# Type Validation Report: `sinfactura-types` vs `api` + `app`

**Date:** 2026-08-10
**Types version validated:** 1.10.16
**Scope:** All 40+ type files in `types/src/` compared against the API's lambda handlers, services, and DynamoDB schema in `api/stacks/`, and against the app's consumption patterns in `app/src/`.

## Executive Summary

The types package models the **read shape** (what the FE receives from GET endpoints), while the API's Zod schemas model the **write shape** (what the API accepts on POST/PATCH). This fundamental difference accounts for the majority of "required in types, optional in API" discrepancies — they are **by design**. However, there are also genuine mismatches that warrant action.

### Findings by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 6 | Structural mismatches where the type fundamentally misrepresents the API's data model |
| 🟡 Medium | 12 | Fields required in types that can legitimately be absent from DDB rows, plus dead fields |
| 🟠 Low | 9 | Internal-only fields, phantom types, minor naming/style issues |
| 🔵 App-only | 7 | App-local types that should be promoted, or untyped surfaces (A1–A7) |
| **Total** | **34** | |
| ✅ Aligned | 8 verified | userActivity, storefrontEvent, impersonation, mercadolibre, currency, print, audit, SupportMessage |

---

## 🔴 Critical Discrepancies

### 1. Subscription — Major Structural Divergence

The `Subscription` type is fundamentally misaligned with the API's `SubscriptionRow`:

| Issue | Types | API |
|-------|-------|-----|
| Naming | `tenantId` | `storeId` |
| Billing cycle | Required | Optional (absent before checkout) |
| Period dates | `currentPeriodStart`/`End` required | Optional |
| Provider IDs | `stripeCustomerId`/`stripeSubscriptionId` | `externalCustomerId`/`externalSubscriptionId` (provider-agnostic) |
| Overrides | `overrides?: Partial<Record<FeatureKey, Entitlement>>` (embedded) | Stored as SEPARATE DDB rows (`OVERRIDE#{key}` SK) |
| Currency | Declared as persisted on subscription | Derived from `PlanTemplate.currency` at runtime |
| Missing | — | `provider?`, `cancelAt?`, `canceledAt?`, `pastDueSince?` not in type |

**Impact:** Any consumer using `Subscription` gets a model that doesn't match what the API stores or returns. Wire payload (`SubscriptionSyncPayload`) exposes `cancelAt`/`canceledAt` that the source type doesn't declare.

**Recommendation:** Redesign `Subscription` to match `SubscriptionRow` + add provider-agnostic naming. Move `overrides` to a separate type or document the DDB-external storage.

### 2. Store — Missing Fields Written by API

Fields the API writes/reads but the Store type doesn't declare:

| Field | Written By | Purpose |
|-------|------------|---------|
| `updatedAt` | Every `_post.ts`/`_patch.ts` mutation | Timestamp |
| `priceListSeq` | `reconcilePriceLists` | Monotonic counter for list-id assignment |
| `whatsapp` (top-level string) | `removableFieldSchema` | Social contact (distinct from `integrations.whatsapp`) |
| `instagram` | `removableFieldSchema` | Social contact |
| `facebook` | `removableFieldSchema` | Social contact |
| `cbu` (top-level) | `removableFieldSchema` | Bank CBU (distinct from `afip.cbu`) |

**Impact:** FE consumers cannot type-safely access these fields even though the API serves them.

### 3. Order + Invoice — Missing `search` Field

The API writes a `search: string` field to every order **and** invoice row, but neither type declares it. This is inconsistent — `Product` (`product.ts:10`) and `Customer` (`customer.ts:56`) both declare `search: string` as required.

| Entity | API writer | Type status |
|--------|-----------|-------------|
| Order | `buildOrderSearch` in `orders/_post.ts` | ❌ not declared |
| Invoice | `buildInvoiceSearch` in `invoices/_post.ts:789` and `:1323` | ❌ not declared |
| Product | server-derived | ✅ `search: string` |
| Customer | server-derived | ✅ `search: string` |

### 4. Account — `details` Required but Conditionally Written

`Account.details: string` is **required** in types, but `_post.ts` only writes it when non-empty:
```typescript
...(details ? { details } : {})
```
DDB rows can and do lack `details`. Should be `details?: string`.

### 5. ImportResponse — `status` Field Never Returned

`ImportResponse.status: boolean` is required, but neither the product importer nor the customer importer returns a `status` field. The actual response is `{ message: string, unprocessed?: number }`.

### 6. ImportCustomersResponse — Missing `skipped`/`skippedRows`

The customers importer returns `skipped: number` and `skippedRows: Array<{ row: number; email: string; reason: string }>` that are not declared on the type.

---

## 🟡 Medium Discrepancies

### 7. SupplierInvoice — Multiple Required Fields Should Be Optional

| Field | Line | Issue |
|-------|------|-------|
| `neto` | `supplier.ts:36` | Required in types, not validated/enforced by API |
| `iva10` | `supplier.ts:37` | Same |
| `iva21` | `supplier.ts:38` | Same |
| `per_iibb` | `supplier.ts:40` | Same |
| `per_iva` | `supplier.ts:41` | Same |
| `file` | `supplier.ts:42` | Required in types, only present when a PDF was uploaded |
| `currencyValue` | `supplier.ts:45` | Required in types, conditionally omitted on writes |
| `storeId`, `invoiceId`, `supplierId` | — | Required in types, live in PK/SK only (not top-level DDB attributes) |

### 8. NotificationInterface — Undeclared Fields

| Field | Issue |
|-------|-------|
| `dated` | Written to every notification row by the SQS consumer, **not declared** |
| `ttl` | Written to every notification row (`getTTL(1)`), **not declared** |
| `TableName` | Declared at `notification.ts:60` but never persisted — it's an SQS transport/routing field destructured out before the write |

### 9. Plan — Required Fields Optional in API

| Field | Types | API |
|-------|-------|-----|
| `isPopular` | Required (`boolean`) | Optional on `PlanTemplate` |
| `bullets` | Required (`string[]`) | Optional on `PlanTemplate` |
| `color` | `string \| null` | `string?` (optional, not nullable) — semantic `null` vs `undefined` divergence |

### 10. Cash — `incomeByCurrency` Dead Field

`cash.ts:24` declares `incomeByCurrency?: Record<string, number>` but **no API handler ever writes it**. Neither `cash/_post.ts` nor `cash/_get.ts` produces it. (Its sibling `balanceByCurrency?` at `:23` **is** written on BALANCE snapshot rows.)

### 11. Account — `currencyValueAt` Dead Field

`account.ts:47` declares `currencyValueAt?: number` but it is **never written to Account rows**. The CAJA mirror (Cash row) writes `currencyValueAt: createdAt`, but the Account row itself doesn't.

### 12. Basket — Zero Server-Side Validation

The API's basket Zod schema validates only `customerId`. Every other field required by the `Basket` type passes through unchecked via `.loose()`:

| Field | Line |
|-------|------|
| `customer: Partial<Customer>` | `basket.ts:6` |
| `quantity: number` | `basket.ts:9` |
| `currency: string` | `basket.ts:11` |
| `cost: number` | `basket.ts:15` |
| `total: number` | `basket.ts:16` |
| `items: BasketItem[]` | `basket.ts:17` |

### 13. Supplier — Transient Fields on Entity Type

`Supplier.photoData?` (`supplier.ts:10`) and `Supplier.removePhotoURL?` (`:11`) are request-only control fields stripped before the DDB write. They should live on a separate input type, not the entity interface.

### 14. Product — `removePictures` Control Field on Read Type

`product.ts:20` declares `removePictures?: { url: string }[]`, which is destructured out of the body and used for S3 deletion — it never persists. Should be on a write/input type.

### 15. Order — `dueDate` Dead Field

`order.ts:32` declares `dueDate?: number` but **no writer exists** anywhere in the orders lambdas. (Note: `invoice.ts:175` has the same dead `dueDate?` — its JSDoc already flags it as "DECLARATIVE ONLY".)

### 16. Invoice — `cbte_numero` Not in Type

The API persists `cbte_numero` on pending NC rows (`...(pendingCause && cbte_numero ? { cbte_numero } : {})`), but the `Invoice` interface doesn't declare it.

### 17. PaymentReceived — `dated`/`externalReference` Not on the REST Type

`PaymentRow` (API) stores `dated: number` and `externalReference?: string`. Neither is on `PaymentReceived` (`payment.ts:31-64`).

- `externalReference` **is** declared on `PaymentReceivedWsPayload` (`payment.ts:23`) but not on the REST `PaymentReceived` — an asymmetry between the WS and REST contracts for the same underlying row.
- `dated` is on neither (the `dated: number` at `payment.ts:104` belongs to `OrderCandidate`, not a payment type).

**Note — this type is exemplary about documenting its own gaps.** `PaymentReceived` carries explicit `⚠️` JSDoc on `currencyValue`/`currencyValueAt` ("NOT IMPLEMENTED on this row … undefined on 100% of GET rows") and on `reconciled`/`reconcileReason` ("Stamped ONLY on the MP row — GET never carries these"). That is the pattern other types should follow rather than a defect. The only real gap is the WS/REST `externalReference` asymmetry.

### 18. Currency — `sourceId` Dead on Wire

`Currency.sourceId?: string` is declared but `GET /currencies` never projects it in its response.

---

## 🟠 Low Severity

### 19. MpIpnLogEntry — `errorMessage` Dead Field
`mercadopago.ts:195` (inside `MpIpnLogEntry`, lines 182-200). Declared optional, never written by `recordMpIpnEvent`. Note `MpHookLogEntry` also has `errorMessage?` at `:157` — that one **is** written.

### 20. MpOauthCallbackResponse / MlOauthCallbackResponse — Phantom Types
`mercadopago.ts:25-31` and `mercadolibre.ts:26`. Both types exist but the corresponding endpoints return HTTP 302 redirects, never JSON. (`MlOauthDisconnectResponse` at `mercadolibre.ts:35` **is** returned as JSON and is correct.)

### 21. Mercadopago Store Integration — Dead Fields
`store.ts:245-248` (inside the `Mercadopago` interface, lines 238-294): `tokenType?`, `scope?`, `liveMode?`, `publicKey?` are declared but never populated by the MP OAuth callback, which writes only `userId`, `accessToken`, `refreshToken`, `expiresAt`, `connectedAt`.

> Not to be confused with `mercadopago.ts:11` `scope?`, which belongs to `MpOauthTokenResponse` — that one is a genuine field of MP's token response.

### 22. User `role` (singular) — Accepted by API, Not in Types
`_post.ts` accepts `role: z.string().optional()` and normalizes to `roles` before write. Types declare only `roles: string` (`user.ts:12`).

### 23. PrintRule — Internal Fields Not in Type
API writes `search` and `createdAt` to `PRINT_RULE#` rows. `PrintRule` (`print.ts:254-263`) declares neither — intentionally stripped before response.

### 24. PrintPrinter — Internal Fields Not in Type
API stores `storeId` and `inLatestReport` on printer rows. `PrintPrinter` (`print.ts:168-217`) declares neither — intentionally internal. (`PrintJobSummary` at `print.ts:331-367` correctly **does** declare `storeId`/`createdAt`.)

### 25. FiscalAuditEvent — `schema_version` Not in Input Schema
`audit.ts:82` declares `schema_version: number`, but the API's Zod input schema omits it (server stamps it). Correct by design; noted for completeness.

### 26. Support — `search`/`inboxKey` Internal Fields
Written to DDB but explicitly deleted before response by `normalizeSupportHeader`. Correctly absent from types.

### 27. Basket — Style Inconsistency
`basket.ts:11` terminates `currency: string,` with a **comma** instead of a semicolon. Valid TypeScript, but inconsistent with every other member in the file and the rest of the package.

---

## ✅ Well-Aligned Entities

The following entities showed no material discrepancies:

- **userActivity** — All 70+ event variants exactly match between types and API Zod schemas (the API `satisfies UserActivityEntityType[]` ensures compile-time sync)
- **storefrontEvent** — All 16 event variants fully aligned
- **impersonation** — Wire contract matches perfectly
- **mercadolibre** — Status/disconnect responses aligned; webhook envelope matches
- **currency** (catalog, subscriptions, fx sources) — Fully aligned
- **print** (PrintOptions, PrintUseCase) — Zod schemas match type definitions exactly
- **audit** (OrderAuditEntry) — Aligned with appropriate narrowing
- **SupportMessage** — All fields match `appendSupportMessage`

---

## Cross-Cutting Patterns

### 1. Read-Shape vs Write-Shape Misalignment (By Design)

The vast majority of "required in types, optional in API Zod" issues stem from:
- Types model the **complete read shape** (what GET returns after entity creation)
- API Zod schemas model the **write shape** (POST/PATCH input where omission = "don't update")

This is a **deliberate architectural choice** documented in the README: the types package models the wire contract consumers receive. However, it means the types package doesn't provide write/input types — consumers must construct partial payloads without type safety on which fields are required for creation vs optional for update.

### 2. `.loose()` Passthrough Risk

Several Zod schemas use `.loose()` (or `z.record()` passthrough) to allow undeclared fields through. This means:
- Fields like `marketing`, `minBuy`, `currencyId` on Customer persist without validation
- Any malformed data or typo silently writes to DDB
- The types declare these fields but the API provides no runtime guarantee of their shape

### 3. PK/SK-Derived Fields

All entities have `storeId`/`entityId` fields that are "required" in types but live in DDB PK/SK, not as top-level attributes. GET handlers synthesize them from keys. This is correct architecture but means the raw DDB item shape differs from the type.

### 4. Control-Only Fields on Read Types

`Product.removePictures`, `Supplier.photoData`, `Supplier.removePhotoURL` are write-time control directives that never persist. They pollute the read interface. A clean separation would use `ProductCreateInput` / `ProductUpdateInput` types.

---

## Recommended Actions

### High Priority (Breaking Changes)

1. **Redesign `Subscription` type** — align with provider-agnostic naming (`storeId`, `externalCustomerId`, `externalSubscriptionId`), make `billingCycle`/period dates optional, add `cancelAt`/`canceledAt`/`provider`, document that `overrides` live in separate DDB rows
2. **Fix `ImportResponse`** — remove `status: boolean` (`imports.ts:46`) or make it optional; add `skipped`/`skippedRows` to `ImportCustomersResponse`
3. **Make `Account.details` optional** (`account.ts:29`)
4. **Add `updatedAt` to Store type** (plus `whatsapp`/`instagram`/`facebook`/`cbu`/`priceListSeq`)

### Medium Priority (Non-Breaking Additions)

5. **Add `search` to Order and Invoice types** — already present on Product (`product.ts:10`) and Customer (`customer.ts:56`)
6. **Add `dated`/`ttl` to NotificationInterface** (or document them as internal-only)
7. **Make SupplierInvoice fields optional** — `neto`, `iva10`, `iva21`, `per_iibb`, `per_iva`, `file`, `currencyValue` (`supplier.ts:36-45`)
8. **Add `cbte_numero?` to Invoice** (for pending NC rows)
9. **Add `externalReference?` to `PaymentReceived`** or document the WS/REST asymmetry

### Cleanup (Dead Field Removal)

10. **Remove `Order.dueDate`** (`order.ts:32`) — no writer exists
11. **Remove `Cash.incomeByCurrency`** (`cash.ts:24`) — no writer exists
12. **Remove `Account.currencyValueAt`** (`account.ts:47`) — never written to Account rows
13. **Remove `MpIpnLogEntry.errorMessage`** (`mercadopago.ts:195`) — never written
14. **Remove dead MP store-integration fields** — `tokenType`/`scope`/`liveMode`/`publicKey` (`store.ts:245-248`)
15. **Remove `NotificationInterface.TableName`** (`notification.ts:60`) — transport field, not an entity field
16. **Move control fields to input types** — `Product.removePictures`, `Supplier.photoData`/`removePhotoURL`
17. **Resolve phantom OAuth callback types** — `MpOauthCallbackResponse`, `MlOauthCallbackResponse` (endpoints return 302, not JSON)
18. **Fix `basket.ts:11`** — comma → semicolon

### Documentation Pattern to Adopt

`PaymentReceived` (`payment.ts:31-64`) is the model to follow: it carries explicit `⚠️` JSDoc marking which declared fields are **not** populated by the API and why. Applying that pattern to the remaining known-unimplemented fields would let them stay in the type (for forward-compatibility) without misleading consumers.

---

## Methodology

This comparison was performed by:
1. Reading every type definition in `types/src/`
2. Reading the corresponding API lambda handlers (`_get.ts`, `_post.ts`, `_patch.ts`) and service modules
3. Comparing field-by-field: presence, optionality, naming, and data shapes
4. Cross-referencing DynamoDB schema definitions for GSI attributes
5. Checking for fields written by the API but not declared in types (and vice versa)

The comparison focuses on the 20 most important entity domains. Utility types (api.ts, socket.ts), configuration types (pricing.ts, platform.ts), and purely FE-local types were excluded from entity-level comparison.

---

## App-Side Findings (`sinfactura/app`)

The app was compared for fields it accesses that aren't declared on the types, and for local type mirrors/duplicates that indicate the shared types package is lagging behind.

### Confirmed API Findings (corroborated by app)

| Finding | App Evidence |
|---------|-------------|
| **Store missing `whatsapp`/`instagram`/`facebook`/`cbu`** | `components/store/buildUpdatePayload.ts` hardcodes `STORE_REMOVABLE_FIELDS = ['email', 'phone', 'whatsapp', 'instagram', 'facebook', 'cbu', 'cuit']` — the app knows these top-level fields exist but the type doesn't declare them |
| **Subscription `cancelAt`/`canceledAt`** | `SubscriptionSyncPayload` sends them; `slices/subscription.ts` silently drops them at the reducer boundary — no Redux state for them |

### New Discrepancies (app-only)

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| A1 | 🟡 Medium | **`deliveryOrder` mutation untyped** | `services/orders.ts` types the delivery body as `Record<string, string \| number \| boolean \| undefined>` — no structured interface anywhere |
| A2 | 🟡 Medium | **WS payload types are app-local** | `CurrencyAutoUpdatedEvent` (and similar) defined in app with no canonical type in sinfactura-types. Only `PaymentReceivedWsPayload` is shared. |
| A3 | 🟡 Medium | **Subscription local types should be promoted** | `BillingProvider`, `CheckoutPayload`, `CheckoutSession`, `PortalPayload`, `CancelSubscriptionPayload`, `CancelSubscriptionResponse`, `InvoiceSummary`, `PlanPatchPayload` — all app-local |
| A4 | 🟠 Low | **`imports.ts` local mirrors** | App defines `ImportResponse`/`ImportCustomersResponse`/`ImportEmailConflict` locally (types HEAD has them but installed v1.10.15 doesn't). Delete local mirrors on next types bump. |
| A5 | 🟠 Low | **`SubscriptionAuditEntry` duplicated** | App re-declares it identically to the global. Local shadows global. |
| A6 | 🟠 Low | **`EditOrderResult` unshared** | App defines `{ orderId, items, total, cost, updatedAt }` locally — no types counterpart |
| A7 | 🟠 Low | **`order.customer` unsound cast** | `useOrderScreen.tsx` casts `Partial<Customer>` to `Customer \| undefined` |

### App Type-Safety Patterns (not discrepancies, but relevant)

- **`updateUser` accepts `Record<string, string>`** — loose union bypasses compile-time checking
- **`Account.createdAt`** — required in types but app uses `?? 0` fallback (defensive for legacy rows)
- **`maintenance` slice** uses `as unknown as` cast on a field that already exists on `Store` (stale workaround)
- **All email/print mutation responses** typed as `Record<string, string>` (overly loose)
- **`ProductEnrichField` / `ProductEnrichResponse`** — AI enrichment types are app-local with no shared counterpart

---

## Verification Evidence

Every finding was re-verified field-by-field against `types/src/` on 2026-08-10. Line numbers below are from types v1.10.16.

### Build Status
- `types` package: `tsc --noEmit` → exit 0 (sinfactura-types@1.10.16)
- `api` package: `tsc --noEmit` → exit 0 (consumes sinfactura-types@1.10.16)
- No compile-time errors — discrepancies are semantic (what the code actually writes vs what types declare)

### Re-Verification Results

| Finding | Claim | Verified |
|---------|-------|----------|
| 1 | `Subscription.tenantId` / required `billingCycle` / `stripe*` ids / embedded `overrides` | ✅ `subscription.ts:253-283` vs API `services/subscriptions.ts:142-174` |
| 2 | Store has no `updatedAt`/`whatsapp`/`instagram`/`facebook`/`cbu`/`priceListSeq` | ✅ `store.ts:71-180` — none present; API `store/_post.ts:98,439` writes them |
| 3 | Order + Invoice have no `search` | ✅ Neither declares it; API `invoices/_post.ts:789,1323` writes it |
| 4 | `Account.details` required | ✅ `account.ts:29` |
| 5 | `ImportResponse.status` required, never returned | ✅ `imports.ts:46`; API `products/_import.ts:283` omits it |
| 6 | `ImportCustomersResponse` lacks `skipped`/`skippedRows` | ✅ only `emailConflicts?`(:94), `constraintReseedRequired?`(:104), `constraintReseedFailed?`(:113) |
| 7 | SupplierInvoice required fields | ✅ `supplier.ts:36,37,38,40,41,42,45` all non-optional |
| 8 | Notification `TableName` present; `dated`/`ttl` absent | ✅ `notification.ts:60` only |
| 9 | `Plan.isPopular`/`bullets` required, `color: string \| null` | ✅ read from `subscription.ts` Plan interface |
| 10 | `Cash.incomeByCurrency` declared | ✅ `cash.ts:24` |
| 11 | `Account.currencyValueAt` declared | ✅ `account.ts:47` |
| 12 | Basket required fields | ✅ `basket.ts:6,9,11,15,16,17` |
| 13 | `Supplier.photoData`/`removePhotoURL` | ✅ `supplier.ts:10,11` |
| 14 | `Product.removePictures` | ✅ `product.ts:20` |
| 15 | `Order.dueDate` dead | ✅ `order.ts:32` |
| 16 | Invoice lacks `cbte_numero` | ✅ not present |
| 17 | `externalReference` on WS but not REST payment type | ✅ `payment.ts:23` (`PaymentReceivedWsPayload`) vs `:31-64` (`PaymentReceived`) |
| 18 | `Currency.sourceId` declared | ✅ `currency.ts:79` |
| 19 | `MpIpnLogEntry.errorMessage` | ✅ `mercadopago.ts:195` within interface `:182-200` |
| 20 | OAuth callback response types exist | ✅ `mercadopago.ts:25-31`, `mercadolibre.ts:26` |
| 21 | MP store-integration dead fields | ✅ `store.ts:245-248` within `Mercadopago` `:238-294` |
| 22 | User declares only `roles` | ✅ `user.ts:12` |
| 23 | `PrintRule` lacks `search`/`createdAt` | ✅ `print.ts:254-263` |
| 24 | `PrintPrinter` lacks `storeId`/`inLatestReport` | ✅ `print.ts:168-217` |
| 25 | `FiscalAuditEvent.schema_version` | ✅ `audit.ts:82` |
| 27 | `basket.ts:11` comma terminator | ✅ `currency: string,` |

### Corrections Made In This Pass

The following were **wrong in the initial report** and have been fixed:

1. **Severity counts** — "15 Low" was inflated; the actual count is 9. "20+ Aligned" was an overstatement; 8 entities were actually verified as aligned.
2. **Finding 3 was incomplete** — it flagged only `Order.search`. `Invoice` has the identical gap (API writes `search` at `invoices/_post.ts:789` and `:1323`).
3. **Finding 17 was mischaracterized** — framed as a plain omission. `PaymentReceived` in fact carries explicit `⚠️` JSDoc documenting its unimplemented fields, which is the pattern the rest of the package should adopt. Only the WS/REST `externalReference` asymmetry is a genuine gap.
4. **Finding 21 lacked precision** — the dead MP fields are at `store.ts:245-248` (the `Mercadopago` store-integration interface), not in `mercadopago.ts`. The `scope?` at `mercadopago.ts:11` belongs to `MpOauthTokenResponse` and is a legitimate field.
5. **New finding 27 added** — `basket.ts:11` style inconsistency (comma instead of semicolon).
6. **`Order.dueDate` context added** — `invoice.ts:175` carries the same dead `dueDate?`, but its JSDoc already flags it as declarative-only.

### Why No Compile Errors
The types package uses `declare global {}` blocks (ambient type declarations). The API:
1. Has its own internal interfaces (`SubscriptionRow`) separate from the types' `Subscription`
2. Uses `as unknown as T` casts when reading from DynamoDB
3. Relies on `.loose()` Zod schemas that pass through undeclared fields without type checking
4. Consumes types primarily for shared enums/unions (`PlanTier`, `SubscriptionStatus`, `FeatureKey`) not for entity row shapes
