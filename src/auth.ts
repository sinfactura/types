
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
		/**
		 * Opt in to a long-lived session. Absent or `false` issues the SHORT
		 * default lifetime, so a client that never learns about this field gets
		 * the safer one; only an explicit `true` extends it.
		 */
		rememberMe?: boolean;
		/**
		 * Opt in to remembering THIS device, so subsequent logins from it skip
		 * the TOTP step-up until the trust expires.
		 *
		 * ⚠️ Honoured only on a login that actually PERFORMED the step-up — it
		 * cannot bootstrap itself on a login that never presented a second
		 * factor. The trust is carried by a BE-managed HttpOnly cookie, never by
		 * a value the client stores or echoes back.
		 */
		trustDevice?: boolean;
	}

	interface Social {
		/** REQUIRED on the wire (BE rejects an empty/missing token) — was wrongly optional before 1.6.70. */
		accessToken: string;
		/** TOTP step-up code (6-32 chars) — same semantics as `Login.totpCode`. */
		totpCode?: string;
		/** Remember this device — same semantics as `Login.trustDevice`. */
		trustDevice?: boolean;
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

	/** `GET /auth?mode=verify-invite` — the token rides the QUERY STRING, not a request body. */
	interface VerifyInviteInput {
		token: string;
	}

	/**
	 * How far an invite token got, and the discriminator on every
	 * `verify-invite` body.
	 *
	 * `invalid` is deliberately COARSE: an unknown token, a malformed one and a
	 * real-but-EXPIRED one all answer `invalid`, resolved through the single
	 * lookup `verify-invite` and `accept-invite` share so the cases cannot be
	 * separated by timing either. ⚠️ There is no `expired` member, and adding
	 * one would undo that — it confirms to whoever holds a leaked token that the
	 * token was once real, and names the moment it stopped being so.
	 */
	type VerifyInviteStatus = 'pending' | 'accepted' | 'revoked' | 'invalid';

	/**
	 * The one branch that discloses tenant detail, and only because the caller
	 * is holding a live, unexpired token issued for that tenant.
	 *
	 * ⚠️ No `email`, and do not add one: the invitee already knows the address
	 * — the invite reached them at it — so echoing it buys the legitimate caller
	 * nothing and turns a leaked token into a way to learn WHO was invited.
	 *
	 * Both name fields are `''` rather than absent when the underlying row
	 * carries no value, so a renderer never has to tell the two apart.
	 */
	interface VerifyInvitePendingResponse {
		status: 'pending';
		storeName: string;
		/** Display name of the team member who issued the invite. */
		inviterName: string;
		role: string;
		/** Unix ms, and always still in the future here — an elapsed invite answers `invalid`. */
		expiresAt: number;
	}

	/**
	 * ⚠️ Bare BY DESIGN — the sparseness IS the security property, not an
	 * oversight to tidy up. A token that will not accept must not disclose which
	 * store it named; adding `storeName` "so the error screen reads better" is
	 * precisely the disclosure this shape exists to prevent.
	 *
	 * ⚠️ `invalid` rides a **404** carrying `error: 'INVITATION_NOT_FOUND'`,
	 * while `accepted` and `revoked` ride 200. A client that parses the body
	 * only on a 2xx therefore handles three of the four statuses and silently
	 * never sees the most common one.
	 */
	interface VerifyInviteClosedResponse {
		status: 'accepted' | 'revoked' | 'invalid';
	}

	/**
	 * Unauthenticated pre-check — only what the accept form needs to render,
	 * discriminated on `status`.
	 *
	 * ⚠️ Reshaped in 1.10.136. Through 1.10.135 this declared a boolean
	 * `valid` discriminator alongside an `email` and an `invitedByName`, none of
	 * which this endpoint has ever sent — the inviter key is `inviterName`, and
	 * there is no `email`. Code written against those names read `undefined` at
	 * runtime while compiling clean, so the compile error this reshape produces
	 * is the defect surfacing, not a new one.
	 */
	type VerifyInviteResponse = VerifyInvitePendingResponse | VerifyInviteClosedResponse;

	/**
	 * `POST /auth {mode:'accept-invite'}` request body — exactly the three fields
	 * `acceptInviteSchema` accepts (`stacks/lambdas/auth/_acceptInvite.ts:45-49`),
	 * and no more.
	 *
	 * ⚠️ A `phone?` was published here through 1.10.138 and has never existed on
	 * the wire: the schema is not `.loose()`, so the field was undeliverable, and
	 * the app's mutation has always sent only these three. `token` is the 64-char
	 * invitation token. There is deliberately NO `email` — it is read off the
	 * INVITATION row server-side, so an invitee cannot redirect an invite to an
	 * address it was not issued to.
	 */
	interface AcceptInviteInput {
		token: string;
		fullName: string;
		password: string;
	}

	/**
	 * The `body.error` codes `POST /auth {mode:'accept-invite'}` can actually
	 * return, each verified against a return site in
	 * `stacks/lambdas/auth/_acceptInvite.ts`:
	 *
	 * - `VALIDATION_FAILED` (400) — `validateRequest` rejected the body against
	 *   `acceptInviteSchema`; also the WEAK-PASSWORD case, since the minimum is a
	 *   schema clause (`password: z.string().min(8)`) rather than its own code.
	 * - `EMAIL_ALREADY_MEMBER` (400) — the invited address already belongs to a
	 *   user (`:141`, from the email-constraint transaction collision).
	 * - `INVITATION_NOT_FOUND` (404) — no such token, or the invitation's own
	 *   store vanished mid-flight (`:145`, `:182`).
	 * - `INVITATION_NOT_PENDING` (409) — already accepted, revoked or expired,
	 *   including losing the accept race to a concurrent request (`:150`, `:188`).
	 * - `INVALID_ROLE` (403) — the stored role is one this anonymous route
	 *   refuses to grant; the invitation is BURNED as well as refused (`:208`).
	 * - `PLAN_LIMIT_EXCEEDED` (403) — the seat cap re-check found no room (`:76`).
	 *   Carries `feature`/`current`/`limit` alongside, unlike the others.
	 *
	 * ⚠️ Through 1.10.138 this union was `INVITE_INVALID | EMAIL_ALREADY_REGISTERED
	 * | SEAT_LIMIT_REACHED | WEAK_PASSWORD` — four names sharing ZERO members with
	 * what the handler emits, so a consumer switching on them matched nothing and
	 * fell through to a generic error while compiling clean. This is a correction
	 * of a contract that was never real, not a migration: nothing consumed the old
	 * names.
	 *
	 * Not-found and real-but-expired deliberately collapse to the same 404 body as
	 * `verify-invite`, so accept cannot be used as a finer-grained probe than the
	 * pre-check already is.
	 */
	type AcceptInviteErrorCode =
		| 'VALIDATION_FAILED'
		| 'EMAIL_ALREADY_MEMBER'
		| 'INVITATION_NOT_FOUND'
		| 'INVITATION_NOT_PENDING'
		| 'INVALID_ROLE'
		| 'PLAN_LIMIT_EXCEEDED';

	/**
	 * Success shape — acceptance logs the new user straight in, so this is a
	 * full session payload rather than an acknowledgement.
	 */
	interface AcceptInviteResponse {
		userId: string;
		storeId: string;
		fullName: string;
		/**
		 * Read off the INVITATION row, never off the request — an invitee cannot
		 * redirect an invite to an address it was not issued to.
		 */
		email: string;
		/**
		 * Plural name, single value: a bare role STRING, matching `User.roles` as
		 * every create path in the api stores it. Never an array on this route, so
		 * a consumer that reaches for `.map` throws.
		 */
		roles: string;
		accessToken: string;
		/** Transport-conditional exactly as `AuthUser.refreshToken` — absent on the default cookie path. */
		refreshToken?: string;
	}

}

export {}; // NOSONAR
