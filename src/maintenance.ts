declare global {
  type MaintenanceLevel = 'platform' | 'store' | null;

  interface MaintenanceInfo {
    level: MaintenanceLevel;
    message?: string;
    startedAt?: number;
    /**
     * ⚠️ OPERATOR PII — a real person's `fullName`. This is why the stored
     * shape must never be handed to an unauthenticated caller verbatim; see
     * `PublicMaintenanceInfo`.
     */
    startedBy?: { userId: string; fullName: string };
    endsAt?: number;
  }

  /**
   * The maintenance shape an UNAUTHENTICATED caller may see — what the Web
   * API's `GET /store` returns so a storefront guest can be shown the banner.
   *
   * ⚠️ It is a deliberate NARROWING of `MaintenanceInfo`, not a convenience
   * alias, and the field it drops is the reason it exists: `startedBy` carries
   * an operator's `userId` and real `fullName`. Returning the stored shape
   * verbatim on a route with no authorizer publishes a named employee to every
   * visitor — and it would typecheck, because every field is optional. Widening
   * this back to `MaintenanceInfo` is a PII disclosure, never a simplification.
   *
   * `startedAt` is dropped too, for a smaller reason: a shopper has no use for
   * when the operator flipped the switch, and `endsAt` is the half that answers
   * the question they actually have.
   *
   * ⚠️ `message` DOES cross, because the banner is the whole point — which
   * means operator-authored text is shopper-visible. Whatever composes it owes
   * the operator that warning at the point of writing.
   */
  interface PublicMaintenanceInfo {
    level: MaintenanceLevel;
    message?: string;
    endsAt?: number;
  }
}

export {}; // NOSONAR