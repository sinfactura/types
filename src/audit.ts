
declare global {

	interface OrderAudit {
		storeId: string;
		auditId: string;
		orderId: string;
		userId: string;
		fullName?: string;
		action: OrderAuditAction;
		createdAt: number;
		dated: number;

		changes?: OrderAuditChange[];

		itemChanges?: {
			added: Partial<BasketItem>[];
			removed: Partial<BasketItem>[];
			modified: Array<{
				productId: string;
				name?: string;
				oldQuantity: number;
				newQuantity: number;
				oldPrice: number;
				newPrice: number;
			}>;
		};

		oldTotal?: number;
		newTotal?: number;

		returnId?: string;
	}

	interface OrderAuditChange {
		field: string;
		oldValue: unknown;
		newValue: unknown;
	}

	type OrderAuditAction =
		| 'order_created'
		| 'order_edited'
		| 'order_ready'
		| 'order_delivered'
		| 'order_delivery_cancelled'
		| 'order_disabled'
		| 'order_enabled'
		| 'order_returned'
		| 'discount_changed'
		| 'payment_method_changed'
		| 'delivery_method_changed'
		| 'delivery_address_changed'
		| 'invoice_created'
		| 'credit_note_created';

}

export {}; // NOSONAR