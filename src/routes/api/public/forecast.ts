import { createFileRoute } from "@tanstack/react-router";
import { forecastSeries, haversineKm } from "@/lib/analytics";

type Phc = {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
};

/**
 * Forecasting engine.
 * Fits quantity = a*day + b by ordinary least squares for every PHC-medicine
 * pair, solves for the zero crossing, writes alerts, and proposes a transfer
 * from the nearest surplus centre for every critical pair.
 * Safe to run on a schedule (pg_cron) or on demand from the dashboard.
 */
export const Route = createFileRoute("/api/public/forecast")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const since = new Date(Date.now() - 45 * 864e5).toISOString();

        const [phcRes, medRes, stockRes] = await Promise.all([
          supabaseAdmin.from("phcs").select("id,name,district,state,lat,lng"),
          supabaseAdmin.from("medicines").select("id,name,unit"),
          supabaseAdmin
            .from("stock_entries")
            .select("phc_id,medicine_id,quantity,recorded_at")
            .gte("recorded_at", since)
            .order("recorded_at", { ascending: true })
            .limit(50000),
        ]);

        const phcs = (phcRes.data ?? []) as Phc[];
        const medicines = (medRes.data ?? []) as { id: string; name: string }[];
        const stock = stockRes.data ?? [];
        const phcById = new Map(phcs.map((p) => [p.id, p]));
        const medById = new Map(medicines.map((m) => [m.id, m.name]));

        const grouped = new Map<string, number[]>();
        for (const row of stock) {
          const key = `${row.phc_id}|${row.medicine_id}`;
          const list = grouped.get(key);
          if (list) list.push(row.quantity);
          else grouped.set(key, [row.quantity]);
        }

        type Pair = {
          phc_id: string;
          medicine_id: string;
          days: number;
          qty: number;
          severity: string;
        };
        const pairs: Pair[] = [];
        for (const [key, values] of grouped) {
          const [phc_id, medicine_id] = key.split("|") as [string, string];
          const f = forecastSeries(values);
          pairs.push({
            phc_id,
            medicine_id,
            days: Number(f.daysRemaining.toFixed(2)),
            qty: f.latestQty,
            severity: f.severity,
          });
        }

        // Refresh the alert board.
        await supabaseAdmin
          .from("alerts")
          .update({ resolved: true })
          .eq("resolved", false);

        const flagged = pairs.filter((p) => p.severity !== "healthy");
        if (flagged.length) {
          await supabaseAdmin.from("alerts").insert(
            flagged.map((p) => ({
              phc_id: p.phc_id,
              medicine_id: p.medicine_id,
              severity: p.severity,
              days_remaining: p.days,
            })),
          );
        }

        // Redistribution proposals for critical pairs.
        const critical = flagged.filter((p) => p.severity === "critical");
        const { data: pending } = await supabaseAdmin
          .from("redistribution_requests")
          .select("to_phc_id,medicine_id,status")
          .eq("status", "pending");
        const pendingKeys = new Set(
          (pending ?? []).map((r) => `${r.to_phc_id}|${r.medicine_id}`),
        );

        const proposals: {
          from_phc_id: string;
          to_phc_id: string;
          medicine_id: string;
          units: number;
          distance_km: number;
        }[] = [];

        for (const c of critical) {
          if (pendingKeys.has(`${c.phc_id}|${c.medicine_id}`)) continue;
          const target = phcById.get(c.phc_id);
          if (!target) continue;
          const surplus = pairs
            .filter(
              (p) =>
                p.medicine_id === c.medicine_id &&
                p.phc_id !== c.phc_id &&
                p.days > 14 &&
                p.qty > 0,
            )
            .map((p) => {
              const from = phcById.get(p.phc_id)!;
              return {
                pair: p,
                from,
                distance: haversineKm(target.lat, target.lng, from.lat, from.lng),
              };
            })
            .filter((s) => s.from)
            .sort((a, b) => a.distance - b.distance)[0];
          if (!surplus) continue;
          proposals.push({
            from_phc_id: surplus.from.id,
            to_phc_id: c.phc_id,
            medicine_id: c.medicine_id,
            units: Math.max(10, Math.round(surplus.pair.qty * 0.2)),
            distance_km: Number(surplus.distance.toFixed(1)),
          });
          pendingKeys.add(`${c.phc_id}|${c.medicine_id}`);
        }

        if (proposals.length) {
          await supabaseAdmin.from("redistribution_requests").insert(proposals);
        }

        const auditRows = [
          {
            user_id: null,
            action: "forecast_run",
            details: `Least-squares forecast over ${pairs.length} PHC-medicine pairs: ${critical.length} critical, ${flagged.length - critical.length} low-stock warnings.`,
          },
          ...flagged.map((p) => ({
            user_id: null,
            action: p.severity === "critical" ? "alert_critical" : "alert_warning",
            details: `${medById.get(p.medicine_id) ?? "medicine"} at ${phcById.get(p.phc_id)?.name ?? "PHC"} — ${p.days.toFixed(1)} days of supply left (current stock ${p.qty}).`,
          })),
          ...proposals.map((p) => ({
            user_id: null,
            action: "redistribution_proposed",
            details: `${p.units} units of ${medById.get(p.medicine_id) ?? "medicine"} proposed from ${phcById.get(p.from_phc_id)?.name} to ${phcById.get(p.to_phc_id)?.name} over ${p.distance_km} km.`,
          })),
        ];
        await supabaseAdmin.from("audit_log").insert(auditRows);

        return new Response(
          JSON.stringify({
            success: true,
            pairs: pairs.length,
            critical: critical.length,
            warnings: flagged.length - critical.length,
            proposals: proposals.length,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
