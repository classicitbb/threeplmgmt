# Warehouse Wizard — UI Improvement & Universal Tile Management Plan

**Status:** Awaiting approval  
**Scope:** 7 UI polish items + full universal tile management system  
**Primary files touched:** `wms-ui.tsx`, `enterprise-wms.ts`, `index.html`, `index.css`  
**New files introduced:** `src/lib/tile-registry.ts`, `src/components/tile-library-panel.tsx`

---

## Part A — UI Polish Items (7 targeted fixes)

### A1 · Login Input Color Consistency
**File:** `src/App.tsx` ~L415, L422  
**Change:** Remove `bg-slate-500` from the two login `<Input>` elements. This hard-coded Tailwind utility overrides the themed background and produces a mismatched grey box inside the dark login card. The inputs should rely solely on `bg-secondary` (already applied) to pick up the CSS variable correctly.  
**Effort:** 2-line edit, zero risk.

---

### A2 · Dashboard Drag-Handle Indicator
**File:** `src/components/wms-ui.tsx` — `SortableMetricCard`  
**Change:** Add a `GripVertical` icon (lucide, already bundled) to the top-right corner of each metric card. The icon is hidden by default (`opacity-0`) and fades in on card hover (`group-hover:opacity-40`). Additionally set `cursor-grab` on the drag-handle and `cursor-grabbing` on the active drag state via the `isDragging` flag from `useSortable`.  
**Why:** Users currently have no affordance that cards are reorderable until they accidentally drag one.  
**Effort:** ~15 lines added to `SortableMetricCard`.

---

### A3 · Severity Glow on Dashboard Cards
**File:** `src/components/wms-ui.tsx` — `toneBorder()` utility and Lean Metrics / Warehouse Brain panels  
**Change:** Extend `toneBorder()` to also return a `drop-shadow` class. Map severity levels to Tailwind `drop-shadow` values using CSS variables already defined in `index.css`:
- `critical` → `drop-shadow-[0_0_8px_hsl(var(--destructive)/0.5)]`
- `warning` → `drop-shadow-[0_0_8px_hsl(var(--warning)/0.4)]`
- `info` → `drop-shadow-[0_0_6px_hsl(var(--info)/0.3)]`
- `success` → `drop-shadow-[0_0_6px_hsl(var(--success)/0.3)]`

Apply the glow class alongside the existing border class on Lean Metric rows and Brain recommendation cards.  
**Effort:** Extend one helper function + 2 JSX sites.

---

### A4 · Scanner Audio Preferences (Mute + Error Buzz)
**File:** `src/components/wms-ui.tsx` — `SettingsPage`, `playBarcodeBeep()`  
**Changes:**
1. Add `playErrorBuzz()` — a 200 ms square-wave oscillator at 180 Hz (distinct, lower tone than the success beep) using the same Web Audio API pattern as `playBarcodeBeep()`.
2. Add a `"scanner"` tab to `SettingsPage` containing two toggles:
   - **Mute scan beep** — stores `ww_pref_mute_beep` in `localStorage`.
   - **Play error buzz on mismatch** — stores `ww_pref_error_buzz` in `localStorage`.
3. Guard `playBarcodeBeep()` call sites with `if (!localStorage.getItem('ww_pref_mute_beep'))`.
4. Call `playErrorBuzz()` at barcode-mismatch paths in `ReceivingPage` and `PutawayTasksPage`.  
**Effort:** ~60 lines across 3 functions + 1 new settings tab section.

---

### A5 · Putaway Rule Violation Flash
**File:** `src/components/wms-ui.tsx` — `PutawayTasksPage` confirm flow  
**Change:** When a rule violation is detected (cool-chain mismatch, mixed SKU restriction), briefly add a CSS class `animate-flash-warning` to the location input field using a `useState<boolean>` flag that auto-resets after 600 ms via `setTimeout`. On valid confirmation, flash with `animate-flash-success`.  
Add two keyframe animations to `index.css`:
```css
@keyframes flash-warning {
  0%, 100% { background-color: transparent; }
  40%       { background-color: hsl(var(--warning) / 0.25); }
}
@keyframes flash-success {
  0%, 100% { background-color: transparent; }
  40%       { background-color: hsl(var(--success) / 0.20); }
}
```
**Effort:** ~25 lines.

---

### A6 · Inventory Search Empty State & Double-click Tip
**File:** `src/components/wms-ui.tsx` — `InventorySearchPage` table  
**Changes:**
1. Replace the plain "No inventory matched." `<TableCell>` with a styled empty-state block: `Boxes` icon (lucide, bundled) + heading "No results" + subtext + a "Clear filters" `<Button variant="ghost">` that resets the search form.
2. Add a `<p className="text-xs text-muted-foreground">` tooltip hint beneath the table title: *"Tip: Double-click a row to view details."*  
**Effort:** ~30 lines.

---

### A7 · SEO / Title Tags
**File:** `index.html` L7–8  
**Changes:**
- Title: `Warehouse Wizard — Enterprise WMS`
- Description: `Enterprise Warehouse Management System: scan-first operations, directed putaway, real-time inventory, and multi-warehouse control.`

**Effort:** 2-line edit.

---

## Part B — Universal Tile Management System

This is the larger architectural addition. The goal is that **every card/widget on every dashboard view** becomes draggable, resizable, removable, and re-addable from a Tile Library panel.

---

### B1 · Data Model

**New file: `src/lib/tile-registry.ts`**

```ts
export type TileSize = "1x1" | "2x1" | "1x2" | "2x2" | "3x1" | "4x1";

export type TileConfig = {
  id: string;          // unique instance id (e.g. "metric-orders-pending")
  tileType: string;    // key into TILE_REGISTRY (e.g. "metric-card", "floor-queue", "brain")
  size: TileSize;      // current display size
  visible: boolean;    // false = in library, not rendered
};

export type TileDefinition = {
  tileType: string;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultSize: TileSize;
  category: "metrics" | "floor" | "dock" | "office" | "analytics";
  minSize: TileSize;
  maxSize: TileSize;
};

// TILE_REGISTRY — master catalogue of all available tile types
export const TILE_REGISTRY: Record<string, TileDefinition> = {
  "metric-card":        { label: "Metric Counter", category: "metrics", defaultSize: "1x1", ... },
  "floor-queue":        { label: "Floor Queue",    category: "floor",   defaultSize: "2x1", ... },
  "lean-andon":         { label: "Lean / Andon Status", category: "floor", defaultSize: "2x2", ... },
  "dock-board":         { label: "Dock Handoff Board",  category: "dock",  defaultSize: "4x1", ... },
  "dock-recommendations": { ... },
  "office-kpi":         { label: "Office KPI",     category: "office",  defaultSize: "1x1", ... },
  "setup-checklist":    { label: "Setup Checklist",category: "office",  defaultSize: "2x2", ... },
  "warehouse-brain":    { label: "Warehouse Brain",category: "analytics", defaultSize: "2x2", ... },
};
```

**Layout persistence keys (localStorage):**

| View         | Key                    |
|--------------|------------------------|
| Metric bar   | `ww_layout_metrics`    |
| Floor mode   | `ww_layout_floor`      |
| Dock mode    | `ww_layout_dock`       |
| Office mode  | `ww_layout_office`     |

Each key stores `TileConfig[]` as JSON. A `loadTileLayout(view, defaults)` helper merges saved data with defaults so new tiles introduced in code updates appear automatically.

---

### B2 · Grid System

The tile grid uses CSS Grid with 4 named columns. `TileSize` maps to Tailwind `col-span-*` and `row-span-*`:

| TileSize | col-span | row-span | Typical use              |
|----------|----------|----------|--------------------------|
| `1x1`    | 1        | 1        | Single metric counter    |
| `2x1`    | 2        | 1        | Wide stat or queue card  |
| `1x2`    | 1        | 2        | Tall list panel          |
| `2x2`    | 2        | 2        | Brain/checklist          |
| `3x1`    | 3        | 1        | Wide table preview       |
| `4x1`    | 4        | 1        | Full-width board         |

---

### B3 · Edit Mode

A **"Customize"** button in the Command Center header (pencil icon + label, only visible to `admin` / `warehouse_manager` roles) toggles `editMode: boolean` state.

**In edit mode, each tile shows three controls (appear on hover via `group-hover`):**

1. **Drag handle** — `GripVertical` icon top-left, `cursor-grab` / `cursor-grabbing`
2. **Resize control** — `Maximize2` / `Minimize2` icon top-right cycles through allowed sizes for that tile type (defined in `TileDefinition.minSize` / `maxSize`). A popover shows all size options as a small grid for direct selection.
3. **Remove button** — `X` icon bottom-right, removes tile from layout (`visible: false`), triggers a `toast` with **Undo** action (restores within 5 s).

A persistent **"Reset to default layout"** button in the header (only in edit mode) wipes localStorage for the current view and reloads defaults.

---

### B4 · Tile Library Panel

**New file: `src/components/tile-library-panel.tsx`**

A `<Sheet>` (right-side slide-in, already used in the app) opened by a **"Tile Library"** button that appears in the Command Center header when `editMode` is active.

**Panel layout:**
```
┌─────────────────────────────────────────┐
│  🧩 Tile Library                    [×] │
├─────────────────────────────────────────┤
│  Tiles on this view  ┊  Available tiles │  ← Tabs
├─────────────────────────────────────────┤
│  [Filter by category ▾]                 │
│                                         │
│  ┌──────────────────┐  ┌─────────────┐  │
│  │ 📦 Floor Queue   │  │ 🤖 Brain    │  │
│  │ Currently hidden │  │ On canvas   │  │
│  │     [Add ➕]     │  │  [Remove]   │  │
│  └──────────────────┘  └─────────────┘  │
│  ...                                    │
└─────────────────────────────────────────┘
```

- **"Tiles on this view"** tab shows all tiles (visible and hidden) for the current mode.
- **"Available tiles"** tab shows the full TILE_REGISTRY including tiles not yet on any view (future expansion).
- Each card shows the tile's icon, label, description, and current size.
- **Add / Remove** toggles `visible` on the `TileConfig` and persists immediately.
- Category filter chips (Metrics / Floor / Dock / Office / Analytics) narrow the list.

---

### B5 · DnD Integration

The current `@dnd-kit/core` + `@dnd-kit/sortable` setup in `DashboardPage` is already correct for the metric bar. The same pattern is extended to each mode's tile grid:

- `<DndContext>` wraps the entire mode grid.
- `<SortableContext items={visibleTiles.map(t => t.id)} strategy={rectSortingStrategy}>` replaces the static grid.
- Each tile is wrapped in a `<SortableTile>` component (analogous to `SortableMetricCard`) that calls `useSortable`.
- `handleDragEnd` updates the order in the layout array and persists to localStorage.
- Drag is **only active in edit mode** — the `disabled` prop on `useSortable` is set to `!editMode`.

No new npm packages are needed; all DnD functionality is covered by the existing `@dnd-kit/*` dependencies.

---

### B6 · Resize Implementation

Resize uses **discrete snap steps** (not free-form CSS resize) to stay consistent with the grid:

1. Each tile type defines `allowedSizes: TileSize[]` in its `TileDefinition`.
2. The resize button cycles through `allowedSizes` in order (wrapping around).
3. A small **size picker popover** (4×2 grid of size chips) opens on long-press / right-click for direct selection.
4. Changing size updates `TileConfig.size`, re-renders the grid via CSS class change, and persists.

No extra packages required — pure state + Tailwind class switching.

---

### B7 · Component Architecture

```
DashboardPage
├── DashboardHeader
│   ├── mode tabs (Floor / Dock / Office)
│   ├── [Customize] button  →  toggles editMode
│   └── (editMode) [Tile Library] button + [Reset layout] button
│
├── MetricBar  ← existing DndContext, extended with edit mode controls
│
└── TileGrid (per mode)
    ├── DndContext (wraps full grid)
    ├── SortableContext
    └── SortableTile[]
        ├── DragHandle (editMode only)
        ├── ResizeControl (editMode only)
        ├── RemoveButton (editMode only)
        └── <tile content component>
            (WarehouseFloorQueue | LeanAndonCard | DockHandoffBoard |
             OfficeKpiCard | SetupChecklistCard | WarehouseBrainPanel | ...)
```

Each **tile content component** is a pure presentational component that receives its data via props. The `SortableTile` shell handles all layout chrome.

---

## Implementation Phases

### Phase 1 — Quick wins (A1–A3, A6, A7) — ~1–2 hours
- Fix login input background (`bg-slate-500` removal)
- Add drag-handle affordance to metric cards
- Add severity glows to Lean/Brain cards
- Inventory search empty state + double-click tip
- SEO title/description tags

### Phase 2 — Audio & flash feedback (A4, A5) — ~1 hour
- `playErrorBuzz()` + Settings scanner tab with mute toggles
- Putaway violation flash animations

### Phase 3 — Tile system data layer (B1, B2) — ~2–3 hours
- Create `tile-registry.ts` with `TILE_REGISTRY`, `TileConfig`, `loadTileLayout`, `saveLayout`
- Migrate existing `DashboardCardConfig` metric cards to the new `TileConfig` shape
- Ensure backward compatibility with existing `ww_layout_*` localStorage keys

### Phase 4 — Edit mode + per-tile controls (B3, B5, B6) — ~3–4 hours
- Add `editMode` toggle to dashboard header
- Wrap each mode's grid in `DndContext` + `SortableContext`
- Build `SortableTile` shell with drag handle, resize control, remove button
- Wire up `handleDragEnd`, `handleResize`, `handleRemove` with localStorage persistence
- Add Undo toast on remove

### Phase 5 — Tile Library panel (B4) — ~2–3 hours
- Build `tile-library-panel.tsx` Sheet component
- "Tiles on this view" / "Available tiles" tabs
- Category filter chips
- Add / Remove toggle with instant persistence

### Phase 6 — Polish & QA — ~1–2 hours
- Verify all 4 layout views persist and restore correctly on hard refresh
- Test role gating (Customize button hidden for `inventory_clerk` / `warehouse_operator`)
- Test Undo toast timing
- Verify no regressions on existing barcode scan flows
- Validate empty Tile Library state (all tiles visible) renders correctly

---

## Files Changed Summary

| File | Type of change |
|------|---------------|
| `index.html` | 2-line edit (SEO) |
| `src/App.tsx` | 2-line edit (login input class) |
| `index.css` | +2 keyframe animations |
| `src/lib/enterprise-wms.ts` | Add tile type exports alongside existing dashboard types |
| `src/lib/tile-registry.ts` | **New** — TILE_REGISTRY, TileConfig, layout helpers |
| `src/components/tile-library-panel.tsx` | **New** — Tile Library Sheet component |
| `src/components/wms-ui.tsx` | Extended DashboardPage, SortableTile shell, edit mode, audio prefs, flash animations, empty states |

---

## Constraints Observed

- `wms-ui.tsx` is 3,211 lines and hits the ~60 KB Edit tool truncation threshold. All edits to this file will use **Python via bash** to avoid silent truncation (per existing project memory).
- No new npm packages are required — `@dnd-kit/*` is already installed and covers all drag/sort/resize needs.
- The UI Freeze Contract in `AGENTS.md` requires approval before any visual changes ship — this plan document is the approval gate.
