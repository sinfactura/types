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
        photoData?: string;
        removePhotoURL?: string;
        disabled: boolean;
        search: string;
        accessToken: string;
        roleSeller?: boolean;
        roleProducts?: boolean;
        roleCustomers?: boolean;
        roleAfip?: boolean;
        notifications?: UserNotifications;
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
    interface UserGoogle extends User {
        displayName: string;
    }
    interface AuthUser extends User {
        refreshToken: string;
    }
}
export {};
