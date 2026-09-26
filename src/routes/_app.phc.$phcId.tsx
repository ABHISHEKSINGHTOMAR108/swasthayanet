import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { buildForecasts, fetchNetwork, latestBy } from "@/lib/network";
import { formatTransit } from "@/lib/analytics";
import { nearestSurplus } from "@/lib/network";

export const Route = createFileRoute("/_app/phc/$phcId")({
  head: () => ({
    meta: [
      { title: "Health centre detail · SwasthyaNet" },
      {
        name: "description",
        content:
          "Current stock, bed occupancy, staff attendance and a 30-day trend for a single Primary Health Centre.",
      },
      { property: "og:title", content: "Health centre detail · SwasthyaNet" },
      {
        property: "og:description",
        content: "30-day stock trends and forecast status for one PHC.",
      },
    ],
  }),
  component: PhcDetail,
});

function PhcDetail() {
  const { phcId } = Route.useParams();
  const { data } = useQuery({ queryKey: ["network"], queryFn: fetchNetwork });
  const [selected, setSelected] = useState<string | null>(null);

  const view = useMemo(() => {
    if (!data) return null;
    const phc = data.phcs.find((p) => p.id === phcId);
    if (!phc) return null;
    const all = buildForecasts(data);
    const forecasts = all.filter((f) => f.phc_id === phcId);
    const beds = latestBy(data.beds).get(phcId);
    const att = latestBy(data.attendance).get(phcId);
    return { phc, forecasts, all, beds, att };
  }, [data, phcId]);

  if (!view) {
    return <p className="text-sm text-muted-foreground">Loading health centre…</p>;
  }

  const activeMedId = selected ?? view.forecasts[0]?.medicine_id ?? null;
  const active = view.forecasts.find((f) => f.medicine_id === activeMedId);
  const medName = (id: string) =>
    data?.medicines.find((m) => m.id === id)?.name ?? "Medicine";

  const suggestions =
    active && active.severity !== "healthy" && data
      ? nearestSurplus(view.phc, active.medicine_id, view.all, data.phcs).slice(0, 3)
      : [];

  return (
    <div className="space-y-6">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to dashboard
      </Link>

      <div>
        <h1 className="font-display text-3xl font-semibold">{view.phc.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {view.phc.district}, {view.phc.state} · {view.phc.lat.toFixed(4)},{" "}
          {view.phc.lng.toFixed(4)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Beds available"
          value={`${view.phc.beds_total - (view.beds?.beds_occupied ?? 0)}/${view.phc.beds_total}`}
          sub={`${view.beds?.beds_occupied ?? 0} occupied`}
        />
        <StatCard
          label="Staff present"
          value={view.att ? `${Number(view.att.staff_present_pct).toFixed(0)}%` : "—"}
          sub="latest attendance report"
        />
        <StatCard
          label="Medicines at risk"
          value={view.forecasts.filter((f) => f.severity !== "healthy").length}
          tone={
            view.forecasts.some((f) => f.severity === "critical") ? "critical" : "success"
          }
          sub={`of ${view.forecasts.length} tracked`}
        />
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold">Current stock &amp; forecast</h2>
        <div className="surface mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Daily trend</th>
                <th className="px-4 py-3">Days of supply</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {view.forecasts.map((f) => (
                <tr
                  key={f.medicine_id}
                  onClick={() => setSelected(f.medicine_id)}
                  className={`cursor-pointer hover:bg-secondary/40 ${
                    f.medicine_id === activeMedId ? "bg-secondary/50" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{medName(f.medicine_id)}</td>
                  <td className="px-4 py-3">{f.latestQty}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {f.model.a.toFixed(1)} / day
                  </td>
                  <td className="px-4 py-3">
                    {f.daysRemaining >= 999 ? "No stock-out projected" : f.daysRemaining.toFixed(1)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        f.severity === "critical"
                          ? "font-medium text-destructive"
                          : f.severity === "warning"
                            ? "font-medium text-warning"
                            : "text-success"
                      }
                    >
                      {f.severity === "critical"
                        ? "Critical"
                        : f.severity === "warning"
                          ? "Low"
                          : "Healthy"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {active && (
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="surface p-5">
            <h2 className="font-display text-lg font-semibold">
              30-day trend — {medName(active.medicine_id)}
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={active.series.map((s, i) => ({
                    ...s,
                    fit: Math.max(0, active.model.a * i + active.model.b),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11 }} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="quantity"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    name="Recorded stock"
                  />
                  <Line
                    type="monotone"
                    dataKey="fit"
                    stroke="var(--chart-2)"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    dot={false}
                    name="Least-squares fit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface p-5">
            <h2 className="font-display text-lg font-semibold">Nearest surplus centres</h2>
            {suggestions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                This medicine is not at risk here, so no transfer is needed.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {suggestions.map((s) => (
                  <li key={s.phc.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{s.phc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.distanceKm.toFixed(1)} km · approx {formatTransit(s.distanceKm)} by
                      road at 45 km/h
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.forecast.latestQty} units in stock ·{" "}
                      {s.forecast.daysRemaining >= 999
                        ? "stable supply"
                        : `${s.forecast.daysRemaining.toFixed(0)} days of cover`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
