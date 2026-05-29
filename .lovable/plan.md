## Root cause

The DB role row uses code `dev`, but the entire frontend checks for `"developer"`. So `useAuth().roles` contains `"dev"` and:

```ts
const canOperateRoles = roles.includes("developer"); // always false
```

→ dev users see the Access tab in read-only mode and can never assign roles. Same mismatch breaks ~30 other call sites (navigation visibility, `canSeeAllTasks`, password-change gate, etc.).

## Fix — Part 1: repair role assignment (small, do first)

1. **Data fix** — single `UPDATE` on `public.roles` to set `code = 'developer'` where it's currently `'dev'`. The `user_roles` table references `role_id`, not `code`, so existing assignments stay intact. The `app_role_code` enum keeps `dev` as a member; no enum rename needed because no SQL currently passes `'developer'` to it.

2. **Verify in UI** — no code change required; all existing `roles.includes("developer")` checks will start matching for dev users:
   - "Assign Role" card becomes visible on `/settings → Users & Roles → Access`.
   - Per-row Revoke/Restore buttons appear.
   - The developer role itself stays visible only to other devs (existing filter).

3. **Add admin gate for assignment** — change `canOperateRoles` from `roles.includes("developer")` to `roles.some(r => ["developer","admin"].includes(r))` so admins can assign and revoke standard roles (still hiding the `developer` role from non-devs via a new `canOperateDeveloperRole = roles.includes("developer")` flag used to filter the role dropdown and the Revoke button on developer rows).

4. **RLS check** — verify `public.user_roles` policies allow admins to INSERT/DELETE. If not, add a migration: `CREATE POLICY "Admins manage user_roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'developer')) WITH CHECK (same)`.

## Fix — Part 2: Role Matrix becomes editable permissions matrix (dev only)

Today the Role Matrix tab is a static list of the current user's roles. The screenshot shows what's wanted: a Features × Roles grid with View/Edit checkmarks, editable by dev only.

Currently "permissions" are hardcoded in `NAVIGATION` (`src/lib/wms-core.ts`) — each module has a `roles: [...]` array. To make this dev-editable:

1. **New table** `public.role_module_permissions` with columns: `role_id` (fk roles), `module_key` (text, matches existing `moduleKey` in NAVIGATION), `can_view` (bool), `can_edit` (bool), unique on (role_id, module_key). RLS: read for any approved user; write only via `has_role(auth.uid(),'developer')`. Standard GRANTs.

2. **Seed migration** — populate the table from current `NAVIGATION` defaults (every module × every role currently listed gets view=true, edit=true for write-capable roles like admin/manager/operator; viewer roles get view=true, edit=false).

3. **Hook** `useRolePermissions()` — loads the table once, caches via react-query. Exposes `can(roleCodes, moduleKey, "view"|"edit")`.

4. **Replace `NAVIGATION.roles` checks** in `AppShell` sidebar and route guards with `can(roles, moduleKey, "view")`. Hardcoded array stays as fallback for modules with no DB row yet.

5. **Role Matrix UI rewrite** — table with sticky first column (module label) and a column-pair (View / Edit) per role. Checkboxes are read-only unless `roles.includes("developer")`. Toggling fires an upsert on `role_module_permissions` and invalidates the cache. Match the visual style in the attached screenshot using existing Card + Table tokens — no new design tokens.

6. **Page-level "edit" enforcement** is out of scope for this pass — we wire the grid + persistence + view gating; gating Edit buttons per module by `can_edit` is a follow-up that touches many pages and should be its own batch.

## Recommendation

Part 1 is a 1-minute data fix + small UI gate change and unblocks the immediate complaint. Part 2 is a larger feature (new table, migration, seeding, UI rewrite, navigation rewiring).

I'll do Part 1 first in this batch. Confirm whether to also do Part 2 now or split it into a follow-up.
