/**
 * WebSocket wire contract — the single source of truth for the SINFACTURA
 * realtime protocol (types#107).
 *
 * ⚠️ This module is deliberately NOT `declare global`. Everything here is a
 * REAL runtime export, because clients need the action names as *values* to
 * validate an incoming frame and to key an exhaustive switch — an ambient type
 * alone cannot do either. Import them:
 *
 * ```ts
 * import { SOCKET_ACTIONS, type SocketAction } from 'sinfactura-types';
 * ```
 *
 * Producers/consumers this contract binds:
 * - `api` — `stacks/wss/lambdas/socket/default.ts` (client→server zod union)
 *   and every `wsPost*` broadcast helper (server→client).
 * - `app` / `storefront` — `Sockets.tsx` action dispatch.
 * - `cloudprint` — the print agent's `websocket-client.ts`.
 *
 * Delivery path is always Lambda → SQS `ws-message` → WSS Lambda → API Gateway
 * Management API → client. Nothing posts to a connection directly.
 */

/* -------------------------------------------------------------------------- */
/*  Server → client data frames                                               */
/* -------------------------------------------------------------------------- */

/**
 * Every `action` the backend broadcasts on a data frame.
 *
 * Derived from the api's actual producers: `postData: { action }` blocks, the
 * `action` argument of `dynamoUpdate` (which auto-broadcasts via `wsPostStore`),
 * and the payment/log call sites. Grouped for readability only — the wire
 * treats them as one flat union.
 *
 * ⚠️ Audience is NOT encoded here. `print*` frames go to the print agent
 * (`wsPostPrinter`), several ops frames go to admins/managers only
 * (`wsPostAdmin`), and most entity frames go to all store users
 * (`wsPostStore`). A client must ignore actions it does not own rather than
 * assume it receives all of them.
 */
export const SOCKET_ACTIONS = [
	// Entity upserts — mostly emitted by `dynamoUpdate`'s auto-broadcast.
	'account',
	'baskets',
	'brands',
	'cash',
	'categories',
	'customers',
	'globals',
	'invoices',
	'literals',
	'orders',
	'products',
	'shifts',
	'stores',
	'suppliers',
	'supplier-invoice',
	'support',
	'surveys',
	'users',
	'favorites',

	// Explicit deletions — the row is gone, not updated.
	'account-delete',
	'baskets-delete',
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
	// BE → agent: re-send your COMPLETE printer set (api#2006). Carries only
	// `storeId`; the agent already knows what to report. Exists because
	// `register_printers` fires just on connect and on local printer change, so
	// an agent that connected before the registry shipped stays invisible to it
	// until it happens to reconnect — days, for a machine that is never restarted.
	'request_printers',
	// ⚠️ Despite sitting in this print block, `printers_changed` does NOT reach an
	// agent. All three of its producers go through `wsPostStore`, which excludes
	// printer connections (api#644) — it is the OPERATOR fleet panel's frame,
	// telling an open panel that a printer was registered, toggled or went away.
	// Grouped here only because the payload is print-shaped.
	'printers_changed',
	// BE → agent, fanned to every printer connection on the store: the store's
	// routing rules changed, re-read them (api#2007/#2010).
	'print_rules_changed',
	// BE → agent, scoped to ONE agent's own connections: that agent's COMPLETE
	// per-printer `active` set, so its local rule-less fallback can honour an
	// operator's pause toggle (api#2028). Payload is `PrintersActiveData`.
	// Full replacement, never a delta; both unknowns fail OPEN (see that type).
	'printers_active',

	// Operations / operator surfaces.
	'logs',
	'maintenance',
	'currency_auto_updated',
	'drain_progress',
	'integration_event_appended',
	'userActivityRecorded',
] as const;

/** Union of every server→client data-frame action. */
export type SocketAction = (typeof SOCKET_ACTIONS)[number];

/** Runtime guard — narrows an untrusted string to a known action. */
export const isSocketAction = (value: unknown): value is SocketAction =>
	typeof value === 'string' && (SOCKET_ACTIONS as readonly string[]).includes(value);

/**
 * A server→client data frame. `data` is action-specific and intentionally left
 * open here: each action carries its own entity shape (an `orders` frame
 * carries an `Order`, a `products` frame a `Product`, …), and encoding all 48
 * payloads as a discriminated union would couple this contract to every entity
 * in the package. Narrow at the call site after switching on `action`.
 */
export interface SocketMessage<T = unknown> {
	action: SocketAction;
	data: T;
}

/* -------------------------------------------------------------------------- */
/*  Client → server frames                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The client-driven actions the WSS `$default` route accepts.
 *
 * The first four mirror the zod discriminated union in
 * `api/stacks/wss/lambdas/socket/default.ts` and are live today.
 *
 * `register_printers` is **live**: api#2006 shipped its handler and the `$default`
 * union, deployed and verified against a real agent on 2026-08-01. It was
 * published ahead of that backend so the agent, api and app lanes could build
 * against one `.d.ts` — which is exactly how api#2017 caught the frame being
 * declared nested while every sibling is flat, before an agent shipped against it.
 *
 * `export_local_rules` is **live** too: api#2010 shipped its `$default` union
 * entry and handler (deployed 2026-08-03). Its frame interface
 * (`SocketExportLocalRulesMessage`) and its `ClientSocketMessage` membership
 * shipped in 1.10.x, but the action string was never added to these two arrays —
 * so `isClientSocketAction`-style checks and exhaustive switches keyed off
 * `ClientSocketAction` silently excluded a live action. Corrected in 1.10.5.
 */
export const CLIENT_SOCKET_ACTIONS = [
	'auth',
	'logs',
	'heartbeat',
	'ack',
	'register_printers',
	'export_local_rules',
] as const;

/** Union of every client→server action. */
export type ClientSocketAction = (typeof CLIENT_SOCKET_ACTIONS)[number];

/** Client→server actions the backend accepts **today**. */
export const LIVE_CLIENT_SOCKET_ACTIONS = [
	'auth',
	'logs',
	'heartbeat',
	'ack',
	'register_printers',
	'export_local_rules',
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
 * Agent → BE printer registry report (api#2006). `printers` is the agent's
 * COMPLETE current set, never a delta — the BE marks absent printers offline
 * rather than deleting them, because deleting would orphan any `PrintRule`
 * pointing at one.
 *
 * **FLAT, like every other client→server frame** (api#2017). 1.9.0–1.9.1
 * declared this nested (`{ action, data }`) — the only nested client action —
 * and that was wrong: the agent's sender builds `{ action, ...data }` by design,
 * reserving nested payloads for server→client frames, and the api destructures
 * `const { action, ...data }`. A union entry written to match the nested
 * declaration would have rejected every real report with `400 Invalid message`
 * and left the registry silently empty, presenting as an agent bug.
 *
 * `agentId` is deliberately **not declared**. The api derives it from the
 * authenticated SOCKET row, because trusting a frame-supplied value would let
 * one agent register printers under another's id. The open index signature still
 * permits sending it, and the api treats it as advisory — falling back to it only
 * when the connection has no `agentId` yet, since a report can arrive before the
 * agent's first heartbeat.
 */
export interface SocketRegisterPrintersMessage {
	action: 'register_printers';
	printers: PrintPrinterReport[];
	[key: string]: unknown;
}

/**
 * Agent → BE, migration of the agent's local `useCase → printer` config into
 * `PRINT_RULE#${storeId}` (api#2010 / sinfactura/print#183, #156 phase 5).
 *
 * **A distinct action, not a field on `register_printers`** — deliberately, and
 * the failure modes are why. An unknown ACTION fails the api's discriminated
 * union with a visible `400`; an unknown FIELD passes the loose gate and is then
 * silently stripped by the handler's schema, so an agent shipping ahead of the
 * BE would migrate nothing and still look healthy. `register_printers` also
 * recurs on every reconnect, and a one-shot payload has no business riding it.
 *
 * Sent after a successful `register_printers` — the registry must exist before a
 * rule can point into it — and **on every connect** rather than once per
 * install. The agent cannot observe delivery (its frame is handed to the
 * renderer, which may drop it, and the socket does not serialise), so a local
 * "already exported" flag would turn one lost race into a store that never
 * migrates. Exactly-once is the BE's `PRINT_AGENT#` marker alone; a repeat costs
 * one failed conditional write.
 *
 * `agentId` is deliberately **not declared**, and unlike
 * `SocketRegisterPrintersMessage` the api will not accept an advisory one — it
 * comes from the authenticated SOCKET row only. Writing routing rules has a
 * wider blast radius than writing a registry row.
 *
 * ⚠️ An EMPTY frame (no `rules`, no `skipped`) is not sent, and the api no-ops on
 * one: otherwise a fresh install consumes the once-only marker and completes
 * migration having seeded nothing, so anything configured locally afterwards
 * could never migrate.
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
	| SocketExportLocalRulesMessage;

/* -------------------------------------------------------------------------- */
/*  Control frames                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Why the backend refused the handshake (api#977 / app#1353).
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
