import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/entry")({
  head: () => ({
    meta: [
      { title: "Daily entry · SwasthyaNet" },
      {
        name: "description",
        content:
          "Record today's medicine stock, bed occupancy and staff attendance for your Primary Health Centre.",
      },
      { property: "og:title", content: "Daily entry · SwasthyaNet" },
      {
        property: "og:description",
        content: "Field data entry for PHC staff.",
      },
    ],
  }),
  component: EntryPage,
});

const schema = z.object({
  medicineId: z.string().uuid("Choose a medicine"),
  quantity: z.coerce.number().int().min(0).max(1000000),
  bedsOccupied: z.coerce.number().int().min(0).max(5000),
  staffPct: z.coerce.number().min(0).max(100),
});

function EntryPage() {
  const { profile, user } = useAuth();
  const qc = useQueryClient();
  const phcId = profile?.phc_id ?? null;

  const [medicineId, setMedicineId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [bedsOccupied, setBedsOccupied] = useState("");
  const [staffPct, setStaffPct] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: medicines } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data } = await supabase.from("medicines").select("id,name,unit").order("name");
      return data ?? [];
    },
  });

  const { data: phc } = useQuery({
    enabled: !!phcId,
    queryKey: ["phc", phcId],
    queryFn: async () => {
      const { data } = await supabase.from("phcs").select("*").eq("id", phcId!).maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    enabled: !!phcId,
    queryKey: ["entry-history", phcId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_entries")
        .select("id,quantity,recorded_at,medicine_id")
        .eq("phc_id", phcId!)
        .order("recorded_at", { ascending: false })
        .limit(25);
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!phcId) {
      toast.error("Your account is not linked to a health centre yet.");
      return;
    }
    const parsed = schema.safeParse({ medicineId, quantity, bedsOccupied, staffPct });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const results = await Promise.all([
        supabase.from("stock_entries").insert({
          phc_id: phcId,
          medicine_id: parsed.data.medicineId,
          quantity: parsed.data.quantity,
          recorded_at: now,
          recorded_by: user?.id ?? null,
        }),
        supabase.from("bed_status").insert({
          phc_id: phcId,
          beds_occupied: parsed.data.bedsOccupied,
          recorded_at: now,
        }),
        supabase.from("staff_attendance").insert({
          phc_id: phcId,
          staff_present_pct: parsed.data.staffPct,
          recorded_at: now,
        }),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;

      await supabase.from("audit_log").insert({
        user_id: user?.id ?? null,
        action: "daily_entry",
        details: `Recorded ${parsed.data.quantity} units of stock, ${parsed.data.bedsOccupied} beds occupied and ${parsed.data.staffPct}% staff present at ${phc?.name ?? "PHC"}.`,
      });

      toast.success("Entry recorded");
      setQuantity("");
      setBedsOccupied("");
      setStaffPct("");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the entry");
    } finally {
      setBusy(false);
    }
  }

  const medName = (id: string) => medicines?.find((m) => m.id === id)?.name ?? "Medicine";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Daily entry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {phc ? `${phc.name} — ${phc.district}, ${phc.state}` : "No health centre linked to your account"}
        </p>
      </div>

      {!phcId ? (
        <div className="surface p-5 text-sm text-muted-foreground">
          Your account is not assigned to a health centre, so you can view the network
          but not record field data. Officers and administrators monitor and approve
          instead of recording.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <form onSubmit={submit} className="surface space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>Medicine</Label>
              <Select value={medicineId} onValueChange={setMedicineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a medicine" />
                </SelectTrigger>
                <SelectContent>
                  {(medicines ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qty">Stock on hand</Label>
              <Input
                id="qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 420"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beds">Beds occupied</Label>
              <Input
                id="beds"
                inputMode="numeric"
                value={bedsOccupied}
                onChange={(e) => setBedsOccupied(e.target.value)}
                placeholder={phc ? `0 – ${phc.beds_total}` : "0"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff">Staff present (%)</Label>
              <Input
                id="staff"
                inputMode="numeric"
                value={staffPct}
                onChange={(e) => setStaffPct(e.target.value)}
                placeholder="e.g. 85"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Submit today's entry"}
            </Button>
          </form>

          <section>
            <h2 className="font-display text-xl font-semibold">Recent entries</h2>
            <div className="surface mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Recorded</th>
                    <th className="px-4 py-3">Medicine</th>
                    <th className="px-4 py-3">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(history ?? []).map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(h.recorded_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">{medName(h.medicine_id)}</td>
                      <td className="px-4 py-2.5 font-medium">{h.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
