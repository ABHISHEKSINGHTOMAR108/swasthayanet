import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BedDouble,
  Building2,
  HeartPulse,
  Info,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { AlertsFeed, useAlerts } from "@/components/AlertsFeed";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import {
  buildForecasts,
  fetchNetwork,
  latestBy,
  stockHealthPct,
} from "@/lib/network";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Network dashboard · SwasthyaNet" },
      {
        name: "description",
        content:
          "Live medicine stock health, bed availability and critical shortage alerts across the national PHC network.",
      },
      { property: "og:title", content: "Network dashboard · SwasthyaNet" },
      {
        property: "og:description",
        content: "Live stock, bed and alert status across every Primary Health Centre.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["network"],
    queryFn: fetchNetwork,
  });
  const { data: alerts } = useAlerts();

  const view = useMemo(() => {
    if (!data) return null;
    const scoped =
      profile?.role === "staff" && profile.phc_id
        ? data.phcs.filter((p) => p.id === profile.phc_id)
        : profile?.role === "officer" && profile.state
          ? data.phcs.filter((p) => p.state === profile.state)
          : data.phcs;
    const ids = new Set(scoped.map((p) => p.id));
    const forecasts = buildForecasts(data).filter((f) => ids.has(f.phc_id));
    const beds = latestBy(data.beds);
    const attendance = latestBy(data.attendance);
    const bedsAvailable = scoped.reduce(
      (sum, p) => sum + Math.max(0, p.beds_total - (beds.get(p.id)?.beds_occupied ?? 0)),
      0,
    );
    const bedsTotal = scoped.reduce((s, p) => s + p.beds_total, 0);

    const byState = new Map<string, { critical: number; warning: number; total: number }>();
    for (const p of scoped) {
      const row = byState.get(p.state) ?? { critical: 0, warning: 0, total: 0 };
      const fs = forecasts.filter((f) => f.phc_id === p.id);
      row.critical += fs.filter((f) => f.severity === "critical").length;
      row.warning += fs.filter((f) => f.severity === "warning").length;
      row.total += fs.length;
      byState.set(p.state, row);
    }

    return {
      scoped,
      forecasts,
      beds,
      attendance,
      bedsAvailable,
      bedsTotal,
      byState: [...byState.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [data, profile]);

  const scopedAlerts = useMemo(() => {
    if (!alerts || !view) return [];
    const ids = new Set(view.scoped.map((p) => p.id));
    return alerts.filter((a) => ids.has(a.phc_id));
  }, [alerts, view]);

  const phcName = (id: string) =>
    data?.phcs.find((p) => p.id === id)?.name ?? "Unknown PHC";
  const medName = (id: string) =>
    data?.medicines.find((m) => m.id === id)?.name ?? "Medicine";

  async function runForecast() {
    setRunning(true);
    try {
      const res = await fetch("/api/public/forecast", { method: "POST" });
      const json = (await res.json()) as {
        success?: boolean;
        critical?: number;
        warnings?: number;
        proposals?: number;
        pairs?: number;
      };
      if (!res.ok || !json.success) throw new Error("Forecast run failed");
      toast.success(
        `Forecast complete — ${json.critical} critical, ${json.warnings} low-stock, ${json.proposals} transfers proposed across ${json.pairs} pairs.`,
      );
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Forecast run failed");
    } finally {
      setRunning(false);
    }
  }

  const criticalCount = scopedAlerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            {profile?.role === "admin"
              ? "National network"
              : profile?.role === "officer"
                ? `${profile.state ?? "State"} network`
                : "My health centre"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile ? ROLE_LABEL[profile.role] : ""} view · live from the field
          </p>
        </div>
        <Button onClick={runForecast} disabled={running}>
          <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Forecasting…" : "Run forecast"}
        </Button>
      </div>

      {isLoading || !view ? (
        <p className="text-sm text-muted-foreground">Loading live network data…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="PHCs monitored"
              value={view.scoped.length}
              sub={`${new Set(view.scoped.map((p) => p.state)).size} states`}
              icon={<Building2 className="size-4" />}
            />
            <StatCard
              label="Critical alerts"
              value={criticalCount}
              sub={`${scopedAlerts.length - criticalCount} low-stock warnings`}
              tone={criticalCount ? "critical" : "success"}
              icon={<AlertTriangle className="size-4" />}
            />
            <StatCard
              label="Avg stock health"
              value={`${stockHealthPct(view.forecasts).toFixed(0)}%`}
              sub="pairs with >7 days of supply"
              tone="success"
              icon={<HeartPulse className="size-4" />}
            />
            <StatCard
              label="Beds available"
              value={view.bedsAvailable}
              sub={`of ${view.bedsTotal} total`}
              icon={<BedDouble className="size-4" />}
            />
          </div>

          <section>
            <h2 className="font-display text-xl font-semibold">State status</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {view.byState.map(([state, s]) => {
                const tone =
                  s.critical > 0
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : s.warning > 0
                      ? "bg-warning/15 text-warning-foreground border-warning/40"
                      : "bg-success/10 text-success border-success/30";
                return (
                  <span
                    key={state}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${tone}`}
                  >
                    {state} · {s.critical} critical / {s.warning} low
                  </span>
                );
              })}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section>
              <h2 className="font-display text-xl font-semibold">Health centres</h2>
              <div className="surface mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Centre</th>
                      <th className="px-4 py-3">State</th>
                      <th className="px-4 py-3">Beds</th>
                      <th className="px-4 py-3">Staff</th>
                      <th className="px-4 py-3">Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {view.scoped.map((p) => {
                      const fs = view.forecasts.filter((f) => f.phc_id === p.id);
                      const crit = fs.filter((f) => f.severity === "critical").length;
                      const warn = fs.filter((f) => f.severity === "warning").length;
                      const occ = view.beds.get(p.id)?.beds_occupied ?? 0;
                      const att = view.attendance.get(p.id)?.staff_present_pct;
                      return (
                        <tr key={p.id} className="hover:bg-secondary/40">
                          <td className="px-4 py-3">
                            <Link
                              to="/phc/$phcId"
                              params={{ phcId: p.id }}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {p.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">{p.district}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.state}</td>
                          <td className="px-4 py-3">
                            {p.beds_total - occ}/{p.beds_total}
                          </td>
                          <td className="px-4 py-3">
                            {att != null ? `${Number(att).toFixed(0)}%` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {crit > 0 ? (
                              <span className="font-medium text-destructive">
                                {crit} critical
                              </span>
                            ) : warn > 0 ? (
                              <span className="font-medium text-warning">{warn} low</span>
                            ) : (
                              <span className="text-success">Healthy</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-display text-xl font-semibold">Early warning feed</h2>
              <AlertsFeed
                alerts={scopedAlerts}
                phcName={phcName}
                medicineName={medName}
              />

              <div className="surface p-5">
                <div className="flex items-center gap-2">
                  <Info className="size-4 text-primary" />
                  <h3 className="font-display text-base font-semibold">About the model</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  For every PHC-medicine pair we fit a straight line{" "}
                  <code className="rounded bg-secondary px-1">quantity = a·day + b</code>{" "}
                  to the last 30 days of recorded stock using{" "}
                  <strong>ordinary least-squares linear regression</strong>. The
                  projected stock-out day is the solution of{" "}
                  <code className="rounded bg-secondary px-1">a·day + b = 0</code>, and
                  days-of-supply is that day minus today. Below 3 days raises a
                  critical alert, below 7 a low-stock warning. A non-negative slope
                  means consumption is not outpacing resupply, so no stock-out is
                  projected. Nothing is hidden — the same arithmetic runs in the
                  browser and in the scheduled server job.
                </p>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
