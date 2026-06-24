
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

	/** One ARCA fiscal SOAP interaction (FECAESolicitar | FECompConsultar). Stored raw (CUIT unmasked) for 10y; masked at read. */
	interface FiscalAuditEvent {
		/** Schema version for forward-compat (start at 1). */
		schema_version: number;
		/** Unique id for this interaction (uuid). */
		event_id: string;
		/** Owning tenant store id, e.g. STO002. Partition-scoping key. */
		tenant_store_id: string;
		/** Unix ms when the interaction completed. */
		ts: number;
		/** Which ARCA fiscal op. */
		operation: 'FECAESolicitar' | 'FECompConsultar';
		/** Issuer CUIT (RAW — masked only at display). */
		cuit: string;
		/** AFIP environment the call hit. */
		environment: 'homologacion' | 'produccion';
		/** Sales point + voucher type + number when known. */
		salesPoint?: number;
		voucherType?: number;
		voucherNumber?: number;
		/** Internal invoice id correlation (INV000123) when available. */
		invoiceId?: string;
		/** Outcome of the interaction. */
		outcome: 'authorized' | 'rejected' | 'unresolved' | 'queried';
		/** CAE + expiry on success. */
		cae?: string;
		caeExpiration?: string;
		/** Raw ARCA Errores[]/Observaciones[] passthrough (no flattening). */
		errores?: { code: number; msg: string }[];
		observaciones?: { code: number; msg: string }[];
		/** Wall-clock duration of the SOAP call in ms. */
		durationMs: number;
		/** Full request args + response body (raw), for the regulator record. */
		requestPayload: Record<string, unknown>;
		responsePayload: Record<string, unknown>;
	}

}

export {}; // NOSONAR