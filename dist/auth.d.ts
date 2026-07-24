declare global {
    interface Login {
        email: string;
        password: string;
        /** TOTP step-up code (6-32 chars) — required by the BE only when the
         * account has 2FA enrolled; otherwise omit. */
        totpCode?: string;
        /** reCAPTCHA v3 token — required by the BE only after a
         * `CAPTCHA_REQUIRED` login rejection (api#1505); otherwise omit. */
        captchaToken?: string;
        /** Firebase App Check token — the mobile (body-transport) step-up,
         * required by the BE only after an `ATTESTATION_REQUIRED` login
         * rejection (api#1855); the native equivalent of `captchaToken`. */
        appCheckToken?: string;
    }
    interface Social {
        /** REQUIRED on the wire (the BE rejects an empty/missing token) —
         * was wrongly optional before 1.6.70. */
        accessToken: string;
        /** TOTP step-up code (6-32 chars) — same semantics as `Login.totpCode`. */
        totpCode?: string;
    }
    interface Register {
        email: string;
        password: string;
        cuit: string;
        fullName: string;
        phone?: string;
        acknowledgedSharedCuit?: boolean;
    }
    interface Recover {
        email: string;
    }
    type LoginErrorCode = 'WRONG_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_DISABLED' | 'CAPTCHA_REQUIRED' | 'CAPTCHA_INVALID' | 'ATTESTATION_REQUIRED' | 'ATTESTATION_INVALID';
    interface AccountLockedResponse {
        error: 'ACCOUNT_LOCKED';
        retryAfterSeconds: number;
    }
    interface WaitlistRegisterResponse {
        waitlistId: string;
        submittedAt: number;
    }
}
export {};
