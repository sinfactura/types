declare global {
    /**
     * Wire contract returned by `POST /tenants/{storeId}/impersonate` — the
     * MANAGER tenant-impersonation mint endpoint (app#1756 · spine #1187).
     *
     * BE produces, FE consumes. This is the ONLY impersonation type that crosses
     * the api↔app boundary: the JWT claims (`act`/`aud`/`scope`/`store`/`sid`),
     * the request body (`{ targetUserId, reason }`) and the server-side
     * session-registry DDB item all stay service-local.
     *
     * The minted token is an RFC 8693 *delegation* token (`sub` = the tenant
     * user, `act.sub` = the operator), short-lived (30 min) and
     * **non-refreshable**, signed with a separate key so a leak is revocable
     * without rotating the normal auth key. The FE reads the impersonated
     * identity's roles/permissions from `impersonatedUser` (NOT from the JWT —
     * `jose.decodeJwt` is used only to read `exp` for the countdown); the
     * `act`/`scope`/`aud` claims exist purely for BE verification + audit.
     */
    interface ImpersonationMintResponse {
        /**
         * The minted delegation JWT (`aud: "impersonation"`). In-memory only on the
         * FE — never persisted to localStorage / URL / the refresh cookie.
         */
        impersonationToken: string;
        /**
         * The impersonated tenant user, AuthUser-shaped: the target's
         * roles/permissions/storeId plus the impersonation `accessToken`. The FE
         * repoints its session identity to this inside the new impersonation tab.
         */
        impersonatedUser: AuthUser;
        /**
         * Hard expiry of the session, unix milliseconds. Mirrors the JWT `exp`;
         * because the token is non-refreshable this is absolute. Drives the banner
         * countdown and the auto-exit.
         */
        expiresAt: number;
        /**
         * Server-side impersonation-session id (also the JWT `sid`). Identifies the
         * registry row the FE later passes to
         * `POST /tenants/{storeId}/impersonation/{sessionId}/end`.
         */
        sessionId: string;
    }
}
export {};
