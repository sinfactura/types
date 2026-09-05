declare global {
    /**
     * One scope's literals, unmerged.
     *
     * ⚠️ The api returns the layers in MERGE ORDER and does NOT merge them —
     * the consumer folds them itself, later layers overriding earlier. Rendering
     * `layers[0]` alone silently shows the global defaults for a store that has
     * overridden them.
     */
    interface LiteralLayer {
        scope: LiteralScope;
        literals: Record<string, string>;
    }
    /**
     * Surface mode — the response when an explicit, recognised `surface` is sent.
     *
     * Scope chain is `GLOBAL → APP/PLATFORM/WEB → {surface}#STO{id}`, and it is
     * returned unmerged as `layers`. See `LiteralLayer`.
     */
    interface LiteralsSurfaceResponse {
        surface: LiteralSurface;
        /** Absent when no store was requested — the chain is then global-only. */
        storeId?: string;
        layers: LiteralLayer[];
    }
    /**
     * Legacy mode — the response when NO `surface` is sent. A single already-merged
     * map, not a chain.
     *
     * ⚠️ A DIFFERENT SHAPE, not a subset: `data`, not `layers`, and merged rather
     * than layered. Discriminate on the presence of `surface`, never by probing
     * for `layers` and falling through.
     *
     * ⚠️ Omitting `surface` does not mean "give me everything" — it selects the
     * single `GLOBALS` row (or the named store's), so a client that drops the
     * parameter to simplify a request silently loses every scope override.
     */
    interface LiteralsLegacyResponse {
        storeId: string;
        data: Record<string, string>;
    }
}
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
export declare const LITERAL_SURFACES: readonly ["app", "web", "platform"];
export type LiteralSurface = (typeof LITERAL_SURFACES)[number];
/**
 * ⚠️ Both modes are served through a conditional GET and carry an `ETag`.
 * Clients MUST send `If-None-Match` and treat **304** as "keep what you cached" —
 * a 304 carries no body, so parsing the response unconditionally yields an empty
 * literal set and a UI rendered entirely from fallback keys.
 *
 * The ETag covers THIS request's envelope, surface and store included, so a
 * cache keyed only on the path collides across surfaces.
 */
export type LiteralsResponse = LiteralsSurfaceResponse | LiteralsLegacyResponse;
export {};
