declare global {
  // ───────────────────────────────────────────────────────────────
  // OAuth wire shapes (epic #832 — per-tenant MercadoPago Connect)
  // ───────────────────────────────────────────────────────────────

  // Response from MP's token endpoint:
  //   POST https://api.mercadopago.com/oauth/token
  // Used by both the initial code→token exchange (api#875) and the
  // refresh-token flow (api#876).
  interface MpOauthTokenResponse {
    access_token: string;
    refresh_token: string;
    user_id: number;
    expires_in: number; // seconds
    scope?: string;
    token_type?: string;
    public_key?: string;
    live_mode?: boolean;
  }

  // BE → FE response from POST /mercadopago/oauth/initiate (api#875).
  interface MpOauthInitiateResponse {
    authorizationUrl: string;
  }

  // BE → FE response from GET /mercadopago/oauth/callback (api#875).
  // The FE renders a confirmation, then redirects to the Integrations
  // hub which fetches the full status via GET /mercadopago/status.
  interface MpOauthCallbackResponse {
    connected: true;
    storeId: string;
    mercadopagoUserId: string;
    expiresAt: number;
    connectedAt: number;
  }

  // FE-safe DTO returned by GET /mercadopago/status (api#878).
  // Strips access/refresh tokens and any field that should never leave
  // the BE. The FE renders the Integrations hub card from this shape.
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

  // ───────────────────────────────────────────────────────────────
  // Webhook / IPN shapes (api#880 — per-tenant payment notifications)
  // ───────────────────────────────────────────────────────────────

  // Envelope MP delivers to /mercadopago/oauth/webhook. The BE then
  // fetches the resource via the SDK and broadcasts a narrower
  // MpPaymentNotification to the FE over WebSocket.
  interface MpWebhookEvent {
    id: number;
    live_mode: boolean;
    type: string;             // 'payment' | 'merchant_order' | 'point_integration_wh' | …
    date_created: string;     // ISO
    application_id: number;
    user_id: number;
    version: number;
    api_version: string;
    action: string;           // 'payment.created' | 'payment.updated' | …
    data: { id: string };
  }

  // Real-time payment broadcast over WebSocket (BE → FE).
  // Narrower than MP's full payment object — only the fields the FE
  // needs to render the "pago recibido" toast and update order/invoice
  // state in the Integrations hub and POS screens.
  interface MpPaymentNotification {
    paymentId: string;
    status: string;             // 'approved' | 'pending' | 'rejected' | 'in_process' | 'cancelled' | …
    statusDetail?: string;
    amount: number;
    currency: string;           // 'ARS'
    paymentMethod?: string;     // 'credit_card' | 'debit_card' | 'qr' | …
    externalReference?: string; // sinfactura order / invoice id
    receivedAt: number;         // unix ms — when BE recorded the event
  }

  // ───────────────────────────────────────────────────────────────
  // Point / In-person QR (api#879)
  // ───────────────────────────────────────────────────────────────

  // Device fetched from /point/integration-api/devices (BE → FE so the
  // admin can pick which physical device receives QR payments).
  interface MpPointDevice {
    id: string;                 // device id (e.g. 'NEWLAND_N950__N950NCC301010029')
    posId: number;              // MP POS id linked to the device
    storeId: number;            // MP store_id for multi-branch merchants
    externalPosId?: string;
    operatingMode: "PDV" | "STANDALONE";
  }
}

export {};
