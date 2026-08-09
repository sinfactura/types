declare global {
  /**
   * Wire contract returned by `POST /tenants/{storeId}/impersonate` — the
   * MANAGER tenant-impersonation mint endpoint. BE produces, FE consumes; this
   * is the ONLY impersonation type crossing the api↔app boundary.
   *
   * The minted token is an RFC 8693 delegation token (`sub` = tenant user,
   * `act.sub` = operator), short-lived (30 min) and non-refreshable, signed
   * with a separate key so a leak is revocable without rotating the normal
   * auth key. FE reads roles/permissions from `impersonatedUser` (NOT the JWT —
   * `jose.decodeJwt` is used only to read `exp` for the countdown).
   */
  interface ImpersonationMintResponse {
    /**
     * The minted delegation JWT (`aud: "impersonation"`). In-memory only on the
     * FE — never persisted to localStorage / URL / the refresh cookie.
     */
    impersonationToken: string;
    /**
     * The impersonated tenant user, AuthUser-shaped, including the
     * impersonation `accessToken`. The FE repoints its session identity to
     * this inside the new impersonation tab.
     */
    impersonatedUser: AuthUser;
    /**
     * Hard expiry of the session, unix ms. Mirrors the JWT `exp`; since the
     * token is non-refreshable this is absolute. Drives the countdown banner
     * and auto-exit.
     */
    expiresAt: number;
    /**
     * Server-side impersonation-session id (also the JWT `sid`), passed to
     * `POST /tenants/{storeId}/impersonation/{sessionId}/end`.
     */
    sessionId: string;
  }
}

export {}; // NOSONAR
