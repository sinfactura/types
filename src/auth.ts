
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

}

export {}; // NOSONAR