
// Canonical notification taxonomy (#78). These are the exact attribute
// names the BE filter-reads on User rows (`notifications.<KEY> = true`
// DynamoDB FilterExpressions — new-order fanout, MP hook/poller/recover,
// Stripe hook, propagate-fx). Exported as a real enum so `api`
// (stacks/helpers/notificationType.ts) and `app`
// (src/domain/notificationType.ts) can drop their hand-mirrored copies
// in follow-ups. DOLARBNA / ERROR / AFIP_CERT_EXPIRY have no User-row
// read path — enum members only (AFIP_CERT_EXPIRY = the cert-expiry
// alert type, api#1382).
export enum NotificationTypeEnum {
	ORDER = 'ORDER',
	MERCADOPAGO = 'MERCADOPAGO',
	STRIPE = 'STRIPE',
	DOLAROFICIAL = 'DOLAROFICIAL',
	DOLARINFORMAL = 'DOLARINFORMAL',
	DOLARBNA = 'DOLARBNA',
	ERROR = 'ERROR',
	AFIP_CERT_EXPIRY = 'AFIP_CERT_EXPIRY',
	// ML order-ingestion fanout (app#797 / api#1574) — User-row read path
	// added by the orders_v2 worker.
	MERCADOLIBRE = 'MERCADOLIBRE',
	// Stock alerts (api#1806) — fired when a sale crosses a product's stock
	// threshold. LOW_STOCK at stock <= `Product.minStock`; OUT_OF_STOCK at
	// stock <= 0. Both have User-row opt-in read paths.
	LOW_STOCK = 'LOW_STOCK',
	OUT_OF_STOCK = 'OUT_OF_STOCK',
	// Support ticket bell (api#1806) — fired on ticket create / status change.
	// User-row opt-in read path.
	SUPPORT = 'SUPPORT',
}

declare global {

	interface NotificationInterface {
		storeId: string;
		notificationId: string;
		createdAt: number;
		type: NotificationTypeEnum;
		title: string;
		orderId?: string;
		// api#1806 — click-through targets for the typed alerts: `productId` for
		// LOW_STOCK / OUT_OF_STOCK, `supportId` for SUPPORT.
		productId?: string;
		supportId?: string;
		// api#1829 — for AGENT-facing SUPPORT notifications only: the tenant store
		// the ticket belongs to, so the bell deep-links cross-tenant to
		// `/platform/support/{ticketStoreId}/{supportId}`. Absent on tenant-facing
		// SUPPORT notifications (there the recipient store IS the ticket store).
		ticketStoreId?: string;
		userId?: string;
		customerId?: string;
		read?: boolean;
		description?: string;
		// api#1382 — severity for typed notifications (e.g. AFIP_CERT_EXPIRY);
		// drives the FE icon/colour. Optional: legacy notifications omit it.
		severity?: 'info' | 'warning' | 'critical';
		details?: string;
		total?: number;
		TableName?: string;
	}

	// `Currency` (FX-rate time-series sample) moved to `currency.ts` and
	// renamed `currencyId` → `catalogId` in api#942.

}

export {}; // NOSONAR