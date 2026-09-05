import type { NotificationTypeEnum } from "./notification";

declare global {
  /** Write shape for user create/update — carries the transient photo controls. */
  type UserUpsertInput = Partial<User> & PhotoUploadControls;

  interface User {
    storeId: string;
    userId: string;
    createdAt: number;
    fullName: string;
    phone: string;
    email: string;
    password?: string;
    /**
     * Canonical role string. The api's write path also accepts a legacy
     * singular `role` alias (not declared here) and normalizes it into this
     * field — but legacy rows created through that alias may still carry a
     * stray persisted `role` attribute until the api-side cleanup lands.
     * Always read `roles`; never the alias.
     *
     * ⚠️ A space- or comma-DELIMITED list, not a single role — a claim can
     * legitimately carry more than one token (`'USER PRINTER'` is real: a
     * Cloud Print agent whose backing user also operates the till). Every
     * token must be a member of the published `USER_ROLES` tuple; split and
     * compare EXACT tokens, never `String#includes`, which is a substring
     * test that would let a future `MANAGER_READONLY` satisfy a `MANAGER`
     * gate. It stays typed `string` rather than ```${UserRole}``` because
     * the delimited form has no expressible template type and legacy rows
     * predate the allow-list.
     */
    roles: string;
    photoURL: string;
    /** @deprecated Request-only upload control, never persisted or returned — use `UserUpsertInput.photoData`. */
    photoData?: string;
    /** @deprecated Request-only control, never persisted or returned — use `UserUpsertInput.removePhotoURL`. */
    removePhotoURL?: string;
    disabled: boolean;
    /**
     * @deprecated Lowercase WRITE-SIDE index for backend filtering. Internal —
     * not part of the read contract, even where legacy responses still include
     * it; never consume it.
     */
    search?: string;
    accessToken: string;
    roleSeller?: boolean;
    roleProducts?: boolean;
    roleCustomers?: boolean;
    roleAfip?: boolean;
    notifications?: UserNotifications;
    // Per-user audible-bell preference (client chime toggle). Default-on:
    // absent === on, so no backfill. Distinct from the `notifications.<KEY>` per-type
    // opt-in map above — this does NOT affect delivery, only whether the FE plays a sound.
    notificationSound?: boolean;
    permissions?: UserPermissions;
    // Grandfather clause: `emailVerified === undefined` means a legacy user
    // that predates the OTP flow — apps should treat undefined as verified.
    // New registrations carry an explicit `false` until OTP completes;
    // provider-verified social signups start at `true`.
    emailVerified?: boolean;
    emailVerifiedAt?: number;
    // TOTP 2FA. `secretRef` / `pendingSecretRef` are
    // KMS-encrypted handles — never the plaintext base32 seed. Absent
    // `totp` means the user never started enrollment.
    totp?: {
      enabled: boolean;
      secretRef?: string;        // KMS ciphertext of the active TOTP seed
      pendingSecretRef?: string; // KMS ciphertext awaiting verify-enrollment
      pendingAt?: number;        // unix ms — enrollment start (expiry window)
      enrolledAt?: number;       // unix ms
      lastUsedAt?: number;       // unix ms — ops audit
      lastCounter?: number;      // last accepted TOTP step (replay guard, RFC 6238 §5.2)
      // Single-use recovery codes. Only the bcrypt hash is stored
      // (bcrypt embeds its own salt); `usedAt` set on consumption (soft-consume,
      // keeps the slot index stable for the atomic single-use conditional write).
      recoveryCodes?: { hash: string; usedAt?: number }[];
      recoveryCodesGeneratedAt?: number; // unix ms — when the active set was minted
      // 2FA brute-force lockout. `failedAttempts` = consecutive step-up
      // failures since the last success; `lockedUntil` (unix ms) short-circuits the
      // step-up while in the future. Internal only — never exposed to the client.
      failedAttempts?: number;
      lockedUntil?: number;
    };
    // CUIT_SHARED soft-warns folded into the auth/register success-response (and
    // the FE session payload) so the register wizard surfaces them without a
    // follow-up getStore. RESPONSE-ONLY — never persisted on the USER row, same
    // as `accessToken`.
    warnings?: StoreWarning[];
    // Per-account password brute-force counter (mirrors
    // totp.{failedAttempts,lockedUntil}). `lastFailedAt` anchors the sliding
    // decay window so the captcha tier self-heals.
    login?: { failedAttempts?: number; lockedUntil?: number; lastFailedAt?: number };
  }

  // Per-user notification opt-ins, keyed by the canonical UPPERCASE
  // `NotificationTypeEnum` values — the only attribute names the BE
  // fanout filter-reads (`notifications.<KEY> = true`). Closed key set,
  // no string index (the dynamic tenant-key taxonomy was
  // dropped). Legacy lowercase keys (`orders`, `dollarOficial`, …)
  // may persist on old user records but are never read by the BE and
  // never written by the FE — intentionally not modeled.
  type UserNotifications = Partial<Record<NotificationTypeEnum, boolean>>;

  type UserPermissions = {
    currency?: boolean;
    customers?: boolean;
    products?: boolean;
    seller?: boolean;
    accountant?: boolean;
    payments?: boolean;
    cash?: boolean;
    /**
     * May see the per-user wallet/shift surface — another employee's shift list
     * and any shift that is not the caller's own.
     *
     * Role-implied, like `seller`: it is a VISIBILITY key, not an approval key,
     * so the `adminToken` roles carry it without the flag. Contrast
     * `discount`/`packOrder`, which grant an extra unbounded action and admit no
     * admin exception ever. A caller reading their OWN shift needs no check.
     */
    wallets?: boolean;
    packOrder?: boolean;
    /**
     * May grant a discount at the till — a per-line `setLineDiscount`, or
     * applying/removing a cart coupon.
     *
     * ⚠️ Checked **IN ADDITION TO** the store-wide `config.changePrice` switch,
     * never instead of it. A store that turned the price switch off must not
     * find discounts still reachable; a per-line discount is a price override in
     * everything but spelling.
     *
     * Absent/false means no. Before this key existed, every `USER`-role cashier
     * at a store with `changePrice` on could grant an unbounded per-line cut,
     * because `UserPermissions` had eight keys and none of them was a discount.
     *
     * ℹ️ This is the industry floor, not a novel control: Shopify POS has
     * separate toggles for custom discounts and for discount codes, Toast
     * requires a manager permission level, and Clover prompts for a manager PIN
     * stating the rationale outright — so employees do not inadvertently (or
     * maliciously) abstain from accepting payment for the full amount.
     */
    discount?: boolean;
  };

  /**
   * Wire error codes for the paths that create or update a USER row:
   * `POST /users` (create AND update — one handler serves both) and
   * `POST /auth?mode=register` (self-registration). They ride `data.error`;
   * `data.message` carries human copy the FE never discriminates on, because
   * the FE owns the operator-facing wording via its own literals.
   *
   * **The two codes carry different HTTP statuses, deliberately:**
   *
   * - `EMAIL_IN_USE` — **400**. The address already belongs to another
   *   account. Raised from the `email-PK` probe and, when a concurrent write
   *   wins the race, from the global email-uniqueness constraint. The caller
   *   must change the address; retrying as-is cannot succeed.
   * - `USER_ID_COLLISION` — **409**. The server-minted `userId` was taken
   *   between the probe and the write. Nothing the caller typed is wrong and
   *   the operation is retryable, so it must not share 400 with the above — a
   *   client treating 4xx-except-409 as "surface a field error, do not retry"
   *   would pin an unactionable message to a form field. Never a duplicate
   *   address, which is why it is not folded into `EMAIL_IN_USE`.
   *
   * Distinct from `LoginErrorCode`, which covers the sign-in lockout flow.
   */
  type UserWriteErrorCode = "EMAIL_IN_USE" | "USER_ID_COLLISION";

  interface UserGoogle extends User {
    displayName: string;
  }

  /**
   * A stored `User` plus the refresh token, where one is delivered in the body
   * at all.
   *
   * ⚠️ This is the STORED shape, and the auth responses built from it are
   * SANITIZED — several inherited fields never reach the wire: the
   * brute-force `login` counters, the legacy singular `role` write-alias, and
   * the write-side `search` index are all dropped, and `totp` arrives reduced
   * to `{ enabled, enrolledAt, recoveryCodesRemaining }` with its KMS
   * ciphertext handles and replay counters stripped inside the Lambda. So an
   * inherited field being declared here is not evidence it arrives; check it
   * survives the sanitize before consuming it off a login body.
   */
  interface AuthUser extends User {
    /**
     * ⚠️ Delivered in the body ONLY under the body refresh transport — the
     * native-mobile opt-in. The DEFAULT is cookie transport, where the token
     * ships in an HttpOnly `Set-Cookie` and this key is absent from the body
     * entirely.
     *
     * The tell for having trusted it as guaranteed: it reads `undefined` on an
     * ordinary browser login and NOTHING breaks, because the cookie the client
     * cannot see is doing the work. A client that persists this value and
     * refreshes from it therefore looks correct wherever body transport is on,
     * and silently never refreshes in the browser — i.e. everywhere real.
     */
    refreshToken?: string;

    /**
     * The "remember this device" trust, delivered in the body ONLY under the
     * body refresh transport — the native-mobile opt-in — and only on a login
     * that both asked to be remembered and actually PERFORMED a second factor.
     * The DEFAULT is cookie transport, where the trust ships in an HttpOnly
     * `sf_device` `Set-Cookie` and this key is absent from the body entirely.
     *
     * Mirrors `refreshToken` above exactly, including its failure mode: it
     * reads `undefined` on an ordinary browser login and nothing breaks,
     * because the cookie the client cannot see is doing the work. So its
     * absence is never evidence that the device was not trusted.
     *
     * ⚠️ Presenting it back is a SECOND-FACTOR bypass, not a session — it is
     * what lets a login skip the TOTP prompt. Treat it at rest exactly as the
     * refresh token is treated, never in a log, a URL or an analytics payload.
     */
    deviceToken?: string;
  }
}

export {}; // NOSONAR