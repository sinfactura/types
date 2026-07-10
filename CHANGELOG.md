# Changelog

All notable changes to `sinfactura-types`. One line per release; see the
[git history](https://github.com/sinfactura/types/commits/main) for full
detail and `npm view sinfactura-types versions` for the published list.

Versioning follows [`PUBLISHING.md`](./PUBLISHING.md): additive changes ship as
**patch** bumps by project convention; breaking reshapes are major.

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
