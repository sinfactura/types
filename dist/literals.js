// The `GET /literals` wire contract — the surface union and both response
// envelopes, so a native client has something to import instead of hand-pinning
// strings it cannot be told about when they change.
//
// ⚠️ Every rendered string in the mobile client comes through this endpoint, so
// a drifted hand-pin here is not one broken screen — it is every screen.
/**
 * The surfaces `GET /literals` recognises.
 *
 * A CONST TUPLE, matching `SOCKET_ACTIONS` and the auth error cohorts: consumers
 * need the VALUES to validate a surface before sending it, and a bare union
 * cannot be iterated.
 *
 * ⚠️ An unrecognised `surface` does not 400 — the api falls through to LEGACY
 * mode and returns `LiteralsLegacyResponse`. So a typo does not fail loudly; it
 * returns a different, plausible-looking shape with none of the store's
 * overrides in it. Validate against this tuple before the request, because the
 * response will not tell you.
 *
 * A native `'mobile'` surface, should its copy ever diverge from `'app'`, is one
 * more member of this tuple — not a new response shape.
 */
export const LITERAL_SURFACES = ['app', 'web', 'platform'];
