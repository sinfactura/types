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
 * ⚠️ `register_printers` is published AHEAD of the backend (api#2005 /
 * api#2006 / sinfactura/print#156) so the agent, api, and app lanes can build
 * against one `.d.ts` instead of discovering a mismatch at integration. The
 * api's union does **not** accept it yet — sending it before api#2006 ships
 * fails validation. Check the api lane before wiring it in an agent build.
 */
export const CLIENT_SOCKET_ACTIONS = ['auth', 'logs', 'heartbeat', 'ack', 'register_printers'] as const;

/** Union of every client→server action. */
export type ClientSocketAction = (typeof CLIENT_SOCKET_ACTIONS)[number];

/** Client→server actions the backend accepts **today**. */
export const LIVE_CLIENT_SOCKET_ACTIONS = ['auth', 'logs', 'heartbeat', 'ack'] as const;

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
 * Agent → BE printer registry report (api#2005). `data` is the COMPLETE current
 * printer set for the agent, not a delta. Not accepted by the api until
 * api#2006 — see `CLIENT_SOCKET_ACTIONS`.
 */
export interface SocketRegisterPrintersMessage {
	action: 'register_printers';
	data: RegisterPrintersData;
}

/** Any client→server JSON frame. */
export type ClientSocketMessage =
	| SocketAuthMessage
	| SocketLogsMessage
	| SocketHeartbeatMessage
	| SocketAckMessage
	| SocketRegisterPrintersMessage;

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
