declare global {
  /**
   * One tenant-authored Cmd-K palette entry (`store.palette.custom[]`).
   *
   * ⚠️ `url` and `icon` are ALLOW-LISTED server-side, not merely validated for
   * shape. A palette entry renders inside an operator's command palette, so a
   * free-form `url` is a phishing and open-redirect surface and a free-form
   * `icon` is an injection surface. `url` accepts `https://…` or a relative
   * path beginning with `/`; `icon` accepts a known subset of
   * `@mui/icons-material`. Never widen either on the strength of the FE
   * having checked first.
   *
   * `custom` is writable ONLY from the Ops API — the tenant-facing palette
   * route refuses it outright rather than validating it, because the phishing
   * surface is not worth exposing to tenant ADMINs at all.
   */
  interface CustomVerb {
    /** `custom-{slug}`. */
    id: string;
    /** Operator-facing label, <= 60 chars. */
    name: string;
    /** `https://…` or a relative path starting with `/`. Allow-listed. */
    url: string;
    /** A known `@mui/icons-material` name. Allow-listed. */
    icon: string;
    /** Palette section heading, <= 40 chars. */
    section: string;
  }

  /**
   * Per-tenant Cmd-K palette overrides.
   *
   * ⚠️ TOP-LEVEL on `Store`, deliberately NOT under `features`. In this repo
   * `features` means the PLAN TEMPLATE's billing entitlements (see
   * `store/_get.ts`), a different concept on the same word — UI personalisation
   * must never share that namespace. There is also no backend `features` merge
   * mechanism to extend: the footer/navbar/sidebar merge this was once modelled
   * on lives entirely in the frontend.
   *
   * `hidden` and `pinned` carry built-in verb ids and are tenant-writable via
   * the palette PATCH route. `custom` is Ops-only — see `CustomVerb`.
   */
  interface StorePalette {
    /** Verb ids to hide. */
    hidden?: string[];
    /** Verb ids to elevate to the top of their section. */
    pinned?: string[];
    /** Tenant-specific deep links. Ops-API-writable only. */
    custom?: CustomVerb[];
  }

  /**
   * One counter's static-QR POS binding (`store.integrations.mercadopago.staticQrs[counterId]`).
   *
   * `label` is the entire point of the multi-counter feature — the operator-facing
   * name of the register, cashier or location ("Caja 1", "Belgrano"). It is NOT
   * MercadoPago's POS `name`: that is a creation-time payload value threaded
   * through the POS resolver and is not persisted here.
   *
   * `disabledAt` is a SOFT delete. The MP-side POS row deliberately stays alive
   * so historical payments keep resolving to the counter that took them —
   * hard-deleting it would orphan past attribution. Readers must hide disabled
   * counters from operator pickers while still resolving them for history.
   */
  interface MercadopagoStaticQr {
    posId: string; // MP-issued POS numeric id (stringified).
    externalPosId: string; // SINFACTURA-pinned external id (`SF{storeId}POS{counterId}`).
    createdAt: number; // unix ms when the POS was created.
    label: string;
    /** Optional attribution binding to one user; absent means counter-only. */
    userId?: string;
    /** Unix ms of soft delete; absent means active. */
    disabledAt?: number;
  }

  interface Config {
    // PK // global config
    appVersion: number;
    fiscalConditions: FiscalCondition[];
    ivaTypes: Method[];
    minWithDni: number;
    stats: {
      store: number;
    };
  }

  interface Ecommerce {
    isActive?: boolean;
    config?: {
      showDefaultPriceList?: number; // 0: NONE, 1: PUBLICO, 2: TECNICO, 3: GREMIO, 4: MAYORISTA
      showStocks?: boolean;
    };
    sidebar?: {
      show?: boolean;
      categories?: boolean;
      brands?: boolean;
      incomes?: boolean;
      favorites?: boolean;
      basket?: boolean;
      orders?: boolean;
      invoices?: boolean;
    };
    home?: {
      displayCurrencyCard?: boolean;
      displayCurrencyDetails?: boolean;
      displayProfile?: boolean;
      displayFeaturedProducts?: boolean;
      displayCategories?: boolean;
      displayPaymentCard?: boolean;
      displayWhatsappCard?: boolean;
      displayOrders?: boolean;
    };
    footerBar?: {
      show?: boolean;
      orders?: boolean;
      invoices?: boolean;
      basket?: boolean;
      favorites?: boolean;
    };
    themeColors?: {
      main?: string;
      navbar?: string;
    };
    appVersion?: number;
    stats?: Record<string, string>;
  }

  /**
   * Platform globals forwarded to a tenant session on `GET /store`.
   *
   * A read-time projection of the `GLOBALS`/`PLATFORM` row, never a stored
   * attribute of the STORE row: the api decides per registered key whether it
   * crosses this boundary (`forwardToTenants` in `globalsDefaults.ts`), so
   * operator-only keys — the AI spend ceilings — are absent by construction.
   * Every member is optional: a key the api has not registered, or has not
   * marked forwardable, simply will not be here.
   */
  interface StoreGlobals {
    /** ARCA/AFIP "Consumidor Final" DNI threshold, in pesos. */
    minWithDni?: number;
    /** Cmd-K usage telemetry collection. */
    commandPaletteTelemetry?: boolean;
  }

  interface Store {
    /**
     * Cmd-K palette overrides. Absent means "all built-in verbs, default order".
     * Not writable through `POST /store` or `POST /tenants` — both refuse it with
     * `FIELD_NOT_WRITABLE_HERE`; it moves through its own PATCH route.
     */
    palette?: StorePalette;

    storeId: string;
    createdAt: number;
    /** Unix ms — BE-stamped on every `POST`/`PATCH /store` write. Always present on written rows. */
    updatedAt?: number;
    // Tenant kind. Absent / 'production' = real tenant; 'demo' = demo/showcase
    // store (guarded from real email/SMS/surveys).
    type?: 'production' | 'demo';
    name: string;
    // Optional: a freshly-registered store has no address until the operator
    // fills one in. Readers guard with `?.`.
    address?: {
      street: string;
      postalCode: string;
      city: string;
      province: string;
    };
    /**
     * Optional: removable via `StoreUpdateInput.removeFields` (DynamoDB REMOVE),
     * so rows — and every wire object built from them — may lack it.
     */
    cuit?: string;
    /** Optional: removable via `StoreUpdateInput.removeFields`. */
    phone?: string;
    /** Optional: removable via `StoreUpdateInput.removeFields`. */
    email?: string;
    /**
     * Flat contact / social-media leaves the store-settings form writes at the
     * top level of the STORE row (NOT under `integrations`, and distinct from
     * `Afip.cbu`). Settable and removable via `StoreUpdateInput.removeFields`;
     * returned by `GET /store` whenever stored.
     */
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
    /** Payment CBU contact leaf (22 digits), shown to customers. */
    cbu?: string;
    acknowledgedSharedCuit?: boolean; // recorded when registered past the shared-CUIT gate
    /**
     * Response-time join, not a persisted Store attribute — and TWO different
     * shapes depending on the endpoint: `GET /tenants` (SUPERVISOR) attaches the
     * compact `StoreRowSubscriptionSummary`; the tenant's own `GET /store`
     * embeds a near-`SubscriptionSyncPayload` (today still missing `currency`
     * and `freeUntil` — treat both as possibly absent until the api aligns the
     * embed). Discriminate structurally (`'entitlements' in subscription`).
     */
    subscription?: StoreRowSubscriptionSummary | SubscriptionSyncPayload;
    // Functional config, not a feature-flag bag.
    config: {
      priceDecimals: 0 | 1 | 2 | 3;
      stock: boolean;
      changePrice: boolean;
      /**
       * Ceiling on concurrent refresh-token sessions per user. When a new login
       * would exceed it the OLDEST family is revoked, so the cap never blocks a
       * login — it evicts.
       *
       * Absent falls back to the BE default (5). Counts SESSIONS (families),
       * not stored rows: refresh rotation replaces a row without adding a
       * device, so counting rows would evict an active user for refreshing.
       */
      maxSessions?: number;
      /**
       * Back-office display currency (catalogId) the operator's screens are
       * framed in — distinct from any individual money entity's own `currency`
       * stamp. Also the denomination fallback for unstamped legacy `Account` rows.
       */
      displayCurrency?: string;
      /** Seed catalogId for new Product writes (FE currency-selector default); does not reinterpret existing rows. */
      defaultProductCurrency?: string;
      /**
       * @deprecated Superseded by `displayCurrency` as the seed. RETAINED, not
       * removed: the platform is forward-only and live rows carry this field,
       * so deleting it from the contract would orphan stored data and break the
       * two write paths that still accept it (`stacks/lambdas/store/_patch.ts:163`
       * and `stacks/lambdas/platform/_storeConfigPut.ts:136`). Do not add NEW
       * readers.
       *
       * Why it was retired: it was never an independent leaf. It seeded
       * `Customer.currencyId`, while the balance that customer accrues is
       * denominated in `displayCurrency` — so any value other than
       * `displayCurrency` produced customer rows whose stamped currency
       * disagreed with the denomination their own balance was actually kept in,
       * with no cross-field guard preventing it. The agreed replacement is for
       * the FE to seed `Customer.currencyId` from `displayCurrency`, which
       * removes the disagreement at the source rather than guarding it after
       * the fact. ✅ **That replacement HAS SHIPPED** — `app@main` seeds
       * `Customer.currencyId` from `store.config.displayCurrency` at every
       * customer-create site (`QuickAddCustomer.tsx:60,135`,
       * `addCustomerFormDefaults.ts:80,96`), so a NEW customer can no longer
       * be stamped with a currency their balance is not kept in, whatever
       * this retired field still holds.
       *
       * ⚠️ Two things did NOT follow from that, and they are the live
       * questions. Rows stamped BEFORE it shipped are untouched — this repo
       * is forward-only, so nothing backfills them. And a `currencyId` that
       * resolves to no entry in `store.currencies` is not merely a label
       * problem: storefront checkout looks the id up and falls through to a
       * conversion rate of `1`, which prices a foreign-currency customer at
       * parity and compares the DNI/CUIT threshold against an unconverted
       * total.
       *
       * Seed catalogId offered as the FE currency-selector default when a new
       * customer-facing money row is created. Does not reinterpret existing
       * rows, and — importantly — **does not denominate the Account ledger.**
       *
       * ⚠️ Read this before treating it as the account currency. `credit`/`debit`
       * on every row of the ACCOUNT partition are denominated in
       * `displayCurrency`, and the backend enforces that: caller-chosen and
       * order-derived amounts alike convert before persisting and refuse with
       * `FX_CONVERSION_UNAVAILABLE` when no usable rate resolves. Nothing on the
       * backend reads this field at all — it is consumed exclusively by the
       * frontend, which uses it to preselect a currency on customer creation and
       * on the invoice flow.
       *
       * ⚠️ Consequence: setting this to anything other than `displayCurrency`
       * produces customer rows whose stamped currency disagrees with the
       * denomination their own balance is actually kept in. No cross-field guard
       * prevents that today.
       *
       * The earlier wording here named "new Account / SupplierAccount writes",
       * which was wrong in both halves: Account rows are ledger-enforced to
       * `displayCurrency` regardless of this field, and no SupplierAccount write
       * path consumes it.
       */
      defaultAccountCurrency?: string;
      /**
       * Ceiling, in percent, on a single per-line discount an operator may grant
       * (`setLineDiscount`). Absent means no ceiling — the switch stays binary,
       * which is the pre-existing behaviour.
       *
       * ⚠️ It bounds the LINE grant only. It is not a cap on coupon value: a
       * coupon's ceilings are its own (`Coupon.maxDiscountAmount` /
       * `maxDiscountTotal`), because a coupon is a term the merchant minted
       * deliberately while a line discount is typed at the till.
       *
       * Exists so the discount control is not all-or-nothing: a store that wants
       * cashiers to be able to take 10% off a damaged item should not have to
       * grant them the ability to take 90%.
       */
      maxLineDiscountPercent?: number;
      /**
       * ADR-0004 §5 — tenant opt-out from AI product enrichment. Absent does
       * NOT block; only an explicit `true` blocks. The api gate fails CLOSED
       * on a read failure but open on a missing field.
       */
      aiOptOut?: boolean;
      /**
       * Per-category × per-channel notification/feedback defaults; absent ⇒
       * FE falls back to all-on. FE-read only — `PATCH /store` validates shape only.
       */
      feedbackDefaults?: Record<string, { sound?: boolean; visual?: boolean }>;
      /**
       * Guided-setup onboarding progress (ADR-0020). First-login is derived
       * FE-side (absent, or neither `completed` nor `skipped` ⇒ show wizard).
       */
      onboarding?: { step: number; completed: boolean; skipped: boolean };
      /**
       * Store-level configuration for GENERATED internal barcodes (products that
       * carry no manufacturer GTIN). Shape-only on the api side: nothing in the
       * backend allocates or advances these values — `PATCH /store` validates the
       * block and the FE generator reads and writes it.
       *
       * ⚠️ `nextSequence` is therefore NOT a server-authoritative allocator. Two
       * clients generating concurrently can read the same value; the generated
       * barcode is deduped at the product write, not here.
       */
      barcode?: {
        /**
         * Leading digits of a generated store-internal EAN-13. Restricted to the
         * GS1 restricted-circulation range — `'02'` or `'20'`–`'29'` — so a
         * generated code can never collide with a real manufacturer GTIN.
         */
        ean13Prefix?: string;
        /** Prefix prepended to the product id when generating a Code-128 internal barcode. */
        code128Prefix?: string;
        /**
         * Next value the sequential generator should consume. Seeded by the
         * operator (the "configurable start value") and advanced by the FE after
         * each generation.
         */
        nextSequence?: number;
      };
    };
    ecommerce?: Ecommerce;
    photoURL: string;
    /** @deprecated Request-only upload control, never persisted or returned — use `StoreUpdateInput.photoData`. */
    photoData?: string;
    /** @deprecated Request-only upload control, never persisted or returned — use `StoreUpdateInput.removePhotoURL`. */
    removePhotoURL?: string;
    // STORE row reverse-lookup by tenant MP user_id — hot path for the
    // per-tenant payment webhook. Sparse (only active MP connections carry it);
    // KEYS_ONLY because a follow-up Get fetches the full row with the access token.
    mercadopagoUserId?: string;
    // STORE row reverse-lookup by tenant ML seller user_id — hot path for
    // unsigned-webhook tenant resolution. Sparse mirror of
    // `integrations.mercadolibre.userId` (DDB GSIs can't index nested attributes);
    // feeds the KEYS_ONLY `mercadolibreUserId-PK` GSI.
    mercadolibreUserId?: string;
    currencies: StoreCurrencySubscription[];
    cashInMethods: Method[];
    cashOutMethods: Method[];
    debitMethods: Method[];
    priceLists: PriceList[]; // was Method[] — PriceList ⊇ Method, so type-compatible
    accountMethods: Method[];
    deliveryMethods: Method[];
    paymentMethods: Method[];
    brands: Brand[];
    categories: Category[];
    themeColors?: {
      main?: string;
      navbar?: string;
    };
    stats: {
      customers?: number;
      invoices?: number;
      orders?: number;
      products?: number;
      users?: number;
    };
    integrations?: StoreIntegrations;
    fxAutoUpdate?: StoreFxAutoUpdate;
    /** @deprecated Retired — stripped on writes and on every wire boundary; no reader should depend on it. */
    appVersion?: number;
    /** @deprecated Retired — stripped on writes and omitted from responses; the FE has no consumer. */
    fiscalConditions?: FiscalCondition[];
    /**
     * Injected on `GET /store` from the static platform `IVA_TYPES` catalog —
     * never persisted per-store. ⚠️ Present on GET only: the `POST`/`PATCH
     * /store` response echo and the admin WS broadcast currently omit it, so
     * treat it as guaranteed only on a fresh GET.
     */
    ivaTypes: Method[];
    globals?: StoreGlobals;
    maintenance?: MaintenanceInfo;
    // Last cert-expiry alert fired for the current cert, so the daily cron
    // doesn't re-alert within a band; keyed to expiry ms so a renewed cert auto-resets.
    afipCertAlert?: {
      expiry: number;
      band: 'expired' | '14' | '30' | '60';
    };
    // White-label transactional-email sender, distinct from the `email` contact
    // string. `verified` is BE-set only after the SES identity is confirmed.
    emailSender?: {
      from?: string;
      verified?: boolean;
    };
    // Pre-launch landing lead-capture marker; cleared by the
    // `convert-waitlist` operator endpoint (which fires the deferred welcome email).
    waitlist?: boolean;
    /**
     * Tenant opt-in: require a storefront customer's email to be verified
     * before checkout. Absent or `false` — the default for every store,
     * including all pre-existing ones — leaves verification a SOFT state:
     * `Customer.emailVerified` is tracked and surfaced, and nothing is
     * blocked.
     *
     * ⚠️ Turning this on gates the store's OWN existing customers. Nothing is
     * backfilled (forward-only), so every customer who registered before
     * verification existed reads as unverified and is refused at checkout
     * until they verify. That is the tenant's decision to make, but a
     * settings UI should say so rather than presenting it as a neutral
     * switch.
     */
    requireEmailVerification?: boolean;
  }

  interface StoreIntegrations {
    afip?: Afip;
    mercadopago?: Mercadopago;
    // Per-tenant WhatsApp Business connection.
    whatsapp?: WhatsAppConfig;
    // Per-store SMS entitlement. The smsmasivos account is shared
    // platform-wide; this flag gates whether a store may consume it. Future
    // SMS-pack metering (balance, packId, monthlyLimit) extends this blob.
    sms?: SmsIntegration;
    // Per-tenant Gmail OAuth send connection — gmail.send scope only.
    gmail?: Gmail;
    // Per-tenant MercadoLibre seller connection.
    mercadolibre?: Mercadolibre;
  }

  interface SmsIntegration {
    /** When true, the store may send SMS through the shared platform account. */
    enabled?: boolean;
    // Per-store SMS signature (firma) appended to outbound order SMS
    // bodies. Unset means no firma is appended (graceful fallback).
    signature?: string;
  }

  interface Gmail {
    connected?: boolean;
    senderEmail?: string;
    /** KMS-encrypted refresh token — never returned in API responses. */
    refreshTokenEncrypted?: string;
    scopes?: string[];
    connectedAt?: number;
    status?: 'connected' | 'expired' | 'disconnected' | 'error' | 'never';
    disconnectedAt?: number;
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;
    // Lazily-refreshed access-token cache for the Gmail send path,
    // mirrors mercadopago.{accessToken,expiresAt}. KMS-encrypted; NEVER
    // returned in any API response (redacted by `_status.ts`).
    accessTokenEncrypted?: string;
    accessTokenExpiresAt?: number;
  }

  type FxAutoUpdateStrategy = "overwrite" | "overwrite-if-stale" | "notify-only";

  interface FxAutoUpdateBinding {
    catalogId: string; // FK to PlatformCurrency
    sourceId: string; // PLATFORM/FX_SOURCES.sources[].id
    strategy: FxAutoUpdateStrategy;
    lastUpdatedAt?: number; // unix ms — set by propagate-fx worker
    lastValue?: number; // last value the worker observed
  }

  interface StoreFxAutoUpdate {
    enabled: boolean;
    bindings: FxAutoUpdateBinding[]; // max 32 enforced by BE Zod
  }

  interface Mercadopago {
    // OAUTH CONNECTION — set by /mercadopago/oauth/callback.
    userId?: string; // MP user_id; string for precision safety.
    accessToken?: string; // V1 plaintext; KMS-encrypted since.
    refreshToken?: string; // V1 plaintext; KMS-encrypted since.
    expiresAt?: number; // unix ms when accessToken expires.
    connectedAt?: number; // unix ms when OAuth flow completed.
    /** @deprecated Never populated: the OAuth callback drops the token response's `token_type` and no other writer exists. */
    tokenType?: string;
    /** @deprecated Never populated: the OAuth callback drops the token response's `scope` and no other writer exists. */
    scope?: string;
    /** @deprecated Never populated: the OAuth callback drops the token response's `live_mode` and no other writer exists. */
    liveMode?: boolean;
    /** @deprecated Never populated: the OAuth callback drops the token response's `public_key` and no other writer exists (sanitizers deliberately treat it as non-secret, but nothing writes it). */
    publicKey?: string;

    // STATUS / OPS — written by refresh + disconnect.
    status?: MercadopagoConnectionStatus;
    disconnectedAt?: number; // unix ms; admin-triggered disconnect.
    lastTokenRefreshAt?: number;
    tokenRefreshFailures?: number;

    // PER-STORE CONFIG — admin-controlled from Integrations hub.
    statementDescriptor?: string; // shows on customer's bank statement.
    notificationUrl?: string; // webhook URL registered with MP.

    /**
     * Tenant cap on the Checkout Preference's `payment_methods.installments` /
     * `default_installments` (cuotas), bounded to Ahora 12's own tiers.
     *
     * ⚠️ ABSENT MEANS "NO SINFACTURA-SIDE CAP", NOT ZERO. `POST /mercadopago`
     * clamps a caller-supplied value DOWN to this when configured and forwards
     * the request UNCLAMPED when it is not — MP's own account-level default
     * then governs. A reader that coerces absence to `0` turns "no restriction"
     * into "no installments", which is the opposite instruction. Every row
     * written before 1.10.96 lacks the key (forward-only; nothing backfills).
     *
     * This is only the installments cap. Ahora 12 enrollment itself is NOT
     * API-settable at all — it is a merchant-side MP dashboard action gated on
     * the tenant's AFIP-registered `rubro`, with no field anywhere in the MP
     * SDK or REST API. Do not add one here expecting it to do something.
     */
    maxInstallments?: 3 | 6 | 12 | 18;

    pos?: {
      defaultDeviceId?: string; // selected POS terminal id.
      defaultStoreMpId?: string; // MP's store_id for multi-branch merchants.
    };

    staticQr?: {
      posId: string; // MP-issued POS numeric id (stringified).
      externalPosId: string; // SINFACTURA-pinned external id (`SF-{storeId}`).
      createdAt: number; // unix ms when the POS was created.
    };

    dynamicQrPos?: {
      posId: string; // MP-issued POS numeric id (stringified).
      externalPosId: string; // SINFACTURA-pinned external id (`SF{storeId}DYN`).
      createdAt: number; // unix ms when the POS was created.
    };

    /**
     * Per-counter static QR POS rows, keyed by an opaque `counterId`.
     *
     * The singular `staticQr` above is the one-POS-per-tenant original and is
     * deliberately left untouched — this is additive, and nothing migrates.
     * A tenant may carry both; treat `staticQr` as the legacy default counter.
     *
     * Every field here is server-written by the dedicated POS endpoints, never
     * by a client. It sits under `integrations.mercadopago`, and BOTH `.loose()`
     * pass-throughs already delete the whole `integrations` umbrella
     * (`store/_post.ts`, `tenants/_post.ts` — which also drops a top-level
     * `mercadopago`), so this inherits that protection rather than needing its
     * own strip-list entry.
     */
    staticQrs?: Record<string, MercadopagoStaticQr>;

    // Money-movement poller checkpoint — unix ms of the
    // latest MP payment/movement date already ingested. `mpMovementsPoller`
    // advances it monotonically so the next poll walks forward from here.
    // Supersedes the lambda-local `MpWithCheckpoint` cast in
    // `api/stacks/lambdas/mpMovementsPoller/_pollTenant.ts`.
    lastMovementCheckpoint?: number;

    // FEATURE TOGGLES per store, surfaced in the FE Integrations hub.
    features?: {
      checkoutPro?: boolean; // online payments via Checkout Pro.
      pointOfSale?: boolean; // in-person QR / Point.
      subscriptions?: boolean; // recurring billing (future).
    };

    // LEGACY — pre-OAuth FE-issued field, kept for
    // backwards compat during migration; cleared after migration ships.
    code?: string;
  }

  type MercadopagoConnectionStatus = "connected" | "expired" | "disconnected" | "error" | "never";

  // `needs-reauth` is ML-specific (ADR-0018 Amendment B): single-use
  // refresh-token rotation means a hard `invalid_grant` or a dangling
  // refresh-attempt marker is terminal — the seller must reconnect.
  type MercadolibreConnectionStatus =
    | "connected"
    | "expired"
    | "disconnected"
    | "error"
    | "needs-reauth"
    | "never";

  interface Mercadolibre {
    // OAUTH CONNECTION — set by /mercadolibre/oauth/callback.
    userId?: string; // ML seller user_id; string for precision safety.
    nickname?: string; // seller nickname — FE hub card display.
    /** KMS-encrypted (`alias/ml-oauth-tokens`) — never returned in API responses. */
    accessTokenEncrypted?: string;
    /** KMS-encrypted. SINGLE-USE rotated by ML (last-only-valid) — never returned. */
    refreshTokenEncrypted?: string;
    expiresAt?: number; // unix ms when accessToken expires (`expires_in` read at runtime).
    connectedAt?: number; // unix ms when OAuth flow completed.
    tokenType?: string; // 'Bearer'.
    scope?: string; // granted scopes — must include 'offline_access read write'.

    // STATUS / OPS — written by refresh-on-use + disconnect.
    status?: MercadolibreConnectionStatus;
    disconnectedAt?: number; // unix ms; admin-triggered disconnect.
    lastTokenRefreshAt?: number;
    /** Transient (network/5xx) failures only — a hard `invalid_grant` is
     * terminal on FIRST occurrence (→ `needs-reauth`), never counted. */
    tokenRefreshFailures?: number;
    /** Write-ahead refresh-attempt marker (ADR-0018 Amendment B): unix ms
     * persisted BEFORE calling ML's token endpoint. A dangling marker found
     * by the next lock-acquirer means the previous winner may have burned
     * the single-use refresh token → go straight to `needs-reauth`. */
    refreshAttemptAt?: number;

    // PER-STORE CONFIG — admin-controlled from the
    // Integrations hub Configuración tab.
    /** Per-channel auto-invoice toggle — default OFF; enabling requires
     * `defaultPosId` (dedicated PdV) + the Facturador-collision check. */
    autoInvoice?: boolean;
    /** Auto-emit a Nota de Crédito when a full-sale ML return is finalized —
     * default OFF; requires `autoInvoice` and rides the same
     * dedicated-PdV + Facturador-collision guards. */
    autoCreditNote?: boolean;
    defaultPosId?: number; // dedicated AFIP PdV for the ML channel.
    /** Epoch ms of the operator's attestation that ML's own Facturador is
     * OFF for this account — required before `autoInvoice` can
     * be enabled (no public ML API exposes Facturador state). Audit trail;
     * absent = never attested. */
    facturadorAttestedAt?: number;
    // Outbound stock-sync knobs, applied in order: buffer → limit → pause
    // (industry-convergent; persisted via diff-PATCH).
    syncPolicy?: {
      stockBuffer?: number; // subtract from local stock before publishing.
      stockLimit?: number; // hard cap on published stock.
      paused?: boolean; // pause ALL outbound sync (inbound keeps flowing).
      /**
       * Hold PRICE pushes while stock keeps flowing — what an operator wants
       * mid-repricing. `paused` freezes both legs; this freezes only the price
       * leg, so stock continues publishing while it is set.
       */
      pricePaused?: boolean;
    };
    /**
     * Unix ms of the last FULLY DRAINED run of the daily Conciliación
     * Financiera settlement poller for this tenant.
     *
     * ⚠️ It advances ONLY on a clean run — every period this tenant owed was
     * pulled and written with no error and no `206`. A partial or errored run
     * leaves it where it was, so the next tick re-covers the same ground.
     * That is deliberate: ML rate-limits these reports **by IP** (a 429 is a
     * preventive block, not a soft throttle), and the cost of re-pulling a
     * period is one call, while the cost of walking past one is a month of
     * billing the tenant never reconciles.
     *
     * ⚠️ Read it as "when we last KNEW we were complete", never as "when we
     * last polled" — a store polled every day but never clean keeps an old
     * value here, and that gap is the signal, not a bug.
     *
     * Absent = never drained (a newly connected tenant, or one that has never
     * completed a run).
     */
    settlementCheckpoint?: number;
  }

  // Mercadolibre PATCH write shape

  /**
   * Wire/write shape for `mercadolibre.syncPolicy` accepted by `PATCH /store` —
   * distinct from the read-side `Mercadolibre['syncPolicy']` because each knob
   * additionally accepts `null` to mean "clear it" (WRITE-ONLY: the BE deletes
   * the knob rather than ever persisting a DynamoDB `null`).
   */
  interface MercadolibreSyncPolicyInput {
    stockBuffer?: number | null;
    stockLimit?: number | null;
    paused?: boolean | null;
    /** WRITE side of `pricePaused` — `null` clears it, same convention as the knobs above. */
    pricePaused?: boolean | null;
  }

  /**
   * Full write shape for the `mercadolibre` key of `PATCH /store`'s body.
   * `defaultPosId` accepts `null` to clear it — same WRITE-ONLY null-means-remove
   * convention as `syncPolicy`'s knobs. `autoInvoice` is a plain boolean, never
   * nullable. Prefer this over `Partial<Mercadolibre>` for PATCH bodies — the
   * read-side interface can't express write-time null-clear semantics.
   */
  interface MercadolibrePatchInput {
    autoInvoice?: boolean;
    /** Auto-emit a Nota de Crédito on a finalized full-sale ML return; BE-enforced: requires `autoInvoice` true (400 otherwise). */
    autoCreditNote?: boolean;
    defaultPosId?: number | null;
    /** WRITE-ONLY attestation flag: `true` = operator confirms ML's own
     * Facturador is OFF. BE stamps `facturadorAttestedAt`; the boolean itself
     * is never persisted. Required when `autoInvoice` flips to `true` (else 422). */
    facturadorAttested?: boolean;
    syncPolicy?: MercadolibreSyncPolicyInput;
  }

  type IibbJurisdiction = 'caba' | 'entre-rios' | 'mendoza';

  /** One province's ISIB transparency registration.
   *
   * Flat optional flags rather than a discriminated union per jurisdiction: the
   * union would make `promoted` on Mendoza unrepresentable, but it costs the FE
   * substantially in form handling against a hard 2026-10-01 deadline. Validity
   * across jurisdiction and flags is enforced BE-side in Zod instead, so an
   * invalid combination is refused at the write rather than at compile time. */
  interface IibbJurisdictionConfig {
    /** Stable row id — survives reorder and keys the FE field array. */
    id: string;
    jurisdiction: IibbJurisdiction;
    regime: 'local' | 'cm';
    /** The store's own Ley Tarifaria percentage, e.g. 3.5. Ignored when `exempt`. */
    rate: number;
    exempt?: boolean;
    /** CABA only — AGIP Res. 169/26 art. 4 economic-promotion legend. ADDITIVE:
     * a promoted store prints its rate line AND the promotion line, and the
     * promotion line survives `exempt`. */
    promoted?: boolean;
    /** Mendoza only — `Tasa Cero - Ley N° 9655` fiscal-benefit operations. */
    tasaCero?: boolean;
    /** Entre Rios only — which of ATER 128/26 art. 3's three labels this store
     * prints. Three because the province covers two taxes, ISIB and Profesiones
     * Liberales. */
    erLabel?: 'impuestos-provinciales' | 'ingresos-brutos' | 'profesiones-liberales';
    /** ISO date; applies to comprobantes issued on or after. Omitted => always.
     * Load-bearing for Entre Rios, whose *grandes contribuyentes* cutover
     * (2026-10-01) is a NOMINATIVE padron lookup per RG 118/22 rather than a
     * revenue threshold — so which date binds a given store is an operator
     * input that code cannot derive. Everyone else: 2026-10-31. */
    activeFrom?: string;
    /** ISO date; stops applying on or after. Omitted => open-ended. */
    expiresAt?: string;
  }

  interface Afip {
    production: boolean;
    address?: string;
    city?: string;
    condFiscal?: number;
    cuit?: string;
    condFiscalName?: string;
    postalCode?: string;
    province?: string;
    razonSocial?: string;
    pointOfSale?: number; // PTO_VTA
    activitiesStartedAt?: number; // INICIO_ACTIVIDADES
    /** Registered AFIP activity codes (6-digit nomenclador) — drives the
     * IVA Simple F.2051 apertura CSV export; autofillable from Padrón A5. */
    actividades?: number[];
    /** SUPERSEDED by `iibbJurisdictions`, which holds one entry per province.
     * Dual-written through the migration window so un-migrated readers keep
     * working; drop it only once no consumer reads it. CABA-shaped by
     * construction.
     *
     * ⚠️ Deliberately NOT carrying the JSDoc deprecation tag yet.
     * `sonarjs/deprecation` is ERROR severity in the api, so the tag would fail
     * the lint gate at every one of the four legitimate read sites the moment
     * the pin lands — and during a dual-write window those readers are correct,
     * which is the whole point of the window. Add the tag in the same change
     * that removes the last reader, not before. */
    iibbTransparency?: {
      jurisdiction: 'caba';
      regime: 'local' | 'cm';
      rate: number;
      exempt?: boolean;
      /** Economic-promotion regime. Drives the AGIP Res. 169/26 art. 4 promotion
       * legend, which is ADDITIVE to the rate/CM lines rather than replacing
       * them — a promoted store prints its rate line AND the promotion line. */
      promoted?: boolean;
    };
    /** Provincial ISIB transparency, one entry per registered jurisdiction
     * (Ley 27.743 art. 99 adhesions). A store can be registered in several
     * provinces at once, which is why this is plural and `iibbTransparency`
     * could not be widened to carry it.
     *
     * Jurisdictions do NOT share a render shape, so consumers must dispatch per
     * `jurisdiction` rather than assume footer lines: CABA and Mendoza print
     * footer text, Entre Rios prints a positioned LABEL plus a rate inside the
     * item table plus a document-level amount. Max 24 entries. */
    iibbJurisdictions?: IibbJurisdictionConfig[];
    invoiceNote?: string; // NOTA EN FACTURA
    showInvoiceLogo?: boolean; // logo en factura — boolean toggle (was mistyped string)
    // catalogId — FK to PlatformCurrency. The AFIP MonId projection
    // (`'PES' | 'DOL'`) is derived at invoice-write time from
    // `PlatformCurrency.afipCode`; was `1 | 2` (legacy tenant-local Method ids).
    // `StoreCurrencySubscription.value` provides the AFIP `MonCotiz` exchange rate.
    // Narrowed to `CatalogId` so comparisons against the AFIP wire codes
    // fail at compile time; wire-boundary DDB readers may still `as CatalogId`.
    currency: CatalogId;
    /** Certificate PEM — persisted, stripped from every public read (only the derived `hasCert` flag crosses the wire). */
    cert?: string;
    /**
     * CSR PEM — persisted and, unlike `cert`/`key`, PUBLIC BY DESIGN: the
     * cert endpoint returns it so the operator can paste it into ARCA, and no
     * sanitizer strips it. A CSR contains only the public key + subject.
     */
    csr?: string;
    /** Private-key PEM — persisted, stripped from every public read (only `hasKey` crosses the wire). */
    key?: string;
    accessTicket_EB?: string;
    accessTicket_RSF?: string;
    // WSAA ticket for the 'wsfex' service (export invoicing); per-service, 12h TTL.
    accessTicket_FEX?: string;
    // WSAA ticket for the 'wsfecred' service (FCE MiPyME buyer-side ops); per-service, 12h TTL.
    accessTicket_FECRED?: string;
    // WSAA ticket for the 'wscdc' service (third-party voucher constatación); per-service, 12h TTL.
    accessTicket_CDC?: string;
    // Derived read-only flags: cert/key existence, projected on read — never the bytes.
    hasCert?: boolean;
    hasKey?: boolean;
    // RG 5762/2025 Factura M elimination. Per-punto-de-venta legend config,
    // NOT a per-invoice override — one sales point issues one legend type.
    // 'retencion' (mandatory): keeps CbteTipo 51/52/53, relabeled "Factura A
    // con leyenda OPERACIÓN SUJETA A RETENCIÓN". 'cbu_informada' (optional, no
    // withholding): ordinary CbteTipo 1/2/3 with "PAGO EN CBU INFORMADA" + a declared CBU.
    facturaMLegend?: 'retencion' | 'cbu_informada';
    // Declared CBU (22 digits), required when facturaMLegend === 'cbu_informada'.
    cbu?: string;
    // The store's DEDICATED CAEA punto de venta (RG 5782/2025 Art. 5) — always
    // DIFFERENT from `pointOfSale`, its own voucher sequence. Unset ⇒ the
    // invoice-time CAEA circuit breaker is skipped (degrade to pending_cae).
    caeaPointOfSale?: number;
    // The store's DEDICATED export punto de venta (WSFEX, "Comprobantes de
    // Exportación" system) — always DIFFERENT from `pointOfSale`/`caeaPointOfSale`.
    // Unset ⇒ export invoicing (Factura E) is unavailable for the store.
    exportPointOfSale?: number;
    // Cert expiry: ms-epoch of the cert's notAfter, parsed on read from the
    // stored PEM — never the bytes.
    certExpiry?: number;
    // Manual-only "I've completed the ARCA relación" toggles. WSFECRED (FCE
    // MiPyME) and WSCDC each need their own dedicated ARCA relación (+ MiPyME
    // cert for FCE); no auto-detection, never mutated by any AFIP-calling handler.
    fceEnabled?: boolean;
    wscdcEnabled?: boolean;
    // WSFECRED received-FCE poller checkpoint — unix ms upper bound
    // (`fecha.hasta`, Receptor role) of the last FULLY DRAINED
    // `consultarComprobantes` poll for this tenant. Absent means never polled,
    // and the poller falls back to a lookback window rather than to epoch.
    // Advanced monotonically under a conditional SET so a late or retried
    // invocation cannot walk the checkpoint backwards and re-ingest.
    // Mirrors `Mercadopago.lastMovementCheckpoint`.
    fceReceivedCheckpoint?: number;
  }

  // Afip PATCH write shape

  /**
   * Write shape for the `afip` key of `PATCH /store`'s body. The wire accepts an
   * explicit `null` for these clearable keys — `null` deletes the key, omitting it
   * keeps the current value — but the read-side `Afip` interface can't express that
   * WRITE-ONLY null-clear semantic. Same convention as `MercadolibrePatchInput`'s
   * `defaultPosId`/`syncPolicy` null-knobs above.
   */
  interface AfipPatchInput {
    facturaMLegend?: 'retencion' | 'cbu_informada' | null;
    cbu?: string | null;
    iibbTransparency?: Afip['iibbTransparency'] | null;
    iibbJurisdictions?: IibbJurisdictionConfig[] | null;
    actividades?: number[] | null;
  }

  // Config PATCH write shape

  /**
   * Write shape for the `config` key of `PATCH /store`'s body. Two things the
   * read-side `Store['config']` cannot say, both WRITE-ONLY:
   *
   * - it is **partial** — a PATCH sends only the leaves it is changing, while the
   *   read side declares `priceDecimals`/`stock`/`changePrice` as always present;
   * - `maxLineDiscountPercent` additionally accepts `null` to mean **clear it**.
   *   The BE deletes the leaf rather than ever persisting a DynamoDB `null`, so
   *   the read side is correctly `number | undefined` and must stay that way.
   *
   * Same convention as `MercadolibrePatchInput`/`AfipPatchInput` above. Prefer
   * this over `Partial<Store['config']>` for PATCH bodies.
   *
   * ⚠️ Omitting the key keeps the stored ceiling; **emptying a form field is not
   * a clear**. Only an explicit `null` removes it, and only through this route —
   * the MANAGER cross-tenant `PUT /platform/stores/{storeId}` declares the field
   * WITHOUT `null` (see `StoreConfigAdminOverrideInput`) and 400s on one.
   */
  type StoreConfigPatchInput = Partial<Omit<Store['config'], 'maxLineDiscountPercent'>> & {
    /** `null` clears the ceiling; omitted keeps it. Bounded 0-100 inclusive BE-side. */
    maxLineDiscountPercent?: number | null;
  };

  type StoreAttributeNames = keyof Store;

  /**
   * The flat leaves `POST /store` accepts in `removeFields` (compiled into a
   * DynamoDB REMOVE). Strictly allowlisted BE-side: integration umbrellas,
   * platform flags, identity and `address` are deliberately NOT removable.
   */
  type StoreRemovableField = 'email' | 'phone' | 'whatsapp' | 'instagram' | 'facebook' | 'cbu' | 'cuit';

  /**
   * Write shape for `POST /store` (and the PATCH merge) — the home of the
   * request-only controls that do NOT belong on the read-side `Store`.
   * Server-owned keys riding in via `Partial<Store>` (`storeId`, `createdAt`,
   * `updatedAt`, `subscription`, `globals`) are ignored or overwritten by the
   * BE; `afip`/`mercadopago` bodies are re-routed to per-leaf integration
   * writes rather than SET wholesale.
   */
  interface StoreUpdateInput
    extends Partial<Omit<Store, 'photoData' | 'removePhotoURL' | 'config'>> {
    /**
     * Partial, and `maxLineDiscountPercent` is nullable to clear it — neither
     * of which `Partial<Store>['config']` can express, which is why `config`
     * is omitted from the extends clause above rather than inherited.
     */
    config?: StoreConfigPatchInput;
    /** Transient base64 image upload; the BE stores the derived `photoURL`, never this. */
    photoData?: string;
    /** Request-only: asks the BE to delete the current photo. */
    removePhotoURL?: string;
    /** FE follow-up contract for a freshly uploaded photo URL. */
    newPhotoURL?: string;
    /** Leaves to REMOVE from the row — see `StoreRemovableField`. */
    removeFields?: StoreRemovableField[];
  }

  interface Method {
    id: number;
    name: string;
    value?: number;
    removable?: boolean;
    editable?: boolean;
  }

  interface FiscalCondition {
    CbteTipo: {
      FAC: number;
      NC: number;
      ND: number;
      NVC: number;
      REC: number;
    };
    DocTipo: number;
    condFiscal: number;
    id: number;
    name: string;
  }

  // Non-blocking store warning surfaced on create/edit responses.
  // CUIT_SHARED: another store already uses this (normalized) CUIT — one CUIT
  // may own many stores (AFIP per-PtoVta), so it informs, never blocks.
  type StoreWarningCode = "CUIT_SHARED";

  interface StoreWarning {
    code: StoreWarningCode;
    stores: string[]; // other STO ids sharing the CUIT
  }

  // Cross-tenant store-config admin override

  /**
   * Request body for the MANAGER cross-tenant `PUT /platform/stores/{storeId}`
   * config+ecommerce override (Part A), mirroring the already-published
   * `SubscriptionAdminOverrideInput`. Merge-never-clobber on the BE:
   * nested `config`/`ecommerce` fields the payload omits are preserved.
   * Deliberately excludes credential-bearing integration fields (AFIP/MP) --
   * those stay owned by the tenant's own `PATCH /store` + OAuth flows.
   */
  interface StoreConfigAdminOverrideInput {
    config?: {
      priceDecimals?: 0 | 1 | 2 | 3;
      stock?: boolean;
      changePrice?: boolean;
      displayCurrency?: string;
      defaultProductCurrency?: string;
      /**
       * Ceiling on a single line's discount percentage, 0-100 inclusive.
       * ⚠️ NOT nullable here: this plane has no clear-a-leaf idiom, so a `null`
       * is a 400 rather than an instruction. Clearing stays the tenant's own
       * `PATCH /store` — see `StoreConfigPatchInput`.
       */
      maxLineDiscountPercent?: number;
      /** @deprecated Same retirement as `Store['config']['defaultAccountCurrency']` — still accepted by `platform/_storeConfigPut.ts`, no new writers. */
      defaultAccountCurrency?: string;
    };
    ecommerce?: Ecommerce;
    reason: string;
  }

  // Tenant custom domains (`/store/domains`)

  /**
   * Lifecycle of a tenant custom-domain claim.
   *
   * `REVOKED` is terminal but reclaimable BY THE SAME STORE only: re-registering
   * a REVOKED host the caller already owns succeeds, while a PENDING or
   * VERIFIED row owned by anyone else refuses the write. Revoked rows are kept
   * for audit and squatter-protection and still consume one of the store's
   * domain slots — see `DomainErrorCode`.
   */
  type DomainStatus = "PENDING" | "VERIFIED" | "REVOKED";

  /**
   * One row of `GET /store/domains`, which answers `{ data: DomainRecord[] }`.
   *
   * ⚠️ MIXED TIME UNITS inside one row, and this is the shipped shape.
   * `createdAt`, `verifiedAt` and `revokedAt` are **Unix MILLISECONDS**; `ttl`
   * is **Unix SECONDS**, because it is a DynamoDB TTL attribute and DynamoDB
   * defines that field in seconds. Feed the first three to a `Date` directly
   * and multiply `ttl` by 1000 — never the same treatment for both.
   *
   * `ttl` exists only while the claim is PENDING (an unverified claim expires
   * after seven days) and is REMOVED when the host verifies, so a VERIFIED row
   * has no `ttl` and does not expire. Its absence is therefore not "no
   * deadline" in general — read it together with `status`.
   *
   * ⚠️ `verificationToken` is the live secret that proves ownership of the
   * host, and this listing returns it. It is the same value the DNS TXT record
   * must contain, so anyone who can read the row can complete a pending
   * verification for that host. Treat it as a credential: never log it, never
   * put it in a URL, and do not render it outside the domain-setup screen.
   *
   * `host` is the NORMALIZED hostname the server stored — lowercased,
   * punycode-encoded, with any scheme stripped — not the string that was
   * submitted. Match on it rather than on user input.
   */
  interface DomainRecord {
    host: string;
    storeId: string;
    status: DomainStatus;
    verificationToken: string;
    /** Unix MILLISECONDS. */
    createdAt: number;
    /** Unix MILLISECONDS. Present once the host has verified. */
    verifiedAt?: number;
    /** Unix MILLISECONDS. Present once the claim has been revoked. */
    revokedAt?: number;
    /** Unix SECONDS — a DynamoDB TTL. PENDING rows only; removed on verify. */
    ttl?: number;
  }

  /**
   * `POST /store/domains { mode: 'register' }` — the payload, carried ENVELOPED
   * under `data` (see `DomainRegisterResponse`).
   *
   * `token` and `txtRecord.value` are the SAME string — the row's
   * `verificationToken`. Both are present because the operator copies
   * `txtRecord` verbatim into DNS, while `token` is what the published record
   * must end up containing when it is read back.
   *
   * ⚠️ `txtRecord.name` ALREADY carries the `_sinfactura-verify.` label and the
   * host. Most DNS providers append the zone to whatever name you type, so
   * pasting this value into such a form lands the record at
   * `_sinfactura-verify.<host>.<host>`, which can never verify and produces no
   * error explaining why. Present the name as-is and say it is fully qualified.
   */
  interface DomainRegisterResult {
    host: string;
    /** Identical to `txtRecord.value` and to the row's `verificationToken`. */
    token: string;
    txtRecord: {
      /** Fully qualified: `_sinfactura-verify.<host>`. Do not re-prefix. */
      name: string;
      /** The TXT value — identical to `token`. */
      value: string;
    };
  }

  /** Envelope of `POST /store/domains { mode: 'register' }`. */
  interface DomainRegisterResponse {
    data: DomainRegisterResult;
  }

  /**
   * Why a verification attempt did not succeed.
   *
   * - `TXT_NOT_FOUND` — no TXT record resolved at `_sinfactura-verify.<host>`.
   *   The ordinary, expected answer while DNS is still propagating.
   * - `NO_PENDING_REGISTRATION` — a TXT record exists but no DOMAIN row does;
   *   `register` was never called, or the pending row expired.
   * - `NOT_OWNER` — the row exists and belongs to another store.
   * - `TOKEN_MISMATCH` — a TXT record resolved but none of its values equal the
   *   row's `verificationToken`. Usually a stale record from an earlier claim.
   * - `NOT_PENDING` — the row was no longer PENDING when the write landed
   *   (already verified, revoked, or a concurrent verify won the race).
   */
  type DomainVerifyFailureReason =
    | "TXT_NOT_FOUND"
    | "NO_PENDING_REGISTRATION"
    | "NOT_OWNER"
    | "TOKEN_MISMATCH"
    | "NOT_PENDING";

  /**
   * `POST /store/domains { mode: 'verify' }` — the payload, carried ENVELOPED
   * under `data` (see `DomainVerifyResponse`).
   *
   * ⚠️ **`verified: false` on a 200 is CORRECT, not a failure.** A TXT record
   * that has not propagated yet is the expected answer during setup — DNS
   * commonly takes minutes to hours. The obvious consumer reflex, treating a
   * falsy result as an error and offering "something went wrong, try again",
   * is wrong advice: nothing is broken and the operator simply has to wait.
   * Show the pending state and the record they still need to publish.
   *
   * ⚠️ Not every `verified: false` is a 200, so do not gate on the status code
   * alone either. `TXT_NOT_FOUND`, `NO_PENDING_REGISTRATION` and
   * `TOKEN_MISMATCH` ride **200**; `NOT_OWNER` rides **403** and `NOT_PENDING`
   * rides **409**, both still carrying this payload. Parse the body on those
   * two statuses as well, or the two cases with a real explanation are the ones
   * that render as a generic error.
   *
   * `host` is present only on the success branch.
   */
  type DomainVerifyResult =
    | { verified: true; host: string }
    | { verified: false; reason: DomainVerifyFailureReason };

  /**
   * Envelope of `POST /store/domains { mode: 'verify' }`.
   *
   * All three modes on this path — `register`, `verify`, `revoke` — answer
   * enveloped under `data`. One shape for the whole route, so a consumer
   * unwraps once instead of branching on the mode.
   *
   * ⚠️ Only the BODY moved under `data`. Every status code is unchanged: the
   * 403 `NOT_OWNER` and 409 `NOT_PENDING` legs still carry a
   * `DomainVerifyResult`, now nested one level deeper.
   */
  interface DomainVerifyResponse {
    data: DomainVerifyResult;
  }

  /**
   * `POST /store/domains { mode: 'revoke' }` — the payload, carried ENVELOPED
   * under `data` (see `DomainRevokeResponse`), like `register` and `verify`.
   *
   * Revoking is the remedy when a host was claimed in error, so it is
   * deliberately NOT gated by the unclaimable-host guard that `register` and
   * `verify` apply — a row that should never have existed can always be undone.
   *
   * ⚠️ Revoking does not free a domain slot. The row survives as `REVOKED` for
   * audit and squatter-protection and still counts against the per-store cap,
   * so `DOMAIN_LIMIT_REACHED` cannot be cleared by revoking.
   */
  interface DomainRevokeResult {
    /**
     * Always `true` on a 200 — a refusal answers 4xx with `error` instead, so
     * this field never reports a failure and must not be branched on as though
     * it could. Check the status.
     */
    revoked: true;
    host: string;
  }

  /** Envelope of `POST /store/domains { mode: 'revoke' }`. */
  interface DomainRevokeResponse {
    data: DomainRevokeResult;
  }

  /**
   * `body.error` codes a `POST /store/domains` refusal can carry, each verified
   * against a return site in the handler.
   *
   * - `DOMAIN_LIMIT_REACHED` (**429**, `register`) — the store already holds its
   *   maximum number of DOMAIN rows. ⚠️ REVOKED rows still occupy a slot, so a
   *   store can hit this with no live domain at all, and revoking more does not
   *   free capacity. Carries a numeric `limit` alongside `error` and — alone
   *   among these codes — NO `message`, so a UI rendering `body.message`
   *   verbatim shows an empty error here.
   * - `DOMAIN_OWNED_BY_OTHER_STORE` (**409**, `register`) — a PENDING or
   *   VERIFIED row for this host belongs to a different store.
   * - `DOMAIN_NOT_CLAIMABLE` (**409**, `register` AND `verify`) — the host is
   *   not any single store's: a storefront apex serving many tenants, or a
   *   platform origin already on the static CORS allowlist. Permanent for that
   *   host; retrying can never succeed, so offer a different host rather than a
   *   retry.
   * - `NOT_OWNER` (**403**, `revoke`) — the row exists but belongs to another
   *   store.
   *
   * ⚠️ `NOT_OWNER` travels in TWO different slots on this one path. Here it is
   * `body.error` on a revoke. On `verify` the same string is a
   * `DomainVerifyFailureReason` inside the verify payload, with no `error` key
   * present at all. A consumer switching on `body.error` alone silently misses
   * the verify case and falls through to a generic message.
   */
  type DomainErrorCode =
    | "DOMAIN_LIMIT_REACHED"
    | "DOMAIN_OWNED_BY_OTHER_STORE"
    | "DOMAIN_NOT_CLAIMABLE"
    | "NOT_OWNER";
}

export {}; // NOSONAR
