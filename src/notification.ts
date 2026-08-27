
// Canonical notification taxonomy. These are the exact attribute
// names the BE filter-reads on User rows (`notifications.<KEY> = true`
// DynamoDB FilterExpressions — new-order fanout, MP hook/poller/recover,
// Stripe hook, propagate-fx). Exported as a real enum so `api`
// (stacks/helpers/notificationType.ts) and `app`
// (src/domain/notificationType.ts) can drop their hand-mirrored copies
// in follow-ups. DOLARBNA / ERROR / AFIP_CERT_EXPIRY have no User-row
// read path — enum members only (AFIP_CERT_EXPIRY = the cert-expiry
// alert type).
export enum NotificationTypeEnum {
	ORDER = 'ORDER',
	MERCADOPAGO = 'MERCADOPAGO',
	STRIPE = 'STRIPE',
	DOLAROFICIAL = 'DOLAROFICIAL',
	DOLARINFORMAL = 'DOLARINFORMAL',
	DOLARBNA = 'DOLARBNA',
	ERROR = 'ERROR',
	AFIP_CERT_EXPIRY = 'AFIP_CERT_EXPIRY',
	// ML order-ingestion fanout — User-row read path
	// added by the orders_v2 worker.
	MERCADOLIBRE = 'MERCADOLIBRE',
	// Stock alerts — fired when a sale crosses a product's stock
	// threshold. LOW_STOCK at stock <= `Product.minStock`; OUT_OF_STOCK at
	// stock <= 0. Both have User-row opt-in read paths.
	LOW_STOCK = 'LOW_STOCK',
	OUT_OF_STOCK = 'OUT_OF_STOCK',
	// Support ticket bell — fired on ticket create / status change.
	// User-row opt-in read path.
	SUPPORT = 'SUPPORT',
	/**
	 * A cart the abandonment sweep flipped to `abandoned`.
	 *
	 * ⚠️ Additive: `UserNotifications` is
	 * `Partial<Record<NotificationTypeEnum, boolean>>`, so every existing
	 * preferences row stays valid and an absent key already reads as
	 * "not opted in". No consumer migration is owed.
	 *
	 * ⚠️ A cart with no `customerId` has nobody to notify — a walk-in POS
	 * ticket has no customer attribute at all, and the legacy partition
	 * flips wholesale on the sweep's first night. The producer must gate on
	 * a customer being present as well as on the cart having lines, or it
	 * writes a notification row that validates, broadcasts to nobody, and
	 * fails silently.
	 */
	ABANDONED_CART = 'ABANDONED_CART',
}

declare global {

	interface NotificationInterface {
		storeId: string;
		notificationId: string;
		createdAt: number;
		type: NotificationTypeEnum;
		title: string;
		orderId?: string;
		// Click-through targets for the typed alerts: `productId` for
		// LOW_STOCK / OUT_OF_STOCK, `supportId` for SUPPORT.
		productId?: string;
		supportId?: string;
		// For AGENT-facing SUPPORT notifications only: the tenant store
		// the ticket belongs to, so the bell deep-links cross-tenant to
		// `/platform/support/{ticketStoreId}/{supportId}`. Absent on tenant-facing
		// SUPPORT notifications (there the recipient store IS the ticket store).
		ticketStoreId?: string;
		userId?: string;
		customerId?: string;
		read?: boolean;
		description?: string;
		// Severity for typed notifications (e.g. AFIP_CERT_EXPIRY);
		// drives the FE icon/colour. Optional: legacy notifications omit it.
		severity?: 'info' | 'warning' | 'critical';
		details?: string;
		total?: number;
		/** @deprecated SQS routing input, destructured out before persistence — it never exists on stored rows or reads. Belongs on `NotificationQueueInput`. */
		TableName?: string;
	}

	/**
	 * What a producer enqueues on the notification SQS queue. The consumer
	 * destructures `TableName` for routing (it is never persisted), derives the
	 * row key, and stamps `createdAt` plus BE bookkeeping (`dated` YYYYMMDD and
	 * a DynamoDB `ttl`); `notificationId` is synthesized from the SK on reads —
	 * producers never send either.
	 */
	type NotificationQueueInput = Omit<NotificationInterface, 'notificationId' | 'createdAt' | 'TableName'> & {
		TableName: string;
	};

	// `Currency` (FX-rate time-series sample) moved to `currency.ts` and
	// renamed `currencyId` → `catalogId`.

}

export {}; // NOSONAR