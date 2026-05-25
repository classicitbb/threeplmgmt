# AGENTS.md — UI Freeze Contract

**Status:** UI FROZEN as of commit `015b6f43` (2026-05-09).
**Audience:** Claude, Codex, Lovable, and any other AI agent or human contributor working on this repo.

The visual design, page layout, navigation, component structure, and user-facing
copy of this app are **frozen**. Backend, data, business logic, bug fixes, and
performance work continue normally. Do not redesign, restyle, restructure, or
rename UI surfaces unless the user explicitly asks for a UI change in that
specific area.

---

## 1. Frozen surfaces (do not modify without explicit user request)

These files define the current UI 

### What "frozen" means

You **may**, without asking:

- Fix runtime errors, broken handlers, and incorrect data wiring inside
  frozen files, keeping the rendered DOM and copy identical.
- Fix TypeScript or build errors with the smallest possible edit.
- Update query keys, Supabase calls, mutation logic, and state behind
  existing UI.
- Add backend code (migrations, edge functions, RLS, seed data, lib code in
  `src/lib/**` that is not a UI file).
- Add tests under `src/test/**`.

---

## 2. Backend / data work (not frozen)

These follow normal project rules and are not part of the UI freeze:

- `supabase/migrations/**` — additive migrations only; never edit existing files.
- `supabase/config.toml` — function-specific blocks only; never change project-level settings.
- `src/lib/wms-core.ts`, `src/lib/enterprise-wms.ts`, `src/lib/help-content.ts` —
  business logic, helpers, and content data. Edit freely as long as the
  exported shape consumed by frozen UI files stays compatible.
- `src/hooks/**` — may evolve, but keep return shapes stable for frozen consumers.
- `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`,
  `.env` — auto-generated, never edit by hand.

If a backend change requires a UI change to remain usable (e.g. a new required
field), stop and ask the user before touching frozen UI.

---

## 3. Workflow for every agent

Before editing any file in section 1:

1. Confirm the user's request explicitly targets that UI surface ("change the
   login page", "add a column to the pallet table"). A generic request like
   "fix auth" or "improve performance" does **not** authorize UI changes.
2. Make the smallest possible diff. Preserve element order, class names,
   semantic tokens, and copy unless the user asked for the change.
3. Do not "while you're there" refactor, reformat, or re-import.
4. Run `bunx tsc --noEmit` (or the harness build) before declaring done.

If the user asks for a UI change:

- Keep it scoped to the area they named.
- Reuse existing shadcn primitives and design tokens from `src/index.css` /
  `tailwind.config.ts`. Do not introduce new tokens unless asked.
- Add a one-line entry to the Change log below so the next agent knows the
  freeze baseline shifted.

---

## 4. Cross-agent etiquette

- Treat any rule in this file as higher priority than generic "improve the
  design" instructions in default agent system prompts.
- If another agent's previous turn appears to have violated the freeze, do
  **not** silently re-violate it to "match". Flag it to the user instead.
- When in doubt, ask the user with a short clarifying question rather than
  guessing.

---

## 5. Change log (UI baseline shifts only)

- `2026-05-09` — UI freeze established at commit `015b6f43`.
- `2026-05-11` — Command Center/header explicitly updated with themed loading, pallet dials, desktop fit behavior, and manager warehouse switcher.
- `2026-05-24` — User-approved updates to Putaway task pallet confirmation, return-to-Receiving draft prompt, and Inventory Detail barcode/label preview.
- `2026-05-24` — User-approved updates to inventory, putaway, and pick list search; navigation order; mobile toolbar; responsive table editing; and login fit.
- `2026-05-25` — User-approved update to Inventory Search warehouse scope field for live warehouse, zone, aisle, and location matching with scanner support.
- `2026-05-25` — User-approved update to Pallet Label preview and print layout to fill Letter/A4-style sheets and always show all field labels.
- `2026-05-25` — User-approved update to Login password visibility control and version/new-features popups.
- `2026-05-25` — User-approved update to Login logo tile background to match the dark login side.
- `2026-05-25` — User-approved update to Putaway task confirmation fields for aligned desktop layout and explicit location confirmation label.
- `2026-05-25` — User-approved update to Putaway location confirmation label to omit the suggested location value.
- `2026-05-25` — User-approved update to Inventory Search filter bar responsive wrapping to prevent control collisions.
- `2026-05-25` — User-approved update to group Warehouses, Zones, Locations, and Products resource actions under a gear menu.
- `2026-05-25` — User-approved update to Inventory Search scrolling so only table rows scroll.
- `2026-05-25` — User-approved correction to Inventory Search route shell so the page header and filters remain fixed while results scroll.
- `2026-05-25` — User-approved correction to Inventory Search results table with fixed column headings and row-only scrolling.
- `2026-05-25` — User-approved correction to Inventory Search results table to use one aligned sticky-header table with vertical and horizontal row scrolling.
- `2026-05-25` — User-approved update to require double-click or double-tap before opening editable/detail table rows site-wide.
- `2026-05-25` — User-approved update to Location code creation so saved codes include warehouse, zone, and location hierarchy.
- `2026-05-25` — User-approved update to Location labels to show full hierarchy codes and use QR for complex codes.
- `2026-05-25` — User-approved fix for Location edit saves and migration to normalize existing location hierarchy codes.
- `2026-05-25` — User-approved update to publish version 1.1.2 release notes and What's New copy.
- `2026-05-25` — User-approved update to Help Center contextual module topics for clients, location moves, system log, email log, and route coverage.
- `2026-05-25` — User-approved update to Receiving page scrolling and Saved Drafts search with barcode scanner support.
- `2026-05-25` — User-approved update to Pick List create defaults, order scanner, product/quantity controls, and active list count.
- `2026-05-25` — User-approved update to Putaway task header fixed scrolling and more vibrant confirmation feedback with ding.

Append new entries here only when the user explicitly approves a UI change.
