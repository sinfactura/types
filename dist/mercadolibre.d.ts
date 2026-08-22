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
        autoInvoice?: boolean;
        autoCreditNote?: boolean;
        defaultPosId?: number;
        /** When the operator attested ML's own Facturador is OFF
         * (epoch ms); absent = never attested. FE gates the autoInvoice toggle
         * on this. */
        facturadorAttestedAt?: number;
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
}
export {};
