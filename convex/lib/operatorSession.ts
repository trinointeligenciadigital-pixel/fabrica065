import type { MutationCtx, QueryCtx } from "../_generated/server";

type SessionCtx = QueryCtx | MutationCtx;
type RequiredAction = "produce" | "dispatch";

function toHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function createSessionToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) throw new Error("SESSION_INVALID");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export async function requireOperatorSession(
  ctx: SessionCtx,
  chamberToken: string,
  sessionToken: string,
  action?: RequiredAction,
) {
  const now = Date.now();
  const tokenHash = await hashSessionToken(sessionToken);
  const session = await ctx.db.query("operatorSessions")
    .withIndex("by_token_hash", (query) => query.eq("tokenHash", tokenHash))
    .unique();
  if (!session || session.revokedAt || session.expiresAt <= now) throw new Error("SESSION_INVALID");

  const [chamber, collaborator, permission] = await Promise.all([
    ctx.db.get(session.chamberId),
    ctx.db.get(session.collaboratorId),
    ctx.db.query("collaboratorPermissions")
      .withIndex("by_collaborator_chamber", (query) =>
        query.eq("collaboratorId", session.collaboratorId).eq("chamberId", session.chamberId),
      )
      .unique(),
  ]);

  if (!chamber?.active || chamber.publicToken !== chamberToken) throw new Error("SESSION_CHAMBER_MISMATCH");
  if (!collaborator?.active || !permission) throw new Error("SESSION_INVALID");
  if (action === "produce" && !permission.canProduce) throw new Error("PERMISSION_DENIED");
  if (action === "dispatch" && !permission.canDispatch) throw new Error("PERMISSION_DENIED");

  return { session, chamber, collaborator, permission };
}