
declare global {

	interface Order {
		storeId: string;
		orderId: string;
		customerId: string;
		customer: Partial<Customer>;
		createdAt: number;
		updatedAt?: number;
		readyAt?: number;
		deliveredAt?: number;
		deliveredDate?: number;
		comments?: string;
		// catalogId (api#942) — FK to PlatformCurrency.
		currency: string;
		// Self-describing currency stamp (app#1539 / ADR-0013): FX rate and
		// the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		paymentMethod: number;
		deliveryMethod: number;
		invoiceMethod?: {
			condFiscal: number;
			condFiscalName: string;
			cuit: string;
			razonSocial: string;
			// Explicit per-order ARCA receptor identity (api#1368), decoupled
			// from condFiscal. ARCA DocTipo codeset: 80 = CUIT, 96 = DNI,
			// 99 = Consumidor Final -- a SEPARATE axis from condFiscal (they
			// share the number 96 only by coincidence). When present, the
			// AFIP invoice builder uses these directly for the receptor
			// (DocTipo/DocNro) instead of deriving from condFiscal; when
			// absent, falls back to today's condFiscal-derived behavior.
			docType?: number;
			docNumber?: string; // the CUIT (11-digit + checksum) / DNI (7-8 digit) value
		};
		cost: number;
		total: number;
		discount: number;
		orderPrinted?: boolean;
		tagPrinted?: boolean;
		invoices?: Partial<Invoice>[];
		returns?: Partial<Return>[];
		disabled?: boolean;
		items: Partial<BasketItem>[];
		rating?: number;
		comment?: string;
		surveyDate?: number;
		deliveryAddress?: {
			fullName: string;
			address: string;
			phone: string;
			city: string;
			province: string;
			postalCode: string;
		};
		// DYNAMIC QR cache (api#884) — present when an MP dynamic QR is
		// currently issued for this order. Cleared lazily on payment received.
		mercadopago?: {
			dynamicQr?: {
				qrData: string;             // raw EMVCo string (FE renders to QR image)
				inStoreOrderId: string;     // MP's id for the in-store order — handle for cancel/refresh
				posId: string;              // dynamic POS that minted this QR
				externalReference: string;  // = orderId
				amount: number;             // smallest currency unit (centavos)
				currency: string;
				expiresAt: number;          // unix ms
				createdAt: number;          // unix ms
			};
		};
		// Denormalized linked-payment metadata, keyed by paymentId so DELETE is
		// `REMOVE linkedPayments.#pid` (atomic, race-safe) instead of array
		// splice (api#981).
		linkedPayments?: Record<string, LinkedPaymentEntry>;
		// Sales-channel tag (app#797 / ADR-0018 Decision 1) — absent means the
		// order originated in SINFACTURA itself. Channel-tagged orders flow
		// through the SAME AFIP/stock/reporting pipelines, no parallel
		// collection.
		channel?: OrderChannel;
		// Provider sub-record for `channel: 'meli'` orders (api#1574).
		mercadolibre?: OrderMercadolibre;
	}

	type OrderChannel = 'meli';

	// ML-side identity + ingest-stamped provider data for a channel-tagged
	// order. Billing fields persist the RAW two-step billing-info v2 values
	// (`invoice_type` no longer exists on the wire) — the Factura A/B
	// mapping is the auto-invoice hook's job (api#1576). All PII.
	interface OrderMercadolibre {
		mlOrderId: string;
		packId?: string; // group unit — fiscal_documents upload target.
		buyerNickname?: string;
		shipmentId?: string;
		// e.g. 'fulfillment' (Full — stock mirror-only, never restock locally),
		// 'cross_docking', 'self_service'.
		logisticType?: string;
		items?: OrderMercadolibreItem[];
		// Marketplace fees stamped at ingest, self-describing per ADR-0013 —
		// feeds order-detail net proceeds + margin analytics (app#1934).
		fees?: {
			saleFee?: number;
			shippingCostSeller?: number;
			currency: string; // catalogId
			currencyValue?: number;
			currencyValueAt?: number;
		};
		// Raw billing-info v2 fields (GET /orders/billing-info/MLA/{id}) —
		// feeds the missing-CUIT-for-A discrepancy badge (app#1257).
		billingInfo?: {
			docType?: string; // identification.type — 'CUIT' | 'DNI' | 'CUIL' | ...
			docNumber?: string;
			custType?: 'CO' | 'BU'; // consumer | business
			taxpayerType?: string;
			iibbNumber?: string; // taxes.iibb_number
		};
	}

	// Line-level ML identity + stock provenance (order_items[].stock[]),
	// persisted for the multi-warehouse foundation + Full no-decrement rule.
	interface OrderMercadolibreItem {
		mlItemId: string;
		variationId?: string;
		userProductId?: string; // UP-variant identity (User Products migration).
		sellerSku?: string;
		quantity: number;
		stock?: {
			mlStoreId?: string; // ML store_id of the fulfilling location.
			networkNodeId?: string; // multi-origin network node.
		}[];
	}

	interface LinkedPaymentEntry {
		source: 'mp' | 'stripe' | 'mp_movement';
		total: number;
		linkedAt: number;
	}

	interface ZebraTag {
		orderId: string;
		fullName: string;
		phone: string;
		address: string;
		city: string;
		quantity: number;
		comments: string;
		sender: {
			razonSocial: string;
			cuit: string;
			phone: string;
			address: string;
			city: string;
			postalCode: string;
			province: string;
		};
	}

}

export {}; // NOSONAR