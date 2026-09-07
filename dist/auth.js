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
];
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
 * - `ACCOUNT_DISABLED` · 401 — the account was disabled between minting the
 *   refresh token and presenting it. The token itself still verifies, which is
 *   why this is not `INVALID_REFRESH_TOKEN`: nothing is wrong with the token.
 * - `USER_NOT_FOUND` · 401 — the user row is gone. ⚠️ Distinct from
 *   `ACCOUNT_DISABLED` on purpose — simply absent is not disabled, and
 *   collapsing them loses the only signal that a record was deleted rather
 *   than deactivated.
 * - `ROLE_NOT_ALLOWED` · 401 — the role no longer permits this surface. The
 *   session was legitimate when minted and is not any more.
 *
 * ⚠️ These three are FATAL and must not be retried. A consumer that classifies
 * fatality by matching a code list, WITHOUT also reading the status, silently
 * omits them the moment they are added here — and a disabled client then
 * refreshes forever against an account that will never be re-enabled by
 * retrying. Treat any 401 in this union as fatal; the list is the narrower
 * check, not the safer one.
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
    'ACCOUNT_DISABLED',
    'USER_NOT_FOUND',
    'ROLE_NOT_ALLOWED',
];
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
 *
 * ⚠️ When it IS added, it must be spelled exactly `ENROLLMENT_REQUIRED`, with no
 * `PRINTER` substring — however natural a surface-prefixed sibling looks. A released
 * Cloud Print agent substring-matches on `PRINTER` in the error code for an unrelated
 * client-side condition; api `_printer.ts:196-198` documents this, and it is why the
 * code emitted there is `TWO_FA_NOT_SUPPORTED` rather than anything clearer. A
 * `PRINTER_ENROLLMENT_REQUIRED` would silently trip that branch in every deployed
 * agent, and the failure would surface in the agent, never in our logs.
 */
export const STEP_UP_ERROR_CODES = ['REQUIRES_2FA'];
/**
 * Login-leg REFUSALS — the attempt is over and the credentials or the caller's
 * eligibility are why. The runtime source of truth for `LoginErrorCode`.
 *
 * ⚠️ Published as a tuple because a bare union cannot be switched exhaustively
 * at runtime, which is the whole reason consumers were hand-pinning these.
 *
 * - `WRONG_CREDENTIALS` · 400 — email/password did not match.
 * - `ACCOUNT_LOCKED` · 400 — brute-force lockout; the response carries
 *   `retryAfterSeconds` (see `AccountLockedResponse`).
 * - `ACCOUNT_DISABLED` · 400 — the user row is disabled.
 * - `CAPTCHA_REQUIRED` / `CAPTCHA_INVALID` — the browser captcha tier.
 * - `ATTESTATION_REQUIRED` / `ATTESTATION_INVALID` — the mobile
 *   (body-transport) equivalents of the two above.
 * - `ROLE_NOT_ALLOWED` · 400 — ⚠️ TERMINAL, and not a credential failure at all:
 *   the password was right and this user's ROLES may not use this surface.
 *   Retrying, re-prompting, or offering a password reset all leave the user
 *   stuck in a loop that cannot succeed. Say the account may not use this app.
 *
 * ⚠️ `ROLE_NOT_ALLOWED` was added to this union after the fact. A consumer with
 * an exhaustive `switch` over `LoginErrorCode` will now fail to compile until it
 * handles the new member — that break is the point, because the code has been on
 * the wire from four emitters all along and every client was silently falling
 * through to a generic "login failed".
 */
export const LOGIN_ERROR_CODES = [
    'WRONG_CREDENTIALS',
    'ACCOUNT_LOCKED',
    'ACCOUNT_DISABLED',
    'CAPTCHA_REQUIRED',
    'CAPTCHA_INVALID',
    'ATTESTATION_REQUIRED',
    'ATTESTATION_INVALID',
    'ROLE_NOT_ALLOWED',
];
/**
 * Second-factor FAILURES on the login step-up — the siblings of
 * `STEP_UP_ERROR_CODES`' single success-path discriminator.
 *
 * ⚠️ Kept apart from `LOGIN_ERROR_CODES` for the same reason `REQUIRES_2FA` is:
 * those members mean the CREDENTIAL attempt failed, these mean the credential
 * was accepted and the SECOND FACTOR failed. A consumer that folds them together
 * re-prompts for a password when it should re-prompt for a six-digit code.
 *
 * - `INVALID_2FA_CODE` · ⚠️ **401 OR 400 — the status depends on the path**, and
 *   this is the detail most likely to be got wrong:
 *   - **401** from the LOGIN step-up (`helpers/totp.ts`) — the user is not
 *     authenticated yet. Re-prompt for the code; do NOT wipe a session, there
 *     isn't one.
 *   - **400** from the 2FA MANAGEMENT routes (disable, recovery-codes,
 *     verify-enrollment) — the user IS authenticated and is proving the factor
 *     to change it. Re-prompt within the same authenticated screen.
 *   ⚠️ A consumer keying on the STATUS rather than on `body.error` will treat one
 *   of these two as the other — and the 401 branch of a generic handler usually
 *   wipes the session, which logs the user out for mistyping a digit while
 *   changing their own 2FA settings.
 * - `2FA_LOCKED` · 429 — the factor is locked for ~15 minutes after repeated
 *   failures. Back off; a retry loop cannot shorten it. Reached from the login
 *   step-up AND from the disable / recovery-codes management routes.
 *
 * ⚠️ `ENROLLMENT_REQUIRED` is DELIBERATELY ABSENT here too — see
 * `STEP_UP_ERROR_CODES` for the emitter rule and for the `PRINTER`-substring
 * hazard that constrains how it must eventually be spelled.
 */
export const LOGIN_2FA_ERROR_CODES = ['INVALID_2FA_CODE', '2FA_LOCKED'];
