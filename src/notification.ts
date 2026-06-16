
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
}

declare global {

	interface NotificationInterface {
		storeId: string;
		notificationId: string;
		createdAt: number;
		type: NotificationTypeEnum;
		title: string;
		orderId?: string;
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