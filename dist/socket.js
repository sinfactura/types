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
    /**
     * A marketing campaign created, updated, scheduled or cancelled.
     * Operator-only — `wsPostStore(..., { audience: 'operator' })`.
     *
     * `Campaign` carries no `customerId`, so the customer leg of
     * `'operator-and-customer'` would be a no-op query rather than a leak —
     * but state the audience explicitly anyway: the safety here is a property
     * of today's shape, not of the broadcast call, and a later field would
     * silently turn a no-op into a fan-out.
     */
    'campaigns',
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
    /**
     * A customer's loyalty balance moved — an earn, a redemption or an
     * adjustment. Operator-only today: `wsPostStore(..., { audience: 'operator' })`.
     *
     * `data` is the `LoyaltyAccount` row, which carries `customerId` by
     * construction. That field is the identity axis a client caches on, so a
     * balance frame that could not answer it would never be placeable and
     * would be dropped silently rather than loudly.
     *
     * ⚠️ The frame carries the BALANCE, never the ledger row: points, the
     * order they came from and the acting user are operator-side history, and
     * `scrubForCustomer` knows nothing about this entity.
     */
    'loyalty',
    'orders',
    'products',
    /**
     * A promotion created, updated or retired. Operator-only —
     * `wsPostStore(..., { audience: 'operator' })`. Carries no discount
     * mechanics: `couponCode` links to the `Coupon` that holds them, so a
     * customer-visible offer still reaches the storefront through its own
     * surface rather than this operator frame.
     */
    'promotions',
    /**
     * A customer segment created, updated or deleted. Operator-only —
     * `wsPostStore(..., { audience: 'operator' })`, NEVER
     * `'operator-and-customer'`: `SegmentCriteria` describes how customers are
     * TARGETED, and broadcasting that to a customer socket would disclose the
     * store's targeting rules to the people being targeted.
     */
    'segments',
    // BE → all store users when a return (devolución) commits. Distinct from
    // `orders` — carries the committed `Return` row itself (stock/account/credit-note
    // effects), not just the order's bumped `updatedAt`.
    'returns',
    /**
     * A message template created, updated or deleted. Operator-only —
     * `wsPostStore(..., { audience: 'operator' })`. A template is authoring
     * content, never a sent message: nothing here implies a customer received
     * anything.
     */
    'templates',
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
    'warehouses',
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
];
/** Runtime guard — narrows an untrusted string to a known action. */
export const isSocketAction = (value) => typeof value === 'string' && SOCKET_ACTIONS.includes(value);
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
];
/** Runtime guard — narrows an untrusted string to a known command. */
export const isAgentCommand = (value) => typeof value === 'string' && AGENT_COMMANDS.includes(value);
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
export const DESTRUCTIVE_AGENT_COMMANDS = ['clear-queue', 'disable-printing'];
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
];
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
export const SOCKET_AUTH_FAIL_REASONS = [
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
export const SOCKET_KEEPALIVE = {
    /** Client → server. */
    ping: 'ping',
    /** Server → client. */
    pong: 'pong',
    /** Deprecated client → server alias for `ping`, still accepted. */
    legacyPing: 'live',
};
/** Recognises either accepted keep-alive request body. */
export const isSocketKeepAlive = (body) => body === SOCKET_KEEPALIVE.ping || body === SOCKET_KEEPALIVE.legacyPing;
