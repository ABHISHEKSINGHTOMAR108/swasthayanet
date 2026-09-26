import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Building2,
  Globe2,
  LineChart,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SwasthyaNet — Federated health supply chain resilience" },
      {
        name: "description",
        content:
          "Real-time medicine stock, bed and staff visibility across a national PHC network, with least-squares stock-out forecasting, automated cross-district redistribution and BRICS federated learning.",
      },
      {
        property: "og:title",
        content: "SwasthyaNet — Federated health supply chain resilience",
      },
      {
        property: "og:description",
        content:
          "Forecast stock-outs, redistribute supplies across districts and train shared models across nations without sharing raw data.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Building2,
    title: "Live PHC telemetry",
    body: "Daily medicine stock, bed occupancy and staff attendance captured at every Primary Health Centre and visible nationally in seconds.",
  },
  {
    icon: LineChart,
    title: "Transparent forecasting",
    body: "Ordinary least-squares regression over 30 days of stock history projects the exact day each medicine hits zero. No black boxes.",
  },
  {
    icon: AlertTriangle,
    title: "Early warning feed",
    body: "Under 3 days of supply raises a critical alert, under 7 a warning — streamed live to district and national officers.",
  },
  {
    icon: Truck,
    title: "Redistribution engine",
    body: "Surplus centres are ranked by great-circle distance; the nearest is proposed automatically with real transit time.",
  },
  {
    icon: Globe2,
    title: "BRICS federated learning",
    body: "Five national partitions train locally; only model coefficients are averaged. Accuracy gain is computed live from your data.",
  },
  {
    icon: Activity,
    title: "Full audit trail",
    body: "Every alert and every approval is logged with actor, timestamp and the data that triggered it.",
  },
];

function Landing() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">SwasthyaNet</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={session ? "/dashboard" : "/auth"}>
            {session ? "Open dashboard" : "Sign in"}
          </Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:pt-16">
          <p className="inline-flex rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Track 3 · Smart Health &amp; Supply Chain Resilience · BRICS
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight md:text-6xl">
            A federated nervous system for national health supply chains.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Primary Health Centres run out of essential medicines long before
            anyone in the capital knows. SwasthyaNet gives an entire PHC network
            real-time stock, bed and staffing visibility, forecasts stock-outs
            before they happen, and moves supplies between districts
            automatically — while allowing nations to improve a shared model
            without ever exchanging raw records.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={session ? "/dashboard" : "/auth"}>
                {session ? "Open dashboard" : "Enter the platform"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/federation">See the federated result</Link>
            </Button>
          </div>
        </section>

        <section className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="surface p-5">
                <f.icon className="size-5 text-primary" />
                <h2 className="mt-3 font-display text-lg font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-2xl font-semibold">Three roles, one network</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              ["PHC Staff", "Record today's stock, beds and staff attendance for your own centre. Nothing else is writable to you."],
              ["District / State Officer", "Monitor every centre in your state and approve or reject proposed transfers."],
              ["National Admin", "Full network view, forecasting runs, audit trail and the BRICS federation panel."],
            ].map(([t, b]) => (
              <div key={t} className="surface p-5">
                <h3 className="font-display text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground">
        SwasthyaNet · Build with AI: Code for Communities — Second Edition
      </footer>
    </div>
  );
}
