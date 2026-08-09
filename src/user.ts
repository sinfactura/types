import type { NotificationTypeEnum } from "./notification";

declare global {
  interface User {
    storeId: string;
    userId: string;
    createdAt: number;
    fullName: string;
    phone: string;
    email: string;
    password?: string;
    roles: string;
    photoURL: string;
    photoData?: string; // transient base64 image upload (matches Brand/Category/Store)
    removePhotoURL?: string;
    disabled: boolean;
    search: string;
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
    packOrder?: boolean;
  };

  interface UserGoogle extends User {
    displayName: string;
  }

  interface AuthUser extends User {
    refreshToken: string;
  }
}

export {}; // NOSONAR