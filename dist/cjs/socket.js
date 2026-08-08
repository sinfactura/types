"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSocketKeepAlive = exports.SOCKET_KEEPALIVE = exports.SOCKET_AUTH_FAIL_REASONS = exports.LIVE_CLIENT_SOCKET_ACTIONS = exports.CLIENT_SOCKET_ACTIONS = exports.DESTRUCTIVE_AGENT_COMMANDS = exports.isAgentCommand = exports.AGENT_COMMANDS = exports.isSocketAction = exports.SOCKET_ACTIONS = void 0;
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
    // BE → all store users when a return (devolución) commits (api#547). Distinct
    // from `orders` even though a return always advances the order's `updatedAt`:
    // the frame carries the committed `Return`, and a client that only patched its
    // order cache would miss the stock, account and credit-note effects that landed
    // with it. Payload is the stored row; `Order.returns` carries the bounded
    // `ReturnSummary[]` projection instead.
    'returns',
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
    // BE → OPERATOR panel only, same `wsPostStore` exclusion as `printers_changed`
    // above: one agent's fleet-health telemetry moved (api#2065). Today that means
    // `queueDepth`, the one field on the fleet card that had no event-driven
    // trigger and so read up to ~90s stale. Deliberately NOT folded into
    // `printers_changed` — the app logs a Sentry breadcrumb naming that frame, and
    // fusing the two triggers would make them un-debuggable apart.
    'agent_status_changed',
    // BE → agent, fanned to every printer connection on the store: the store's
    // routing rules changed, re-read them (api#2007/#2010).
    'print_rules_changed',
    // BE → agent, scoped to ONE agent's own connections: that agent's COMPLETE
    // per-printer `active` set, so its local rule-less fallback can honour an
    // operator's pause toggle (api#2028). Payload is `PrintersActiveData`.
    // Full replacement, never a delta; both unknowns fail OPEN (see that type).
    'printers_active',
    // BE → agent, scoped to ONE agent's own connections (like `printers_active`,
    // never fanned to the store): run a local diagnostic/recovery action
    // (print#224). Payload is `AgentCommandData`.
    //
    // ⚠️ NOT understood by any released agent. The agent routes inbound frames
    // through a closed control-frame switch (`request_printers`,
    // `printers_active`) and then a 4-member print-job enum; anything else lands
    // in its "Unhandled frame" warn and is never executed or acknowledged. As of
    // v2.2.2 that includes this action — print#224's agent lane must add the case
    // before a producer can rely on it. Publishing it here first is deliberate, so
    // all three lanes build against one `.d.ts`.
    'agent_command',
    // Operations / operator surfaces.
    'logs',
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
/*  Agent diagnostic commands (print#224)                                     */
/* -------------------------------------------------------------------------- */
/**
 * The remote-triggerable diagnostic actions, in the agent's OWN spelling.
 *
 * **Kebab-case, verbatim from the agent's `DiagnosticActionId`** (print#223,
 * shipped v2.2.2) — not the snake_case the rest of this file's ACTION names use.
 * That is a deliberate trade. `sinfactura/print` does not depend on this package,
 * so any renaming here has to be re-implemented as a mapping table on the agent
 * side, where a drift is invisible to both ends until an operator reports that a
 * button does nothing. Passing the agent's own ids through untouched removes the
 * mapping layer entirely: the BE forwards a string the agent already keys on.
 * The frame's ACTION (`agent_command`) stays snake_case like its siblings; this
 * is the payload vocabulary, a different namespace.
 *
 * A command the agent does not recognise is safe by construction — its
 * `runDiagnosticAction` returns a structured "unknown command" result instead of
 * throwing — so an older agent degrades to a visible failure, not a crash.
 *
 * Two members of the originally-proposed set are absent on purpose:
 *
 * - **`view-logs`** exists on the agent but is not remotely meaningful. It opens
 *   the log FOLDER on the agent's own machine and resolves `ok: true`, so a
 *   remote operator would read "logs delivered" while a window opened on an
 *   unattended PC. Shipping logs BACK to the backend is a genuinely different
 *   capability that the agent does not have; it needs its own contract.
 * - **`test_print`** is not an agent-local action at all. The backend dispatches
 *   a real job to an explicit printer (api#2041, shipped), so routing it through
 *   here would be a second way to do one thing — and the agent would reject it as
 *   an unknown command.
 */
exports.AGENT_COMMANDS = ['redetect-printers', 'reconnect-socket', 'flush-acks', 'clear-queue'];
/** Runtime guard — narrows an untrusted string to a known command. */
const isAgentCommand = (value) => typeof value === 'string' && exports.AGENT_COMMANDS.includes(value);
exports.isAgentCommand = isAgentCommand;
/**
 * Commands that destroy operator data and MUST be confirmed before dispatch.
 *
 * Mirrors the agent's own `destructive` flag. The agent deliberately does not
 * prompt inside `run()` — its confirmation lives in the DOM layer, which a remote
 * trigger never reaches — so the "are you sure?" is the CALLER's job. For a
 * remote command that means the app, before it asks the backend to dispatch.
 *
 * `clear-queue` deletes queued work that then never prints. print#235 (agent
 * v2.2.3) stopped it destroying in-flight ACKs, but queued jobs are still lost,
 * and the operator who loses them is not the one who pressed the button.
 */
exports.DESTRUCTIVE_AGENT_COMMANDS = ['clear-queue'];
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
 *
 * `agent_command_result` is declared but **NOT live** (print#224, 1.10.8): no
 * `$default` union entry or handler exists for it yet, so the api answers it with
 * `400 Invalid message`. It is in this array — the full vocabulary — and out of
 * `LIVE_CLIENT_SOCKET_ACTIONS` below, which is exactly the distinction the two
 * arrays exist to carry. Do not "fix the inconsistency" by adding it there; that
 * is the inverse of the 1.10.5 bug, and it would tell a consumer the frame is
 * accepted when it is rejected.
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
 * Why the backend refused the handshake (api#977 / app#1353).
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
