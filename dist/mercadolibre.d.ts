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
        /** api#1655 — when the operator attested ML's own Facturador is OFF
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
    type GtinRequirementTag = "not_required" | "conditional_required" | "new_required";
    interface MlAttribute {
        id: string;
        name?: string;
        value_id?: string;
        value_name?: string;
        attribute_group_id?: string;
        attribute_group_name?: string;
    }
    interface MlRequiredAttribute {
        id: string;
        name?: string;
        required: boolean;
        tags?: string[];
    }
    interface MlCategoryPrediction {
        domainName: string;
        categoryId: string;
        categoryName: string;
        attributes: MlAttribute[];
        requiredAttributes: MlRequiredAttribute[];
        immediatePayment?: "required" | "optional";
        maxTitleLength?: number;
        gtinRequirement: GtinRequirementTag;
    }
    interface MlCategoryCandidate {
        domainId?: string;
        domainName: string;
        categoryId: string;
        categoryName: string;
    }
    interface PublishPrediction extends MlCategoryPrediction {
        isUpMigrated: boolean;
        candidates: MlCategoryCandidate[];
    }
    interface MlCategoryAttributeSchema {
        categoryId: string;
        requiredAttributes: MlRequiredAttribute[];
        gtinRequirement: GtinRequirementTag;
        maxTitleLength?: number;
        immediatePayment?: "required" | "optional";
    }
    interface MlPublishRequest {
        productId: string;
        categoryId: string;
        attributes: MlAttribute[];
        listingTypeId: string;
        saleTerms?: Record<string, unknown>[];
        pictures?: {
            url: string;
        }[];
        description?: string;
    }
    interface MlPublishResponse {
        productId: string;
        itemId: string;
        userProductId?: string;
        isUpMigrated: boolean;
        status: "linked";
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
