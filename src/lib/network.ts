import { supabase } from "@/integrations/supabase/client";
import {
  forecastSeries,
  haversineKm,
  type Forecast,
} from "@/lib/analytics";

export type Phc = {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  beds_total: number;
};

export type Medicine = { id: string; name: string; unit: string };

export type StockEntry = {
  phc_id: string;
  medicine_id: string;
  quantity: number;
  recorded_at: string;
};

export type NetworkSnapshot = {
  phcs: Phc[];
  medicines: Medicine[];
  entries: StockEntry[];
  beds: { phc_id: string; beds_occupied: number; recorded_at: string }[];
  attendance: { phc_id: string; staff_present_pct: number; recorded_at: string }[];
};

export async function fetchNetwork(): Promise<NetworkSnapshot> {
  const since = new Date(Date.now() - 45 * 864e5).toISOString();
  const [phcs, medicines, entries, beds, attendance] = await Promise.all([
    supabase.from("phcs").select("*").order("state").order("name"),
    supabase.from("medicines").select("id,name,unit").order("name"),
    supabase
      .from("stock_entries")
      .select("phc_id,medicine_id,quantity,recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at")
      .limit(20000),
    supabase
      .from("bed_status")
      .select("phc_id,beds_occupied,recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at")
      .limit(5000),
    supabase
      .from("staff_attendance")
      .select("phc_id,staff_present_pct,recorded_at")
      .gte("recorded_at", since)
      .order("recorded_at")
      .limit(5000),
  ]);

  return {
    phcs: (phcs.data ?? []) as Phc[],
    medicines: (medicines.data ?? []) as Medicine[],
    entries: (entries.data ?? []) as StockEntry[],
    beds: (beds.data ?? []) as NetworkSnapshot["beds"],
    attendance: (attendance.data ?? []) as NetworkSnapshot["attendance"],
  };
}

export type PairForecast = Forecast & {
  phc_id: string;
  medicine_id: string;
  series: { day: string; quantity: number }[];
};

export function buildForecasts(snap: NetworkSnapshot): PairForecast[] {
  const grouped = new Map<string, StockEntry[]>();
  for (const e of snap.entries) {
    const key = `${e.phc_id}|${e.medicine_id}`;
    const list = grouped.get(key);
    if (list) list.push(e);
    else grouped.set(key, [e]);
  }
  const out: PairForecast[] = [];
  for (const [key, list] of grouped) {
    list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    const [phc_id, medicine_id] = key.split("|") as [string, string];
    const f = forecastSeries(list.map((e) => e.quantity));
    out.push({
      ...f,
      phc_id,
      medicine_id,
      series: list.map((e) => ({
        day: e.recorded_at.slice(0, 10),
        quantity: e.quantity,
      })),
    });
  }
  return out;
}

export function latestBy<T extends { phc_id: string; recorded_at: string }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) {
    const cur = map.get(r.phc_id);
    if (!cur || cur.recorded_at < r.recorded_at) map.set(r.phc_id, r);
  }
  return map;
}

/** Stock health = share of PHC-medicine pairs with more than 7 days of supply. */
export function stockHealthPct(forecasts: PairForecast[]) {
  if (!forecasts.length) return 0;
  const ok = forecasts.filter((f) => f.severity === "healthy").length;
  return (ok / forecasts.length) * 100;
}

export function nearestSurplus(
  target: Phc,
  medicineId: string,
  forecasts: PairForecast[],
  phcs: Phc[],
) {
  const byId = new Map(phcs.map((p) => [p.id, p]));
  const candidates = forecasts
    .filter(
      (f) =>
        f.medicine_id === medicineId &&
        f.phc_id !== target.id &&
        f.daysRemaining > 14 &&
        f.latestQty > 0,
    )
    .map((f) => {
      const p = byId.get(f.phc_id)!;
      return {
        forecast: f,
        phc: p,
        distanceKm: haversineKm(target.lat, target.lng, p.lat, p.lng),
      };
    })
    .filter((c) => c.phc)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return candidates;
}
