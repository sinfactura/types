
declare global {

	interface Return {
		storeId: string;
		returnId: string;
		orderId: string;
		customerId: string;
		invoiceId?: string;
		creditNoteId?: string;

		items: ReturnItem[];

		subtotal: number;
		cost: number;
		total: number;

		reason: ReturnReason;
		notes?: string;
		userId: string;

		emitCreditNote: boolean;
		sendEmail: boolean;
		creditNoteEmitted: boolean;

		createdAt: number;
		dated: number;
	}

	interface ReturnItem {
		productId: string;
		name: string;
		sku?: string;
		quantity: number;
		price: number;
		cost: number;
		ivaType: number;
		condition: 'sellable' | 'damaged';
		restock: boolean;
	}

	type ReturnReason =
		| 'defective'
		| 'wrong_item'
		| 'damaged_shipping'
		| 'customer_changed_mind'
		| 'not_as_described'
		| 'duplicate_order'
		| 'price_adjustment'
		| 'billing_error'
		| 'other';

}

export { };
