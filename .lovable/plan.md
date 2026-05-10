## Plan

### 1. Verify the TypeScript build

- Run `bunx tsc --noEmit` and `bun run build` (Vite) to confirm `src/components/wms-ui.tsx` and the rest of the project compile cleanly after the recent `LocationWizardValues` fix.
- If anything still fails, fix with the smallest possible edit (no UI changes).

### 2. Zod schema + typed state for the location wizard form

Currently `LocationWizardValues` is an inline `type` with no validation; numeric fields are coerced via `Number(...)` at submit time.

- Add `locationWizardSchema` using `zod` next to the component:
  - `warehouse_id`, `zone_id`: `z.string().uuid()` (non-empty)
  - `prefix`: `z.string().trim().min(1).max(8)`
  - `start_bay`, `end_bay`, `levels`, `depth`, `max_pallets`: `z.coerce.number().int().min(1)` with `end_bay >= start_bay` refinement
  - `location_type`, `temperature_class`: `z.enum([...])` matching DB enums
  - `mixed_sku_allowed`, `mixed_lot_allowed`: `z.boolean()`
- Replace the inline `type` with `type LocationWizardValues = z.infer<typeof locationWizardSchema>`, exported so the mutation and any consumers share it.
- Wire `useForm<LocationWizardValues>({ resolver: zodResolver(locationWizardSchema), defaultValues: ... })`.
- Drop manual `Number(...)` coercion in `mutationFn` (schema already coerces).
- Add `<FormMessage />` under each field so validation errors render (no other layout changes).

### 3. AppShell polish (frozen-file edits, minimal-diff)

All inside `src/components/wms-ui.tsx` `AppShell`. Keep DOM order and copy intact except for the additions below.

- **Collapsed sidebar — touch-friendly icons**: when `sidebarCollapsed`, bump nav links from `h-9 w-9` to `h-11 w-11` and icons from `h-4 w-4` to `h-5 w-5`; widen the collapsed grid column from `56px` to `64px`. Tooltip behavior already exists.
- **Mobile menu fullscreen**: on the mobile `<SheetContent side="left">`, change `w-[240px]` → `w-screen max-w-full h-svh` and add a header row inside with the signed-in user (avatar + name + email) and a Sign out button, mirroring the desktop top bar.
- **Mobile/tablet header — show signed-in user**: in the `lg:hidden` header, add a compact avatar + truncated display name to the right side (before the Help/Menu buttons). Hidden on the smallest widths only if needed for space.
- **Version in header**: read the app version from `package.json` via Vite's `import.meta.env` by exposing `__APP_VERSION__` in `vite.config.ts` (`define: { __APP_VERSION__: JSON.stringify(pkg.version) }`) plus a `vite-env.d.ts` declaration. Render `v{__APP_VERSION__}` as a muted small text next to the page title in the desktop top bar AND in the mobile header.

### 4. Dashboard fullscreen + fit-to-screen

In `DashboardPage` (wms-ui.tsx):

- Add a `dashboardRef` and two buttons in the existing dashboard toolbar: **Fullscreen** (toggles `requestFullscreen()` / `exitFullscreen()` on the ref, swapping `Maximize2`/`Minimize2` icons — already imported) and **Fit to screen** (toggles a `fitToScreen` state that applies `h-[calc(100vh-...)] overflow-hidden` and switches the metric grid to `auto-rows-fr` so cards scale to viewport height).
- Track fullscreen state via a `fullscreenchange` listener so the button label/icon stays correct.
- No other layout/copy changes to the dashboard.

### 5. Seeded data + DB save verification

- Run `supabase--read_query` to spot-check key tables (`warehouses`, `zones`, `locations`, `products`, `pallets`, `receipts`, `putaway_tasks`, `pick_lists`) and confirm row counts match what `supabase/seed.sql` claims to insert.
- Inspect `supabase/seed.sql` around the `putaway_tasks` insert (line ~839) to confirm it actually executes for the seeded receipts; if the seed only inserts conditionally and current DB has 0 rows, add an additive migration that backfills putaway tasks for any existing seeded pallets that don't have one (no schema changes — pure data via `supabase--insert`). also the full system must be able to be demoed using the seed data so all save able forms must be working. data in tables must be editable.   
also for tables with overflow data, show only important fields and ensure that tables are dense enough in desktop view to show maximum detail. make sure search works across all table data. 
- Smoke-check the wizards (location wizard above, plus receiving/picking/transfer/cycle-count forms) by reading their `useMutation` paths to confirm payload shapes match the live `supabase-tables` columns. Note any mismatches and fix them in the mutation code only — no UI changes.

### 6. Validation

- `bunx tsc --noEmit` and Vite build green.
- Manual preview check: collapsed sidebar icons are larger and centered; mobile menu opens fullscreen with user info; header shows user on mobile + version everywhere; dashboard fullscreen toggles correctly; location wizard rejects invalid inputs with inline messages and still creates locations on valid submit.

### Technical notes

- New dep already present: `zod`, `@hookform/resolvers`. Confirmed via existing `useForm<z.infer<...>>` usages in the same file.
- `vite.config.ts` change is the only outside-frozen-file edit (build config, not UI). Reading `package.json` at build time avoids shipping the JSON to the client.
- Touch target bump (44px ≈ `h-11 w-11`) follows WCAG 2.5.5 / Apple HIG.
- Fullscreen API needs a user gesture; using a button click satisfies that. Fit-to-screen is a pure CSS/state toggle and works regardless of fullscreen state, and they can be combined. yes please. 