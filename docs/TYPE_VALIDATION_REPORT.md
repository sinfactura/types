# Cross-Repository Type Validation Report

**Date:** 2026-08-10
**Types version:** `sinfactura-types@1.10.16` (audited); `1.10.17` landed and published mid-remediation, resolving Finding 5
**Compared repositories:** `sinfactura/types`, `sinfactura/api`, `sinfactura/app`
**Scope:** All 43 files in `types/src/`, their API producers/storage paths, and current app consumers.

## Executive summary

The fresh audit found **20 shared-contract discrepancies**, **13 app integration/type-safety gaps**, and **4 forward-only or documentation observations**. This replaces the previous total of 34: that count included false positives, intentional storage/input differences, and a style-only item.

An independent adversarial verification pass (2026-08-10) re-checked every claim below against api/app code (~100 sub-claims). None of the findings collapsed; four corrections were folded in (Findings 2, 3, 15 and app row A11), one previously removed item was restored as Finding 20, newly surfaced adjacent defects were folded into Findings 1, 2, 5, 6 and 19, and all validation gates were re-run and pass.

| Category | Count | Meaning |
|---|---:|---|
| High | 3 | A core type or public response materially misrepresents the implemented contract |
| Medium | 10 | Real optionality, projection, validation, or boundary mismatch |
| Low | 7 | Dead/phantom fields or client-only fields mixed into shared entities |
| App | 13 | Current app pin, stale local mirrors, or unshared wire DTOs |
| Observation | 4 | Forward-only declarations or documentation drift, not runtime mismatches |
| **Shared discrepancies** | **20** | High + medium + low only |

The package does **not** consistently model one layer. It contains a mixture of:

1. request DTOs,
2. DynamoDB/storage rows,
3. REST projections,
4. WebSocket payloads, and
5. app-only/synthetic view fields.

That distinction matters. A storage-only field is not missing from a public type if every read path strips it; conversely, an internal field is a wire mismatch when a raw-row projection leaks it. Findings below identify the affected layer explicitly.

## High-severity discrepancies

### 1. `Store` conflates storage, request, and wire shapes

`Store` is used as the app-facing `GET /store` shape, but it both omits returned fields and requires fields the endpoint deliberately no longer returns.

**Returned but undeclared:**

- `updatedAt`
- top-level contact/payment fields `whatsapp`, `instagram`, `facebook`, and `cbu`
- `priceListSeq` can leak through the raw `...store` spread on `GET /store` — and additionally through the shared write echo (`dynamoUpdate` returns the re-read row) on POST/PATCH responses and the admin WebSocket broadcast — although it is documented by the API as internal bookkeeping and should be stripped rather than publicized

**Declared required but not guaranteed on the wire:**

- `appVersion` is retired and stripped on writes/wire boundaries
- `fiscalConditions` is retired and omitted
- `email`, `phone`, and `cuit` are required in `Store`, but the API allows all three to be removed

`ivaTypes` is different: it remains required and `GET /store` injects it from the static `IVA_TYPES` catalog — but only there. `sanitizeStoreRow` deletes it, so the POST/PATCH `/store` response echo and the admin WebSocket broadcast omit this required field; it is aligned on GET only.

The same interface also exposes request-only controls (`photoData`, `removePhotoURL`) and storage-only integration credentials that sanitizers never return: `Mercadopago.accessToken`, the Gmail encrypted tokens, and the AFIP `cert`/`key`/`accessTicket_*` fields. Two verification corrections: `Afip.csr` is persisted and deliberately public (returned to the operator; stripped by no sanitizer), and WhatsApp's required `accessToken` has no writer at all — no connect flow exists — so it is a phantom rather than a stripped secret. `GET /store` currently withholds `integrations.whatsapp` entirely.

**Action:** split `StoreWriteInput`, `StoreRow`, and `StoreWire`; make removable contact fields optional; remove retired required fields; add legitimate wire fields; explicitly strip `priceListSeq` from responses.

### 2. `Subscription` is not the implemented DynamoDB row

The `Subscription` comment explicitly says it is the stored row, but the API's `SubscriptionRow` uses a different model:

| `Subscription` | API storage |
|---|---|
| `tenantId` | `storeId` |
| required billing cycle/periods | optional before checkout |
| `stripeCustomerId` / `stripeSubscriptionId` | provider-neutral `externalCustomerId` / `externalSubscriptionId` |
| embedded `overrides` | separate `OVERRIDE#...` rows |
| no provider/cancellation/past-due fields | `provider`, `cancelAt`, `canceledAt`, `pastDueSince` |

This does **not** mean the frontend currently receives the wrong shape. `GET /subscription` serves `SubscriptionSyncPayload` — the builder is annotated `Promise<SubscriptionSyncPayload>` and a field-by-field comparison found zero mismatches. The WebSocket, however, never carries the payload: all five subscription pushes send a thin `{ action: 'subscription', data: { type, … } }` refetch nudge.

Two adjacent defects surfaced by verification: the types `Subscription.currency` JSDoc documents a subscription-level snapshot that does not exist (`SubscriptionRow` has no `currency`; the snapshot reads the Plan row), and `GET /store` embeds a hand-built, unannotated subscription block that omits `currency` and `freeUntil`. That embed matches neither declared shape: `Store.subscription` is typed `StoreRowSubscriptionSummary`, which is the six-field `GET /tenants` supervisor summary — the `GET /store` embed is a ten-field near-`SubscriptionSyncPayload`, so the declared type actively contradicts the tenant-facing response.

**Action:** replace or rename `Subscription` as an actual storage type (and drop its phantom `currency` snapshot claim). Keep `SubscriptionSyncPayload` as the public read contract, and annotate the `GET /store` subscription embed with it or a declared subset.

### 3. Internal `search` fields leak inconsistently from Orders and Invoices

Order, Invoice, Customer, Supplier and SupplierInvoice writers all persist a lower-cased `search` index.

- Order service projections (`getOrderById`, `getOrdersByCustomerId`, `getOrdersByDate`) spread raw rows and return `search` on every affected REST path; the delivery endpoint's `...order` response echo leaks it too, and `getOrdersByCustomerId` declares a `ProjectionExpression` prop it never forwards.
- Invoice search results delete `search`, but the customer-scoped and default/date branches return it through raw spreads, and get-one (`getInvoiceById`) returns the raw row.
- Verification overturned the claim that Customer/Supplier reads already strip it — only some branches do. `GET /customers?customerId=` returns the unprojected row, the bare supplier list spreads raw rows (only the supplier *search* branch strips, with a comment claiming it mirrors customers), and supplier invoices both persist and leak it via `?mode=invoices`.
- Neither `Order` nor `Invoice` declares `search` — but `Customer.search` is declared **required**, and `Supplier`, `Product` and `User` declare it too, codifying the internal index on shared entities.

The API comments identify `search` as internal, and the central `stripSensitive` list covers only keys and credentials, so nothing catches these leaks centrally. Adding the field to more public types would codify a leak rather than fix the boundary.

**Action:** strip `search` from every Order, Invoice, Customer, Supplier and SupplierInvoice REST/WS projection (print rules are Finding 12); deprecate the four `search` declarations already in the shared package rather than adding more.

## Medium-severity discrepancies

### 4. `Account.details` is required but conditionally written

`Account.details: string` is required, while manual account creation omits it when empty. Existing rows can therefore lack the field.

**Action:** make `details` optional, or make every writer stamp a value.

### 5. Customer import warning fields are absent from `ImportCustomersResponse` — RESOLVED in 1.10.17

`response()` injects `status`, so the old claim that `ImportResponse.status` is absent was false. Successful imports correctly return `status: true`.

The real mismatch is that customer imports can additionally return:

```ts
skipped?: number;
skippedRows?: Array<{
  row: number;
  email: string; // server-masked
  reason: 'EMAIL_TAKEN' | 'DUPLICATE_IN_FILE' | 'EMAIL_CHECK_INCOMPLETE';
}>;
skippedRowIndexes?: number[];
```

`skippedRows` is a bounded sample (capped at 200 rows, emails masked server-side); `skippedRowIndexes` is the deliberately uncapped complete list. Both are also emitted on the all-rows-skipped early return. `constraintReseedFailed` is already declared in 1.10.16 and is not a gap.

**Resolved:** `sinfactura-types@1.10.17` (commit `91d4fa6`, pushed and published during remediation) declares `skipped`, `skippedRows` and `skippedRowIndexes` with the cap/masking semantics, plus the `ImportSkipReason`/`ImportSkippedRow` vocabulary; the api already installs 1.10.17. Remaining work is app-side only (A5/A10).

### 6. `SupplierInvoice` overstates required fields

The API does not guarantee the following required properties on all persisted/read rows:

- `neto`, `iva10`, `iva21`, `per_iibb`, `per_iva`
- `file` (only when a PDF exists)
- `currencyValue` (conditional currency stamping)
- `supplierId` (verification addition: `.optional()` in the write schema and never defaulted)

`storeId` and `invoiceId` are correctly synthesized from keys on the public read path — though two internal read paths cast raw items to `SupplierInvoice` without synthesizing them (neither reaches a response body). `supplierId` is a normal persisted field and should not be described as key-derived. The API derives `currencyValueAt` on current writes, and its optional shared declaration remains safe for legacy rows.

**Action:** make only the genuinely non-guaranteed fields optional, or tighten the writer schema/migration.

### 7. Notification transport/storage/wire layers are mixed

Every notification row receives `dated` and `ttl`; raw WebSocket/GET paths can expose them, but `NotificationInterface` omits both. Conversely, `TableName` is an SQS routing input that is removed before persistence but is declared on the entity.

**Action:** define a notification queue input separately. Either add `dated`/`ttl` to a row/wire type or explicitly project them out at every public boundary.

### 8. Basket has almost no runtime shape validation

The write schema validates `customerId` and passes the rest through `.loose()`. It does not enforce the shared `Basket` contract for `customer`, `quantity`, `currency`, `cost`, `total`, or `items`.

This is a runtime-guarantee gap rather than evidence that every stored basket is currently malformed.

**Action:** validate the persisted Basket fields or introduce an explicit permissive input DTO and normalize it before storage.

### 9. Request controls are embedded in seven entity interfaces

The following are request-only and stripped before persistence:

- `Brand.photoData` / `removePhotoURL`
- `Category.photoData` / `removePhotoURL`
- `Customer.photoData` / `removePhotoURL`
- `Supplier.photoData` / `removePhotoURL`
- `User.photoData` / `removePhotoURL`
- `Store.photoData` / `removePhotoURL`
- `Product.removePictures`

**Action:** move them to create/update input DTOs instead of public entity/read interfaces.

### 10. `Invoice.cbte_numero` is missing

The API persists `cbte_numero` on pending credit-note rows. `Invoice` does not declare it, although the app already carries a local request-side field.

**Action:** add `cbte_numero?: number` to the appropriate Invoice row/wire or pending-NC subtype.

### 11. REST payments omit persisted `externalReference`

`PaymentRow` stores `externalReference`, and `PaymentReceivedWsPayload` includes it. `projectRowToWire()` omits it from `GET /payments/received`. The service comment saying it is "surfaced on the wire" is satisfied only by the WebSocket live-tail — it is misleading for REST, where the projection is an allow-list without the field.

`dated` is internal in practice (no comment or test documents the intent); REST already exposes `paidAt`, so it should not be added to `PaymentReceived`.

**Action:** project `externalReference` and add it to `PaymentReceived`.

### 12. `PrintRule` leaks undeclared storage fields

Print rules persist `search` and `createdAt`. `listStorePrintRules()` returns raw rows, and the generic response sanitizer does not remove either field. `PrintRule` declares neither.

**Action:** either project both out or add them to the public read type. They are not currently “intentionally stripped.”

## Low-severity discrepancies

### 13. `Account.currencyValueAt` has no Account-row writer

The field is written to Cash mirror rows, not Account rows. No API writer was found for Account entities.

### 14. `Cash.incomeByCurrency` is an app-only synthetic field

The API neither stores nor returns it today, but this is decommissioned drift rather than app invention: the API used to emit a synthetic `cashStart` row carrying `incomeByCurrency` on `GET /cash`, a later commit removed it, and the app's opening `Cash` display row is a client-side reimplementation of that removed server behavior. It is therefore not dead; it is a client view field mixed into a shared entity.

**Action:** introduce a display-row type before removing it from `Cash`.

### 15. `Order.dueDate` and `Invoice.dueDate` have no producer

No API/app writer or consumer was found. Both fields document themselves as declarative-only — `Invoice.dueDate` explicitly, `Order.dueDate` with a weaker forward-only note that disclaims automatic computation but not population.

### 16. `MpIpnLogEntry.errorMessage` is not written

`recordMpIpnEvent` never accepts or persists it. `MpHookLogEntry.errorMessage` is separate and valid.

### 17. OAuth callback/status response types are phantom

- Mercado Pago and Mercado Libre OAuth callbacks always return HTTP 302 with an empty body, not their declared callback JSON DTOs.
- No `GET /mercadopago/status` route exists; root `GET /mercadopago` lists `MP#...` rows. `MercadopagoStatus` therefore has no producer.

### 18. Four Mercado Pago integration fields have no writer

The callback drops token-response `scope`, `token_type`, `public_key`, and `live_mode`; no other writer populates corresponding `Mercadopago.tokenType`, `scope`, `publicKey`, or `liveMode` fields. Tests that sanitize a hypothetical `publicKey` do not establish a writer.

### 19. `Currency` is a storage sample, not the current GET wire DTO

`Currency.sourceId` is persisted by FX pollers and omitted by `GET /currencies` — the omission reads as unremediated drift rather than documented design (the commit introducing `sourceId` never touched the read handlers), but the field is not dead storage either way. The real design issue is that the package has no dedicated current GET projection (`currencyId` plus `createdAt`, `dated`, `value`, `variation?`, `source?`), encouraging the app to maintain a stale local interface. Relatedly, the `StoreCurrencySubscriptionView` JSDoc claims to be the wire shape for "`GET /store` and `GET /currencies`" — the `GET /currencies` half is false (its sole producer is called only from the store GET paths). See A13.

### 20. Singular `User.role` persists and leaks (medium — restored)

Previously removed as a false positive; verification restored it. The write-alias half is real: the FE's singular `role` is normalized into canonical `roles` before the role guard. But the singular attribute is never deleted, so it persists on the row, and no read shaper strips it — it leaks on `POST /users`, `GET /users`, and every login/social/refresh/impersonation response for rows created via the FE payload. (Numbered 20, out of severity order, to keep the prior finding numbers stable.)

**Action:** delete `role` after normalization on write and strip it on reads (api-side). The shared package never declared a singular `role` — the alias and the legacy-row caveat are documented on `User.roles`.

## App integration and type-safety gaps

The app currently declares, locks, and installs `sinfactura-types@1.10.15`, while this audit targets `1.10.16`.

| ID | Finding |
|---|---|
| A1 | **Version lag:** `package.json`, `yarn.lock`, and installed `node_modules` all resolve 1.10.15. |
| A2 | **Order delivery is untyped:** body and result use broad `Record` types; the API accepts `{ orderId, delivered?, sendSms? }` and returns an updated `Order`. |
| A3 | **Currency WS event is local:** `CurrencyAutoUpdatedEvent` is locally declared and consumed through `as unknown as`. |
| A4 | **Subscription wire DTOs are local:** `BillingProvider`, checkout/portal/cancel DTOs, invoice summary, plan patch/create/response types remain app-local. |
| A5 | **Import mirrors are stale:** needed under 1.10.15, but the local customer response omits `constraintReseedFailed`, `skipped`, and `skippedRows`; the shared type is complete as of 1.10.17 — remove the mirror after bumping. |
| A6 | **`SubscriptionAuditEntry` is duplicated:** it already exists in installed 1.10.15. |
| A7 | **`EditOrderResult` is local:** the API returns a partial recomputed patch with no shared response type. |
| A8 | **`Order.customer` is cast unsafely:** the shared field is `Partial<Customer>`, but `useOrderScreen` casts it to full `Customer`. |
| A9 | **Subscription reducer drops fields:** it does not retain `currency`, `cancelAt`, or `canceledAt` from `SubscriptionSyncPayload`. |
| A10 | **Customer import UI drops warnings:** `skipped`, `skippedRows`, and `constraintReseedFailed` are not handled and can fall through to the success path. |
| A11 | **Sales report contract is split three ways (direction corrected):** the api emits only `{date, quantity, cost, total}` with numeric `YYYYMMDD` — the shared type is *ahead of the api*, declaring `returns`/`returnCount`/`returnCost`/`net`/`netCost` with no producer — while app-local `ReportSales` is behind both (`date: string`, missing fields). |
| A12 | **Product enrichment DTOs are local:** field, request, suggestion, and response shapes cross the API boundary but are not shared — and they already diverge (the api's suggestion types `attributes` optional; the app requires it). |
| A13 | **Currency service is stale:** it sends legacy `currencyId`, declares `createdAt: string`, and omits the required keyed query parameters `isoCode`/`variant`; the API hard-400s without them. Latent rather than live: the query hook has no call site. |

## Removed false positives and intentional differences

The following previous findings must not be counted. (Verification note: the singular User `role` item originally listed here did **not** survive re-checking — the alias intent is real, but the stray attribute persists and leaks, so it is restored as Finding 20.)

- **Import `status`:** `response()` injects `status: code === 200`; both import endpoints return it.
- **Plan `isPopular` / `bullets` / `color`:** every plan wire response normalizes to `false`, `[]`, and `null` respectively.
- **PrintPrinter `storeId` / `inLatestReport`:** `toWirePrinter()` omits them via an explicit whitelist projection (`inLatestReport` named in the JSDoc; `storeId` dropped implicitly).
- **Fiscal audit server fields:** `event_id`, `schema_version`, and `ts` are intentionally stamped after input validation.
- **Support `search` / `inboxKey`:** `normalizeSupportHeader()` explicitly deletes them.
- **Basket comma terminator:** valid TypeScript style, not a contract discrepancy.
- **Currency `sourceId`:** persisted storage metadata omitted from the GET projection (unremediated drift rather than documented intent), not a dead writer field.
- **Cash `incomeByCurrency`:** app-generated view data reimplementing a decommissioned server response row, not unused/dead.

## Forward-only and documentation observations

These are not included in the 20-discrepancy count:

1. `ServiceOrder` and `ServiceTemplate` are Phase-1/forward-only declarations; no API or app implementation was found.
2. `DemoClaims` is documented but not referenced by name in the checked API/app code.
3. WhatsApp webhook shapes are active, and `WhatsAppConfig` is partially used for sanitization/supervisor projection; `WhatsAppConversation`, `WhatsAppUsage`, and `WhatsAppTemplate` remain forward-only.
4. Documentation is stale:
   - `storefrontEvent.ts` says 14 variants; the union and API schema contain 16.
   - `socket.ts` says 48 server actions; `SOCKET_ACTIONS` contains 55.
   - README says the package has no runtime code, but `socket.ts`, `userActivity.ts`, `notification.ts`, and `provinces.ts` export runtime values/functions.
   - README's usage example imports nonexistent `IUser`, `IOrder`, `IInvoice`, and `IProduct` names.

## Verified aligned areas

Direct source comparison found no material mismatch in these areas:

- `AfipHealth` / `PadronIdentity`
- AI usage report
- authentication request/error contracts checked
- impersonation mint response
- maintenance
- Mercado Libre status/disconnect and integration shapes, excluding its phantom callback DTO
- pricing discriminated unions
- Returns and stock-return linkage
- platform globals/provider health
- PrintOptions, PrintUseCase, printer wire projection, and print-agent message contracts
- Order audit and fiscal-audit stored/read shapes
- SupportMessage and support-header normalization
- currency catalog/subscription/FX-source contracts
- `StorefrontEvent`: 16 type variants and 16 event schema branches
- `UserActivityEvent`: 83 union arms; API schema coverage was directly compared
- socket runtime vocabularies: 55 server actions, 7 declared client actions; the 6-entry live list is the backend's accept-list — the app currently emits 2 (`auth`, `logs`) plus a raw `ping` keepalive documented as not a `SocketMessage`

## 43-file coverage matrix

| File | Result |
|---|---|
| `account.ts` | Findings 4, 13 |
| `afip.ts` | aligned |
| `ai.ts` | aligned |
| `api.ts` | valid full-envelope type; not universal because `response()` only guarantees `status` |
| `audit.ts` | aligned; server-stamped input fields intentional |
| `auth.ts` | aligned in checked flows |
| `basket.ts` | Finding 8 |
| `brands.ts` | Finding 9 |
| `cash.ts` | Finding 14 |
| `categories.ts` | Finding 9 |
| `currency.ts` | Finding 19 (incl. the `StoreCurrencySubscriptionView` doc defect); catalog/FX-source types aligned |
| `customer.ts` | Findings 3, 9; import response lives in `imports.ts` |
| `demo.ts` | forward-only observation |
| `impersonation.ts` | aligned |
| `imports.ts` | Finding 5 |
| `index.ts` | all 42 sibling modules exported |
| `invoice.ts` | Findings 3, 10, 15 |
| `log.ts` | aligned |
| `maintenance.ts` | aligned |
| `mercadolibre.ts` | callback DTO part of Finding 17; otherwise aligned |
| `mercadopago.ts` | Findings 16, 17 |
| `notification.ts` | Finding 7 |
| `order.ts` | Findings 3, 15 |
| `payment.ts` | Finding 11 |
| `platform.ts` | aligned |
| `pricing.ts` | aligned |
| `print.ts` | Finding 12; printer/options/use-case contracts aligned |
| `product.ts` | Finding 9 |
| `provinces.ts` | aligned runtime export |
| `report.ts` | types ahead of api (A11: return/net fields have no producer); app mirror stale |
| `return.ts` | aligned |
| `serviceOrder.ts` | forward-only observation |
| `serviceTemplate.ts` | forward-only observation |
| `socket.ts` | contracts aligned; stale action-count comment |
| `stock.ts` | aligned |
| `store.ts` | Findings 1, 18; WhatsApp forward-only observation |
| `storefrontEvent.ts` | schema aligned; stale variant-count comment |
| `subscription.ts` | Finding 2; sync wire aligned on GET (WS is a refetch nudge) |
| `support.ts` | aligned |
| `supplier.ts` | Findings 3, 6, 9 |
| `user.ts` | Findings 9, 20 |
| `userActivity.ts` | aligned; 83 union arms |
| `whatsapp.ts` | webhook shapes active; commerce types partly forward-only |

## Recommended order of work

Execution is phased by repository:

**Phase 1 — `types` (this repo):** correct shared DTOs additively (Invoice `cbte_numero`, `PaymentReceived.externalReference`, a dedicated currency GET projection — the import skip fields already landed in 1.10.17); make truthfully optional what no writer guarantees (Account `details`, the SupplierInvoice set including `supplierId`, Store's removable contact fields, `ReportSales` return/net fields, WhatsApp `accessToken`); add wire/input splits (`StoreWire`, `StoreUpdateInput`, a notification queue input) while deprecating what they replace (request controls on seven entities, `TableName`, retired Store fields, the four declared `search` fields, the phantom MP/OAuth/status DTOs, `Subscription`'s storage claim); repair README, count comments, and forward-only markers.

**Phase 2 — `api` (own ticket):** strip internal fields (`search` across orders/invoices/customers/suppliers/supplier-invoices, `priceListSeq`, notification `dated`/`ttl`, print-rule `search`) at every REST/WS boundary; project `externalReference`; fix the `role` write/read leak; close the MP `z.unknown()` write-hole; annotate the `GET /store` subscription embed; decide the basket validation posture and the ivaTypes echo.

**Phase 3 — `app` (own ticket):** bump to the corrected types version; delete stale local mirrors (imports envelope, `ReportSales`, `SubscriptionAuditEntry`, subscription and product-enrichment DTOs where now shared); fix the currency service, subscription reducer retention, import-warning UI, and the `Order.customer` casts.

## Methodology and verification standard

For every `types/src/*.ts` file, the audit checked the relevant combination of:

- API Zod/input validation,
- DynamoDB writers and key-derived fields,
- REST read projection,
- WebSocket projection,
- sanitizers,
- app service/reducer/UI consumption, and
- repo-wide symbol references for apparently dead or forward-only fields.

Comments were treated as claims, not evidence. A field was considered internal only when all public projections removed it. A field synthesized by the app was not called dead. The report distinguishes storage, request, REST, WebSocket, and app-view contracts rather than comparing every interface directly to every write schema.

A second, adversarial verification pass (2026-08-10) independently re-derived every finding from code, spot-checked each reversal directly, and re-ran the build/lint/typecheck gates in all three repos. Its corrections are folded into Findings 1, 2, 3, 5, 6, 11, 14, 15, 19 and 20 and rows A11–A13 above.
