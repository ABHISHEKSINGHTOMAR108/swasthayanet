import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Globe2, Lock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { fetchNetwork } from "@/lib/network";
import { runFederatedSimulation, type Series } from "@/lib/analytics";

export const Route = createFileRoute("/_app/federation")({
  head: () => ({
    meta: [
      { title: "BRICS federation · SwasthyaNet" },
      {
        name: "description",
        content:
          "Five national partitions train a local forecasting model; only coefficients are averaged. The accuracy gain is computed live from current data.",
      },
      { property: "og:title", content: "BRICS federation · SwasthyaNet" },
      {
        property: "og:description",
        content:
          "Federated averaging across five national partitions with live-computed accuracy improvement.",
      },
    ],
  }),
  component: FederationPage,
});

function FederationPage() {
  const { data } = useQuery({ queryKey: ["network"], queryFn: fetchNetwork });

  const result = useMemo(() => {
    if (!data) return null;
    // Deterministic split of the network into 5 synthetic national partitions.
    const phcIndex = new Map(data.phcs.map((p, i) => [p.id, i % 5]));
    const grouped = new Map<string, number[]>();
    for (const e of data.entries) {
      const key = `${e.phc_id}|${e.medicine_id}`;
      const list = grouped.get(key);
      if (list) list.push(e.quantity);
      else grouped.set(key, [e.quantity]);
    }
    const series: Series[] = [...grouped.entries()].map(([key, values]) => ({
      key,
      partition: phcIndex.get(key.split("|")[0]!) ?? 0,
      values,
    }));
    return runFederatedSimulation(series, 5);
  }, [data]);

  if (!result) {
    return <p className="text-sm text-muted-foreground">Computing federated models…</p>;
  }

  const chartData = [
    ...result.partitions.map((p) => ({
      name: p.label.split(" ")[0]!,
      mae: Number(p.localMae.toFixed(4)),
      federated: false,
    })),
    { name: "Federated", mae: Number(result.globalMae.toFixed(4)), federated: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">BRICS federated learning</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The network is split into five synthetic national partitions. Each trains
          the same least-squares forecasting model on its own data only. The five
          sets of coefficients are then averaged into one global model — classic
          federated averaging. No stock record, patient record or PHC identity ever
          leaves a partition.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Accuracy improvement"
          value={`${result.improvementPct.toFixed(1)}%`}
          sub="federated vs. average single-nation model"
          tone={result.improvementPct >= 0 ? "success" : "critical"}
          icon={<Globe2 className="size-4" />}
        />
        <StatCard
          label="Federated model error"
          value={result.globalMae.toFixed(4)}
          sub="mean absolute error, normalised units"
        />
        <StatCard
          label="Avg single-nation error"
          value={result.avgLocalMae.toFixed(4)}
          sub="same held-out network data"
        />
        <StatCard
          label="Series in the simulation"
          value={result.totalSeries}
          sub={`last ${result.heldOutDays} days held out`}
        />
      </div>

      <div className="surface p-5">
        <h2 className="font-display text-xl font-semibold">
          Prediction error on held-out network data
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lower is better. Each national model is evaluated against the whole
          network's held-out days, which is what a single nation forecasting alone
          would face.
        </p>
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={60} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="mae" radius={[6, 6, 0, 0]}>
                {chartData.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.federated ? "var(--chart-4)" : "var(--chart-1)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Node</th>
                <th className="px-4 py-3">Series</th>
                <th className="px-4 py-3">slope a</th>
                <th className="px-4 py-3">intercept b</th>
                <th className="px-4 py-3">Network MAE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.partitions.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-medium">{p.label}</td>
                  <td className="px-4 py-2.5">{p.seriesCount}</td>
                  <td className="px-4 py-2.5">{p.model.a.toFixed(5)}</td>
                  <td className="px-4 py-2.5">{p.model.b.toFixed(4)}</td>
                  <td className="px-4 py-2.5">{p.localMae.toFixed(4)}</td>
                </tr>
              ))}
              <tr className="bg-success/10">
                <td className="px-4 py-2.5 font-semibold">Global (averaged)</td>
                <td className="px-4 py-2.5">{result.totalSeries}</td>
                <td className="px-4 py-2.5">{result.globalModel.a.toFixed(5)}</td>
                <td className="px-4 py-2.5">{result.globalModel.b.toFixed(4)}</td>
                <td className="px-4 py-2.5 font-semibold">
                  {result.globalMae.toFixed(4)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="surface p-5">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">
              What crosses the border
            </h2>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-secondary/60 p-4 text-[11px] leading-relaxed text-foreground">
{`   Brazil        Russia        India        China     S. Africa
  ┌───────┐     ┌───────┐     ┌───────┐   ┌───────┐   ┌───────┐
  │ local │     │ local │     │ local │   │ local │   │ local │
  │ stock │     │ stock │     │ stock │   │ stock │   │ stock │
  │  data │     │  data │     │  data │   │  data │   │  data │
  └───┬───┘     └───┬───┘     └───┬───┘   └───┬───┘   └───┬───┘
      │ (a,b)       │ (a,b)       │ (a,b)     │ (a,b)     │ (a,b)
      └─────────────┴──────┬──────┴───────────┴───────────┘
                           ▼
                 ┌──────────────────┐
                 │   AGGREGATOR     │   global a = mean(a_i)
                 │ federated average│   global b = mean(b_i)
                 └────────┬─────────┘
                          │ global model returned to every node
      ┌───────────────────┴───────────────────┐
      ▼                                       ▼
  better forecasts                     zero raw records shared`}
          </pre>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Only two numbers per node — the slope and the intercept of the fitted
            line — are transmitted. Those coefficients cannot be inverted back into
            individual stock records, so a nation's supply chain and patient data
            stay inside its own borders while every participant gets a model trained
            on the combined signal.
          </p>
        </div>
      </div>
    </div>
  );
}
