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
export declare const SOCKET_ACTIONS: readonly ["account", "baskets", "brands", "cash", "categories", "customers", "globals", "invoices", "literals", "orders", "products", "returns", "shifts", "stores", "suppliers", "supplier-invoice", "support", "surveys", "users", "favorites", "account-delete", "baskets-delete", "log-delete", "notifications", "support-message", "whatsapp-message", "payment_received", "payment_linked", "payment_unlinked", "mercadopago", "mercadopago_dynamic_qr_created", "mercadopago_static_qr_created", "mp_hook_log_appended", "mp_ipn_log_appended", "stripe", "subscription", "caea", "print", "print-order", "print-invoice", "print-product", "print-tag", "print_job_failed", "request_printers", "printers_changed", "agent_status_changed", "print_rules_changed", "printers_active", "agent_command", "logs", "maintenance", "currency_auto_updated", "drain_progress", "integration_event_appended", "userActivityRecorded"];
/** Union of every server→client data-frame action. */
export type SocketAction = (typeof SOCKET_ACTIONS)[number];
/** Runtime guard — narrows an untrusted string to a known action. */
export declare const isSocketAction: (value: unknown) => value is SocketAction;
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
export declare const AGENT_COMMANDS: readonly ["redetect-printers", "reconnect-socket", "flush-acks", "clear-queue"];
/** Union of every remote-triggerable diagnostic command. */
export type AgentCommand = (typeof AGENT_COMMANDS)[number];
/** Runtime guard — narrows an untrusted string to a known command. */
export declare const isAgentCommand: (value: unknown) => value is AgentCommand;
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
export declare const DESTRUCTIVE_AGENT_COMMANDS: readonly AgentCommand[];
/**
 * `data` payload of the BE → agent `agent_command` frame — nested,
 * `{ action: 'agent_command', data: AgentCommandData }`, like every other
 * server→client frame.
 *
 * Declared here rather than beside `PrintersActiveData` in `print.ts` because it
 * references `AgentCommand`, which is derived from the runtime `AGENT_COMMANDS`
 * array above; re-declaring the vocabulary as an ambient type would give it two
 * sources that drift independently.
 */
export interface AgentCommandData {
    command: AgentCommand;
    /**
     * The target agent. Advisory for the agent itself — the BE has already scoped
     * delivery to that agent's connections — but carried so the agent can drop a
     * frame that reached it through a mis-scoped broadcast rather than acting on
     * another machine's instruction.
     */
    agentId: string;
    /**
     * Stable per-dispatch id. **Required, never optional.**
     *
     * The wss `$default` route has a bare Lambda integration and no route
     * response, so a frame the agent sends can never fail visibly to it. Delivery
     * therefore has to be idempotent-and-repeatable rather than once-and-hope,
     * and a re-dispatch needs a stable id for the agent to deduplicate on and for
     * the backend to match a late result against.
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
export declare const CLIENT_SOCKET_ACTIONS: readonly ["auth", "logs", "heartbeat", "ack", "register_printers", "export_local_rules", "agent_command_result"];
/** Union of every client→server action. */
export type ClientSocketAction = (typeof CLIENT_SOCKET_ACTIONS)[number];
/**
 * Client→server actions the backend accepts **today** — a strict subset of
 * `CLIENT_SOCKET_ACTIONS`. Anything declared but absent here is published ahead
 * of its handler and will be rejected `400 Invalid message` on the wire.
 */
export declare const LIVE_CLIENT_SOCKET_ACTIONS: readonly ["auth", "logs", "heartbeat", "ack", "register_printers", "export_local_rules"];
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
export type ClientSocketMessage = SocketAuthMessage | SocketLogsMessage | SocketHeartbeatMessage | SocketAckMessage | SocketRegisterPrintersMessage | SocketExportLocalRulesMessage | SocketAgentCommandResultMessage;
/**
 * Why the backend refused the handshake (api#977 / app#1353).
 *
 * These exist because API Gateway translates a server-side disconnect into an
 * opaque 1006 close with no reason. Without an explicit frame the client cannot
 * tell a rejection from a network blip and burns its retry budget.
 */
export declare const SOCKET_AUTH_FAIL_REASONS: readonly ["no_token", "invalid_role", "invalid_token", "not_authenticated", "server_error"];
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
export declare const SOCKET_KEEPALIVE: {
    /** Client → server. */
    readonly ping: "ping";
    /** Server → client. */
    readonly pong: "pong";
    /** Deprecated client → server alias for `ping`, still accepted. */
    readonly legacyPing: "live";
};
/** Recognises either accepted keep-alive request body. */
export declare const isSocketKeepAlive: (body: unknown) => boolean;
