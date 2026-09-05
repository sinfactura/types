
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


	/**
	 * One row of `GET /auth?mode=sessions` — a storefront customer's own
	 * device/session list, projected from that customer's refresh-token
	 * partition. The token digest is never projected and can never appear here.
	 *
	 * ⚠️ `issuedAt`, `expiresAt` and `revokedAt` are **Unix SECONDS**, not
	 * milliseconds — they are written as `Math.floor(Date.now() / 1000)`. The
	 * sibling `CustomerLoginAttempt` row from `GET /auth?mode=login-history`,
	 * on the SAME `/auth` path, carries `createdAt` in **milliseconds**, and a
	 * customer security screen typically renders both lists side by side.
	 * Passing these three straight to a `Date` constructor dates every session
	 * to January 1970; multiply by 1000 here, and do NOT multiply the
	 * login-history value.
	 *
	 * `userAgent` and `ip` are OPTIONAL, not empty strings: the writer omits
	 * each attribute entirely when it had no value at login time, so a real row
	 * can carry neither. Render a placeholder rather than assuming a string.
	 */
	interface CustomerSession {
		/**
		 * Rotation family. Every refresh rotation descending from one login
		 * shares it, so two rows with the same `family` are one device over time.
		 */
		family: string;
		/** This token's unique id — the handle `revoke-session` takes. */
		jti: string;
		/** Unix SECONDS. */
		issuedAt: number;
		/** Unix SECONDS. */
		expiresAt: number;
		/** Absent when the login recorded no user agent. */
		userAgent?: string;
		/** Absent when the login recorded no client IP. */
		ip?: string;
		/**
		 * Unix SECONDS. Present only on an already-revoked row, which the default
		 * listing excludes — so it appears only under `?includeRevoked=true`.
		 */
		revokedAt?: number;
		/** True for the one session making this request. */
		current: boolean;
	}

	/**
	 * `GET /auth?mode=sessions[&includeRevoked=true]` — the 200 body.
	 *
	 * ⚠️ `complete: false` means the list is a PREFIX of the customer's
	 * sessions, not all of them. The read is paged over a single partition and
	 * stops on a read budget; `includeRevoked=true` spans every row ever
	 * rotated (hundreds for a long-lived session), so it truncates far sooner
	 * than the live-only default.
	 *
	 * Rendering a `complete: false` list as though it were the whole truth is
	 * the exact failure this flag exists to prevent: a customer checking
	 * whether they have been breached is shown a list a stolen session is
	 * simply missing from, and concludes they are safe. Say the list is partial,
	 * and keep "log out everywhere else" reachable — that sweep does not depend
	 * on the listing being complete.
	 *
	 * ⚠️ POLARITY, and it is the inverse of its neighbour. This flag is TRUE
	 * when the list is WHOLE. The sibling `GET /auth?mode=login-history` on the
	 * same `/auth` path answers with `truncated`, which is TRUE when ITS list is
	 * SHORT. Both are deployed and consumed in production, so the asymmetry is
	 * documented here rather than normalised. A screen showing both lists must
	 * not share one boolean between them: copying the `truncated` branch onto
	 * `complete` inverts the warning and hides precisely the case it was
	 * written for.
	 */
	interface CustomerSessionsResponse {
		data: CustomerSession[];
		/**
		 * TRUE = the whole list. FALSE = a prefix, sessions are missing.
		 * Inverse polarity to login-history's `truncated`.
		 */
		complete: boolean;
	}

	/**
	 * `POST /auth { mode: 'revoke-session', jti }` — the 200 body, discriminated
	 * on `message`. `revoked` echoes the `jti` that was ended.
	 *
	 * `logged_out_self` means the caller revoked the session it is currently
	 * using: the response also clears the refresh cookie, so the client is now
	 * signed out and must route to login instead of re-rendering the device
	 * list. `session_revoked` means some OTHER device was ended and this
	 * session continues.
	 *
	 * ⚠️ A miss does NOT always answer 404. When the session lookup was capped
	 * — the same shortfall `CustomerSessionsResponse.complete: false` reports —
	 * and the target `jti` was not among the rows read, the endpoint answers
	 * **409** with `error: 'session_lookup_incomplete'` INSTEAD of a 404, on
	 * purpose: a miss on a capped list is not proof of absence.
	 *
	 * Treating that 409 as "already gone" is the dangerous handling. It tells
	 * someone their stolen device was killed while its token is still live. The
	 * 409 means "ask again" — retry, or fall back to `revoke-others`, which
	 * needs no lookup. Only a genuine 404 `session_unknown` means the session
	 * does not exist.
	 */
	type RevokeSessionResult =
		| { message: 'session_revoked'; revoked: string }
		| { message: 'logged_out_self'; revoked: string };

	/**
	 * `POST /auth { mode: 'revoke-others' }` — the 200 body. Every session in
	 * the caller's partition except the one making the request is dead.
	 *
	 * `complete` is the literal `true` and carries no information on its own,
	 * because an INCOMPLETE sweep is deliberately NOT a 200: it answers **502**
	 * with `error: 'revoke_incomplete'` and a `revokedCount` that is a PARTIAL
	 * count. Some refresh tokens survived that sweep and are STILL USABLE.
	 *
	 * So read the outcome from the STATUS, never from the count. On 200 the
	 * sweep finished; on 502 the customer is not logged out everywhere else,
	 * however large `revokedCount` looks. Rendering "you have been signed out
	 * of N devices" off the 502's count tells a customer their stolen session
	 * is gone when it is not — surface a retry instead.
	 */
	interface RevokeOthersResult {
		message: 'others_revoked';
		/** Sessions dead as a result of this sweep. Excludes the current one. */
		revokedCount: number;
		/** Always `true` on a 200 — an incomplete sweep answers 502 instead. */
		complete: true;
	}

	/**
	 * How one recorded login attempt ended. The discriminator on
	 * `CustomerLoginAttempt`.
	 *
	 * - `success` — authenticated.
	 * - `wrong_password` — credentials rejected.
	 * - `disabled` — the account exists but is disabled.
	 * - `blocked` — brute-force lockout on the password leg; the attempt was
	 *   refused before the credentials were checked.
	 * - `requires_2fa` — password accepted, TOTP step-up issued. NOT a
	 *   completed login: a run of these with no following `success` means
	 *   somebody holds the password and stalled at the second factor.
	 * - `wrong_totp` — the step-up code was wrong.
	 * - `totp_replay` — an already-used code was presented again and rejected.
	 * - `totp_locked` — brute-force lockout active on the TOTP leg.
	 */
	type LoginOutcome =
		| 'success'
		| 'wrong_password'
		| 'disabled'
		| 'blocked'
		| 'requires_2fa'
		| 'wrong_totp'
		| 'totp_replay'
		| 'totp_locked';

	/**
	 * One row of `GET /auth?mode=login-history[&days=N]` — a storefront
	 * customer's own login audit trail. The stored row reaches the wire
	 * unmapped (only the DynamoDB keys are dropped), so this is the row shape,
	 * not a projection of it.
	 *
	 * ⚠️ MIXED TIME UNITS in one row. `createdAt` is **Unix MILLISECONDS**
	 * (`Date.now()`), while `ttl` is **Unix SECONDS** because it is a DynamoDB
	 * TTL attribute. And the sessions row on the SAME `/auth` path
	 * (`CustomerSession.issuedAt`/`expiresAt`/`revokedAt`) is **Unix SECONDS**.
	 * One storefront security screen renders both lists, so the same helper
	 * cannot format both: multiply the session timestamps by 1000, pass
	 * `createdAt` to a `Date` directly.
	 *
	 * ⚠️ AN EMPTY HISTORY IS NOT PROOF THAT NOTHING WAS ATTEMPTED. Attempts on
	 * an unknown email are deliberately NOT recorded — a documented anti-DoS
	 * choice, since recording them would let anyone grow an unbounded partition
	 * for an account that does not exist — and neither is any leg that resolved
	 * no single principal to attribute the row to. Never render "no login
	 * attempts" as "nobody tried".
	 *
	 * `jti` is the same identifier as `CustomerSession.jti`, so a `success` row
	 * can be joined to the session it created — that is how a customer tells
	 * "this unfamiliar sign-in is the device still listed as live" from "it has
	 * since expired".
	 */
	interface CustomerLoginAttempt {
		outcome: LoginOutcome;
		/** Unix MILLISECONDS. */
		createdAt: number;
		/** Absent when the attempt recorded no client IP. */
		ip?: string;
		/** Absent when the attempt recorded no user agent. */
		userAgent?: string;
		/** Client build string, when the caller sent one. */
		clientVersion?: string;
		/**
		 * The refresh token id this attempt minted. Present on `success` rows
		 * only, and joins to `CustomerSession.jti`.
		 */
		jti?: string;
		/**
		 * Unix SECONDS — a DynamoDB TTL, thirty days after the attempt. Not a
		 * millisecond timestamp like `createdAt` on the same row.
		 */
		ttl?: number;
		/**
		 * How the customer authenticated.
		 *
		 * ⚠️ OPTIONAL, and the optionality is load-bearing. Writes are
		 * forward-only: every row recorded before this field shipped has no
		 * `provider` and never will. A reader MUST treat absence as UNKNOWN.
		 * Defaulting it to `'password'` mislabels the entire existing history as
		 * password logins, including every social sign-in already recorded —
		 * which is the exact opposite of what this field is for.
		 *
		 * It exists because the screen's question is "did someone else get in".
		 * "Somebody signed in" is far weaker than "somebody signed in with
		 * Google" to a customer who knows they only ever use a password.
		 *
		 * ⚠️ Spelled `'password'` here, NOT `'email'`. The already-published
		 * `CustomerLoggedInEvent.method` union models the same cases as
		 * `'email' | 'google' | 'facebook' | 'apple'`, so the analytics value
		 * cannot be assigned to this field unchanged — map the
		 * password-via-Firebase case across explicitly rather than reusing the
		 * variable. Every OTHER member shares its spelling across the two
		 * unions; `'password'`/`'email'` is the only pair that differs.
		 *
		 * Typed as the shared `CustomerSignInProvider`. ⚠️ That union is NOT
		 * closed for good — it gained `'apple'` when Apple went live on the
		 * Firebase project, and it will gain a member again for any further
		 * provider enabled there. Do not enumerate its members into an
		 * exhaustive `switch` or a `Record<>` in a consumer: a widening is a
		 * patch release here and a compile break there. Render an unrecognised
		 * provider as itself rather than as blank or "Unknown" — this field is
		 * read on the screen that answers "was this me?", where a blank is
		 * worse than an unfamiliar word.
		 */
		provider?: CustomerSignInProvider;
	}

	/**
	 * `GET /auth?mode=login-history[&days=N]` — the 200 body. `days` is clamped
	 * server-side to at most 30, which is also the default and the row TTL.
	 *
	 * ⚠️ POLARITY, and it is the inverse of its neighbour. `truncated` is TRUE
	 * when rows are MISSING. The sibling `GET /auth?mode=sessions` on the same
	 * `/auth` path answers with `complete`, which is TRUE when its list is
	 * WHOLE. Both flags are root siblings of `data`, both ship today, and one
	 * screen renders both lists — a consumer that assumes one spelling covers
	 * the whole endpoint gets the DANGEROUS reading on exactly one of the two,
	 * because a missing key reads as falsy and falsy means "fine" on one flag
	 * and "rows are gone" on the other. Read each by its own name.
	 *
	 * ⚠️ `truncated: true` here is not routine paging. The read cap is a wide
	 * multiple of an organic partition, and the partition is written by the
	 * FAILURE path too — so anyone who can reach the login endpoint for a known
	 * address can inflate it. Hitting the cap is itself evidence that this
	 * account has been hammered, which is precisely what the customer opened
	 * the screen to learn. Surface it as a finding, not as a "load more".
	 *
	 * ⚠️ The rows dropped when it truncates are the OLDEST in the window — the
	 * list is newest-first — and there is no resume cursor. The start of an
	 * attack is the end that gets lost.
	 */
	interface CustomerLoginHistoryResponse {
		/** Newest first. */
		data: CustomerLoginAttempt[];
		/**
		 * TRUE = rows are MISSING. Inverse polarity to `?mode=sessions`'s
		 * `complete`.
		 */
		truncated: boolean;
	}

	// Customer sign-in methods (`/auth` — connected accounts, link, unlink)

	/**
	 * Which credential a customer signs in with.
	 *
	 * ⚠️ THE UNION IS CLOSED; FIREBASE'S PROJECT CONFIGURATION IS NOT.
	 * Which providers are enabled lives in the shared Firebase console, not in
	 * any repo, so enabling a fifth (an OIDC connection, say) makes a sign-in
	 * reachable that this type cannot name — and it takes a console click, while
	 * widening this union takes a release. The two are not gated on each other.
	 * A consumer must therefore tolerate an unrecognised provider string rather
	 * than treating a `switch` over these members as exhaustive at runtime.
	 * Apple is the case that already proved it: the provider went live on the
	 * Firebase project while this union still named three members, so
	 * `'apple.com'` sign-ins arrived unrecognised — un-gated and mislabelled —
	 * without anything failing loudly.
	 *
	 * ⚠️ SHORT NAMES, not Firebase provider ids. Firebase spells the social
	 * three `'google.com'`, `'facebook.com'` and `'apple.com'` — that is what a
	 * browser's `providerData[].providerId` carries, and what the storefront's
	 * own `getLinkedProviders()` returns today. A comparison between a value of
	 * this type and one of those is ALWAYS false and throws nothing; map across
	 * explicitly at the boundary.
	 *
	 * ⚠️ And it is `'password'`, NOT `'email'`. The already-published
	 * `CustomerLoggedInEvent.method` models the same cases as
	 * `'email' | 'google' | 'facebook' | 'apple'`, so neither value is
	 * assignable to the other's slot. Both spellings ship; this is documented
	 * rather than reconciled, because `method` is an established analytics
	 * contract.
	 */
	type CustomerSignInProvider = 'google' | 'facebook' | 'apple' | 'password';

	/**
	 * Whether a stored sign-in method may be used, or has been explicitly turned
	 * off by the customer.
	 *
	 * ⚠️ `'refused'` IS WHAT MAKES UNLINK WORK, and it is the subtlest part of
	 * this whole design — the single most likely thing for an implementer or a
	 * reviewer to get wrong.
	 *
	 * Enforcement cannot simply switch on at deploy time. Every customer that
	 * exists today has NO stored methods and, because writes here are
	 * forward-only, never will until they sign in again. So a naive "refuse a
	 * provider that is not linked" would lock out the entire installed base on
	 * the first request after the deploy. The transition is therefore
	 * TRUST-ON-FIRST-USE:
	 *
	 * - No stored methods → resolve by verified email exactly as today, and
	 *   RECORD the provider and its Firebase UID as a side effect. Behaviour is
	 *   unchanged; the row heals itself on first use.
	 * - Stored methods present → the provider must be among them AND the UID must
	 *   match. This is the enforcement, and it only ever applies to rows that
	 *   have already healed.
	 *
	 * That is exactly why an unlink must RECORD A REFUSAL rather than deleting
	 * the entry. If unlink merely removed it, the row would be back to "no
	 * stored methods for that provider" and the next sign-in would re-add it
	 * under trust-on-first-use — THE UNLINK WOULD SILENTLY UNDO ITSELF, with a
	 * 200 on the unlink and no error anywhere to say so. A refused entry is a
	 * tombstone, and it has to outlive the thing it replaced.
	 */
	type CustomerSignInMethodStatus = 'linked' | 'refused';

	/**
	 * One sign-in method recorded against a customer.
	 *
	 * ⚠️ THE GATE CLOSES PER CUSTOMER, NOT PER DEPLOY. Until a given customer's
	 * first social sign-in after this ships, their account still resolves by
	 * verified email alone — unchanged from today, where anyone holding a
	 * verified Google identity for a customer's email address signs in as that
	 * customer whether or not anything was ever linked. A consumer must NOT
	 * present a "connected accounts" screen as a security boundary that is
	 * already in force for everyone; for an account with no stored methods it
	 * describes what WILL be enforced, not what is.
	 *
	 * ⚠️ A `refused` entry is stored state, never rendered — see
	 * `CustomerSignInMethodsResponse.data.methods`, which carries the LINKED
	 * entries only.
	 */
	interface CustomerSignInMethod {
		provider: CustomerSignInProvider;
		/**
		 * `'linked'` = usable. `'refused'` = explicitly unlinked and must not be
		 * re-adopted by trust-on-first-use. Read `CustomerSignInMethodStatus` for
		 * why deleting instead of refusing silently reverses an unlink.
		 */
		status: CustomerSignInMethodStatus;
		/**
		 * The Firebase UID this provider was seen under, captured from a verified
		 * ID token at link (or trust-on-first-use) time, and compared on every
		 * later sign-in with that provider.
		 *
		 * ABSENT FOR `'password'`, which never touches Firebase at all — email and
		 * password sign-in is api-side. Absence is therefore not "not captured
		 * yet"; for the password method there is no such identifier to capture.
		 *
		 * ⚠️ It is an identifier, not a credential — but it is also the only value
		 * in this shape that is worth withholding. The api's `response()` strips
		 * credential keys inside `data` and does NOT recurse into nested arrays, so
		 * nothing credential-bearing (`hash`, `salt`) may ever be added to a
		 * `CustomerSignInMethod`: it would travel verbatim.
		 */
		firebaseUid?: string;
		/**
		 * ms-epoch. Absent on an entry created by trust-on-first-use before the
		 * field was written, and on a `refused` entry that was never explicitly
		 * linked.
		 *
		 * ⚠️ MILLISECONDS, like `CustomerLoginAttempt.createdAt` on the same
		 * `/auth` path — and UNLIKE `CustomerSession`'s `issuedAt`/`expiresAt`/
		 * `revokedAt`, which are Unix SECONDS. One storefront security screen
		 * renders all three lists, so no single date formatter covers them.
		 */
		linkedAt?: number;
		/**
		 * ms-epoch of the explicit unlink. Set when — and only when — `status`
		 * becomes `'refused'`; a method that was never unlinked does not carry it.
		 */
		refusedAt?: number;
		/**
		 * ms-epoch of the most recent sign-in through this provider.
		 *
		 * ⚠️ Not a login-history substitute and not a completeness claim: it is
		 * only ever as old as the first sign-in AFTER this shipped, so a provider
		 * used for years reads as recently-first-seen. Absent means "not seen
		 * since this began recording", never "never used".
		 */
		lastUsedAt?: number;
	}

	/**
	 * The 200 body of the read that answers "how can this account be signed into".
	 *
	 * ⚠️ `methods` CARRIES THE LINKED ENTRIES ONLY. Refused entries are stored —
	 * they have to be, or an unlink undoes itself — and are deliberately not
	 * exposed. So ABSENCE IS AMBIGUOUS ON THE WIRE and only the server can
	 * resolve it: a provider missing from this list is either never-linked or
	 * explicitly-refused. Do not render "never connected" off absence, and do not
	 * infer that a link attempt will succeed from it.
	 *
	 * ⚠️ Note the nesting: `methods` sits under `data`, not at the root beside
	 * it, unlike `CustomerSessionsResponse.data` / `CustomerLoginHistoryResponse.data`
	 * which put their array directly at `data`. `hasPassword` is part of the
	 * answer rather than a flag about it, and keeping both under `data` is also
	 * what keeps the api's central credential strip (which acts on `data` and one
	 * level into its values) covering this payload.
	 */
	interface CustomerSignInMethodsResponse {
		data: {
			/** LINKED entries only. A refused provider is invisible here. */
			methods: CustomerSignInMethod[];
			/**
			 * DERIVED, never stored: "does a usable password credential exist for
			 * this account". The api computes it from the customer's stored hash,
			 * which is stripped from every response and can never be inspected
			 * client-side — which is precisely why this boolean has to exist.
			 *
			 * ⚠️ `false` IS A REAL AND COMMON STATE, not an error: a customer who
			 * registered through Google has no password, and the operator create path
			 * makes a password optional, so imported customers have none either.
			 *
			 * It is also the reason the last-credential guardrail is necessary at
			 * all. Firebase cannot see this — password sign-in never touches it — so
			 * no client-side "is this my last way in" check can be correct. Only the
			 * api sees both halves.
			 */
			hasPassword: boolean;
		};
	}

	/**
	 * The 200 body payload of an explicit link.
	 *
	 * `linked` is always the literal `true`: a refusal answers 4xx with an
	 * `error` from `SignInMethodErrorCode` instead, so this field never reports a
	 * failure and must not be branched on as though it could. Check the status.
	 */
	interface CustomerLinkSignInMethodResult {
		linked: true;
		provider: CustomerSignInProvider;
	}

	/**
	 * The 200 body payload of an explicit unlink.
	 *
	 * `unlinked` is always the literal `true` — same contract as
	 * `CustomerLinkSignInMethodResult.linked`; read the outcome from the status.
	 *
	 * ⚠️ A 200 here means the provider was marked REFUSED, not erased. The entry
	 * survives as a tombstone so that trust-on-first-use cannot re-adopt it, and
	 * it stops appearing in `CustomerSignInMethodsResponse` — which is why a
	 * re-read after an unlink shows the same thing a never-linked provider shows.
	 */
	interface CustomerUnlinkSignInMethodResult {
		unlinked: true;
		provider: CustomerSignInProvider;
	}

}

/**
 * `body.error` codes the sign-in-method paths can refuse with.
 *
 * A CONST TUPLE, not a bare union, because the consumer's job is an exhaustive
 * `Record<SignInMethodErrorCode, string>` of user-facing copy — and a bare union
 * cannot key one the compiler re-checks when a member is added. Module-scope
 * rather than ambient, so importing the VALUES is the only way to read them; a
 * surviving global would let a consumer keep matching strings and never notice
 * the tuple grew.
 *
 * ⚠️ NO HTTP STATUS IS STATED FOR ANY OF THESE, deliberately. Match on
 * `body.error`, never on a status you assumed here. The status is chosen at each
 * handler's return site, and two members share a status while meaning opposite
 * things.
 *
 * ⚠️ The previous docblock claimed "these modes do not exist in the api yet;
 * this cohort is published AHEAD of it". That stopped being true without anyone
 * editing it: five of the members below have been ON THE WIRE and unpublished,
 * `SIGN_IN_METHODS_CONFLICT` since the sign-in-methods race fix shipped. A
 * contract that lags its own emitter is the failure this tuple closes.
 *
 * - `SIGN_IN_METHOD_LAST_CREDENTIAL` (unlink) — the guardrail. Removing this
 *   provider would leave the account with no way in at all: no other linked
 *   provider and no password. Correct ONLY because the api sees both the social
 *   providers and the password credential. Offer "set a password first", not a
 *   retry.
 * - `SIGN_IN_METHOD_NOT_LINKED` (unlink) — nothing to unlink. ⚠️ Reachable for a
 *   provider the customer signs in with RIGHT NOW: a working Google sign-in is
 *   still not a linked one.
 * - `SIGN_IN_METHOD_ALREADY_LINKED` (link) — already recorded against the
 *   account. Idempotent from the customer's point of view; render the connected
 *   state rather than an error.
 * - `SIGN_IN_PROVIDER_REFUSED` (social sign-in) — stored with `status: 'refused'`,
 *   so the unlink is doing its job. NOT a credential failure and not retryable:
 *   the token was perfectly valid. Route to "sign in another way", or re-linking.
 * - `SIGN_IN_UID_MISMATCH` (social sign-in) — linked, but to a DIFFERENT Firebase
 *   UID than this verified token carries. Closes the gap where a matching email
 *   address was enough. A security event, not a bad password.
 * - `SIGN_IN_IDENTITY_MISMATCH` (link) — the minted token's identity is not the
 *   account being linked to. ⚠️ Distinguishable here and deliberately NOT on the
 *   unauthenticated sign-in path: the linking caller is cookie-authenticated and
 *   already holds both operands, so naming the mismatch discloses nothing it did
 *   not supply. Naming it on sign-in would enumerate the customer table.
 * - `SIGN_IN_IDENTITY_UNVERIFIED` (link) — the provider asserts an identity it
 *   has not itself verified.
 * - `INVALID_ID_TOKEN` — the token failed verification outright: malformed,
 *   expired, or signed by the wrong issuer. Retryable by re-authenticating.
 * - `SIGN_IN_PROVIDER_UNSUPPORTED` — the provider is not one this store accepts.
 *   A configuration answer, not a credential one.
 * - `SIGN_IN_METHODS_CONFLICT` — a concurrent writer won the row. The retry
 *   budget is already spent by the time this reaches the wire, so it is
 *   terminal for this request: surface "please retry", never auto-retry again.
 *   ⚠️ It collapses TWO distinct DynamoDB failures — a transaction cancellation
 *   from the shared write helper and a bare conditional-check failure from the
 *   social path. That split never reaches the wire, and must not: a caller
 *   cannot act on which transport lost the race.
 * - `SIGN_IN_RELAY_IDENTITY_UNRESOLVED` — a private-relay identity could not be
 *   resolved to a known account. Distinguishable so the client can steer the
 *   customer to link rather than showing a generic failure; the relay address
 *   itself is deliberately not carried, since it is re-derivable from the token
 *   on the next sign-in.
 */
export const SIGN_IN_METHOD_ERROR_CODES = [
	'SIGN_IN_METHOD_LAST_CREDENTIAL',
	'SIGN_IN_METHOD_NOT_LINKED',
	'SIGN_IN_METHOD_ALREADY_LINKED',
	'SIGN_IN_PROVIDER_REFUSED',
	'SIGN_IN_UID_MISMATCH',
	'SIGN_IN_IDENTITY_MISMATCH',
	'SIGN_IN_IDENTITY_UNVERIFIED',
	'INVALID_ID_TOKEN',
	'SIGN_IN_PROVIDER_UNSUPPORTED',
	'SIGN_IN_METHODS_CONFLICT',
	'SIGN_IN_RELAY_IDENTITY_UNRESOLVED',
] as const;

export type SignInMethodErrorCode = (typeof SIGN_IN_METHOD_ERROR_CODES)[number];

/**
 * `body.error` codes the operator refresh/session leg can refuse with —
 * `POST /auth { mode: 'refresh' }` and the body-transport ingress it shares with
 * `logout` and `sessions`.
 *
 * A CONST TUPLE for the same reason as the sign-in cohort above: consumers
 * switch exhaustively on these, and a bare union cannot key a `Record` the
 * compiler re-checks when a member is added. Module-scope, not ambient.
 *
 * ⚠️ Published because every consumer was hand-pinning them and at least one had
 * them WRONG — lowercase spellings that predated the casing normalisation. A
 * hand-pinned wire contract does not fail loudly when it drifts; it silently
 * stops matching, and a session-expiry branch that never fires looks like a
 * working app until the token actually expires.
 *
 * The status is stated per member below because the client obligation differs by
 * status, but ⚠️ MATCH ON `body.error`, never on the status alone — 401 covers
 * six distinct causes with one remedy, and 409 is not a failure at all.
 *
 * - `MISSING_REFRESH_TOKEN` · 401 — no token presented at all.
 * - `INVALID_REFRESH_TOKEN` · 401 — presented, did not verify.
 * - `NOT_A_REFRESH_TOKEN` · 401 — a well-formed token of the wrong kind, e.g. an
 *   access token replayed at the refresh endpoint.
 * - `LEGACY_STATELESS_TOKEN` · 401 — minted before refresh tokens were tracked
 *   server-side. Indistinguishable from expiry to the user; same remedy.
 * - `CSRF_ORIGIN_REJECTED` · 403 — ⚠️ COOKIE TRANSPORT ONLY, and therefore
 *   UNREACHABLE from a native client, which cannot send the cookie in the first
 *   place. A native client seeing this is not a CSRF failure to handle: it means
 *   the request went out on the wrong transport.
 * - `REFRESH_TOKEN_UNKNOWN` · 401 — verified, but no longer stored.
 * - `FAMILY_REVOKED` · 401 — the whole token family was invalidated, which is
 *   what a detected replay looks like from here. Wipe the session; do not retry.
 * - `SESSION_EXPIRED_ABSOLUTE` · 401 — the session hit its absolute lifetime cap.
 *   Rotation cannot extend past it, so re-login is the only path.
 * - `CONCURRENT_ROTATION` · 409 — ⚠️ NOT a failure and NOT a reason to log out.
 *   Another in-flight request is already rotating. Re-read the stored token ONCE
 *   and proceed; a retry loop here is how a client turns one race into a
 *   thundering herd against its own session.
 *
 * ⚠️ 401 members: wipe the session and route to login. Treating any of them as
 * retryable produces an infinite refresh loop against a token that will never
 * verify again.
 */
export const REFRESH_ERROR_CODES = [
	'MISSING_REFRESH_TOKEN',
	'INVALID_REFRESH_TOKEN',
	'NOT_A_REFRESH_TOKEN',
	'LEGACY_STATELESS_TOKEN',
	'CSRF_ORIGIN_REJECTED',
	'REFRESH_TOKEN_UNKNOWN',
	'FAMILY_REVOKED',
	'SESSION_EXPIRED_ABSOLUTE',
	'CONCURRENT_ROTATION',
] as const;

export type RefreshErrorCode = (typeof REFRESH_ERROR_CODES)[number];

/**
 * Login-leg discriminators that are a CHALLENGE rather than a refusal — the
 * credentials were accepted and the server is asking for one more factor.
 *
 * ⚠️ Kept apart from `LoginErrorCode` deliberately. Those members mean the
 * attempt FAILED; this one means it is still in progress. A consumer that folds
 * them together renders "wrong password" at a 2FA prompt.
 *
 * - `REQUIRES_2FA` · 401 — re-submit the same credentials plus `totpCode` in one
 *   call. Stateless: nothing is held server-side between the challenge and the
 *   answer, so there is no pending-login handle to keep and nothing to expire.
 *
 * ⚠️ An `ENROLLMENT_REQUIRED` step-up — a tier that mandates 2FA meeting an
 * operator who has not enrolled — is DELIBERATELY ABSENT: no emitter exists on
 * the wire today. It is added here when, and only when, something sends it.
 * Publishing a code the wire never sends is how a consumer ends up with a dead
 * branch it believes is covered.
 */
export const STEP_UP_ERROR_CODES = ['REQUIRES_2FA'] as const;

export type StepUpErrorCode = (typeof STEP_UP_ERROR_CODES)[number];

export {}; // NOSONAR
