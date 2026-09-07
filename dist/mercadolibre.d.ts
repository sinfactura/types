declare global {
    interface MlOauthTokenResponse {
        access_token: string;
        token_type?: string;
        expires_in: number;
        scope?: string;
        user_id: number;
        refresh_token: string;
    }
    interface MlOauthInitiateResponse {
        authorizationUrl: string;
    }
    /**
     * @deprecated PHANTOM — the OAuth callback never returns JSON: every branch
     * answers HTTP 302 with an empty body and a redirect `Location`. No producer
     * exists; nothing should consume this. (Status/disconnect DTOs below are real.)
     */
    interface MlOauthCallbackResponse {
        connected: true;
        storeId: string;
        mercadolibreUserId: string;
        expiresAt: number;
        connectedAt: number;
    }
    interface MlOauthDisconnectResponse {
        disconnected: true;
        storeId: string;
    }
    type MlOauthErrorCode = "OAUTH_USER_DENIED" | "OAUTH_STATE_MISMATCH" | "OAUTH_EXCHANGE_FAILED" | "ML_OAUTH_NOT_CONFIGURED" | "ML_REDIRECT_URI_MISMATCH" | "ML_OFFLINE_ACCESS_NOT_GRANTED" | "ML_OPERATOR_SUB_ACCOUNT" | "ML_SELLER_ALREADY_LINKED";
    interface MercadolibreStatus {
        connected: boolean;
        status: MercadolibreConnectionStatus;
        userId?: string;
        nickname?: string;
        connectedAt?: number;
        expiresAt?: number;
        syncPolicy?: Mercadolibre["syncPolicy"];
    }
    interface MlWebhookEvent {
        _id: string;
        resource: string;
        user_id: number;
        topic: string;
        application_id: number;
        attempts: number;
        sent: string;
        received: string;
    }
    type MlMatchGrade = "vinculada" | "para-revisar" | "sin-vincular";
    type MlMatchBasis = "seller_sku" | "gtin" | "title";
    interface MlMatchSuggestion {
        productId: string;
        sku?: string;
        mlItemId: string;
        mlTitle?: string;
        userProductId?: string;
        familyId?: string;
        variationId?: string;
        grade: MlMatchGrade;
        basis?: MlMatchBasis;
    }
    interface MercadolibreOrderWsPayload {
        orderId: string;
        mlOrderId: string;
        packId?: string;
        buyerNickname?: string;
        total: number;
        currency: string;
        paidAt?: number;
    }
    interface MlFieldError {
        field: string;
        code?: string;
        message: string;
        type?: "warning" | "error";
        causeId?: number;
    }
    /**
     * One charge or bonus line off `summary/details`'s `bill_includes`.
     *
     * ⚠️ `type` is deliberately a bare `string`, not a union. ML's own
     * documentation calls its observed codes non-exhaustive (`CV` cargo por
     * venta, `CXD` cargo por Mercado Envíos, `PADS` Product Ads, `BXD` for
     * BOTH bonus categories — ML distinguishes those two only by `label`,
     * not by a per-category code). A closed union would drop a line the day
     * ML adds a code, and dropping a money line is worse than carrying an
     * unrecognised one.
     *
     * ⚠️ A line carries NO order reference of any kind — `{label, amount,
     * type, groupId}` is the whole shape. That is why commission and shipping
     * reconcile at PERIOD level and not per order; see
     * `OrderMercadolibre.settlement` for the same point from the other side.
     */
    interface MercadolibreSettlementLine {
        type: string;
        label: string;
        amount: number;
        /** ML's own grouping id for the line. Opaque — carried, never interpreted. */
        groupId?: number;
    }
    /**
     * One ingested ML billing period, keyed `ML_SETTLEMENT_PERIOD#{storeId}` /
     * `{periodKey}`.
     *
     * ⚠️ `periodStatus: 'OPEN'` means the numbers STILL MOVE — ML re-states an
     * open period until it closes. Read an OPEN period as provisional and
     * re-pull after close; do not reconcile against one and call it settled.
     */
    interface MercadolibreSettlementPeriod {
        storeId: string;
        /** `YYYY-MM-01` — the first day of the billing month, ML's own key. */
        periodKey: string;
        periodStatus: "OPEN" | "CLOSED";
        charges: MercadolibreSettlementLine[];
        bonuses: MercadolibreSettlementLine[];
        /** `bill_includes.total_amount` — the period's bill total. */
        totalAmount?: number;
        /** `bill_includes.total_perceptions`. AR sellers only; absent elsewhere. */
        totalPerceptions?: number;
        /**
         * Amount still pending payment on the period — the debt-alert signal.
         * ⚠️ Absent means "not reported by ML on this pull", never "zero".
         */
        unpaidAmount?: number;
        /** ML's own payment due date for the period, as ML states it (`YYYY-MM-DD`). */
        expirationDate?: string;
        currency?: string;
        /**
         * ML answered `206 Partial Content` — the report was not fully generated,
         * so what is stored here is INCOMPLETE and the poller will re-pull it.
         * ⚠️ A partial period must not be treated as an authority on anything;
         * it exists so a partial pull is not silently indistinguishable from a
         * complete one.
         */
        partial?: boolean;
        ingestedAt: number;
    }
    /** `GET /mercadolibre/settlement` — the operator's period list. */
    interface MercadolibreSettlementPeriodsResponse {
        message: string;
        data: MercadolibreSettlementPeriod[];
        LastEvaluatedKey?: Record<string, unknown>;
    }
}
export {};
