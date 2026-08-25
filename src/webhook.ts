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
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

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
