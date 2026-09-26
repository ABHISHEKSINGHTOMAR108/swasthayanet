/**
 * SwasthyaNet forecasting + logistics maths.
 * Everything here is plain, auditable arithmetic — no black boxes.
 */

export type Point = { x: number; y: number };

export type LinearModel = { a: number; b: number; n: number };

/** Ordinary least squares fit of y = a*x + b. */
export function ols(points: Point[]): LinearModel {
  const n = points.length;
  if (n < 2) return { a: 0, b: n === 1 ? points[0]!.y : 0, n };
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { a: 0, b: sy / n, n };
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  return { a, b, n };
}

export function predict(model: LinearModel, x: number) {
  return model.a * x + model.b;
}

export type Forecast = {
  model: LinearModel;
  latestQty: number;
  daysRemaining: number; // days until projected stock-out (capped at 999)
  severity: "critical" | "warning" | "healthy";
};

export const NO_STOCKOUT = 999;

/**
 * Entries must be ordered oldest -> newest. x is the day index.
 */
export function forecastSeries(quantities: number[]): Forecast {
  const points = quantities.map((y, x) => ({ x, y }));
  const model = ols(points);
  const lastX = points.length - 1;
  const latestQty = quantities[lastX] ?? 0;
  let daysRemaining = NO_STOCKOUT;
  if (model.a < -1e-9) {
    // solve a*x + b = 0
    const zeroX = -model.b / model.a;
    daysRemaining = Math.max(0, zeroX - lastX);
  }
  if (latestQty <= 0) daysRemaining = 0;
  if (daysRemaining > NO_STOCKOUT) daysRemaining = NO_STOCKOUT;
  const severity =
    daysRemaining < 3 ? "critical" : daysRemaining < 7 ? "warning" : "healthy";
  return { model, latestQty, daysRemaining, severity };
}

/** Great-circle distance in kilometres. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const AVG_ROAD_SPEED_KMH = 45;

export function transitHours(distanceKm: number) {
  return distanceKm / AVG_ROAD_SPEED_KMH;
}

export function formatTransit(distanceKm: number) {
  const h = transitHours(distanceKm);
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/* ───────────────── Federated learning simulation ───────────────── */

export type Series = { key: string; partition: number; values: number[] };


export type PartitionReport = {
  id: number;
  label: string;
  seriesCount: number;
  model: LinearModel;
  localMae: number; // local model evaluated on the whole network's held-out data
  ownMae: number; // local model on its own held-out data
};

export type FederationOutcome = {
  partitions: PartitionReport[];
  globalModel: LinearModel;
  globalMae: number;
  avgLocalMae: number;
  improvementPct: number;
  heldOutDays: number;
  totalSeries: number;
};

/**
 * Normalise each PHC-medicine series against its own first observation so that
 * coefficients are comparable across medicines with very different volumes.
 */
export function normaliseSeries(values: number[]): number[] | null {
  const base = values[0];
  if (!base || base <= 0) return null;
  return values.map((v) => v / base);
}

export function runFederatedSimulation(
  series: Series[],
  heldOutDays = 5,
): FederationOutcome {
  const prepared = series
    .map((s) => {
      const norm = normaliseSeries(s.values);
      return norm ? { ...s, values: norm } : null;
    })
    .filter((s): s is Series => s !== null && s.values.length > heldOutDays + 3);

  const partitionIds = [...new Set(prepared.map((s) => s.partition))].sort();

  const trainPoints = (s: Series): Point[] =>
    s.values.slice(0, s.values.length - heldOutDays).map((y, x) => ({ x, y }));
  const testPoints = (s: Series): Point[] =>
    s.values
      .map((y, x) => ({ x, y }))
      .slice(s.values.length - heldOutDays);

  const allTest = prepared.flatMap(testPoints);

  const mae = (model: LinearModel, pts: Point[]) =>
    pts.length === 0
      ? 0
      : pts.reduce((acc, p) => acc + Math.abs(predict(model, p.x) - p.y), 0) /
        pts.length;

  const partitions: PartitionReport[] = partitionIds.map((id) => {
    const mine = prepared.filter((s) => s.partition === id);
    const model = ols(mine.flatMap(trainPoints));
    return {
      id,
      label: BRICS_NATIONS[id] ?? `Partition ${id + 1}`,
      seriesCount: mine.length,
      model,
      localMae: mae(model, allTest),
      ownMae: mae(model, mine.flatMap(testPoints)),
    };
  });

  // True federated averaging: mean of the partitions' coefficients.
  const globalModel: LinearModel = {
    a: partitions.reduce((s, p) => s + p.model.a, 0) / (partitions.length || 1),
    b: partitions.reduce((s, p) => s + p.model.b, 0) / (partitions.length || 1),
    n: partitions.reduce((s, p) => s + p.model.n, 0),
  };

  const globalMae = mae(globalModel, allTest);
  const avgLocalMae =
    partitions.reduce((s, p) => s + p.localMae, 0) / (partitions.length || 1);
  const improvementPct =
    avgLocalMae > 0 ? ((avgLocalMae - globalMae) / avgLocalMae) * 100 : 0;

  return {
    partitions,
    globalModel,
    globalMae,
    avgLocalMae,
    improvementPct,
    heldOutDays,
    totalSeries: prepared.length,
  };
}

export const BRICS_NATIONS = [
  "Brazil (node B)",
  "Russia (node R)",
  "India (node I)",
  "China (node C)",
  "South Africa (node S)",
];
