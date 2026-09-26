import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/audit")({
  head: () => ({
    meta: [
      { title: "Audit log · SwasthyaNet" },
      {
        name: "description",
        content:
          "Every alert, forecast run and redistribution decision recorded with actor, timestamp and the data that triggered it.",
      },
      { property: "og:title", content: "Audit log · SwasthyaNet" },
      {
        property: "og:description",
        content: "Full transparency trail of alerts and redistribution decisions.",
      },
    ],
  }),
  component: AuditPage,
});

const LABEL: Record<string, string> = {
  forecast_run: "Forecast run",
  alert_critical: "Critical alert",
  alert_warning: "Low-stock warning",
  redistribution_proposed: "Transfer proposed",
  redistribution_approved: "Transfer approved",
  redistribution_rejected: "Transfer rejected",
  daily_entry: "Field data entry",
};

function AuditPage() {
  const { data } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_log")
        .select("id,user_id,action,details,created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Audit &amp; transparency log</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Every automated alert and every human decision is recorded here with the
          triggering data, so any recommendation the platform makes can be traced
          back and explained.
        </p>
      </div>

      <div className="surface divide-y divide-border">
        {(data ?? []).length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">
            Nothing logged yet. Run a forecast from the dashboard to populate the
            trail.
          </p>
        )}
        {(data ?? []).map((row) => (
          <div key={row.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
            <div className="shrink-0 sm:w-56">
              <p className="text-sm font-medium">{LABEL[row.action] ?? row.action}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(row.created_at).toLocaleString()}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{row.details}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
