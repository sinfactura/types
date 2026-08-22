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
        notificationSound?: boolean;
        permissions?: UserPermissions;
        emailVerified?: boolean;
        emailVerifiedAt?: number;
        totp?: {
            enabled: boolean;
            secretRef?: string;
            pendingSecretRef?: string;
            pendingAt?: number;
            enrolledAt?: number;
            lastUsedAt?: number;
            lastCounter?: number;
            recoveryCodes?: {
                hash: string;
                usedAt?: number;
            }[];
            recoveryCodesGeneratedAt?: number;
            failedAttempts?: number;
            lockedUntil?: number;
        };
        warnings?: StoreWarning[];
        login?: {
            failedAttempts?: number;
            lockedUntil?: number;
            lastFailedAt?: number;
        };
    }
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
    interface AuthUser extends User {
        refreshToken: string;
    }
}
export {};
