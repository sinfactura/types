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
    disabled: boolean;
    search: string;
    accessToken: string;
    // ROLES
    roleSeller?: boolean;
    roleProducts?: boolean;
    roleCustomers?: boolean;
    roleAfip?: boolean;
    // NOTIFICATIONS
    notifications?: UserNotifications;
    permissions?: UserPermissions;
    // EMAIL VERIFICATION (#773)
    // Grandfather clause: `emailVerified === undefined` means a legacy
    // user that predates the OTP flow — apps should treat undefined as
    // verified. New registrations carry an explicit `false` until OTP
    // completes; provider-verified social signups start at `true`.
    emailVerified?: boolean;
    emailVerifiedAt?: number;
    // TOTP 2FA (#68, api#636). `secretRef` / `pendingSecretRef` are
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
    };
  }

  // Per-user notification opt-ins, keyed by the canonical UPPERCASE
  // `NotificationTypeEnum` values — the only attribute names the BE
  // fanout filter-reads (`notifications.<KEY> = true`). Closed key set,
  // no string index (#78; the dynamic tenant-key taxonomy was dropped
  // in app#1675). Legacy lowercase keys (`orders`, `dollarOficial`, …)
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