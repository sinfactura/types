
declare global {
	interface Login {
		email: string;
		password: string;
		/** TOTP step-up code (6-32 chars) — required only when the account has 2FA enrolled; otherwise omit. */
		totpCode?: string;
		/** reCAPTCHA v3 token — required only after a `CAPTCHA_REQUIRED` login rejection; otherwise omit. */
		captchaToken?: string;
		/** Firebase App Check token — the mobile step-up, required only after an `ATTESTATION_REQUIRED` rejection; the native equivalent of `captchaToken`. */
		appCheckToken?: string;
	}

	interface Social {
		/** REQUIRED on the wire (BE rejects an empty/missing token) — was wrongly optional before 1.6.70. */
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
		acknowledgedSharedCuit?: boolean; // shared-CUIT consent gate
	}

	interface Recover {
		email: string;
	}

	// Wire error codes for the password brute-force lockout flow. ATTESTATION_*
	// are the mobile (body-transport) captcha-tier equivalents of CAPTCHA_*.
	type LoginErrorCode =
		| 'WRONG_CREDENTIALS'
		| 'ACCOUNT_LOCKED'
		| 'ACCOUNT_DISABLED'
		| 'CAPTCHA_REQUIRED'
		| 'CAPTCHA_INVALID'
		| 'ATTESTATION_REQUIRED'
		| 'ATTESTATION_INVALID';

	// `retryAfterSeconds` (seconds) mirrors the FE's existing 429 rate-limit convention.
	interface AccountLockedResponse {
		error: 'ACCOUNT_LOCKED';
		retryAfterSeconds: number;
	}

	// `POST /auth?mode=register` response when `waitlist: true` is sent — no
	// accessToken/session; pre-launch waitlist submissions persist a
	// lightweight row instead of creating a tenant.
	interface WaitlistRegisterResponse {
		waitlistId: string;
		submittedAt: number;
	}

}

export {}; // NOSONAR