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
    type MpHookResult = 'config-missing' | 'test-event' | 'orphan' | 'duplicate' | 'not-approved' | 'item-saved' | 'error';
    interface MpHookLogEntry {
        hookId: string;
        rawBodyB64?: string;
        rawBodyLen?: number;
        headers?: Record<string, string>;
        path?: string;
        resource?: string;
        queryStringParameters?: Record<string, string> | null;
        signatureValid?: boolean;
        signatureV1Prefix?: string;
        expectedPrefix?: string;
        signatureReason?: string;
        paymentId?: string;
        userId?: string;
        storeId?: string;
        result: MpHookResult;
        errorMessage?: string;
        processingMs?: number;
        createdAt: number;
        ts?: number;
        requestId?: string;
        ttl?: number;
    }
    type MpIpnOutcome = 'polled-online' | 'no-online-tenants' | 'no-online-mp-tenants' | 'not-payment-topic' | 'none' | 'error';
    interface MpIpnLogEntry {
        ipnId: string;
        topic: string;
        resourceId: string;
        rawBodyB64?: string;
        rawBodyLen?: number;
        headers?: Record<string, string>;
        path?: string;
        resource?: string;
        queryStringParameters?: Record<string, string> | null;
        processingMs?: number;
        createdAt: number;
        ttl?: number;
        errorMessage?: string;
        outcome?: MpIpnOutcome;
        tenantsScanned?: number;
        tenantsPolled?: number;
        tenantsFailed?: number;
    }
    type MpMovementType = 'transfer_in' | 'qr_in' | 'transfer_out' | 'fee' | 'refund' | 'other';
    interface MpMovementLogEntry {
        operationId: string;
        source: 'transfer';
        amount: number;
        currency: string;
        type: MpMovementType;
        date: number;
        description: string;
        sourceChannel?: string;
        payerName?: string;
        cuit?: string;
        email?: string;
        raw?: unknown;
        createdAt: number;
        processedAt: number;
        ttl?: number;
    }
}
export {};
