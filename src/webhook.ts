// Outbound integrator webhooks for print-state changes: the `WEBHOOK#${storeId}`
// subscription row plus the event-type vocabulary a store can subscribe to.
//
// Deliberately NOT `declare global`, for the same reason as `socket.ts`:
// consumers need the event names as VALUES, not just as a type. The api's CRUD
// handler builds its Zod enum from `WEBHOOK_EVENT_TYPES` rather than restating
// the strings, so there is exactly one source of truth — a hand-restated enum
// is how a newly added event silently becomes unsubscribable.

/**
 * Every print-state transition an integrator can subscribe to.
 *
 * `readonly` tuple, so no consumer-side `declare module` can extend it: a new
 * event must be published here before any repo can emit or accept it.
 */
export const WEBHOOK_EVENT_TYPES = [
	'print.queued',
	'print.received',
	'print.printed',
	'print.failed',
	'print.agent.connected',
	'print.agent.disconnected',
	'print.printer.online',
	'print.printer.offline',
	'print.job.settled',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/** Terminal outcomes for a print job. Closed union — a job printed, or it failed. */
export const PRINT_JOB_SETTLED_OUTCOMES = ['printed', 'failed'] as const;

export type PrintJobSettledOutcome = (typeof PRINT_JOB_SETTLED_OUTCOMES)[number];

/**
 * Payload for `print.job.settled` — emitted exactly ONCE per job that emitted
 * `print.queued`, regardless of `useCase` and regardless of whether a
 * `printedAt` projection was written.
 *
 * ⚠️ **NOT the same thing as `PrintJobSummaryOutcome`**
 * (`applied | stale | uncorrelated | failed | skipped`), which is internal
 * bookkeeping about whether the SUMMARY ROW upsert succeeded. A job can print
 * successfully while its summary upsert is `stale` — that value is documented
 * as the guard WORKING, not as a failure. Never derive one from the other:
 * conflating them makes a correctly-handled race look like a print failure to
 * an integrator.
 *
 * ⚠️ **"Exactly once" is a property of the EMIT SITE, not of this shape.** A job
 * that fails and is later acked printed must not emit twice, and nothing here
 * enforces that.
 *
 * ⚠️ **A job that is queued and never acked emits nothing**, by construction:
 * nothing times a job out today, so it emits `print.queued` and then stays
 * silent. "Every queued job eventually settles" therefore holds only for acked
 * jobs. Closing that gap needs a reaper that does not exist.
 */
export interface PrintJobSettledPayload {
	jobId: string;
	outcome: PrintJobSettledOutcome;
	/** Server-stamped ms epoch. Present on both outcomes.
	 *  ⚠️ A subscriber that falls back to RECEIPT time gets this wrong under SQS
	 *  retry, and retry is live (5 attempts with visibility backoff). */
	settledAt: number;
	/** Absent when the job carried no resolvable use case — a legitimately
	 *  id-less job has none, so this must stay optional or the api would have to
	 *  invent one. */
	useCase?: PrintUseCase;
	agentId?: string;
	orderId?: string;
	invoiceId?: string;
	/**
	 * SCREAMING_SNAKE machine code. `outcome: 'failed'` only.
	 *
	 * ⚠️ Named `errorCode`/`errorMessage` rather than reusing `error`, and that is
	 * deliberate. The house rule elsewhere makes `error` the machine-readable slot
	 * a client switches on — but the EXISTING `print.failed` payload already ships
	 * `error` as bounded PROSE with `errorCode` as the code, i.e. the inverted
	 * spelling is what is on the wire today. Reusing `error` here under the
	 * opposite meaning would be worse than not reusing it, so neither name is
	 * contested and no reader has to know which convention a given print event
	 * follows.
	 */
	errorCode?: string;
	/** Bounded human prose. `outcome: 'failed'` only. Never switch on this. */
	errorMessage?: string;
}

/** A `WEBHOOK#${storeId}` subscription row as STORED. */
export interface Webhook {
	PK: string; // `WEBHOOK#${storeId}`
	SK: string; // `WEB${paddedId}`
	storeId: string;
	webhookId: string;
	/** Integrator-supplied delivery target. Validated against the egress policy
	 *  at write time — an operator-registered URL the backend then POSTs to is
	 *  an SSRF vector, so it is never persisted unvalidated. */
	url: string;
	events: WebhookEventType[];
	/**
	 * KMS ciphertext of the HMAC-SHA256 signing key — **never the plaintext
	 * key**, and NOT a Secrets Manager ARN: resolve it through the KMS decrypt
	 * helper, not `getSecret()`. Same treatment as `user.totp.secretRef`.
	 *
	 * The live key must not sit on this row. `response()` auto-strips exactly
	 * seven keys, and `secretRef` is one of them (the bare name `secret` is
	 * NOT) — and that strip reaches the top level and one level into nested
	 * non-array objects only, so it would never have covered a LIST endpoint
	 * returning an array of these rows. Holding a reference rather than a key
	 * makes the protection structural instead of a property of handler code a
	 * later edit can silently drop.
	 */
	secretRef: string;
	active: boolean;
	description?: string;
	/** Lowercase, written on EVERY insert and update — a row missing it stays
	 *  readable by key and invisible to search, with nothing failing. */
	search?: string;
	createdAt: number;
	updatedAt: number;
	lastDeliveryAt?: number;
	lastError?: string;
	/** Drives permanent disable after the documented failure ceiling. */
	consecutiveFailures: number;
	entityType: 'WEBHOOK';
}
