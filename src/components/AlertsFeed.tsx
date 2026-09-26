import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export type AlertRow = {
  id: string;
  phc_id: string;
  medicine_id: string;
  severity: string;
  days_remaining: number;
  created_at: string;
};

export function useAlerts() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id,phc_id,medicine_id,severity,days_remaining,created_at")
        .eq("resolved", false)
        .order("days_remaining", { ascending: true })
        .limit(200);
      return (data ?? []) as AlertRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("alerts-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        () => void qc.invalidateQueries({ queryKey: ["alerts"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  return query;
}

export function AlertsFeed({
  alerts,
  phcName,
  medicineName,
}: {
  alerts: AlertRow[];
  phcName: (id: string) => string;
  medicineName: (id: string) => string;
}) {
  if (!alerts.length) {
    return (
      <div className="surface flex items-center gap-3 p-5">
        <ShieldCheck className="size-5 text-success" />
        <div>
          <p className="font-medium">No critical shortages</p>
          <p className="text-sm text-muted-foreground">
            Every centre in view has more than 7 days of projected supply.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface divide-y divide-border overflow-hidden">
      {alerts.map((a) => {
        const critical = a.severity === "critical";
        return (
          <div key={a.id} className="flex items-start gap-3 p-4">
            <AlertTriangle
              className={`mt-0.5 size-4 shrink-0 ${critical ? "text-destructive" : "text-warning"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {medicineName(a.medicine_id)} · {phcName(a.phc_id)}
              </p>
              <p className="text-xs text-muted-foreground">
                {a.days_remaining.toFixed(1)} days of supply left ·{" "}
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                critical
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/15 text-warning-foreground"
              }`}
            >
              {critical ? "Critical" : "Low"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
