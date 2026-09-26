import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatTransit } from "@/lib/analytics";
import { fetchNetwork } from "@/lib/network";

export const Route = createFileRoute("/_app/redistribution")({
  head: () => ({
    meta: [
      { title: "Redistribution · SwasthyaNet" },
      {
        name: "description",
        content:
          "Automated cross-district medicine transfers ranked by great-circle distance, approved or rejected by district officers.",
      },
      { property: "og:title", content: "Redistribution · SwasthyaNet" },
      {
        property: "og:description",
        content: "Approve or reject proposed cross-district medicine transfers.",
      },
    ],
  }),
  component: RedistributionPage,
});

type Req = {
  id: string;
  from_phc_id: string;
  to_phc_id: string;
  medicine_id: string;
  units: number;
  distance_km: number;
  status: string;
  created_at: string;
};

function RedistributionPage() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const canDecide = profile?.role === "officer" || profile?.role === "admin";

  const { data: net } = useQuery({ queryKey: ["network"], queryFn: fetchNetwork });
  const { data: requests } = useQuery({
    queryKey: ["redistribution"],
    queryFn: async () => {
      const { data } = await supabase
        .from("redistribution_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Req[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("redis-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "redistribution_requests" },
        () => void qc.invalidateQueries({ queryKey: ["redistribution"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const phcName = (id: string) => net?.phcs.find((p) => p.id === id)?.name ?? "PHC";
  const medName = (id: string) =>
    net?.medicines.find((m) => m.id === id)?.name ?? "Medicine";

  async function decide(req: Req, status: "approved" | "rejected") {
    const { error } = await supabase
      .from("redistribution_requests")
      .update({ status, approved_by: user?.id ?? null })
      .eq("id", req.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      action: `redistribution_${status}`,
      details: `${req.units} units of ${medName(req.medicine_id)} from ${phcName(req.from_phc_id)} to ${phcName(req.to_phc_id)} (${req.distance_km} km, approx ${formatTransit(Number(req.distance_km))}) ${status} by ${profile?.name || "officer"}.`,
    });
    toast.success(`Transfer ${status}`);
    await qc.invalidateQueries();
  }

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const decided = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Redistribution engine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When a centre goes critical, the nearest centre with more than 14 days of
          cover is found by great-circle (haversine) distance and a transfer is
          proposed automatically. Transit time assumes 45 km/h average road speed.
        </p>
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold">
          Pending approvals ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="surface mt-3 p-5 text-sm text-muted-foreground">
            No transfers awaiting a decision. Run a forecast from the dashboard to
            generate proposals for any critical shortages.
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {pending.map((r) => (
              <div key={r.id} className="surface p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Truck className="size-4" />
                  <span className="text-sm font-semibold">{medName(r.medicine_id)}</span>
                </div>
                <p className="mt-2 text-sm">
                  <strong>{r.units} units</strong> from {phcName(r.from_phc_id)} →{" "}
                  {phcName(r.to_phc_id)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Number(r.distance_km).toFixed(1)} km · estimated transit{" "}
                  {formatTransit(Number(r.distance_km))}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    disabled={!canDecide}
                    onClick={() => decide(r, "approved")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canDecide}
                    onClick={() => decide(r, "rejected")}
                  >
                    Reject
                  </Button>
                </div>
                {!canDecide && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Only district officers and national admins can decide.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Decision history</h2>
        <div className="surface mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Medicine</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {decided.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">{medName(r.medicine_id)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {phcName(r.from_phc_id)} → {phcName(r.to_phc_id)}
                  </td>
                  <td className="px-4 py-2.5">{r.units}</td>
                  <td className="px-4 py-2.5">{Number(r.distance_km).toFixed(1)} km</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        r.status === "approved"
                          ? "font-medium text-success"
                          : "font-medium text-destructive"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {decided.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={5}>
                    No decisions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
