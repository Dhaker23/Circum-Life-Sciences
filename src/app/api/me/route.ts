import { ok, fail } from "@/lib/api-envelope";
import { getAuthContext } from "@/lib/auth-context";

// Returns the current user's session + resolved permissions + resolved sites.
// Used by the UI for nav hiding (usability only; NOT authorization, ADR-0004).
export async function GET() {
  try {
    const ctx = await getAuthContext();
    if (!ctx) {
      return ok({ authenticated: false });
    }
    return ok({
      authenticated: true,
      user: ctx.user,
      permissions: [...ctx.resolvedPermissions],
      resolvedSites: ctx.resolvedSites === "*" ? "*" : [...ctx.resolvedSites],
      assignments: ctx.assignments.map((a) => ({
        role: a.role.systemKey,
        siteId: a.siteId,
        departmentId: a.departmentId,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
