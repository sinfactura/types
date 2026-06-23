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

  // ───────────────────────────────────────────────────────────────
  // Super-ops forensic logs (api#970/#976) — operator OPERACIONES panels
  // ───────────────────────────────────────────────────────────────

  // MP webhook forensic-log result. Mirrors the BE `MpHookLogResult` union
  // in `api/stacks/services/mercadopago.ts` (api#970).
  type MpHookResult =
    | 'config-missing'
    | 'test-event'
    | 'orphan'
    | 'duplicate'
    | 'not-approved'
    | 'item-saved'
    | 'error';

  // Row shape from `MP_HOOK_LOG#{storeId}` (or `unresolved`). Field names match
  // the BE `recordMpHookEvent` writer (api#970): `rawBodyB64` (not `rawBody`),
  // `expectedPrefix` (not `computedExpectedPrefix`). `hookId` is the SK surfaced
  // by the read/WS-broadcast DTO (`data: { hookId: Item.SK }`).
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

  // Phase-2 IPN processing outcome (api#976), stamped on each MP_IPN_LOG row.
  // Mirrors the BE `MpIpnOutcome` union AND `ProcessIpnPaymentResult['outcome']`
  // in `api/stacks/lambdas/mercadopago/_ipnProcess.ts`. Optional on the row —
  // Phase-1 (pre-#976) rows omit it.
  type MpIpnOutcome =
    | 'polled-online'
    | 'no-online-tenants'
    | 'no-online-mp-tenants'
    | 'not-payment-topic'
    | 'none'
    | 'error';

  // Row shape from `MP_IPN_LOG#unresolved`. Field names match the BE
  // `recordMpIpnEvent` writer (api#976). `ipnId` is the SK surfaced by the
  // read/WS-broadcast DTO (`data: { ipnId: Item.SK }`). The BE always writes
  // `topic` (`topic || 'unknown'`) and `resourceId` (`resourceId || ''`), so
  // both are required here (corrects the app-local optional drift).
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

  // MP money-movement classification. Mirrors `MoneyMovement['type']` in
  // `api/stacks/lambdas/mpMovementsPoller/_pollTenant.ts` and the read-path
  // Zod enum in `api/stacks/lambdas/platform/_mpMovementLog.ts` (api#976).
  type MpMovementType = 'transfer_in' | 'qr_in' | 'transfer_out' | 'fee' | 'refund' | 'other';

  // Row shape from `MP_MOVEMENT#{storeId}`. Field names match the BE
  // `claimAndPersistMovement` writer (api#976): `email` (not `payerEmail`),
  // `cuit` (not `payerCuit`); `operationId` is re-derived from the SK on read.
  // `source` is the literal 'transfer' the writer always stamps. The BE does
  // NOT persist `storeId` (it lives only in the PK) or `paymentId` on this row
  // (those belong to the sibling PAYMENT partition), so neither is graduated.
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

export {}; // NOSONAR