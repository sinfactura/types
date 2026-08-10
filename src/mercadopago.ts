declare global {
  // OAuth wire shapes (per-tenant MercadoPago Connect)

  // Response from MP's token endpoint (POST /oauth/token). Used by both the
  // initial code→token exchange and the refresh-token flow.
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

  // BE → FE response from POST /mercadopago/oauth/initiate.
  interface MpOauthInitiateResponse {
    authorizationUrl: string;
  }

  /**
   * @deprecated PHANTOM — the OAuth callback never returns JSON: every branch
   * (success and failure) answers HTTP 302 with an empty body and a redirect
   * `Location`. No producer exists; nothing should consume this.
   */
  interface MpOauthCallbackResponse {
    connected: true;
    storeId: string;
    mercadopagoUserId: string;
    expiresAt: number;
    connectedAt: number;
  }

  /**
   * @deprecated PHANTOM — no `GET /mercadopago/status` route exists (the root
   * `GET /mercadopago` lists `MP#…` payment rows instead), so this DTO has no
   * producer. Its MercadoLibre twin (`MercadolibreStatus`) IS real and served
   * by an implemented status handler.
   */
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

  // Webhook / IPN shapes (per-tenant payment notifications)

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

  // Point / In-person QR

  // Device fetched from /point/integration-api/devices (BE → FE so the
  // admin can pick which physical device receives QR payments).
  interface MpPointDevice {
    id: string;                 // device id (e.g. 'NEWLAND_N950__N950NCC301010029')
    posId: number;              // MP POS id linked to the device
    storeId: number;            // MP store_id for multi-branch merchants
    externalPosId?: string;
    operatingMode: "PDV" | "STANDALONE";
  }

  // QR collection responses (static · dynamic)

  // `data` payload of POST /mercadopago/qr — the static "QR Personal": a
  // persistent, printable POS QR the customer scans to pay over the counter.
  // `null`s are the handler's explicit `?? null` fallbacks when MP omits the field.
  interface MpStaticQrResponse {
    posId: string;                     // MP-issued POS numeric id (stringified).
    externalPosId: string;             // SINFACTURA-pinned external id (`SF{storeId}POS`).
    qrImageUrl: string | null;         // MP-hosted QR image URL.
    qrTemplateUrl: string | null;      // MP-hosted printable template image URL.
    mpUserId: string | null;           // connected tenant's MP user_id.
    externalReference: string | null;  // echoed FE reference, when one was supplied.
    isNew: boolean;                    // true when the POS was created on this call.
  }

  // `data` payload of POST /mercadopago/qr/dynamic — the amount-bound EMVCo
  // QR, one per charge, minted from the order / cuenta-balance / ad-hoc
  // surfaces. The FE renders `qrData` as an EMVCo QR the MP app interprets natively.
  interface MpDynamicQrResponse {
    qrData: string;             // EMVCo QR string.
    inStoreOrderId: string;     // MP in-store order id backing this QR.
    posId: string;              // MP dynamic POS id (`SF{storeId}DYN`).
    externalReference: string;  // SINFACTURA linkage key (ORD/CUST/INV/ACC or ad-hoc).
    customerId?: string;        // present when the charge targets a customer cuenta.
    amount: number;             // charge amount.
    currency: string;           // 'ARS' — MP Argentina settles ARS only.
    expiresAt: number;          // unix ms when the QR expires (FE re-mints on expiry).
    createdAt: number;          // unix ms when the QR (cache row) was created.
    isNew: boolean;             // false when a still-valid cached QR was returned.
  }

  // Super-ops forensic logs — operator OPERACIONES panels

  // MP webhook forensic-log result. Mirrors the BE `MpHookLogResult` union
  // in `api/stacks/services/mercadopago.ts`.
  type MpHookResult =
    | 'config-missing'
    | 'test-event'
    | 'orphan'
    | 'duplicate'
    | 'not-approved'
    | 'item-saved'
    | 'error';

  // Row shape from `MP_HOOK_LOG#{storeId}` (or `unresolved`). Field names match
  // the BE `recordMpHookEvent` writer: `rawBodyB64` (not `rawBody`),
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

  // Phase-2 IPN processing outcome, stamped on each MP_IPN_LOG row.
  // Mirrors the BE `MpIpnOutcome` union AND `ProcessIpnPaymentResult['outcome']`
  // in `api/stacks/lambdas/mercadopago/_ipnProcess.ts`. Optional on the row —
  // Phase-1 rows omit it.
  type MpIpnOutcome =
    | 'polled-online'
    | 'no-online-tenants'
    | 'no-online-mp-tenants'
    | 'not-payment-topic'
    | 'none'
    | 'error';

  // Row shape from `MP_IPN_LOG#unresolved`. Field names match the BE
  // `recordMpIpnEvent` writer. `ipnId` is the SK surfaced by the
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
    /** @deprecated Never populated: the IPN recorder neither accepts nor persists it (unlike `MpHookLogEntry.errorMessage`, which is real). */
    errorMessage?: string;
    outcome?: MpIpnOutcome;
    tenantsScanned?: number;
    tenantsPolled?: number;
    tenantsFailed?: number;
  }

  // MP money-movement classification. Mirrors `MoneyMovement['type']` in
  // `api/stacks/lambdas/mpMovementsPoller/_pollTenant.ts` and the read-path
  // Zod enum in `api/stacks/lambdas/platform/_mpMovementLog.ts`.
  type MpMovementType = 'transfer_in' | 'qr_in' | 'transfer_out' | 'fee' | 'refund' | 'other';

  // Row shape from `MP_MOVEMENT#{storeId}`. Field names match the BE
  // `claimAndPersistMovement` writer: `email` (not `payerEmail`),
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