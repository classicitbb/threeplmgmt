# Plan: ML/AI Assist + Command Center Revamp

> **Scope:** Two parallel streams. Stream A adds a learning AI-assist layer that improves operator cues over time. Stream B revamps the Command Center KPIs to eliminate redundancy, add situation awareness, and push plain-language notifications to operators.

---

## Stream A — ML / AI Assist

### What we're building

1. **Pallet Qty Learning** — the system learns the usual `units per pallet` for each product from receiving history and surfaces a suggestion the next time that product is received.
2. **Product Placement Learning** — the system learns which locations products usually land in after putaway and shows a nudge when an operator is about to put a product somewhere unexpected.
3. **Operator Cues** — lightweight, in-context hints appear at the right moment in the receiving and putaway flows without interrupting the workflow.

### Data sources (already exist — no new tables required for MVP)

| Source | What we learn from it |
|---|---|
| `audit_events` (`event_type = 'putaway'`) | `to_location_id`, `pallet_id`, `suggestion_overridden` — tells us where each product actually landed |
| `pallets` → `products` | Joins pallet → product so we know which SKU went where |
| `inventory_balances` (historical picks) | Pick frequency per product → A/B/C velocity class |
| `receipt_lines` | `quantity` per line per receipt — tells us how many units were received per pallet over time |

> **Note:** `receipt_lines` currently stores total `quantity`, not an explicit `quantity_per_pallet` column. The per-pallet qty is computed in `createReceiptFlow` as `quantity_per_pallet` on the UI input. We will add a lightweight `pallet_qty_history` table (see below) to persist this signal across sessions.

### New: `ai_product_hints` Supabase table

```sql
create table ai_product_hints (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references products(id) on delete cascade,
  warehouse_id  uuid references warehouses(id) on delete cascade,
  hint_type     text not null,          -- 'pallet_qty' | 'placement' | 'velocity'
  hint_value    jsonb not null,         -- type-specific payload (see below)
  sample_count  int not null default 1,
  confidence    numeric(4,3),           -- 0.0–1.0
  last_observed_at timestamptz default now(),
  updated_at    timestamptz default now()
);
```

**`hint_value` shapes:**
- `pallet_qty`: `{ "qty": 48, "mode_qty": 48, "p50_qty": 48, "samples": [48, 48, 50, 48] }`
- `placement`: `[{ "location_id": "...", "location_code": "B3-01", "frequency": 12, "last_used_at": "..." }]`
- `velocity`: `{ "class": "A", "picks_last_90d": 84, "avg_picks_per_day": 0.93 }`

### New file: `src/lib/ai-assist.ts`

Core functions (all pure/queryable — no training loop required):

```
getProductPalletQtyHint(productId, warehouseId)
  → { suggestedQty: number, confidence: number, sampleCount: number } | null

getProductPlacementHints(productId, warehouseId)
  → [{ locationId, locationCode, zone, frequency, lastUsedAt, isCurrentSuggestion }]

getProductVelocityClass(productId, warehouseId)
  → { class: 'A'|'B'|'C', picksLast90d: number }

recordPalletQtyObservation(productId, warehouseId, qty)
  → void  (called on receipt confirm)

recordPlacementObservation(productId, warehouseId, locationId, overrideUsed)
  → void  (called inside confirmPutaway — already has the data, just needs to upsert hints)
```

The "learning" is a rolling weighted average + mode detection over the last 50 observations. No external ML service needed — just aggregation over the hint table.

### UI integration points

**A1 — Receiving page (pallet qty suggestion)**

When an operator selects a product in the receipt line form, call `getProductPalletQtyHint`. If a hint exists with `confidence >= 0.6`:
- Show a chip under the `Units per pallet` field: `"Usually 48 units/pallet (last 12 receipts)"`
- Clicking the chip fills the field
- On confirm, call `recordPalletQtyObservation`

**A2 — Putaway task detail (placement nudge)**

On the putaway task screen, after the pallet is scanned, call `getProductPlacementHints`:
- Show a `"Usually stored in: B3-01 (×12), B3-02 (×5)"` info card above the location scan field
- If the `suggested_location_id` on the task already matches the top hint: show `"✓ Matches usual placement"` in muted green
- If the operator scans a *different* location than the top hint (and `confidence >= 0.7`): show a dismissable amber nudge: `"This product usually goes to B3-01 — confirm this location?"`

**A3 — Velocity badge on product detail**

Show A / B / C badge on the product detail page and in inventory search results. Tooltip: `"A-class: 84 picks in the last 90 days"`.

**A4 — `wms-core.ts` hook points**

- Inside `confirmPutaway`: after the audit log call, call `recordPlacementObservation(product.id, warehouseId, location.id, overrideUsed)`
- Inside `createReceiptFlow` / the receiving confirm handler: call `recordPalletQtyObservation(productId, warehouseId, qtyPerPallet)` using the value the operator entered

### Confidence model

```
confidence = min(sampleCount, 20) / 20  ×  agreement_rate
agreement_rate = mode_count / sampleCount
```

Show hints when `confidence >= 0.5`. Show the override nudge only at `>= 0.7`. This means ~10 consistent receipts or ~15 varied ones before any nudge appears — avoiding false signals on sparse data.

---

## Stream B — Command Center KPI Revamp

### Problem with the current KPIs

| Issue | Current state |
|---|---|
| Duplicate capacity signal | `totalPallets` (all warehouses) + `warehousePallets` (current warehouse) both shown as big dials — always on every mode |
| Expiry overlap | `expiryWarning30` is a strict subset of `expiryWarning60` — confuses operators |
| Aging noise | 3 separate aging cards (3mo / 6mo / 12mo) crowd the board with minor increments |
| No throughput signal | No card for tasks completed today — no way to gauge shift productivity |
| Warehouse Brain tile | Recommendations are generic; no urgency hierarchy for operators |
| Notification gap | No persistent, role-filtered notification feed — everything appears as ephemeral toasts |

### Revised KPI card set

Replace `DEFAULT_DASHBOARD_CARDS` with a tighter, non-overlapping set:

| Card ID | Label | Replaces | What it shows |
|---|---|---|---|
| `capacityUtilization` | Capacity | `totalPallets` + `warehousePallets` | `87% full · 124/142 slots` with a fill bar |
| `openReceipts` | Open Receipts | same | unchanged |
| `openPutawayTasks` | Open Put-Away | same | unchanged |
| `openPickLists` | Open Pick Lists | same | unchanged |
| `openMoveTasks` | Open Moves | same | unchanged |
| `expiryRisk` | Expiry Risk | `expiryWarning30` + `expiryWarning60` | `5 expiring in 30d · 14 in 60d` in one card, red/amber colour |
| `stockAgeBand` | Slow Stock | 3 aging cards | Single card: `3mo: 8 · 6mo: 3 · 12mo: 1` with mini spark |
| `exceptionsOpen` | Exceptions | (new) | Held + quarantine + task exceptions summed |
| `throughputToday` | Today's Throughput | (new) | Putaway + picks completed since midnight |

Net: 9 cards down from 11, zero overlap, two new signals operators care about.

### New: Situation Report tile

Replace the "Warehouse Intelligence" and "Warehouse Brain" tiles with a **Situation Report** — a single prose card that describes the warehouse in 2–4 plain sentences, prioritised by urgency.

**`buildSituationReport(snapshot, metrics, role)` in `enterprise-wms.ts`:**

Returns `{ sentences: string[], urgency: 'critical' | 'warning' | 'normal' }`.

Example outputs by situation:

> **Critical:** "3 staging loads are blocked at the dock — drivers are waiting. 2 pallets on quarantine hold need QA sign-off before they can ship."

> **Warning:** "Warehouse is 91% full. 14 pallets are slow-moving stock aged 6+ months — consider overflow or disposal review. 6 lots expire in the next 30 days."

> **Normal:** "Warehouse is running normally. 8 put-away tasks are open, 5 pick lists are in progress. No expiry or hold issues today."

Rule engine (priority-ordered, first applicable rule sets urgency):
1. `blocked dock loads > 0` → critical
2. `quarantine + hold > 10` → critical
3. `expiring in 30d > 0` → warning
4. `fill rate > 90%` → warning
5. `open putaway > 20` → warning
6. `open work > 0` → info ("shift package ready")
7. Default → normal ("running normally")

Each sentence is constructed from metrics with real numbers. No vague language.

The tile renders as a card with a coloured left border (red/amber/green) and the sentences in body text. It replaces both "Warehouse Intelligence" (floor) and "Warehouse Brain" (dock/office) tiles — same component, different mode context.

### New: Notification Panel

A persistent, role-filtered notification feed accessible from a bell icon in the header.

**Architecture:**

```
useWarehouseNotifications(metrics, snapshot, role)
  → { notifications: Notification[], unreadCount: number, dismiss(id), dismissAll() }

type Notification = {
  id: string
  title: string
  body: string          // plain language
  severity: 'critical' | 'warning' | 'info'
  route: string
  generatedAt: Date
  dismissed: boolean
}
```

The hook derives notifications from the same rule engine as the Situation Report but exposes each rule as a discrete item the operator can dismiss. Dismissed state persists in localStorage keyed by `profile.id`.

**`NotificationBell` component** — added to the WMS header:
- Badge shows `unreadCount` (capped at 9+)
- Click opens a `<Sheet>` (`NotificationPanel`) from the right
- Each notification has: coloured severity pill, title, body text, a "Go →" link, dismiss button
- "Clear all" button at top

**Toast escalation:** when a new `critical` notification appears (via the 15s polling refresh), fire a Sonner toast as well so operators who aren't looking at the panel are alerted.

**Role filtering:**
- `warehouse_operator`: only sees task-level items (putaway queue, exceptions, dock calls)
- `warehouse_manager` / `admin`: sees all items
- `inventory_clerk`: sees expiry, hold/quarantine, stock age items

---

## Delivery order

### Phase 1 — Foundation (no visible UI change, just data)
1. Create `ai_product_hints` table in Supabase with RLS
2. Create `src/lib/ai-assist.ts` with all core functions
3. Wire `recordPlacementObservation` into `confirmPutaway`
4. Wire `recordPalletQtyObservation` into the receiving confirm handler

### Phase 2 — Command Center KPI overhaul
5. Revise `DEFAULT_DASHBOARD_CARDS` in `wms-ui.tsx` (consolidate cards as above)
6. Add `getDashboardMetrics` fields: `capacityUtilization`, `expiryRisk`, `stockAgeBand`, `exceptionsOpen`, `throughputToday`
7. Build `buildSituationReport()` in `enterprise-wms.ts`
8. Swap "Warehouse Intelligence" / "Warehouse Brain" tiles for `<SituationReportTile>`

### Phase 3 — Operator cues
9. Pallet qty hint chip in receiving form
10. Placement nudge card in putaway task detail
11. Override confirmation toast when mismatch detected at scan time
12. ABC velocity badge on product detail + inventory search

### Phase 4 — Notification Panel
13. `useWarehouseNotifications()` hook
14. `NotificationBell` + `NotificationPanel` components in header
15. Critical toast escalation
16. Role-based filtering

---

## Files to create / modify

| File | Action |
|---|---|
| `src/lib/ai-assist.ts` | Create — AI hint engine |
| `src/lib/enterprise-wms.ts` | Modify — add `buildSituationReport()`, extend `buildWarehouseBrainRecommendations()` |
| `src/lib/wms-core.ts` | Modify — wire hint recording into `confirmPutaway` and receiving confirm; add new metric fields to `getDashboardMetrics` |
| `src/components/wms-ui.tsx` | Modify — revise KPI cards, add `SituationReportTile`, `NotificationBell`, `NotificationPanel`, receiving hint chip, putaway hint card |
| Supabase migration | Create — `ai_product_hints` table + RLS policy |

---

## Open questions before build starts

1. **Qty per pallet storage:** Does the current receiving form store the `quantity_per_pallet` the operator enters, or is it discarded after pallet creation? If discarded, Phase 1 step 4 needs to capture it from the form before the API call.
2. **Placement hints scope:** Should hints be warehouse-scoped (product X always goes to B3 in *this* warehouse) or cross-warehouse? Recommend warehouse-scoped for accuracy.
3. **Notification persistence:** Should notifications be stored in Supabase so they survive page refresh and are visible on all devices, or is localStorage sufficient for now? Recommend localStorage for MVP, Supabase table later.
4. **Situation Report mode:** Should the Floor, Dock, and Office modes show different situation reports (i.e. floor-ops language vs. dock language vs. office KPI language), or one shared report?
