# Changelog

All notable changes to `sinfactura-types`. One line per release; see the
[git history](https://github.com/sinfactura/types/commits/main) for full
detail and `npm view sinfactura-types versions` for the published list.

Versioning follows [`PUBLISHING.md`](./PUBLISHING.md): additive changes ship as
**patch** bumps by project convention; breaking reshapes are major.

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
