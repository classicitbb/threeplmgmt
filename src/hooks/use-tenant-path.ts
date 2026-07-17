// Tenant-aware path seam (Phase 0 groundwork for multi-tenant routing).
//
// Today: `toPath("/pick-lists")` returns `"/pick-lists"` — byte-identical to the
// absolute paths call sites used before this seam was introduced.
//
// Later, once the app is mounted under `<Route path="/:companySlug/*">`, this
// hook can read the slug from route params and return `/${slug}${p}`. That
// change happens in ONE place (this file); every call site already routes
// through it, so the Phase 1 flip is a one-line update with no other diffs.
//
// Contract:
// - Input is expected to be an absolute app path starting with "/", or an
//   external URL / hash / query string. Only leading-"/" inputs are treated as
//   internal app paths and rewritten in later phases.
// - Anything else (http(s)://, mailto:, #anchor, ?query-only, empty string) is
//   returned unchanged.
// - `"/"` is preserved as-is; the future implementation will special-case the
//   root to become `/${slug}` rather than `/${slug}/`.

import { useCallback } from "react";

export type TenantPathFn = (path: string) => string;

function isInternalAppPath(path: string): boolean {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  // Protocol-relative URLs like "//example.com/foo" are not internal app paths.
  if (path.startsWith("//")) return false;
  return true;
}

export function useTenantPath(): { toPath: TenantPathFn } {
  const toPath = useCallback<TenantPathFn>((path) => {
    if (!isInternalAppPath(path)) return path;
    // Phase 0: no slug awareness yet — return the input unchanged so behavior
    // is byte-identical to pre-seam call sites. Phase 1 will replace this line
    // with slug-prefixing logic.
    return path;
  }, []);

  return { toPath };
}