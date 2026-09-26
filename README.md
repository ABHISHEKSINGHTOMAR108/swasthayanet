# SwasthyaNet

**A federated AI platform for national-scale health resource & supply chain resilience.**

Track 3 — Smart Health & Supply Chain Resilience (BRICS theme: Resilience).
Build with AI: Code for Communities — Second Edition.

---

## The problem

Public health systems in developing nations cannot see their own supply chain in
real time. Primary Health Centres (PHCs) run out of essential medicines weeks
before a district office hears about it, beds and staffing are reported on paper,
and there is no mechanism to move surplus stock from one district to a
neighbouring one that is about to run dry.

## What SwasthyaNet does

| Capability | How it actually works |
| --- | --- |
| Field data capture | PHC staff record medicine stock, beds occupied and staff attendance; each submission is a time-series row. |
| Live national dashboard | Every statistic (PHCs monitored, critical alerts, stock health, beds available, state chips) is computed from live database queries, never cached constants. |
| Forecasting | For each PHC-medicine pair, ordinary least squares fits `quantity = a·day + b` over the recorded history. The projected stock-out day is the solution of `a·day + b = 0`; days-of-supply is that day minus today. |
| Early warning | Under 3 days of supply → critical alert; under 7 days → low-stock warning. Alerts stream to the dashboard over Realtime, with an explicit healthy state. |
| Redistribution | For each critical pair, every centre with more than 14 days of cover is ranked by **haversine** great-circle distance from the centre in need. The nearest becomes an automatic transfer proposal with transit time = distance / 45 km/h. Officers approve or reject; status propagates live. |
| BRICS federated learning | The network is split into 5 synthetic national partitions. Each fits the same model on its own data; the five coefficient pairs are averaged (federated averaging) into one global model. Both the local and global models are scored by mean absolute error on held-out recent days, and the accuracy improvement shown in the UI is recomputed from current data every time the page loads. |
| Audit log | Every forecast run, alert, transfer proposal and approval/rejection is written with actor, timestamp and the triggering numbers. |

## Roles

| Role | Sees | Can do |
| --- | --- | --- |
| PHC Staff | Their own centre | Record daily stock / beds / attendance (row-level security blocks writes for any other centre) |
| District / State Officer | Every centre in their state | Approve or reject redistribution requests |
| National Admin | The whole network | Run forecasts, view the audit trail and the BRICS federation panel |

## Architecture

```
React 19 + TanStack Start (SSR) + Tailwind v4 + Recharts
        │
        ├── Supabase Auth (email/password, role in profiles + user_roles)
        ├── Supabase Postgres + Row Level Security
        ├── Supabase Realtime  → alerts & redistribution_requests
        └── POST /api/public/forecast  (server route, service role)
                 ├── least-squares forecast per PHC-medicine pair
                 ├── writes alerts
                 ├── haversine ranking → redistribution proposals
                 └── writes audit_log
                 ▲
                 └── pg_cron daily schedule + on-demand "Run forecast" button
```

All forecasting maths lives in `src/lib/analytics.ts` — the *same* pure functions
run in the browser (for charts and the federation panel) and on the server (for
the scheduled job), so what a judge sees on screen is the code that makes the
decisions.

### Database schema

`phcs`, `medicines`, `profiles`, `user_roles`, `stock_entries`, `bed_status`,
`staff_attendance`, `redistribution_requests`, `alerts`, `audit_log`.

Seeded with 18 PHCs across Madhya Pradesh, Rajasthan, Bihar, Maharashtra and
Assam (real city coordinates), 6 essential medicines, and 30 days of stock, bed
and attendance history per centre — so forecasting has genuine history from the
first minute.

### Security

- Roles are stored in a separate `user_roles` table and checked through a
  `SECURITY DEFINER` `has_role()` function — never read from the client.
- `stock_entries`, `bed_status` and `staff_attendance` inserts are constrained by
  RLS to `phc_id = my_phc_id()`.
- Only officers and admins may update `redistribution_requests`.

## Running locally

```bash
bun install
bun run dev      # http://localhost:8080
```

The backend (Postgres, Auth, Realtime) is provisioned by Lovable Cloud; the
client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`.

## Key files

```
src/lib/analytics.ts            least squares, haversine, federated averaging
src/lib/network.ts              live queries + per-pair forecast construction
src/routes/api/public/forecast.ts  scheduled/on-demand forecasting engine
src/routes/_app.dashboard.tsx   national/district dashboard + "About the model"
src/routes/_app.entry.tsx       PHC staff data entry + history
src/routes/_app.phc.$phcId.tsx  drill-down with 30-day trend and fitted line
src/routes/_app.redistribution.tsx  approvals with real distance and transit time
src/routes/_app.federation.tsx  BRICS federated simulation and architecture panel
src/routes/_app.audit.tsx       transparency log
```
