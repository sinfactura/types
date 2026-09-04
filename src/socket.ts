/**
 * WebSocket wire contract — the single source of truth for the SINFACTURA
 * realtime protocol.
 *
 * Deliberately NOT `declare global`: clients need the action names as
 * *values* (to validate an incoming frame and key an exhaustive switch), so
 * import them:
 *
 * ```ts
 * import { SOCKET_ACTIONS, type SocketAction } from 'sinfactura-types';
 * ```
 *
 * Producers/consumers: `api` (`stacks/wss/lambdas/socket/default.ts` +
 * `wsPost*` broadcast helpers), `app`/`storefront` (`Sockets.tsx`),
 * `cloudprint` (`websocket-client.ts`). Delivery path is always
 * Lambda → SQS `ws-message` → WSS Lambda → API Gateway Management API → client.
 * Nothing posts to a connection directly.
 */

/* -------------------------------------------------------------------------- */
/*  Server → client data frames                                               */
/* -------------------------------------------------------------------------- */

/**
 * Every `action` the backend broadcasts on a data frame. Grouped for
 * readability only — the wire treats them as one flat union.
 *
 * Audience is NOT encoded here: `print*` frames go to the print agent
 * (`wsPostPrinter`), several ops frames go to admins/managers only
 * (`wsPostAdmin`), most entity frames go to all store users (`wsPostStore`).
 * A client must ignore actions it does not own rather than assume it
 * receives all of them.
 */
export const SOCKET_ACTIONS = [
	// Entity upserts — mostly emitted by `dynamoUpdate`'s auto-broadcast.
	'account',
	/**
	 * A scheduled booking created, updated or cancelled. Operator-only —
	 * broadcast via `wsPostStore(..., { audience: 'operator' })`; Phase 1 is an
	 * internal ops tool with no customer-facing booking surface.
	 *
	 * `data` is the `Appointment` row. One action covers create, update AND
	 * cancel: a cancellation is `status: 'CANCELLED'`, never a row delete, so a
	 * separate delete frame would describe a transition that never happens.
	 */
	'appointments',
	/**
	 * The staff clock-in/clock-out roster. Operator-only — broadcast via
	 * `wsPostStore(..., { audience: 'operator' })`, never to a customer socket.
	 * `data` is the `AttendanceShift` rollup row, the same shape
	 * `GET /attendance/roster` returns.
	 */
	'attendance',
	'baskets',
	// The re-keyed cart. `baskets` stays published and stays emitted for legacy
	// rows: a NEW name is what makes an un-migrated client IGNORE the frame
	// (a stale cart until refresh) rather than render `lines` where it expects
	// `items` and confidently display an empty cart. Fail-quiet over fail-wrong.
	'cart',
	'brands',
	'cash',
	'categories',
	'customers',
	/**
	 * A delivery created, or an event appended to its timeline. Operator-only —
	 * `wsPostStore(..., { audience: 'operator' })`, NEVER
	 * `'operator-and-customer'`: the payload can carry a GPS fix and proof
	 * assets, which are PII. A customer tracking view needs its own coarse,
	 * status-only projection rather than this frame.
	 */
	'deliveries',
	'globals',
	'invoices',
	'literals',
	'orders',
	'products',
	// BE → all store users when a return (devolución) commits. Distinct from
	// `orders` — carries the committed `Return` row itself (stock/account/credit-note
	// effects), not just the order's bumped `updatedAt`.
	'returns',
	// BE → all store users on any service-order mutation. Operator-only by
	// construction: a `ServiceOrder` carries internal diagnosis notes, per-part
	// `unitCost`, work logs and technician ids, and `scrubForCustomer` strips
	// none of them (it only knows about `cost` / `items[].cost`), so producers
	// MUST send this with `excludeCustomers`. Anything a customer should see
	// goes out as a separately field-projected `wsPostCustomer` frame.
	'services',
	/**
	 * BE → all store users on a service-template mutation.
	 *
	 * Declared even though the api currently writes templates with
	 * `silent: true` and emits no frame. `dynamoUpdate`'s `action` is not
	 * socket-only — it is interpolated into the REST success message and into
	 * the cross-tenant guard's audit label, neither of which `silent` gates. So
	 * a writer with no action of its own has to borrow one, and the borrowed
	 * name then surfaces as the wrong entity in a client's response body and
	 * sends anyone grepping the audit log into the wrong handler. Publishing the
	 * string is what lets the producer be honest on those two surfaces; turning
	 * the broadcast on later is a one-line change with no contract move.
	 */
	'service-templates',
	'shifts',
	'stores',
	'suppliers',
	'supplier-invoice',
	'support',
	'surveys',
	'users',
	'favorites',
	/**
	 * BE → all store users on an outbound-webhook config mutation.
	 *
	 * Declared even though the api writes webhook rows with `silent: true` and
	 * emits no frame today — the same reason `'service-templates'` above is
	 * declared. `dynamoUpdate`'s `action` is not socket-only: it is interpolated
	 * into the REST success message and into the cross-tenant guard's audit
	 * label, neither of which `silent` gates. A writer with no action of its own
	 * has to borrow one, and the borrowed name then surfaces as the wrong entity
	 * in the client's response body and sends anyone grepping the audit log into
	 * the wrong handler.
	 *
	 * ⚠️ If the broadcast is ever turned on, keep it operator-only. A `Webhook`
	 * row carries `secretRef` (KMS ciphertext of the key) and never the signing
	 * secret itself, but `scrubForCustomer` knows nothing about this entity, so
	 * it would strip nothing from a webhook frame.
	 */
	'webhooks',

	// Explicit deletions — the row is gone, not updated.
	'account-delete',
	'baskets-delete',
	// Makes "emptying the last line deletes the row" explicit on the wire.
	'cart-delete',
	'log-delete',

	// Notifications & messaging.
	'notifications',
	'support-message',
	'whatsapp-message',

	// Payments & providers.
	'payment_received',
	'payment_linked',
	'payment_unlinked',
	'mercadopago',
	'mercadopago_dynamic_qr_created',
	'mercadopago_static_qr_created',
	'mp_hook_log_appended',
	'mp_ipn_log_appended',
	'stripe',
	'subscription',

	// Fiscal.
	'caea',

	// Print agent audience (`wsPostPrinter`).
	'print',
	'print-order',
	'print-invoice',
	'print-product',
	'print-tag',
	'print_job_failed',
	// BE → agent: re-send your COMPLETE printer set (carries only `storeId`).
	// Needed because `register_printers` only fires on connect/local-change, so
	// an agent connected before the registry shipped stays invisible until it
	// happens to reconnect.
	'request_printers',
	// Despite sitting in this print block, `printers_changed` does NOT reach an
	// agent — its producers go through `wsPostStore`, which excludes printer
	// connections. It's the OPERATOR fleet panel's frame; grouped here only
	// because the payload is print-shaped.
	'printers_changed',
	// BE → OPERATOR panel only (same `wsPostStore` exclusion): one agent's
	// fleet-health telemetry (`queueDepth`) moved. Deliberately NOT folded into
	// `printers_changed` — kept separately debuggable.
	'agent_status_changed',
	// BE → agent, fanned to every printer connection on the store: routing rules changed, re-read them.
	'print_rules_changed',
	// BE → agent, scoped to ONE agent's connections: that agent's COMPLETE
	// per-printer `active` set (`PrintersActiveData`) — full replacement, never
	// a delta; both unknowns fail OPEN.
	'printers_active',
	// BE → agent, scoped to ONE agent's connections: run a local diagnostic
	// action (`AgentCommandData`).
	// NOT understood by any released agent as of v2.2.2 — its inbound switch
	// only handles `request_printers`/`printers_active` + the print-job enum, so
	// this is published ahead of the agent handling it, deliberately, so all
	// three lanes build against one `.d.ts`.
	'agent_command',

	// Operations / operator surfaces.
	//
	// ⚠️ `'logs'` is deliberately ABSENT here and must not be re-added. It is a
	// CLIENT→SERVER action only (`SocketLogsMessage`, telemetry ingestion) and
	// appears in `CLIENT_SOCKET_ACTIONS` / `LIVE_CLIENT_SOCKET_ACTIONS` below.
	// It was listed here as well, with no backend producer behind it: the api
	// never broadcasts it, and `registerLog` writes rows through raw `put` paths
	// that cannot auto-broadcast at all. The only consequence was a consumer in
	// `app` written against a frame that is never sent. Log deletion DOES
	// broadcast, under `'log-delete'` above.
	'maintenance',
	'currency_auto_updated',
	'drain_progress',
	'integration_event_appended',
	'userActivityRecorded',
	// One ingested MercadoLibre billing period landed (or was re-pulled and
	// changed). Emitted by the daily settlement poller, so it arrives on a
	// cadence of about one per store per day — not a live movement stream.
	// ⚠️ A frame for a period whose `periodStatus` is `'OPEN'` carries numbers
	// ML will still restate; a consumer must not render one as final.
	'mercadolibre_settlement_period',
	// BE → all store users when an EMPRESA custom domain's provisioning state
	// moves (`CustomDomainSocketPayload`). Status only: the row's
	// `verificationToken` is an ownership credential and is never re-sent here.
	'customDomain',
	// BE → all store users on every purchase-order write: create, update, cancel,
	// and any status change the goods-receipt hook drives. Carries the full
	// `PurchaseOrder` row, mirroring how `products` carries the product.
	//
	// ⚠️ A received purchase order does NOT mean fully received — suppliers
	// under-ship and operators close short — so a client must read the item
	// quantities rather than inferring completeness from the status alone.
	'purchaseOrders',
] as const;

/** Union of every server→client data-frame action. */
export type SocketAction = (typeof SOCKET_ACTIONS)[number];

/**
 * Payload of the `'customDomain'` frame — a projection of `DomainRecord`, not
 * the row. Deliberately OMITTED versus the row: `verificationToken` (an
 * ownership credential, returned once at register time and never re-sent),
 * any hosting-provider app id (internal), and `lastCheckedAt` / `startedAt`
 * (operator-only diagnostics).
 */
export interface CustomDomainSocketPayload {
	storeId: string;
	/** The NORMALIZED host, as stored on the row. */
	host: string;
	provisioning: {
		state: DomainProvisioningState;
		certificateVerificationDnsRecord?: string;
		subDomains?: DomainSubDomainRecord[];
		/** Unix MILLISECONDS. Present once `state` reaches `active`. */
		activatedAt?: number;
		error?: string;
	};
}

/** Runtime guard — narrows an untrusted string to a known action. */
export const isSocketAction = (value: unknown): value is SocketAction =>
	typeof value === 'string' && (SOCKET_ACTIONS as readonly string[]).includes(value);

/**
 * A server→client data frame. `data` is action-specific and intentionally left
 * open here: each action carries its own entity shape (an `orders` frame
 * carries an `Order`, a `products` frame a `Product`, …), and encoding every
 * action's payload as a discriminated union would couple this contract to
 * every entity in the package. Narrow at the call site after switching on
 * `action`.
 */
export interface SocketMessage<T = unknown> {
	action: SocketAction;
	data: T;
}

/**
 * The `/logs` read mode a `log-delete` frame can refer to.
 *
 * Exactly one value today, and deliberately a union rather than `string`: both
 * delete endpoints target the backend's single global `ERROR` partition, read
 * back as `GET /logs?mode=error`. Declaring it open invited the bug this
 * replaced — the api echoed the REQUEST's `mode` onto the frame, so a body that
 * omitted it published `'unknown'`, and the bulk path published the router's
 * `'errors-all'` discriminator, which `GET /logs?mode=` does not even accept.
 */
export type LogDeleteMode = 'error';

/**
 * `data` of a **single** `log-delete` frame — one row, removed by id.
 *
 * Correct handling: remove that id from the `mode` cache. The deletion is exact
 * and total, so a targeted patch is safe.
 */
export interface LogDeleteOneData {
	logId: string;
	/** Names the cache to patch. Not caller-controlled — see `LogDeleteMode`. */
	mode: LogDeleteMode;
}

/**
 * `data` of a **bulk** `log-delete` frame — the whole `ERROR` partition purged.
 *
 * Carries no id, and that absence is the discriminator against
 * `LogDeleteOneData`.
 *
 * Correct handling: refetch that mode's list. It is NOT a mode-scoped purge —
 * the backend query carries no mode predicate, so this can only ever mean the
 * `error` view; there is no way to purge just the tenant `user` or `customer`
 * logs.
 */
export interface LogDeleteAllData {
	/** Names the cache to refetch. Not caller-controlled — see `LogDeleteMode`. */
	mode: LogDeleteMode;
}

/**
 * Either `log-delete` payload. Discriminate on the presence of `logId`.
 *
 * Audience for both: MANAGER connections, ACROSS stores (`wsPostSuperAdmin`).
 * The backing `PK: 'ERROR'` partition is a single global one and deletion is
 * MANAGER-gated, so no tenant owns these frames and a store-scoped view should
 * not expect them.
 */
export type LogDeleteData = LogDeleteOneData | LogDeleteAllData;

/* -------------------------------------------------------------------------- */
/*  Agent diagnostic commands                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The remote-triggerable diagnostic actions, in the agent's OWN spelling.
 *
 * Kebab-case, verbatim from the agent's `DiagnosticActionId` — not the
 * snake_case the rest of this file's ACTION names use. Deliberate: since
 * `sinfactura/print` does not depend on this package, passing its own ids
 * through untouched avoids a mapping table that could silently drift.
 *
 * A command the agent does not recognise is safe by construction — it
 * returns a structured "unknown command" result instead of throwing.
 *
 * Two originally-proposed members are absent on purpose: **`view-logs`**
 * only opens the log folder on the agent's own machine (not remotely
 * meaningful — shipping logs back would be a different capability), and
 * **`test_print`** isn't agent-local at all (the backend already dispatches
 * a real job to an explicit printer). ⚠️ `view-logs` IS a member of the
 * agent's own `DiagnosticActionId` union — its absence here is a deliberate
 * narrowing, not drift, so do not "fix" it by copying that union wholesale.
 *
 * `disable-printing` / `enable-printing` are the remote kill switch. They are
 * **remote-only**: the agent's panel wires buttons from `[data-diagnostic-action]`
 * elements and skips an id with no element, so these two reach the agent
 * through `agent_command` and nowhere else. Both are payload-free — the
 * command id IS the instruction, and adding a payload later would be a wire
 * change, not a detail.
 */
export const AGENT_COMMANDS = [
	'redetect-printers',
	'reconnect-socket',
	'flush-acks',
	'clear-queue',
	'disable-printing',
	'enable-printing',
] as const;

/** Union of every remote-triggerable diagnostic command. */
export type AgentCommand = (typeof AGENT_COMMANDS)[number];

/** Runtime guard — narrows an untrusted string to a known command. */
export const isAgentCommand = (value: unknown): value is AgentCommand =>
	typeof value === 'string' && (AGENT_COMMANDS as readonly string[]).includes(value);

/**
 * Commands that destroy operator data and MUST be confirmed before dispatch.
 *
 * Mirrors the agent's own `destructive` flag; the agent's confirmation lives
 * in the DOM layer (unreachable from a remote trigger), so the "are you
 * sure?" is the caller's job. `clear-queue` deletes queued work that then
 * never prints — the operator who loses it isn't the one who pressed the button.
 * `disable-printing` stops a site printing until someone re-enables it, which
 * is the same shape of loss.
 *
 * ⚠️ **`enable-printing` is deliberately NOT here, and must never be added.**
 * It is the un-kill. Gating it behind a confirmation inverts the safety
 * property: the moment it is most needed is an incident, when an operator is
 * trying to restore service, and a "are you sure?" on RESTORING printing
 * protects nothing while delaying the fix. Confirmation belongs on the action
 * that loses work, never on the one that recovers from it.
 *
 * Both flags were read from the agent's own `diagnostic-actions.ts` rather
 * than from the issue that requested them — `clear-queue` true,
 * `disable-printing` true, `enable-printing` false.
 */
export const DESTRUCTIVE_AGENT_COMMANDS: readonly AgentCommand[] = ['clear-queue', 'disable-printing'];

/**
 * `data` payload of the BE → agent `agent_command` frame — nested, like every
 * other server→client frame. Declared here (not beside `PrintersActiveData`
 * in `print.ts`) because it references `AgentCommand`, avoiding a second
 * ambient vocabulary that could drift from `AGENT_COMMANDS`.
 */
export interface AgentCommandData {
	command: AgentCommand;
	/**
	 * The target agent. Advisory — the BE has already scoped delivery to that
	 * agent's connections — but lets the agent drop a frame from a mis-scoped broadcast.
	 */
	agentId: string;
	/**
	 * Stable per-dispatch id. **Required, never optional.**
	 *
	 * The wss `$default` route has no route response, so a frame the agent
	 * sends can never fail visibly to it — delivery must be idempotent-and-repeatable,
	 * and a re-dispatch needs this id to dedupe / match a late result.
	 */
	commandId: string;
}

/**
 * Agent → BE outcome of one `agent_command`.
 *
 * ⚠️ **A report, not an acknowledgement of delivery.** The agent cannot observe
 * whether the backend received this frame (see `commandId`), so "did the command
 * work" is a question the BACKEND answers by reconciling its own dispatch state —
 * never one the agent can settle by sending this.
 *
 * Note that `ok: false` is not necessarily a failure of the action: the agent
 * guards every command with a 3s per-action cooldown and an in-flight lock, and
 * a refusal from either returns `ok: false` with an operator-facing message
 * ("Esperá unos segundos…"). Surface `message`; do not translate `ok: false`
 * into "the agent is broken".
 */
export interface SocketAgentCommandResultMessage {
	action: 'agent_command_result';
	/** Echoes `AgentCommandData.commandId` — the only way to match a result to its dispatch. */
	commandId: string;
	ok: boolean;
	/** Operator-facing, Spanish voseo, always non-empty. Produced by the agent. */
	message: string;
	[key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*  Client → server frames                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The client-driven actions the WSS `$default` route accepts.
 *
 * The authority for what the backend really accepts is the Zod discriminated
 * union behind the api's `$default` route — that union IS the runtime gate.
 * This array mirrors it; an action the union does not carry is answered
 * `400 Invalid message`.
 *
 * ⚠️ **A client cannot observe that rejection.** The `$default` route is
 * registered with a bare Lambda integration and no route response, so API
 * Gateway never returns the handler's reply to the sender. A frame sent to a
 * backend that has not deployed its handler is therefore indistinguishable
 * from success — the socket simply stays open. That is precisely why these
 * arrays have to be truthful: they are the only signal a client author gets,
 * and a wrong one cannot be caught at runtime by either end.
 *
 * (1.10.5 fixed the inverse bug: a live action missing from this array, which
 * let exhaustive switches keyed off `ClientSocketAction` silently exclude it.)
 */
export const CLIENT_SOCKET_ACTIONS = [
	'auth',
	'logs',
	'heartbeat',
	'ack',
	'register_printers',
	'export_local_rules',
	'agent_command_result',
] as const;

/** Union of every client→server action. */
export type ClientSocketAction = (typeof CLIENT_SOCKET_ACTIONS)[number];

/**
 * Client→server actions the backend accepts **today** — a subset of
 * `CLIENT_SOCKET_ACTIONS`. Anything declared but absent here is published ahead
 * of its handler and will be rejected `400 Invalid message` on the wire.
 *
 * Currently **identical** to `CLIENT_SOCKET_ACTIONS`: every declared action now
 * has a deployed handler, `agent_command_result` included. Do not read the
 * equality as redundancy — the two exports mean different things, and keeping
 * this one lets a future publish-ahead-of-handler be expressed without a
 * breaking rename. Before adding an action here, confirm its entry exists in
 * the api's `$default` union; that union, not this array, is what runs.
 */
export const LIVE_CLIENT_SOCKET_ACTIONS = [
	'auth',
	'logs',
	'heartbeat',
	'ack',
	'register_printers',
	'export_local_rules',
	'agent_command_result',
] as const;

/** Authenticate the connection. Must be the first frame; see `AuthAckFrame`. */
export interface SocketAuthMessage {
	action: 'auth';
	token: string;
}

/**
 * Storefront/telemetry event ingestion. Extra fields are accepted by design
 * (the api validates this branch `.loose()`), so the payload is open.
 */
export interface SocketLogsMessage {
	action: 'logs';
	[key: string]: unknown;
}

/**
 * Print-agent fleet health. `timestamp` is optional; the api additionally
 * reads agent fields (`agentVersion`, `queueDepth`, `memoryMB`, `uptime`,
 * `platform`) off this frame and stamps them on the SOCKET row — hence the
 * open index signature.
 */
export interface SocketHeartbeatMessage {
	action: 'heartbeat';
	timestamp?: number;
	[key: string]: unknown;
}

/** Print-job acknowledgement from the agent. */
export interface SocketAckMessage {
	action: 'ack';
	jobId: string;
	status: string;
	[key: string]: unknown;
}

/**
 * Agent → BE printer registry report. `printers` is the agent's COMPLETE
 * current set, never a delta — the BE marks absent printers offline rather
 * than deleting them, since deleting would orphan any `PrintRule` pointing at one.
 *
 * FLAT, like every other client→server frame (1.9.0–1.9.1 wrongly declared
 * this nested — the agent sender builds `{ action, ...data }`, so a nested
 * union entry would reject every real report with `400`).
 *
 * `agentId` is deliberately not declared — the api derives it from the
 * authenticated SOCKET row (trusting a frame-supplied value would let one
 * agent register printers under another's id) — but the open index signature
 * still permits sending it as an advisory fallback for pre-heartbeat reports.
 */
export interface SocketRegisterPrintersMessage {
	action: 'register_printers';
	printers: PrintPrinterReport[];
	[key: string]: unknown;
}

/**
 * Agent → BE, migration of the agent's local `useCase → printer` config into
 * `PRINT_RULE#${storeId}`.
 *
 * A distinct action, not a field on `register_printers`: an unknown ACTION
 * fails visibly with `400`, but an unknown FIELD is silently stripped by the
 * loose gate — an agent shipping ahead of the BE would migrate nothing and
 * still look healthy. Also `register_printers` recurs on every reconnect,
 * and this one-shot payload has no business riding it.
 *
 * Sent after a successful `register_printers`, on every connect (not once per
 * install) — the agent cannot observe delivery, so a local "already exported"
 * flag would turn one lost race into a store that never migrates.
 * Exactly-once is enforced BE-side by the `PRINT_AGENT#` marker alone.
 *
 * `agentId` is not declared and, unlike `SocketRegisterPrintersMessage`, the
 * api will NOT accept an advisory one — comes from the authenticated SOCKET
 * row only (writing rules has a wider blast radius than writing a registry row).
 *
 * An EMPTY frame (no `rules`, no `skipped`) is never sent and the api no-ops
 * on one — otherwise a fresh install would consume the once-only marker
 * having migrated nothing, and later local config could never migrate.
 */
export interface SocketExportLocalRulesMessage {
	action: 'export_local_rules';
	rules: PrintLocalRuleExport[];
	skipped?: PrintLocalRuleSkip[];
	[key: string]: unknown;
}

/** Any client→server JSON frame. */
export type ClientSocketMessage =
	| SocketAuthMessage
	| SocketLogsMessage
	| SocketHeartbeatMessage
	| SocketAckMessage
	| SocketRegisterPrintersMessage
	| SocketExportLocalRulesMessage
	| SocketAgentCommandResultMessage;

/* -------------------------------------------------------------------------- */
/*  Control frames                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Why the backend refused the handshake.
 *
 * These exist because API Gateway translates a server-side disconnect into an
 * opaque 1006 close with no reason. Without an explicit frame the client cannot
 * tell a rejection from a network blip and burns its retry budget.
 */
export const SOCKET_AUTH_FAIL_REASONS = [
	'no_token',
	'invalid_role',
	'invalid_token',
	'not_authenticated',
	'server_error',
] as const;

/** Union of `auth-fail` reasons. */
export type SocketAuthFailReason = (typeof SOCKET_AUTH_FAIL_REASONS)[number];

/** Handshake accepted. The client should not treat itself as connected until this arrives. */
export interface SocketAuthOkFrame {
	type: 'auth-ok';
}

/** Handshake refused; the connection is closed immediately after this frame. */
export interface SocketAuthFailFrame {
	type: 'auth-fail';
	reason: SocketAuthFailReason;
}

/** Either handshake outcome. Discriminate on `type`, not `action`. */
export type SocketControlFrame = SocketAuthOkFrame | SocketAuthFailFrame;

/**
 * Anything that can arrive on the socket: a control frame (keyed by `type`) or
 * a data frame (keyed by `action`).
 */
export type SocketInboundFrame = SocketControlFrame | SocketMessage;

/* -------------------------------------------------------------------------- */
/*  Keep-alive                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The keep-alive is **raw strings, not JSON** — the client sends the literal
 * body `ping` and the backend replies with the literal body `pong`.
 *
 * `api/stacks/wss/lambdas/socket/default.ts` matches these before body
 * parsing, precisely because `JSON.parse('ping')` throws. `live` is accepted as
 * a legacy alias for `ping` from older clients; never send it from new code.
 *
 * Do not wrap these in a `SocketMessage`.
 */
export const SOCKET_KEEPALIVE = {
	/** Client → server. */
	ping: 'ping',
	/** Server → client. */
	pong: 'pong',
	/** Deprecated client → server alias for `ping`, still accepted. */
	legacyPing: 'live',
} as const;

/** Recognises either accepted keep-alive request body. */
export const isSocketKeepAlive = (body: unknown): boolean =>
	body === SOCKET_KEEPALIVE.ping || body === SOCKET_KEEPALIVE.legacyPing;
