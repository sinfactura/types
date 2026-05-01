/**
 * WebSocket broadcast payload for the `payment_received` action.
 *
 * Fired by the API when a "money received" event is persisted across any
 * of three sources (MP webhook, Stripe webhook, MP movements poller).
 * Receivers (FE) should:
 *   1. Render an immediate snackbar toast using `total` + `currency` + `payerName`.
 *   2. Invalidate RTK Query tags `PaymentReceived` + `PaymentReceivedUnlinked`
 *      so the canonical row is refetched from `GET /payments/received`.
 */
export type PaymentReceivedSource = "mp" | "stripe" | "mp_movement";

export interface PaymentReceivedWsPayload {
	source: PaymentReceivedSource;
	paymentId: string;
	total: number;
	currency: string; // ISO 4217 (e.g. 'ARS', 'USD')
	payerName?: string;
	paidAt: number; // unix milliseconds
	customerId?: string;
	orderId?: string;
	invoiceId?: string;
}

/**
 * REST shape of a payment row returned by `GET /payments/received` (api#902).
 *
 * Distinct from `PaymentReceivedWsPayload` (api#880, the WS broadcast):
 *   - This carries denormalized labels (customerName, orderCode, invoiceCode)
 *     attached server-side at response time so the FE doesn't N+1 fetch.
 *   - The WS broadcast is the lean live-tail event; this is the canonical row.
 */
export interface PaymentReceived {
	paymentId: string;
	source: PaymentReceivedSource;
	total: number;
	currency: string;
	payerName?: string;
	payerEmail?: string;
	payerCuit?: string;
	paidAt: number; // unix milliseconds
	// Linkage — any one means "linked"
	customerId?: string;
	customerName?: string; // denormalized
	orderId?: string;
	orderCode?: string; // denormalized — equals orderId today
	invoiceId?: string;
	invoiceCode?: string; // denormalized — equals invoiceId today
	accountId?: string;
	linkedAt?: number;
	linkSource?: "auto" | "manual";
}
