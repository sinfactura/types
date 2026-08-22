declare global {
    interface Config {
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
            showDefaultPriceList?: number;
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
        storeId: string;
        createdAt: number;
        /** Unix ms — BE-stamped on every `POST`/`PATCH /store` write. Always present on written rows. */
        updatedAt?: number;
        type?: 'production' | 'demo';
        name: string;
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
        acknowledgedSharedCuit?: boolean;
        /**
         * Response-time join, not a persisted Store attribute — and TWO different
         * shapes depending on the endpoint: `GET /tenants` (SUPERVISOR) attaches the
         * compact `StoreRowSubscriptionSummary`; the tenant's own `GET /store`
         * embeds a near-`SubscriptionSyncPayload` (today still missing `currency`
         * and `freeUntil` — treat both as possibly absent until the api aligns the
         * embed). Discriminate structurally (`'entitlements' in subscription`).
         */
        subscription?: StoreRowSubscriptionSummary | SubscriptionSyncPayload;
        config: {
            priceDecimals: 0 | 1 | 2 | 3;
            stock: boolean;
            changePrice: boolean;
            /**
             * Back-office display currency (catalogId) the operator's screens are
             * framed in — distinct from any individual money entity's own `currency`
             * stamp. Also the denomination fallback for unstamped legacy `Account` rows.
             */
            displayCurrency?: string;
            /** Seed catalogId for new Product writes (FE currency-selector default); does not reinterpret existing rows. */
            defaultProductCurrency?: string;
            /** Seed catalogId for new Account / SupplierAccount writes (FE currency-selector default); does not reinterpret existing rows. */
            defaultAccountCurrency?: string;
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
            feedbackDefaults?: Record<string, {
                sound?: boolean;
                visual?: boolean;
            }>;
            /**
             * Guided-setup onboarding progress (ADR-0020). First-login is derived
             * FE-side (absent, or neither `completed` nor `skipped` ⇒ show wizard).
             */
            onboarding?: {
                step: number;
                completed: boolean;
                skipped: boolean;
            };
        };
        ecommerce?: Ecommerce;
        photoURL: string;
        /** @deprecated Request-only upload control, never persisted or returned — use `StoreUpdateInput.photoData`. */
        photoData?: string;
        /** @deprecated Request-only upload control, never persisted or returned — use `StoreUpdateInput.removePhotoURL`. */
        removePhotoURL?: string;
        mercadopagoUserId?: string;
        mercadolibreUserId?: string;
        currencies: StoreCurrencySubscription[];
        cashInMethods: Method[];
        cashOutMethods: Method[];
        debitMethods: Method[];
        priceLists: PriceList[];
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
        afipCertAlert?: {
            expiry: number;
            band: 'expired' | '14' | '30' | '60';
        };
        emailSender?: {
            from?: string;
            verified?: boolean;
        };
        waitlist?: boolean;
    }
    interface StoreIntegrations {
        afip?: Afip;
        mercadopago?: Mercadopago;
        whatsapp?: WhatsAppConfig;
        sms?: SmsIntegration;
        gmail?: Gmail;
        mercadolibre?: Mercadolibre;
    }
    interface SmsIntegration {
        /** When true, the store may send SMS through the shared platform account. */
        enabled?: boolean;
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
        accessTokenEncrypted?: string;
        accessTokenExpiresAt?: number;
    }
    type FxAutoUpdateStrategy = "overwrite" | "overwrite-if-stale" | "notify-only";
    interface FxAutoUpdateBinding {
        catalogId: string;
        sourceId: string;
        strategy: FxAutoUpdateStrategy;
        lastUpdatedAt?: number;
        lastValue?: number;
    }
    interface StoreFxAutoUpdate {
        enabled: boolean;
        bindings: FxAutoUpdateBinding[];
    }
    interface Mercadopago {
        userId?: string;
        accessToken?: string;
        refreshToken?: string;
        expiresAt?: number;
        connectedAt?: number;
        /** @deprecated Never populated: the OAuth callback drops the token response's `token_type` and no other writer exists. */
        tokenType?: string;
        /** @deprecated Never populated: the OAuth callback drops the token response's `scope` and no other writer exists. */
        scope?: string;
        /** @deprecated Never populated: the OAuth callback drops the token response's `live_mode` and no other writer exists. */
        liveMode?: boolean;
        /** @deprecated Never populated: the OAuth callback drops the token response's `public_key` and no other writer exists (sanitizers deliberately treat it as non-secret, but nothing writes it). */
        publicKey?: string;
        status?: MercadopagoConnectionStatus;
        disconnectedAt?: number;
        lastTokenRefreshAt?: number;
        tokenRefreshFailures?: number;
        statementDescriptor?: string;
        notificationUrl?: string;
        pos?: {
            defaultDeviceId?: string;
            defaultStoreMpId?: string;
        };
        staticQr?: {
            posId: string;
            externalPosId: string;
            createdAt: number;
        };
        dynamicQrPos?: {
            posId: string;
            externalPosId: string;
            createdAt: number;
        };
        lastMovementCheckpoint?: number;
        features?: {
            checkoutPro?: boolean;
            pointOfSale?: boolean;
            subscriptions?: boolean;
        };
        code?: string;
    }
    type MercadopagoConnectionStatus = "connected" | "expired" | "disconnected" | "error" | "never";
    type MercadolibreConnectionStatus = "connected" | "expired" | "disconnected" | "error" | "needs-reauth" | "never";
    interface Mercadolibre {
        userId?: string;
        nickname?: string;
        /** KMS-encrypted (`alias/ml-oauth-tokens`) — never returned in API responses. */
        accessTokenEncrypted?: string;
        /** KMS-encrypted. SINGLE-USE rotated by ML (last-only-valid) — never returned. */
        refreshTokenEncrypted?: string;
        expiresAt?: number;
        connectedAt?: number;
        tokenType?: string;
        scope?: string;
        status?: MercadolibreConnectionStatus;
        disconnectedAt?: number;
        lastTokenRefreshAt?: number;
        /** Transient (network/5xx) failures only — a hard `invalid_grant` is
         * terminal on FIRST occurrence (→ `needs-reauth`), never counted. */
        tokenRefreshFailures?: number;
        /** Write-ahead refresh-attempt marker (ADR-0018 Amendment B): unix ms
         * persisted BEFORE calling ML's token endpoint. A dangling marker found
         * by the next lock-acquirer means the previous winner may have burned
         * the single-use refresh token → go straight to `needs-reauth`. */
        refreshAttemptAt?: number;
        /** Per-channel auto-invoice toggle — default OFF; enabling requires
         * `defaultPosId` (dedicated PdV) + the Facturador-collision check. */
        autoInvoice?: boolean;
        /** Auto-emit a Nota de Crédito when a full-sale ML return is finalized —
         * default OFF; requires `autoInvoice` and rides the same
         * dedicated-PdV + Facturador-collision guards. */
        autoCreditNote?: boolean;
        defaultPosId?: number;
        /** Epoch ms of the operator's attestation that ML's own Facturador is
         * OFF for this account — required before `autoInvoice` can
         * be enabled (no public ML API exposes Facturador state). Audit trail;
         * absent = never attested. */
        facturadorAttestedAt?: number;
        syncPolicy?: {
            stockBuffer?: number;
            stockLimit?: number;
            paused?: boolean;
        };
    }
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
        pointOfSale?: number;
        activitiesStartedAt?: number;
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
        invoiceNote?: string;
        showInvoiceLogo?: boolean;
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
        accessTicket_FEX?: string;
        accessTicket_FECRED?: string;
        accessTicket_CDC?: string;
        hasCert?: boolean;
        hasKey?: boolean;
        facturaMLegend?: 'retencion' | 'cbu_informada';
        cbu?: string;
        caeaPointOfSale?: number;
        exportPointOfSale?: number;
        certExpiry?: number;
        fceEnabled?: boolean;
        wscdcEnabled?: boolean;
    }
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
    interface StoreUpdateInput extends Partial<Omit<Store, 'photoData' | 'removePhotoURL'>> {
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
    type StoreWarningCode = "CUIT_SHARED";
    interface StoreWarning {
        code: StoreWarningCode;
        stores: string[];
    }
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
            defaultAccountCurrency?: string;
        };
        ecommerce?: Ecommerce;
        reason: string;
    }
}
export {};
