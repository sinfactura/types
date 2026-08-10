# Changelog

All notable changes to `sinfactura-types`. One line per release; see the
[git history](https://github.com/sinfactura/types/commits/main) for full
detail and `npm view sinfactura-types versions` for the published list.

Versioning follows [`PUBLISHING.md`](./PUBLISHING.md): additive changes ship as
**patch** bumps by project convention; breaking reshapes are major.

## 1.10.14

- **feat(audit):** `ImpersonationUiStartedEvent` gains an optional `return_to`
  (`userActivity.ts`) — the destination inside the impersonated tenant where a
  support session landed, recorded so an audit reader can see *where* the
  operator went, not just that a session opened. The value is a rooted,
  same-origin path; the api resolves it against a sentinel origin and persists
  the **pathname alone**, so the query string and hash the app's guard appends
  are dropped before the row is written — a target picked off a filtered list
  would otherwise carry an operator-typed email or CUIT into a row that lives
  three months hot and indefinitely in the archive (Ley 25.326). Optional
  because emitters predating the field, and sessions with no resolvable
  destination, simply omit it. `ImpersonationUiEndedEvent` is deliberately
  unchanged: the destination is emitted once, at session start.
- **feat(audit):** `CustomerPasswordResetInitiatedEvent` joins the
  `UserActivityEvent` union (`userActivity.ts`), graduating out of the local
  augmentation bridge the api had been carrying — the operator-initiated
  customer storefront password reset. `customer_id` follows the customer-scoped
  convention rather than `target_customer_id`, since `target_*` is reserved for
  users and stores in this union; the operator identity rides on
  `UserActivityEventBase`. `email_sent` records whether the mail actually went
  out, so a suppressed send cannot read as a delivered one. BE-emitted, so it is
  **not** in `UI_ONLY_USER_ACTIVITY_VARIANTS` — the FE-ingest gate must keep
  rejecting it.

## 1.10.13

- **fix(audit):** add `'mercadopago.dynamicQr.create'` to `OrderAuditAction`
  (`audit.ts`). The api has written that literal into the `AUDIT#ORDER#…`
  partition since before the union existed, so the closed union did not
  describe the partition it claims to type — the order-audit read endpoint was
  casting those rows onto the wire as if they were union members, and a
  consumer keying a label map off the union renders a blank action for them.
  Published as-written rather than renamed, so historical rows stay inside the
  type. It is the one member not in the `snake_case` taxonomy.

## 1.10.12

- **feat(mercadopago):** declare the QR-collection response DTOs that api had
  been returning without a shared type — `MpStaticQrResponse` (`data` of `POST
  /mercadopago/qr`) and `MpDynamicQrResponse` (`data` of `POST
  /mercadopago/qr/dynamic`), mirrored from `_qr.ts` / `_qrDynamic.ts`
  (`mercadopago.ts`). Also adds `Mercadopago.lastMovementCheckpoint?: number`
  (`store.ts`) — the money-movement poller checkpoint the api read via a
  lambda-local `MpWithCheckpoint` cast, which can now be dropped (api#879,
  api#959, api#895/#976).

## 1.10.11

- **fix(contracts):** eleven declarations corrected against what the api
  actually reads and writes, found by an audit of all 42 modules against
  `stacks/**`. Every one of these had a consumer coding against a field that is
  always `undefined`, a field under a name no row carries, or a documented
  invariant the api does not hold.
  - **`Currency`** reshaped to the poller's real `put` — drops `catalogId` (no
    writer has ever set it; the api#942 rename applies to the catalog
    contracts, not to this time-series sample), types `dated` as the `number`
    `getDated()` returns rather than `string`, and publishes the `createdAt`,
    `variation` and `sourceId` the row has always carried.
  - **`Product.totalIncomes` → `totalIncome`** — the singular is what
    `products/_post.ts` increments; the published plural matched no row.
  - **`Product.incomes[]`** gains `returnId` (the purchase-vs-return
    discriminator, api#547) and an honest `orderId` comment.
  - **`Product.inOffer`** is now optional and documented as client-authored:
    the "read-projection of any active promo" it claimed to be does not exist
    in the api. Read `prices[].promo` instead.
  - **`Account.userId`** is now optional — the manual `POST /account` row and
    the order-delivery debit, the two highest-volume writers, never stamp it.
  - **`UserActivityEvent`** gains the `Printer Active Toggled` arm (api#2008),
    which the api has validated, persisted and served from a live route since
    1.10.3 graduated only the Print Rule variants beside it.
  - **`scope`** narrowed to `'app' | 'landing' | 'storefront'` on
    `PlatformConfigEntry`, `PlatformGlobalsPostBody` and
    `PlatformConfigUpdatedEvent` — api#1955 retired `'web'` and the write gate
    now rejects it with a 400.
  - **`CashEvent`** PK corrected to `SHIFT#{storeId}#{shiftId}`; the documented
    bare `SHIFT#{shiftId}` is the exact form the api's key factory rejects,
    since shiftIds are per-store counters and the bare key merges tenants.
  - **`Invoice.dueDate`**, **`PaymentReceived.currencyValue`/`currencyValueAt`**
    and **`PaymentReceived.reconciled`/`reconcileReason`** keep their shape but
    are now marked as not populated on those surfaces, so absence is no longer
    readable as a meaningful value.

## 1.10.10

- **feat(orders):** `returns` joins `SOCKET_ACTIONS` — the BE → store-user frame
  fired when a return (devolución) commits (api#547). The return contracts
  themselves shipped in 1.9.0 and were sharpened in 1.10.7, but the **action
  string** never did, and it is wire shape exactly like the four drifts 1.10.5
  closed: `WsPostData.action` is typed `string` in the api's own ambient
  declarations, so an api emitting `'returns'` compiles, deploys and runs green
  while the published union says the action does not exist. The app's returns UI
  already listens for it. Silent in both directions, which is why it needs a
  release rather than a local augmentation — a `readonly [...]` const array
  cannot be extended from a consumer's `declare module` bridge. Audience is
  `wsPostStore` (all store users); the payload is the committed `Return`, while
  `Order.returns` carries the bounded `ReturnSummary[]` projection.

## 1.10.9

- **feat(print):** `agent_status_changed` joins `SOCKET_ACTIONS` — the BE →
  operator-panel frame fired when a heartbeat **changed** an agent's `queueDepth`
  (api#2065). `queueDepth` was the one field on the fleet card with no
  event-driven trigger, so it read up to ~90s stale (the agent's 60s beat plus
  the app's 30s poll). ⚠️ Payload-wise nothing moved — `queueDepth` was already
  on the heartbeat schema — which is why the three-lane ticket first recorded
  that no types change was needed. That is true of the **agent** lane
  (sinfactura/print#237 re-sends a byte-identical frame more often, and
  `heartbeat` is a `CLIENT_SOCKET_ACTIONS` member) but not of the api lane, which
  mints a new **server→client** action. The action string is wire shape too: this
  is the same drift class 1.10.5 closed four of at once, and it is silent,
  because nothing in api validates an outbound action against this list.
  Audience is `printers_changed`'s — `wsPostStore`, so operator panels only and
  never an agent (api#644).

## 1.10.8

- **feat(print):** `PrintRawFormat` + `PrintPrinter.rawFormats` — the
  operator-declared raw control languages a device understands, and the guard
  that stops a ZPL stream reaching a laser printer (types#114; blocks api#2058,
  print#61). ⚠️ Its doc block records the inversion that makes it worth a
  separate field: **absent or empty means REFUSE**, the opposite of
  `PrintPrinterCapabilities`, where absence means "not reported, accept
  everything". That default is right where guessing wrong wastes one job; here
  guessing wrong prints a ream of garbage and needs someone to walk to the
  machine. BE-owned like `active`, so it is added to `PrintPrinterReport`'s
  `Omit` — an agent build structurally cannot set it, and a re-registration
  cannot silently re-enable raw on the wrong device.
- **feat(print):** `agent_command` server→agent action, the `AGENT_COMMANDS`
  vocabulary, `isAgentCommand`, `DESTRUCTIVE_AGENT_COMMANDS`, `AgentCommandData`,
  and the `agent_command_result` reply frame (types#115, lane 1 of print#224).
  Commands are **kebab-case, verbatim from the agent's own `DiagnosticActionId`**
  (print#223, v2.2.2) rather than this file's usual snake_case: `sinfactura/print`
  does not depend on this package, so renaming would push a mapping table onto the
  agent where drift is invisible from both ends. `view-logs` and `test_print` are
  deliberately excluded — see the doc block. `commandId` is required, because the
  wss `$default` route has no route response and delivery must be repeatable.
  ⚠️ `agent_command_result` is in `CLIENT_SOCKET_ACTIONS` but **not** in
  `LIVE_CLIENT_SOCKET_ACTIONS`: no handler exists yet, so the api rejects it
  `400`. That gap is the point of having two arrays.
- **chore(mercadolibre):** removed the nine publish-composer-only shapes
  (`GtinRequirementTag`, `MlAttribute`, `MlRequiredAttribute`,
  `MlCategoryPrediction`, `MlCategoryCandidate`, `PublishPrediction`,
  `MlCategoryAttributeSchema`, `MlPublishRequest`, `MlPublishResponse`) —
  SINFACTURA dropped the create-a-new-listing flow (types#113, app#797,
  app#2310 closed). Zero references anywhere outside this package, verified
  across `api`, `app`, `storefront` and `cloudprint`.
  ⚠️ **`MlFieldError` was NOT removed**, against the issue's provisional read. It
  shipped in the same comment block, but it is not composer-only: api's
  `mapMlErrorCause` is shared by every `/items`-family write including
  `setListingStatus` (a manage-existing flow, api#1894/#1989), and app's
  `getMlFieldErrors` narrows the 422 `ML_VALIDATION_FAILED` payload off this
  ambient global with no local declaration — deleting it breaks app's typecheck
  the moment it bumps its pin. Patch bump despite the removals, per the repo's
  standing convention.

## 1.10.7

- **feat(orders):** `OrderLockReason` — the machine-readable payload of
  `409 ORDER_LOCKED` (api#546) / `409 ORDER_CANCELLATION_LOCKED` (api#591), and
  the gate a return checks first (api#547). Previously each consumer invented its
  own copy; api's shipped `assessLock` already had exactly these six members.
  ⚠️ Its doc block records the trap that made this worth publishing: every member
  is a **`> 0`** test, never a presence test — `POST /orders` stamps
  `readyAt: 0` / `deliveredAt: 0` / `deliveredDate: 0` at creation, so an
  `attribute_exists` check matches *every* order and inverts the lock.
- **feat(orders):** `ReturnCreditNoteErrorCode` + `Return.ncErrorCode` — why a
  return's credit note was refused, so a client can tell the one retryable cause
  (`PARTIAL_NC_AFIP_DOWN`) from the terminal ones. `ncError` stays as prose.
- **fix(orders):** `ReturnItem.orderItemIndex` and `Return.ncStatus` are now
  **required**. Both were optional "for pre-api#547 rows" — no such rows exist or
  can exist, because the returns feature is unbuilt and nothing has ever written
  a `RETURN#` row. An optional `orderItemIndex` forced every reader to `??`-guard
  the line's *identity*, which is the precise mechanism by which a
  `productId`-keyed collapse (the bug the index exists to prevent) creeps back
  in; an absent `ncStatus` was an unnamed fifth state. Zero producers today, so
  no consumer can break.
- **docs:** `ReturnCreditNoteStatus` now records that a return NC is always a
  *partial* NC, and that the partial path has no offline contingency — an ARCA
  outage must land on `rejected` + `PARTIAL_NC_AFIP_DOWN`, never `pending`
  (api#1749: `POST /invoices` fails closed with a 502 instead of degrading to a
  `pending_cae` row). A `pending` there would never settle.
- **docs:** `Return.requestId` now states that the dedupe does **not** key off it
  — api's `withIdempotency` reads the `Idempotency-Key` **header** only and is
  opt-in — so a client must send the same UUID in both places.

## 1.10.6

- **feat(print):** `Order.printedAt` / `Order.printJobId` and the `Invoice`
  counterparts (api#642) — the **confirmed** print signal, alongside the existing
  optimistic `orderPrinted` / `invoicePrinted` / `tagPrinted` booleans, which are
  unchanged and stay. `printJobId` is stamped at dispatch; `printedAt` is a
  server-derived ms epoch written only when the print agent acks that job.
  ⚠️ **Absent = not confirmed printed — never seeded to `0`**, unlike the
  `readyAt` / `deliveredAt` convention it otherwise resembles, and it is
  **cleared on every reprint** so it only ever describes the current
  `printJobId`. A tag/label print never sets either field on the order.

## 1.10.5

- **feat(print):** `PrintersActiveData` — the `data` payload of the new
  server→agent `printers_active` frame (api#2028). The BE enforces a printer's
  `active` pause flag only when a `PrintRule` resolves; on an unrouted job the
  agent picks its own local default, which the BE cannot know. This frame pushes
  the flag to the agent so its local fallback applies it too. **Full replacement,
  never a delta**, scoped to ONE agent's own connections. ⚠️ Both unknowns fail
  **open** and a consumer must implement them: a `printerId` the frame omits ⇒
  not paused; no frame yet (fresh connect) ⇒ not paused — a dispatch decision
  must never block on the backend's view arriving.
- **feat(print):** `PrintJobSummary` — one row of `PRINT_JOB_STATE#${storeId}`
  (api#2013), the per-job summary backing store-wide print-job listing. The
  timeline partition is per-job and cannot answer "list this store's jobs".
  ⚠️ `updatedAt` on this entity means **created**, not last-updated — it is the
  `PK-updatedAt` GSI sort key, and a mutable sort key cannot be paginated (a job
  transitioning between page 1 and page 2 would land on neither). Recency is
  `lastTransitionAt`.
- **fix(socket):** close four `SOCKET_ACTIONS` drifts — actions the api has been
  broadcasting or accepting while the published union omitted them, so an
  exhaustive switch keyed off `SocketAction` / `ClientSocketAction` silently
  excluded live traffic. Server→client gains `printers_changed` and
  `print_rules_changed` (both pre-existing) plus `printers_active`;
  client→server gains `export_local_rules`, whose frame interface and
  `ClientSocketMessage` membership shipped in 1.10.4 while the action string
  itself never did. ⚠️ `printers_changed` is **not** an agent frame despite its
  name and grouping — all its producers use `wsPostStore`, which excludes
  printer connections (api#644); it is the operator fleet panel's frame.

## 1.10.4

- **feat(print):** the phase-5 migration frame — `SocketExportLocalRulesMessage`
  (added to `ClientSocketMessage`) plus `PrintLocalRuleExport` and
  `PrintLocalRuleSkip`. Carries the agent's local `useCase → printer` config into
  `PRINT_RULE#${storeId}` on connect (api#2010 + sinfactura/print#183, the two
  halves of sinfactura/print#156 phase 5).
  A **distinct action rather than a field on `register_printers`**: an unknown
  action fails the api's discriminated union with a visible `400`, whereas an
  unknown field passes the loose gate and is silently stripped — an agent
  shipping ahead of the BE would otherwise migrate nothing and look healthy.
  `skipped[]` is keyed by `useCase` (not by slot) so it shares units with
  `rules[]` — one unresolvable `tags` slot is *two* unrouted use cases — while
  still carrying `slot`, since that is what tells an operator which printer to
  fix. `agentId` is deliberately undeclared and, unlike
  `SocketRegisterPrintersMessage`, not accepted even as advisory: routing rules
  have a wider blast radius than a registry row.
  ⚠️ Consumers should not treat an absent `PRINT_AGENT#` marker as a failed
  migration — an unconfigured agent sends no frame at all, and an empty frame is
  a no-op by contract.

## 1.10.3

- **feat(userActivity):** graduate the three `PRINT_RULE#` audit variants from
  api#2007 (merged as api PR#2023) — `Print Rule Created`, `Print Rule Edited`,
  `Print Rule Deleted`. Each carries `use_case` (typed as `PrintUseCase`, not a
  bare string), `agent_id` and `printer_id`; `Edited` adds a symmetric
  `fields_changed` (a key removed from the options payload is listed, not just
  added/changed ones, and it may be empty when a write changed nothing).
  Unblocks the app-side renderers — `CATEGORY_BY_EVENT` there is an exhaustive
  `Record<UserActivityEvent['event'], …>`, so **this bump turns app's current
  silent runtime crash on these events into a compile error** until it adds the
  three entries (sinfactura/app#2300).
  ⚠️ Deliberately NOT added: `printer` / `printer_agent` in
  `UserActivityEntityType`. The api writes no `LINK#` rows for them, so
  Path C (`?entityType=printer`) would 400 on a type the contract advertises.
  That needs the api-side composite `(agentId, printerId)` id first — `printerId`
  is unique only *within* an agent.
- **docs(userActivity):** the union's variant count comment read `72` while the
  union already held 78; corrected to 81. Recount rather than trust it.

## 1.10.2

- **docs(print):** actually apply the `PrintAgentSummary.hostname` correction.
  **1.10.1 shipped the changelog entry below without the code change** — a scripted
  edit's anchor assumed tab indentation while `src/print.ts` uses four spaces, and
  the assertion failure did not stop the chained version bump, commit and push. So
  1.10.1's `dist` is byte-identical to 1.10.0. Nothing was broken by it; the
  changelog simply described a fix that was not there. Corrected here.

## 1.10.1

- **docs(print):** correct `PrintAgentSummary.hostname` — it said *"Requires a
  cloudprint heartbeat change (sinfactura/print#180) — absent until then"*, which
  is now doubly stale: the agent ships it as of **v2.1.6**, and the api persists
  and exposes it as of **api#2016**. The fallback advice survives (mixed fleets
  are real, so it stays optional), but "absent until then" would have told the
  next consumer the field is unreachable.

  Also records that a hostname is **mild PII** — machine names routinely embed a
  person's (`MacBook-de-Juan`, `PC-MARIA`). The agent keeps it out of its own
  logs, and api#2016 redacts it by key in both the Powertools logger and Sentry.
  Worth stating on the contract so a consumer doesn't log or tag it.

  Doc-only, no shape change → patch.

## 1.10.0

- **fix(socket):** flatten `SocketRegisterPrintersMessage` and add the
  `request_printers` server→client action, for sinfactura/api#2017.

  **Minor, not patch:** `SocketRegisterPrintersMessage` is *reshaped*
  (`data: RegisterPrintersData` → `printers: PrintPrinterReport[]`), which the
  versioning table calls major. Shipped as minor because it cannot break anyone —
  the symbol had **zero** importers across `api`, `app`, `web`, `storefront`,
  `landing` and `cloudprint` (the only two api hits are prose in code comments).
  Same call as 1.9.0's two zero-consumer reshapes.

  It was the **only nested action** in the client→server union while `auth` /
  `logs` / `heartbeat` / `ack` are all flat — in this package, in the api's live
  `messageSchema`, and in the agent's sender, which builds `{ action, ...data }`
  by design and reserves nested payloads for server→client frames. A union entry
  written to match the nested declaration would have rejected **every** real
  agent report with `400 Invalid message`, leaving the `PRINTER#` registry
  silently empty — a failure that presents as an agent bug, in the repo with the
  slowest fix cycle (tag → CDN → electron-updater). Publishing the contract ahead
  of both lanes is what surfaced the mismatch before an agent shipped against it.

  `agentId` is deliberately **not declared** on the frame: the api derives it from
  the authenticated SOCKET row, because trusting a frame-supplied value lets one
  agent register printers under another's id. The open index signature still
  permits sending it, and the api treats it as advisory.

- **feat(socket):** `request_printers` (BE → agent) joins `SOCKET_ACTIONS` (48 →
  49). `register_printers` only fires on agent connect and on local printer
  change, so an agent already connected when the registry shipped stays invisible
  to it until it happens to reconnect — days for a machine that is never
  restarted. This lets the backend ask. Verified in production against a live
  agent, which ignored the unknown action without dropping its socket.

- **chore(socket):** `register_printers` moves into `LIVE_CLIENT_SOCKET_ACTIONS`
  — api#2006 shipped its handler and union entry, deployed and verified
  2026-08-01. The "not accepted by the api yet" warning is removed as stale.

## 1.9.1

- **feat(report):** canonicalize the `GET /reports?mode=invoices` ventas summary
  — `ReportInvoices`, `ReportInvoicesResume`, `ReportInvoicesAmounts`,
  `ReportInvoicesVoucherRow` — for sinfactura/api#2011. Purely additive: the
  shape existed only as a local duplicate in the app
  (`src/app/services/reports.ts`), so nothing here changes for an existing
  consumer.

  The new `gross` / `credit` / `net` triple (per day, plus a `period` aggregate)
  is what makes api#2011's fix legible: today the summary sums every deliverable
  voucher with a positive sign, so a nota de crédito **inflates** reported sales
  instead of reducing them. Every bucket amount is a POSITIVE magnitude —
  netting lives in `net`, never as a sign on `credit` — matching the fiscal-file
  convention where an NC row also stays positive and the `CbteTipo` carries the
  sign. Notas de **débito** stay in `gross` on purpose: a débito increases what
  is owed, and netting both families would move the total the wrong way.

  Two drift fixes fall out of canonicalizing it. `resume[].date` is a **number**
  (`YYYYMMDD`) — the app's copy typed it `string` while the API has always
  returned `Invoice.dated` — the same class of bug as `ReportSales.date`. And
  `invoices[]` is `ReportInvoicesVoucherRow`, not `Record<string, string>[]`:
  five of its ten fields are numbers. The legacy `neto10`/`neto21`/`iva10`/
  `iva21`/`neto`/`iva`/`total` columns are retained untouched for wire
  compatibility and documented as the debit-and-credit mixture they are.

## 1.9.0

Batched release of the five open contract issues: types#107, #109, #110, #111,
#112. **Minor, not the usual patch** — two symbols are reshaped rather than
purely added (see the ⚠️ items). Both had zero consumers at the time of the
change, verified by grep across every umbrella repo, so nothing can break; the
minor is a signal to read this entry, not a migration warning.

- **feat(socket):** new `src/socket.ts` exports the WS wire contract as
  **runtime values** — `SOCKET_ACTIONS` (48 server→client actions) +
  `SocketAction`, `CLIENT_SOCKET_ACTIONS` / `LIVE_CLIENT_SOCKET_ACTIONS`,
  `SocketMessage`, the four client→server frames, `SocketAuthOkFrame` /
  `SocketAuthFailFrame` + `SOCKET_AUTH_FAIL_REASONS`, `SOCKET_KEEPALIVE`, and
  the `isSocketAction` / `isSocketKeepAlive` guards — types#107. This is the
  package's **first non-ambient module**: everything else is
  `declare global` + `export {}`, but action names are needed as *values* to
  validate a frame and key an exhaustive switch. The action list is derived from
  the api's real producers (`postData` blocks, `dynamoUpdate`'s auto-broadcast
  `action` arg, payment/log call sites) — 48, not the 31 the issue estimated,
  which was only the app's own `action === '…'` handler count. Audience is not
  encoded: `print*` frames target the agent, some ops frames admins only, so a
  client must ignore what it does not own. `register_printers` is published
  **ahead of the backend** (api#2006) so the agent/api/app lanes share one
  `.d.ts`; `LIVE_CLIENT_SOCKET_ACTIONS` is what the api accepts today.
- **fix(build):** `src/index.ts` barrel now uses explicit `.js` specifiers. The
  package is `"type": "module"`, so Node's ESM resolver governs `dist/index.js`
  and does not do extensionless resolution — `dist/index.js` threw
  `ERR_MODULE_NOT_FOUND` on import. Latent for the package's whole life because
  ambient-only modules meant nothing ever loaded it at runtime; types#107's
  values made it reachable. Bundler-based consumers (Vite/esbuild) were
  unaffected and stay unaffected.
- **feat(print):** printer registry + routing contract — `PrintPrinterState`,
  `PrintPrinterCapabilities`, `PrintPrinter`, `PrintPrinterReport` (via `Omit`,
  so an agent build structurally cannot claim the BE-owned `active` /
  `reportedAt` / `online`), `RegisterPrintersData`, `PrintUseCase`, `PrintRule`,
  `PrintJobRouting`; `PrintAgentSummary` gains `hostname?` + `printers?` —
  types#112 / api#2005. Existing `PrintOptions` (api#1004) is reused, not
  duplicated. ⚠️ The full print-job **dispatch payload is still not
  canonical here** — the de-facto shape is cloudprint's own
  `PrintJobPayloadSchema`, whose `documentType` vocabulary
  (`invoice | shipping_tag | delivery_label`) does **not** match `PrintUseCase`;
  `PrintJobRouting` carries only the one field #156 adds. Reconciling those two
  vocabularies needs its own ticket.
- **feat(orders):** epic api#607 contracts — types#111. `EditOrderRequest`,
  `CreateReturnRequest`, `RetryReturnCreditNoteRequest`;
  `ReturnItem.orderItemIndex`, `Return.requestId`, `Return.ncStatus`
  (`ReturnCreditNoteStatus`) + `ncError`, `ReturnSummary`; `Order` gains
  `cancelledAt` / `cancelledBy` / `cancellationSource`
  (`OrderCancellationSource`) / `cancellationReason`; `StockIncome` gains
  `returnId` / `orderId` / `orderItemIndex`; new `ReportSales`;
  `OrderEditedEvent` + `OrderReturnedEvent` UserActivity variants and the
  `OrderCancelledByCustomerEvent` storefront variant. Returns are keyed by
  **order-array index, never `productId`** (one order can carry the same product
  on several lines at different prices). Sellable return stock rides
  `returnId`-tagged `INCOME#` rows rather than a new partition, so the existing
  `Σ INCOME − Σ SALE` on-hand formula stays correct with no reader change —
  hence the `StockIncome` attribution fields and no return-stock entity.
- ⚠️ **feat(audit) reshape:** `OrderAudit` + `OrderAuditChange` are **replaced**
  by `OrderAuditEntry` + `OrderAuditActor` + `OrderAuditPage`. The old shape
  invented columns (`auditId`, `changes[]`, `itemChanges`, `oldTotal`,
  `newTotal`) that did not match what the api's `writeAuditEntry` /
  `listAuditEntries` actually persist and return, so a handler could not satisfy
  both; line/total detail now lives inside the generic `before`/`after`
  payloads. `OrderAuditAction` **keeps all 14 members** and adds only
  `order_cancelled` — an earlier draft of api#548 listed 11 and would have
  silently narrowed the union.
- ⚠️ **feat(order) reshape:** `Order.returns` narrowed from
  `Partial<Return>[]` to `ReturnSummary[]` (bounded, max 50 per order).
- **feat(order, invoice):** `dueDate?: number` (Unix ms) on both — types#110 /
  api#713. Declarative only; nothing computes it from payment terms yet.
  Distinct from `Invoice.ttl` (a DDB cost boundary) and `caeExpiration` (an ARCA
  window) — this is a commercial payment term and what AR dunning schedules on.
- **feat(supplier):** `SupplierInvoice.ttl?: number` mirroring `Invoice.ttl` —
  types#109 / api#1947. Forward-only; a cost boundary on the hot tier with **no
  legal meaning**, never to be surfaced as a retention or expiry date. Lets api
  drop its `as unknown as` cast and the local augmentation block.

## 1.8.6

- **feat(print):** add `PrintAgentSummary`; `PrintAgentStatus` gains
  `agents: PrintAgentSummary[]` + `onlineCount: number` — api#612. The 1.8.5
  shape answered only "is *any* printer reachable", which can drive a red/green
  badge but not the operator fleet view sinfactura/app#1378 describes ("N
  agentes conectados", a per-agent drawer). Every field was already on the
  SOCKET row from the agent's 60s heartbeat and simply discarded. Per-agent
  fields are all optional because a pre-heartbeat agent build holds a live
  socket and receives jobs without ever reporting. ⚠️ `agents` is CONNECTED
  agents, not INSTALLED ones — an agent never started, or whose socket row was
  reaped by the 3h TTL, is invisible, so this cannot answer "are all my
  configured agents running". `platform` is `process.platform`, NOT a hostname;
  the agent sends no hostname and no per-printer statuses today, so the
  per-printer pane of app#1378 still needs agent-side work. The two new fields
  are required, which only affects a *producer* constructing the type (api
  alone); readers are unaffected.

## 1.8.5

- **feat(print):** add `PrintAgentStatus` — the `GET /print?mode=agent-status`
  response payload (api#612). Agent-LEVEL connectivity (`online`, `lastSeen`,
  `agentVersion`, `queueDepth`), deliberately separate from the job-level
  `PrintJobTransition` timeline: #612 answers "is the printer reachable now",
  api#642 answers "was this job printed". Purely derived — there is no stored
  entity behind it; the API computes `online` from the heartbeat fields the WSS
  `heartbeat` action already writes onto the store's SOCKET row, treating a
  heartbeat older than 3 intervals (180s) as offline. `lastSeen` is the wire
  name for the stored `lastHeartbeatAt`. Additive.

## 1.8.4

- **fix(store, product):** remove `Store.newPhotoURL`; add
  `Product.removePictures?: { url: string }[]` — api#1985. **Removal:**
  `newPhotoURL` was a legacy client-supplied upload destination with no
  remaining producer. Consumers that merely *strip* it from a request body
  (via a Zod schema or a `Record<string, unknown>` cast) are unaffected;
  anything reading it off a typed `Store` must drop the reference.

## 1.8.3

- **fix(api):** `LastEvaluatedKey` widens from `Record<string, string>` to
  `string | Record<string, string | number>`, and `truncated?: boolean` is
  added. The old shape couldn't express either real cursor: an opaque cursor
  string, or a key object for a GSI with a *numeric* sort key (`GET /invoices`'
  `PK-dated` branch). `truncated` is deliberately distinct from
  `LastEvaluatedKey` — an endpoint can be truncated with NO cursor to continue
  from, so `truncated: true` does not mean "fetch the next page". Readers are
  compatible; anything *constructing* a `LastEvaluatedKey` should widen.

## 1.8.2

- **feat(invoice, store):** graduate `FceThresholdConfig.updatedAt?: number`
  and `Store.config.aiOptOut?: boolean`. Both optional by design — a row
  written before the field exists simply omits it. Additive.

## 1.8.1

- **feat(invoice):** add `InvoiceAlicuota` (`{ id, baseImp, importe }`) and
  `Invoice.alicuotas?: InvoiceAlicuota[]` — api#1961. Per-VAT-rate buckets; a
  bucket is meaningful when `baseImp !== 0`, so a 0%-rated line still carries
  one. Forward-only with no backfill: absent on every row issued before
  api#1961, so treat missing as "not computed", not "no VAT". Additive.

## 1.8.0

- **feat(store):** add the `StoreGlobals` envelope and `Store.globals?:
  StoreGlobals` — platform globals forwarded to a tenant session on
  `GET /store` (api#1955). Only what `forwardToTenants` whitelists crosses the
  boundary. **Removals:** the unused `FeatureFlags` interface (and
  `Store.features`) is gone, and `minWithDni` moved off `Store` — where it was
  required — onto `StoreGlobals.minWithDni?`, where it is optional. A consumer
  reading `store.minWithDni` must move to `store.globals?.minWithDni`.

## 1.7.10

- **feat(supplier):** `SupplierInvoiceNotApplicableReason` gains
  `'wscdc_not_authorized'` — api#1934/#1937. Splits "the tenant never switched
  WSCDC on" (`wscdc_not_configured`, nobody asked ARCA) from "the tenant did
  switch it on but ARCA refused the certificate for the `wscdc` service"
  (`coe.notAuthorized`). The distinction is load-bearing on the API side: the
  latter is a verdict ARCA actually produced, so the write path must not
  re-enqueue it on every edit — treating both alike loops one WSAA login per
  save for exactly the tenants api#1933/#1934 exist to stop calling ARCA for.
  It also lets the FE say *"falta completar la relación en ARCA"* instead of
  *"WSCDC no configurado"*. Additive; `verifiedAt` keeps its documented meaning
  (WSCDC `FchProceso`) and is NOT set on this path.

## 1.7.9

- **feat(supplier):** `SupplierInvoiceConstatacion` gains `notApplicableReason`
  (`SupplierInvoiceNotApplicableReason` = `'not_constatable' |
  'wscdc_not_configured'`) — api#1937. `not_applicable` conflated a permanent
  property of the *comprobante* (missing CAE/coordinates/`cuit`/`total`, or a
  type outside the `CbteTipo` grid) with a transient property of the *tenant*
  (WSCDC not enabled / ARCA relación not completed), so the FE re-derived the
  difference by reimplementing the BE's `isVoucherConstatable` (app#2252) —
  which would silently drift the day that rule changed. Distinct from the
  existing `reason?: string`, which carries ARCA's own failure prose. Additive
  and optional; rows written before api#1937 carry `not_applicable` with no
  discriminator, so treat an absent value as unknown rather than as
  `'not_constatable'`.

## 1.7.8

- **feat(product):** `ProductChannelMapping` gains `permalink` (persisted, ML's
  public listing URL) and read-time-only `listingPrice` / `listingStock` /
  `mlStatus` (api#1895 — listing detail: permalink + live price/stock/lifecycle
  status). The latter three mirror the existing `regime`/`stockMirrorOnly`
  precedent: sourced from the `ML_ITEM` webhook cache, merged onto the
  response only, never persisted on `Product`. Additive.

## 1.7.7

- **feat(userActivity):** new `MlChannelStatusChangedEvent` variant on `UserActivityEvent`
  (api#1894). First audit-trail coverage for the marketplace-channel product-link
  state machine — `{provider, product_id, ml_item_id, from_status, to_status}`
  captures any operator-initiated `Product.channels[provider].status` transition.
  Designed to be shared, not single-purpose: api#1894 (pause/reactivate) emits it
  for `'linked'<->'paused'`, and api#1893 (unlink, in-flight) will reuse the same
  variant with `to_status: 'unlinked'` rather than adding a second one-off event.
  Additive.

## 1.7.6

- **feat(audit):** `ApocCheckResult` gains `stale: boolean` / `registryAgeDays: number`
  (api#1903). `registrySnapshotAt` was previously advisory-only — a stale local
  APOC registry answered `flagged: false` with no signal the answer might be
  outdated. A legal-research spike (`sinfactura/docs/references/ARCA_REGULATIONS.md`
  §15) found this consequential: the due-diligence defense courts recognize for
  the underlying "facturas apócrifas" check hinges on whether a supplier was
  listed at transaction time. Additive; the only consumer today (`api`'s
  `POST /afip {mode:'apoc'}`) computes both fields on every response.

## 1.7.5

- **feat(subscription):** `SubscriptionAdminOverrideInput.freeUntil` / `.trialEndsAt`
  widened to `| null`. The MANAGER out-of-band subscription override
  (`PUT /platform/stores/{storeId}/subscription`, api#827) previously had no way
  to clear either field once set (api#1907) — `null` now explicitly REMOVEs the
  attribute; omitting the key still leaves the existing value untouched.
  Additive/backward-compatible: every existing consumer only ever read/wrote a
  plain string/number.

## 1.7.3

- **fix(store):** `Store.address` is now optional. A freshly-registered store
  has no address until the operator fills one in via `PATCH /store`; the BE
  `POST /auth/register` no longer accepts `address`/`afip` (api#1898), so the
  previously non-optional `address` field was an untrue contract. Readers
  already guard with `?.` (verified) — relaxation is code-safe.

## 1.7.2

- **feat(product):** add optional `Product.seoTitle` / `seoDescription` /
  `attributes` (`{ name, value, evidence? }[]`) for AI product enrichment
  (api#1768). Additive; `attributes` is distinct from `variantAttributes` and its
  `evidence` provenance is operator-only (strip from customer projections).

## 1.7.1

- **chore(store):** remove `Store.seededAt` — a write-only provenance timestamp the
  removed seeder stamped; zero readers anywhere (demo-store behavior keys off
  `Store.type='demo'` alone). Follows the seeder removal (api#1875). `Store.type` kept.

## 1.7.0

- **chore(seeder):** remove `seeder.ts` and all AI Tenant Seeder wire/entity
  contracts (`SeedJob`, `SeedProfile`, `SeedProgressEvent`, `SeederJob`,
  `SeedSummary`, `SeedCommitResult`, `SeedAiTenantOpRequest`, `SeedVertical`,
  `SeedScale`, `SeedPhase`, `SeedSampleCard`, `SeedJobHandle`, `SeedJobState`,
  `BusinessDescription`). The seeder backend was removed (api#1875, ADR-0020).
  Removal is breaking by the table, shipped as **minor** by owner decision — no
  consumer imported these (FE removed in app#2219). `Store.type`/`seededAt` and
  `DemoClaims` are RETAINED (the demo-store concept is kept).

## 1.6.85

- **feat(store):** `Store.config.onboarding?` (`{ step: number; completed: boolean; skipped: boolean }`)
  — store-level guided-setup wizard progress persisted across sessions (api#1876, app#998, ADR-0020).
  Purely FE-read; first-login is derived FE-side (no BE field). Additive/non-breaking.

## 1.6.84

- **feat(store):** `Store.config.feedbackDefaults?` (`Record<string, { sound?: boolean; visual?: boolean }>`)
  — store-level per-category × per-channel notification/feedback defaults the app layers per-device
  overrides on top of (api#1740, app#2085 phase 2). Purely FE-read; open key set. Additive/non-breaking.

## 1.6.83

- **feat(basket):** `BasketMergeMeta` (`{ droppedSkus: string[]; mergedCount: number }`) — the
  response envelope sibling to `data` on `POST /basket?mode=merge` (api#1209). Additive/non-breaking.

## 1.6.75

- **feat(support):** helpdesk polish (api#1829) — `Support` gains a denormalized thread summary
  (`lastMessageAt?`, `lastMessagePreview?`, `messageCount?`), `updatedAt` is now required
  (always-set last-activity key), and `read` is now meaningful (tenant unread state).
  `NotificationInterface.ticketStoreId?` added for agent-facing SUPPORT bell cross-tenant
  deep-links. Additive/non-breaking.

## 1.6.74

- **feat(support):** new `Support` ticket-header entity + `SupportMessage` thread type,
  with `SupportTicketStatus` / `SupportTicketPriority` / `SupportMessageDirection` unions
  (api#1816 thread model + api#1817 agent console). Grows the flat support row into a
  header (`subject`, `category`, `priority`, `status`, `assignee?`, timestamps) plus an
  ordered message thread. Additive/non-breaking.

## 1.6.71

- **feat(notification):** `NotificationTypeEnum` gains `LOW_STOCK`, `OUT_OF_STOCK` and
  `SUPPORT` (api#1806) — stock-alert + support-ticket bell types, each with a User-row
  `notifications.<KEY>` opt-in read path. `Product.minStock?` (low-stock threshold) and
  `NotificationInterface.productId?`/`supportId?` (click-through targets) added alongside.
  All additive/non-breaking.

## 1.6.64

- **feat(seeder):** `SeedVertical` widened 4 → 10 (api#1075, app#1054) — the launch set is
  now the UNION of the 4 the FE shipped (`ferreteria`/`kiosco`/`libreria`/`farmacia`) and
  the 8 the research corpus wrote full prompt packs for, which overlapped on only 2. Adds
  `gastronomia`, `textil`, `tecnologia`, `panaderia`, `agropecuario`, `repuestos`.
  Additive/non-breaking (a 4-value producer still assigns cleanly); api's
  `Record<SeedVertical, …>` IVA tables are compiler-forced to stay exhaustive with it.
  SERVICE verticals are deliberately excluded — different seed shape, and the Services
  feature is types-only today (app#758).

## 1.6.63

- **feat(seeder):** `SeedProfile`, `SeedJobHandle`, `SeederJob`, `SeedPhase` (7-value,
  FE-frozen), `SeedProgressEvent`, `SeedSampleCard`, `SeedVertical`, `SeedScale`,
  `SeedJobStartRequest`, `SeedAiTenantOpRequest` (types#103, app#1054, api#1073-#1082/
  #1758/#1759) — the AI Tenant Seeder's wire/entity contracts. The event/profile/handle
  shapes mirror the already-shipped FE code verbatim (FE shipped the scaffold before the
  BE pipeline), not the original research blueprint.
- **feat(store):** `Afip.fceEnabled` / `Afip.wscdcEnabled` (api#1760) — manual-only
  toggles recording that a tenant has completed the WSFECRED/WSCDC ARCA relación; no
  auto-detection.

## 1.6.47

- **feat(mercadolibre):** `MlCategoryCandidate` + `MlCategoryAttributeSchema`
  graduated from api main (types#100, api#1664 ↔ app#1933) — the publish
  composer's override-arm read feeds: the confirm/override picker's
  `domain_discovery/search` candidate list and the standalone
  category-attribute-schema bundle for a FE-picked `categoryId`.
  `PublishPrediction` gains `candidates: MlCategoryCandidate[]` (required —
  api's handler always returns an array, possibly empty).

## 1.6.46

- **feat(mercadolibre):** `MercadolibreSyncPolicyInput` / `MercadolibrePatchInput`
  (api#1650) — write-oriented shapes for `PATCH /store`'s `mercadolibre` body.
  `syncPolicy`'s knobs accept `null` to mean "clear it" (an `InputNumber`-style
  control emits `null`, not `undefined`, on clear); the BE never persists
  `null`, so the read-side `Mercadolibre['syncPolicy']` is unchanged. Prefer
  `MercadolibrePatchInput` over `Partial<Mercadolibre>` for PATCH bodies.
- **chore:** graduate 5 in-flight local-bridge augmentations from `api`'s
  `@types/sinfactura-types/index.d.ts`, each already shipped and in live use —
  `StoreConfigAdminOverrideInput` (api#1509 Part A), `OrderMercadolibre`
  `.mlLastUpdated` (api#1574) + `.paid` (api#1576), `CAEAPeriod`
  `.order`/`.phase` + `CAEAInformResult.pendingInvoices`/`.classification`
  (api#1638), `ProductChannelMapping.regime`/`.stockMirrorOnly` (api#1649).

## 1.6.45

- **feat(mercadolibre):** publish-composer wire shapes graduated from api main
  (types#99 + types#98, api#1577 ↔ app#1933): `PublishPrediction` (+ its
  `MlCategoryPrediction` base), `MlAttribute`, `MlRequiredAttribute`,
  `GtinRequirementTag`, `MlPublishRequest` (POST body), `MlPublishResponse`
  (POST success `data`), `MlFieldError` (the 422 `ML_VALIDATION_FAILED` →
  `fieldErrors[]` payload). api#1664's override-arm read feeds (category
  candidates + attributes-by-categoryId) graduate in a follow-up release when
  that lands.
- **fix(store):** `Afip.showInvoiceLogo` retyped `string` → `boolean`
  (types#96) — it's a boolean toggle: FE binds a Switch and sends a boolean,
  BE reads it truthy (`makeInvoicePdf`); the string typing was papered over in
  app with an `as Afip` cast. Zero consumers read it as a string.

## 1.6.44

- **feat(mercadolibre):** MercadoLibre contracts, one consolidated release
  (types#94, app#797 Phase 1). `Mercadolibre` leaf in `StoreIntegrations`
  (KMS-token lifecycle mirroring `Mercadopago`/`Gmail`, plus `needs-reauth`
  status, ADR-0018 Amendment B write-ahead `refreshAttemptAt`, `autoInvoice`
  / `defaultPosId` / `syncPolicy` buffer→limit→pause knobs) +
  `Store.mercadolibreUserId` sparse-GSI scalar mirror. `Order.channel:
  'meli'` + `OrderMercadolibre` sub-record (pack/shipment identity,
  line-level UP-variant + stock provenance, ADR-0013 self-describing `fees`,
  raw billing-info-v2 `billingInfo`). `Product.channels` map
  (`ProductChannelMapping` with UP-variant identity + `rejected` state). New
  `mercadolibre` module: OAuth wire shapes (`MlOauthTokenResponse`,
  `MlOauthInitiateResponse`, `MlOauthCallbackResponse`, `MlOauthErrorCode`,
  `MercadolibreStatus`), unsigned `MlWebhookEvent` envelope, mapping
  workbench contract (`MlMatchSuggestion` + grade/basis unions),
  `MercadolibreOrderWsPayload`. Widened: `NotificationTypeEnum.MERCADOLIBRE`,
  `FeatureKey 'marketplaceChannels'`,
  `IntegrationTokenRefreshedEvent.provider` += `'mercadolibre'`. Decision
  recorded on types#94: ML settlements reuse `PaymentReceivedSource 'mp'` —
  no enum change.

## 1.6.43

- **feat(platform):** `PlatformConfigEntry` + `PlatformGlobalsPostBody` — the
  platform-wide settings/feature-flag CRUD contract (single fixed
  GLOBALS/PLATFORM scope, no per-tenant override), plus `PlatformConfigUpdatedEvent`
  (`UserActivityEvent` union, now 71 variants) (api#1108). Graduated out of
  api's bridge.
- **feat(afip):** `Afip.accessTicket_FECRED` — WSAA ticket for the
  `wsfecred` service (FCE MiPyME buyer-side ops), mirrors the published
  `accessTicket_FEX` (api#1558). Graduated out of api's bridge.
- **feat(afip):** `Afip.accessTicket_CDC` — WSAA ticket for the `wscdc`
  service (third-party voucher constatación); `VoucherVerificationRequest`
  gains `authorizationCode` (required), `authorizationMode`,
  `receptorDocType`, `receptorDocNumber` — the fields WSCDC's
  `ComprobanteConstatar` needs beyond the voucher coordinates already shipped
  in 1.6.42 (api#1500). Graduated out of api's bridge.

## 1.6.42

- **feat(invoice+store):** WSFEX contract amendments from the api#1557
  preflight manual read (v2.0.1 §2.1.3): `ExportInvoiceFields` gains required
  `tipoExpo`/`cliente`/`domicilioCliente` + `cuitPaisCliente` (one-of with
  `idImpositivo`, err 1580) + `fechaPago`; `canMisMonExt` becomes the wire
  `'S' | 'N'` (was `boolean`; zero consumers existed); `monedaId`/`monedaCtz`
  documented as wire projections of `Invoice.currency`/`currencyValue`.
  `WsfexReferenceData` gains `unitsOfMeasure` (GetPARAM_UMed — `Pro_umed` is
  required per item) + `currenciesWithQuote` (MON_CON_COTIZACION). `Afip`
  gains `accessTicket_FEX` (WSAA 'wsfex' ticket) and `exportPointOfSale`
  (dedicated FEEWS punto de venta, err 1510 — the api#1586 lesson applied).

## 1.6.41

- **feat(store):** `Afip.caeaPointOfSale?: number` — the store's dedicated
  CAEA punto de venta (api#1586). RG 5782/2025 Art. 5 requires CAEA
  comprobantes to be issued from "puntos de venta específicos" (ABM Sistema
  "CAEA – Fact. Elect."), always a different number than the CAE
  `pointOfSale`, with its own voucher sequence.

## 1.6.40

- **chore(store):** remove the dead `Store.legacyCurrencyIds` field — a
  migration-era artifact of the api#942 currency-catalog rollout whose last
  reader was dropped when the #942 read-path checklist closed (api PR #1031).
  Nominally a removal (major per the table below), shipped as a patch because
  it is provably consumer-free: zero references across api/app/web/landing,
  verified 2026-07-03. Also the first release published by the new
  `publish-npm` OIDC workflow end-to-end.

## 1.6.39

- **feat(caea):** `Invoice.caeaDet` + `CaeaInformDet` — frozen
  `FECAEADetRequest`-shaped snapshot captured at CAEA-stamp time and replayed
  verbatim by the deferred `FECAEARegInformativo` step (api#1580).
- **feat(waitlist):** graduate `Store.waitlist` + `WaitlistConvertedEvent`
  (now a `UserActivityEvent` union member, 70 variants) out of api's bridge
  (types#92, api#1567).
- **feat(facturaM):** graduate `Afip.cbu` + issuance-frozen
  `Invoice.facturaMLegend`/`Invoice.cbu` (RG 5762) out of api's bridge
  (types#93, api#1560).
- **feat(arca):** graduate `Invoice.arcaEvents` + `FiscalAuditEvent.eventos`
  — AFIP `Events.Evt[]` passthrough, reusing the `InvoiceObservation`
  `{code, msg}` shape (types#95, api#1559 follow-up).

## 1.6.38

- **feat(caea):** `CAEAPeriod.fchTopeInf` — ARCA's authoritative per-period
  Inform deadline, captured verbatim from `FECAEASolicitar`/`FECAEAConsultar`
  `ResultGet.FchTopeInf` (api#1580).

## 1.6.37

- **feat(auth):** graduate `WaitlistRegisterResponse` out of api's bridge —
  `POST /auth?mode=register` response shape when `waitlist: true` is sent
  (api#640). Pre-launch landing signups now persist to a lightweight
  waitlist bucket instead of creating a full tenant; no `accessToken`/
  session in the response.

## 1.6.36

ARCA/AFIP e-invoicing compliance pre-launch batch (app#1017 epic, ADR-0017,
launch 2026-08-01) — types for every Phase 2 BE companion ticket filed on
`api`, plus graduation of two more contracts out of api's in-flight bridge:

- **feat(invoice):** CAEA contingency (api#1556) — `CAEAPeriod`,
  `CAEARequestResult`, `CAEAInformResult`, `Invoice.caea?` / `caeaPeriod?`.
- **feat(invoice):** WSFEXV1 export invoicing (api#1557) —
  `ExportInvoiceFields`, `Invoice.export?`, `WsfexReferenceData`.
- **feat(invoice):** WSFECRED FCE MiPyME credit invoices (api#1558) —
  `FceStatus`, `FceFields`, `Invoice.fce?`, `FceThresholdConfig`.
- **feat(invoice):** observaciones parsing (api#1559) — `InvoiceObservation`,
  `Invoice.arcaObservations?: InvoiceObservation[]`. Deliberately a **new**
  field rather than retyping the existing `Invoice.observations?: string` —
  that field is free text and already consumed by the FE
  (`FiscalStatusBanner`'s `errorMessage`), so changing its shape would be a
  breaking change.
- **feat(invoice):** structured rejection payload (api#1380) — `ArcaError`,
  `Invoice.arcaError?`.
- **feat(store):** `Afip.facturaMLegend?: 'retencion' | 'cbu_informada'` — RG
  5762/2025 Factura M elimination, per-punto-de-venta legend config, not a
  per-invoice override (api#1560).
- **feat(order):** `Order.invoiceMethod` gains `docType?` / `docNumber?` —
  explicit per-order ARCA receptor identity (CUIT/DNI), decoupled from the
  legacy `condFiscal`-derived path (api#1368).
- **feat(supplier):** graduate `SupplierInvoicesResumeRow` /
  `ReportSupplierInvoicesResponse` out of api's bridge — `GET
  /reports?mode=supplier-invoices` compras mirror of `mode=invoices`
  (api#1550).
- **feat(userActivity):** graduate `IntegrationTokenRefreshedEvent` out of
  api's bridge — new `UserActivityEvent` union member, 69 variants total
  (types#91, api#1540).
- **feat(supplier):** WSCDC third-party voucher verification (api#1500) —
  `VoucherVerificationRequest`, `VoucherVerificationResult`. Not drafted in
  the ticket itself; derived from its AC field list plus the A/O/R
  (Aceptado/Observado/Rechazado) convention already shipped on
  `FiscalAuditEvent`. `FiscalAuditEvent.operation` widened to include
  `'ConstatarComprobante'` since verification calls log to the same table.
- **fix(invoice):** `InvoiceObservation.message` → `.msg` — matches the
  already-shipped `FiscalAuditEvent.observaciones`/`.errores` `{code, msg}`
  convention instead of introducing a second naming scheme for the same ARCA
  concept (caught before publish, no consumer impact).

## 1.6.35

Batch graduation of api's in-flight `@types/sinfactura-types` bridge — every
contract that had shipped in api but was still living in the local
augmentation file:

- **feat(user):** `User.login?: { failedAttempts?, lockedUntil?, lastFailedAt? }`
  — per-account password brute-force counter (api#1505).
- **feat(auth):** new `LoginErrorCode` union + `AccountLockedResponse` — wire
  error codes for the password brute-force lockout flow (api#1505).
- **feat(store):** `Gmail.accessTokenEncrypted?` / `accessTokenExpiresAt?` —
  lazily-refreshed access-token cache for the Gmail send path (api#1457).
- **feat(payment):** `PaymentReceived.reconciled?` / `reconcileReason?` —
  same-day MP refund ledger reconciliation stamp (api#1464).
- **feat(store):** `SmsIntegration.signature?` — per-store SMS firma appended
  to outbound order SMS (api#1515).
- **feat(invoice):** new `LibroIvaDigitalResponse` — `GET
  /reports?mode=libro-iva-digital` wire shape (RG 4597, api#1501).
- **feat(supplier):** `SupplierInvoice` gains `neto10?/neto21?/neto27?/iva27?/
  noGravado?/exento?` (per-alícuota IVA discrimination for Libro IVA Digital
  compras, api#1501) and `cbteClass?: 'A' | 'B' | 'C'` (real ARCA comprobante
  class, api#1542).

## 1.6.34

- **feat(userActivity):** `LiteralUpdatedEvent` gains a required `scope` field;
  new `LiteralScope` union (`'GLOBAL' | 'APP' | 'PLATFORM' | 'WEB' |
  \`APP#${string}\` | \`WEB#${string}\``) models the multi-scope literals
  taxonomy — per-surface defaults plus per-tenant overrides keyed off the
  `LITERALS` row `SK` (api#1484).

## 1.6.31

- **feat(mercadopago):** super-ops forensic log shapes for the per-tenant
  payments integration — `MpHookLogEntry` / `MpHookResult` (webhook),
  `MpIpnLogEntry` / `MpIpnOutcome` (IPN), `MpMovementLogEntry` / `MpMovementType`
  (movements poller) (api#970, api#976). *(Backfilled — recovered from git
  `ce2cddc`; the MercadoPago epic originally shipped without a changelog line.)*

## 1.6.28

- **feat(subscription):** graduate the MANAGER store-subscription override types
  (api#827) out of the api in-flight bridge — `SubscriptionAdminOverrideInput`
  (the `PUT /platform/stores/{storeId}/subscription` body) and
  `SubscriptionAuditEntry` (the `GET .../subscription/audit` read row).
- **feat(subscription):** add `SubscriptionSyncPayload.currency`
  (`'ARS' | 'USD' | null`) — already on the `GET /subscription` wire, now typed.
- **fix(subscription):** widen `SubscriptionUsageEntry.period` / `limit` /
  `remaining` to allow `null` (lifetime caps + unlimited tiers) — matches the
  long-standing wire shape.

## 1.6.25

- **fix(store):** AFIP cert expiry is now `Afip.certExpiry?: number` (ms-epoch of
  the cert's `notAfter`), matching the FE contract (app#1022) and the ms-epoch
  timestamp convention. **Replaces** the 1.6.24 `afipCertExpiresAt` /
  `afipCertExpiresInDays` (published but unconsumed — corrected before any
  consumer adopted them). (api#1374)
- **feat(account):** add `Account.paymentRefSource?: PaymentReceivedSource` /
  `paymentRefId?` — provenance of link-derived credit rows (api#933 / PR#943,
  app#1344).
- **feat(afip):** add `AfipHealth` — cached ARCA platform-health snapshot served
  by `GET /afip/health` (api#1213, app#1408).
- **feat(user):** add `User.warnings?: StoreWarning[]` — CUIT_SHARED soft-warns
  carried on the auth/register response (response-only, app#1664).

## 1.6.24

- **feat(print):** add the agent-agnostic print-protocol wire types
  `PrintJobState`, `PrintContentType`, `PrintOptions`, `PrintJobTransition`
  (`print.ts`) (types#79, api#1004 / api#1290).
- **feat(cash):** add cash-drawer shift management — `CashShift`, `CashEvent` +
  `CashShiftStatus` / `CashEventType` (`cash.ts`) (types#80, api#987).
- **feat(store):** add derived AFIP cert expiry `Afip.afipCertExpiresAt` /
  `afipCertExpiresInDays` (api#1374).
- **feat(invoice):** add ARCA-contingency `Invoice.attemptedCbteNro` /
  `attemptedCbteFch` + `invoicePrinted` (api#1314, api#643).

## 1.6.22

- **feat(service):** add `ServiceOrder`, `WorkLog`, `PartUsed`,
  `ServiceStatusEntry` + `ServiceType` / `ServiceStatus` / `ServicePriority` /
  `PricingModel` unions (`serviceOrder.ts`); extend `Invoice` with AFIP service
  fields `serviceStartDate` / `serviceEndDate` / `paymentDueDate` /
  `serviceOrderId` (types#30, app#758).
- **feat(service):** add `ServiceTemplate` (+ `ServiceChecklistItem`,
  `ServiceCommonPart`) for configurable per-type workflows (types#31, app#758).
- **feat(demo):** add `DemoClaims` and `Store.type = 'production' | 'demo'`
  (types#33, app#1054).
- **feat(whatsapp):** add WhatsApp Commerce types — `WhatsAppConfig`,
  `WhatsAppConversation`, `WhatsAppChatMessage`, `WhatsAppUsage`,
  `WhatsAppTemplate` (+ component/button); expose via
  `StoreIntegrations.whatsapp` (types#34, app#1072).
- **docs:** add `PUBLISHING.md` (coordinated release workflow) + this changelog
  (types#42).

## 1.6.18 – 1.6.21

- **feat(user, audit):** TOTP 2FA — `User.totp` shape, recovery codes, 2FA
  lockout fields, and the Two-Factor Enrolled/Disabled/Reset activity variants
  (api#636).

## 1.6.10 – 1.6.17

- **feat(storefrontEvent):** publish the `StorefrontEvent` discriminated union +
  `IdentityLink`; add the Customer Password Reset Requested variant.
- **feat(userActivity):** publish the `UserActivityEvent` discriminated union
  (Phase 1–3, 49+ variants).
- **fix(types):** `phone → string` on Register/Store/Supplier; `Afip`
  `hasCert` / `hasKey` derived flags; reconcile `UserNotifications` with the
  canonical `NotificationTypeEnum`.

## 1.5.6 – 1.6.x (currency taxonomy)

- **feat(currency):** introduce the currency catalog — `CatalogId`,
  `StoreCurrencySubscription`, FX auto-update bindings — and widen every
  currency field to the catalogId encoding (api#942). Money entities became
  self-describing via their own `currency` stamp (ADR-0013).

## 1.5.0 – 1.6.x (mercadopago per-tenant payments)

- **feat(mercadopago):** per-tenant MercadoPago integration contracts — OAuth
  Connect (`MpOauthTokenResponse`, `MpOauthInitiateResponse`,
  `MpOauthCallbackResponse`), `MercadopagoStatus`, the webhook/IPN notification
  shapes (`MpWebhookEvent`, `MpPaymentNotification`) and `MpPointDevice`
  (`mercadopago.ts`) — the foundation each tenant's OAuth Connect, static +
  dynamic QR collection and webhook/IPN ingestion path builds on (types#51,
  api#832). *(Backfilled — recovered from git `a57d78b`; the epic originally
  shipped without a changelog line. QR-response bodies and the
  `staticQr`/`dynamicQrPos`/`lastMovementCheckpoint` STORE fields are read via
  local casts in api and are not yet declared here — see api#894 TODO.)*

## 1.1.0 – 1.5.x (subscription)

- **feat(subscription):** add the subscription/billing contracts — `PlanTier`,
  `Entitlement`, `FeatureKey`, `FeatureMatrix`, `Plan`, `Subscription`,
  `UsageCounters`, and the `SubscriptionSyncPayload` WS shape. First
  cross-cutting type addition requiring paired PRs across `app` + `api`
  (app#710 + api#626). Subsequently aligned to the BE wire format and
  reshaped `Plan` (PlanAuditEntry, `bullets[]`).

## 1.0.x

- Initial published releases — core domain entities (`User`, `Store`,
  `Customer`, `Product`, `Order`, `Invoice`, `Basket`, …).
