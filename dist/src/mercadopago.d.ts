declare global {
    interface MpOauthTokenResponse {
        access_token: string;
        refresh_token: string;
        user_id: number;
        expires_in: number;
        scope?: string;
        token_type?: string;
        public_key?: string;
        live_mode?: boolean;
    }
    interface MpOauthInitiateResponse {
        authorizationUrl: string;
    }
    interface MpOauthCallbackResponse {
        connected: true;
        storeId: string;
        mercadopagoUserId: string;
        expiresAt: number;
        connectedAt: number;
    }
    interface MercadopagoStatus {
        connected: boolean;
        status: MercadopagoConnectionStatus;
        userId?: string;
        connectedAt?: number;
        expiresAt?: number;
        liveMode?: boolean;
        publicKey?: string;
        statementDescriptor?: string;
        pos?: Mercadopago["pos"];
        features?: Mercadopago["features"];
    }
    interface MpWebhookEvent {
        id: number;
        live_mode: boolean;
        type: string;
        date_created: string;
        application_id: number;
        user_id: number;
        version: number;
        api_version: string;
        action: string;
        data: {
            id: string;
        };
    }
    interface MpPaymentNotification {
        paymentId: string;
        status: string;
        statusDetail?: string;
        amount: number;
        currency: string;
        paymentMethod?: string;
        externalReference?: string;
        receivedAt: number;
    }
    interface MpPointDevice {
        id: string;
        posId: number;
        storeId: number;
        externalPosId?: string;
        operatingMode: "PDV" | "STANDALONE";
    }
}
export {};
