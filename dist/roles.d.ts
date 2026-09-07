/**
 * The staff role vocabulary — the single published source of truth for what
 * may appear in `User.roles`.
 *
 * Deliberately NOT `declare global`: the api needs these as *values* (to
 * validate a write against the allow-list and to key an exhaustive switch),
 * so import them:
 *
 * ```ts
 * import { USER_ROLES, type UserRole } from 'sinfactura-types';
 * ```
 *
 * ⚠️ **`User.roles` is a delimited STRING, not one of these.** The wire shape
 * is a space- or comma-separated list, so a claim can legitimately carry more
 * than one token (`'USER PRINTER'` is real and load-bearing — a Cloud Print
 * agent whose backing user also operates the till). This tuple types the
 * TOKENS, never the whole attribute. Split before comparing, and compare
 * exact tokens: a bare `String#includes` is a SUBSTRING test, so a future
 * `MANAGER_READONLY` would silently satisfy a `MANAGER` gate.
 *
 * ⚠️ **`CUSTOMER` is not here, and its absence is deliberate.** Shoppers
 * authenticate through a separate flow against the `CUSTOMER#` partition and
 * never own a `User` row. A customer token is minted with `roles: 'CUSTOMER'`
 * verbatim, but that string is a claim on a different entity — admitting it
 * to this vocabulary would let a customer role be *assigned to staff*, which
 * no gate anywhere expects.
 *
 * ⚠️ **Order is not precedence.** This is the assignable set, listed
 * least-privileged first for readability. Audit attribution uses its own
 * priority order in which `PRINTER` outranks every operator role — the
 * machine identity has to win attribution because it already wins the
 * authorization decision. Do not derive one from the other.
 */
export declare const USER_ROLES: readonly ["USER", "ADMIN", "SUPERVISOR", "MANAGER", "PRINTER"];
/** One assignable staff role token. See `USER_ROLES` for why this is not the shape of `User.roles`. */
export type UserRole = (typeof USER_ROLES)[number];
/**
 * Every role string an authenticated principal can present, staff or shopper.
 *
 * `CUSTOMER` is included here and excluded from `USER_ROLES` on purpose: a
 * reader that classifies an incoming token needs it, and a writer that
 * assigns a staff role must not.
 */
export type PrincipalRole = UserRole | 'CUSTOMER';
