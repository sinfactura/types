
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
		acknowledgedSharedCuit?: boolean; // api#1328 — shared-CUIT consent gate
	}

	interface Recover {
		email: string;
	}

	// api#1505 — wire error codes for the password brute-force lockout flow.
	type LoginErrorCode = 'WRONG_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_DISABLED' | 'CAPTCHA_REQUIRED' | 'CAPTCHA_INVALID';

	// `retryAfterSeconds` (seconds) mirrors the FE's existing 429 rate-limit convention.
	interface AccountLockedResponse {
		error: 'ACCOUNT_LOCKED';
		retryAfterSeconds: number;
	}

	// api#640 — `POST /auth?mode=register` response when `waitlist: true` is
	// sent. No accessToken/session: pre-launch waitlist submissions persist a
	// lightweight row instead of creating a tenant.
	interface WaitlistRegisterResponse {
		waitlistId: string;
		submittedAt: number;
	}

}

export {}; // NOSONAR