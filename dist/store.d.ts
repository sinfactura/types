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
    interface FeatureFlags {
        navbar?: {
            show?: boolean;
        };
        sidebar?: {
            show?: boolean;
            customerFinder?: {
                show?: boolean;
                showPicture?: boolean;
                showEditButton?: boolean;
                showStatsButton?: boolean;
                showExitButton?: boolean;
                showBalance?: boolean;
                showPaymentButton?: boolean;
            };
            showHome?: boolean;
            showCash?: boolean;
            showOrders?: boolean;
            showInvoices?: boolean;
            showBaskets?: boolean;
            showCustomers?: boolean;
            showProducts?: boolean;
            showReports?: boolean;
            store?: {
                show?: boolean;
                showConfig?: boolean;
                showCategories?: boolean;
                showBrands?: boolean;
                showProviders?: boolean;
                showUsers?: boolean;
                showIntegrations?: boolean;
            };
            showBalance?: boolean;
        };
        footer?: {
            desktopNavigation?: {
                show?: boolean;
                showCopyright?: boolean;
                showPrivacy?: boolean;
                showAppVersion?: boolean;
            };
            mobileNavigation?: {
                show?: boolean;
                showOrders?: boolean;
                showInvoices?: boolean;
                showBasket?: boolean;
                showFavorites?: boolean;
            };
        };
    }
    interface Store {
        storeId: string;
        createdAt: number;
        type?: 'production' | 'demo';
        name: string;
        address: {
            street: string;
            postalCode: string;
            city: string;
            province: string;
        };
        cuit: string;
        phone: string;
        email: string;
        acknowledgedSharedCuit?: boolean;
        config: {
            priceDecimals: 0 | 1 | 2 | 3;
            stock: boolean;
            changePrice: boolean;
            /**
             * Back-office display currency (catalogId). The single currency
             * the operator's screens are framed in — distinct from the
             * currency of any individual money entity (Order / Invoice /
             * etc carry their own self-describing `currency` stamps).
             *
             * NOTE: the self-describing-stamp invariant is true for Order /
             * Invoice but only ASPIRATIONAL for ACCOUNT — `Account.currency`
             * is optional and ≈100% of historical rows are unstamped, so they
             * fall back to THIS field for their denomination (tracked
             * api#1333 / api#1352).
             */
            displayCurrency?: string;
            /**
             * Seed catalogId for new Product writes. Used by the FE product
             * form to populate the currency selector default — does NOT
             * reinterpret existing Product rows.
             */
            defaultProductCurrency?: string;
            /**
             * Seed catalogId for new Account / SupplierAccount writes. Used
             * by the FE cuenta form to populate the currency selector
             * default — does NOT reinterpret existing Account rows.
             */
            defaultAccountCurrency?: string;
            /**
             * api#1740 — per-category × per-channel notification/feedback defaults.
             * Store-level baseline the app layers per-device overrides on top of
             * (app#2085); absent ⇒ the FE falls back to all-on. Purely FE-read — no
             * BE behavior depends on these; `PATCH /store` validates shape only.
             * Open key set (lowercase English category keys: `scan`, `payments`, …).
             */
            feedbackDefaults?: Record<string, {
                sound?: boolean;
                visual?: boolean;
            }>;
            /**
             * api#1876 — guided-setup onboarding progress (app#998, ADR-0020).
             * Store-level wizard state persisted across sessions. Purely FE-read —
             * no BE behavior depends on these; `PATCH /store` validates shape only.
             * First-login is DERIVED FE-side (absent block, or neither `completed`
             * nor `skipped` ⇒ show the wizard) — there is no BE first-login field.
             */
            onboarding?: {
                step: number;
                completed: boolean;
                skipped: boolean;
            };
        };
        features: FeatureFlags;
        ecommerce?: Ecommerce;
        photoURL: string;
        photoData?: string;
        newPhotoURL?: string;
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
        appVersion: number;
        fiscalConditions: FiscalCondition[];
        ivaTypes: Method[];
        minWithDni: number;
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
        /** Lifecycle fields (api#1459 / #1460). */
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
        tokenType?: string;
        scope?: string;
        liveMode?: boolean;
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
        /** Auto-emit a Nota de Crédito when a full-sale ML return is finalized
         * (api#1684) — default OFF; requires `autoInvoice` and rides the same
         * dedicated-PdV + Facturador-collision guards. */
        autoCreditNote?: boolean;
        defaultPosId?: number;
        /** Epoch ms of the operator's attestation that ML's own Facturador is
         * OFF for this account (api#1655) — required before `autoInvoice` can
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
     * Wire/write shape for `mercadolibre.syncPolicy` accepted by `PATCH /store`
     * (api#1650) — distinct from the read-side `Mercadolibre['syncPolicy']`
     * above because each knob additionally accepts `null` to mean "clear it"
     * (an `InputNumber`-style FE control emits `null`, not `undefined`, on
     * clear). `null` is a WRITE-ONLY signal: the BE deep-merges it into the
     * stored leaf and deletes the knob rather than ever persisting a DynamoDB
     * `null` — so the read shape (`Mercadolibre['syncPolicy']`) never contains
     * `null` and does not need to change.
     */
    interface MercadolibreSyncPolicyInput {
        stockBuffer?: number | null;
        stockLimit?: number | null;
        paused?: boolean | null;
    }
    /**
     * Full write shape for the `mercadolibre` key of `PATCH /store`'s body
     * (`mercadolibrePatchSchema`, `stacks/lambdas/store/_patch.ts`). `defaultPosId`
     * additionally accepts `null` to clear a previously-set dedicated PdV
     * (api#1656) — same WRITE-ONLY null-means-remove convention as
     * `syncPolicy`'s knobs (api#1650): the BE deletes the field rather than
     * ever persisting a DynamoDB `null`, so the read shape
     * (`Mercadolibre['defaultPosId']`) stays `number | undefined` and does not
     * need to change. `autoInvoice` is not nullable — it's a plain boolean
     * toggle, never "unset." Prefer this over `Partial<Mercadolibre>` for
     * PATCH request bodies — the read-side interface can't express these
     * write-time null-clear semantics.
     */
    interface MercadolibrePatchInput {
        autoInvoice?: boolean;
        /** Auto-emit a Nota de Crédito on a finalized full-sale ML return (api#1684).
         *  BE-enforced: requires `autoInvoice` to be true (400 otherwise). */
        autoCreditNote?: boolean;
        defaultPosId?: number | null;
        /** WRITE-ONLY attestation flag (api#1655): `true` = the operator
         * confirms ML's own Facturador is OFF for this account. The BE stamps
         * `facturadorAttestedAt` (epoch ms) — the boolean itself is never
         * persisted. Required (same request or previously stamped) when
         * `autoInvoice` flips to `true`; otherwise 422. */
        facturadorAttested?: boolean;
        syncPolicy?: MercadolibreSyncPolicyInput;
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
        /** Registered AFIP activity codes (6-digit nomenclador), api#1741 — drives the
         * IVA Simple F.2051 apertura CSV export; autofillable from Padrón A5. */
        actividades?: number[];
        /** Provincial ISIB transparency config (Ley 27.743 art. 99 adhesions), api#1742.
         * v1: CABA only (AGIP Res. 169/26 — prints the RATE, never an amount). `rate` is
         * the store's own Ley Tarifaria percentage (e.g. 3.5 → "3,50%"); `regime: 'cm'`
         * adds the Convenio Multilateral second line; `exempt` prints the exempt legend. */
        iibbTransparency?: {
            jurisdiction: 'caba';
            regime: 'local' | 'cm';
            rate: number;
            exempt?: boolean;
        };
        invoiceNote?: string;
        showInvoiceLogo?: boolean;
        currency: CatalogId;
        cert?: string;
        csr?: string;
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
        actividades?: number[] | null;
    }
    type StoreAttributeNames = keyof Store;
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
     * config+ecommerce override (api#1509 Part A), mirroring the already-published
     * `SubscriptionAdminOverrideInput` (api#827). Merge-never-clobber on the BE:
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
