declare global {
    interface Login {
        email: string;
        password: string;
    }
    interface Social {
        accessToken?: string;
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
    type LoginErrorCode = 'WRONG_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_DISABLED' | 'CAPTCHA_REQUIRED' | 'CAPTCHA_INVALID';
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
