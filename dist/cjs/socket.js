"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSocketKeepAlive = exports.SOCKET_KEEPALIVE = exports.SOCKET_AUTH_FAIL_REASONS = exports.LIVE_CLIENT_SOCKET_ACTIONS = exports.CLIENT_SOCKET_ACTIONS = exports.DESTRUCTIVE_AGENT_COMMANDS = exports.isAgentCommand = exports.AGENT_COMMANDS = exports.isSocketAction = exports.SOCKET_ACTIONS = void 0;
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
exports.SOCKET_ACTIONS = [
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
];
/** Runtime guard — narrows an untrusted string to a known action. */
const isSocketAction = (value) => typeof value === 'string' && exports.SOCKET_ACTIONS.includes(value);
exports.isSocketAction = isSocketAction;
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
 * a real job to an explicit printer).
 */
exports.AGENT_COMMANDS = ['redetect-printers', 'reconnect-socket', 'flush-acks', 'clear-queue'];
/** Runtime guard — narrows an untrusted string to a known command. */
const isAgentCommand = (value) => typeof value === 'string' && exports.AGENT_COMMANDS.includes(value);
exports.isAgentCommand = isAgentCommand;
/**
 * Commands that destroy operator data and MUST be confirmed before dispatch.
 *
 * Mirrors the agent's own `destructive` flag; the agent's confirmation lives
 * in the DOM layer (unreachable from a remote trigger), so the "are you
 * sure?" is the caller's job. `clear-queue` deletes queued work that then
 * never prints — the operator who loses it isn't the one who pressed the button.
 */
exports.DESTRUCTIVE_AGENT_COMMANDS = ['clear-queue'];
/* -------------------------------------------------------------------------- */
/*  Client → server frames                                                    */
/* -------------------------------------------------------------------------- */
/**
 * The client-driven actions the WSS `$default` route accepts.
 *
 * `register_printers` and `export_local_rules` are live (their handlers and
 * `$default` union entries are deployed). `agent_command_result` is declared
 * here — the full vocabulary — but deliberately excluded from
 * `LIVE_CLIENT_SOCKET_ACTIONS` below: no handler exists yet, so the api
 * answers it with `400 Invalid message`. Do NOT "fix the inconsistency" by
 * adding it there — that would tell a consumer the frame is accepted when it
 * is rejected. (1.10.5 fixed the inverse bug: a live action missing from
 * this array, which let exhaustive switches keyed off `ClientSocketAction`
 * silently exclude it.)
 */
exports.CLIENT_SOCKET_ACTIONS = [
    'auth',
    'logs',
    'heartbeat',
    'ack',
    'register_printers',
    'export_local_rules',
    'agent_command_result',
];
/**
 * Client→server actions the backend accepts **today** — a strict subset of
 * `CLIENT_SOCKET_ACTIONS`. Anything declared but absent here is published ahead
 * of its handler and will be rejected `400 Invalid message` on the wire.
 */
exports.LIVE_CLIENT_SOCKET_ACTIONS = [
    'auth',
    'logs',
    'heartbeat',
    'ack',
    'register_printers',
    'export_local_rules',
];
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
exports.SOCKET_AUTH_FAIL_REASONS = [
    'no_token',
    'invalid_role',
    'invalid_token',
    'not_authenticated',
    'server_error',
];
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
exports.SOCKET_KEEPALIVE = {
    /** Client → server. */
    ping: 'ping',
    /** Server → client. */
    pong: 'pong',
    /** Deprecated client → server alias for `ping`, still accepted. */
    legacyPing: 'live',
};
/** Recognises either accepted keep-alive request body. */
const isSocketKeepAlive = (body) => body === exports.SOCKET_KEEPALIVE.ping || body === exports.SOCKET_KEEPALIVE.legacyPing;
exports.isSocketKeepAlive = isSocketKeepAlive;
