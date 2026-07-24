
declare global {

	interface Product {
		storeId: string;
		productId: string;
		createdAt: number;
		updatedAt: number;
		disabled: boolean;
		search: string;
		// BASE
		sku: string;
		name: string;
		description?: string;
		pictures?: {
			url: string;
			base64?: string;
			primary?: boolean;
		}[];
		stock: number;
		// api#1806 — per-product low-stock threshold. A sale that crosses `stock`
		// down to <= minStock fires a LOW_STOCK notification (unset => no
		// LOW_STOCK; OUT_OF_STOCK at stock <= 0 fires regardless).
		minStock?: number;
		limit?: number;
		incomes?: {
			stockId: string;
			orderId?: string; // when we put items trough a buy order
			supplierName?: string;
			quantity: number;
			cost: number;
		}[];
		sales?: {
			stockId: string;
			orderId: string;
			fullName: string;
			quantity: number;
			price: number;
		}[];
		totalIncomes?: number;
		totalSales?: number;
		zone?: string;

		// OPTIONS
		// catalogId (api#942) — FK to PlatformCurrency. Was a
		// tenant-local integer; now resolves via the catalog directly.
		currency: string;
		// Self-describing currency stamp (app#1539 / ADR-0013): FX rate and
		// the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		ivaType: number;
		categoryId: string;
		brandId: string;
		// READ-PROJECTION of "any slot has an active promo" — never authored. (#1780)
		inOffer: boolean;
		isNew: boolean;
		isService: boolean;

		// PRICES
		cost: number;
		// Canonical pricing (A-prime, #1780). Operators author ONLY this. The
		// materialized price1..4 shim was removed end-of-epic; all consumers
		// read `prices[]` directly. See ADR-0014.
		prices?: PriceSlot[];

		// Per-channel listing links (app#797 / ADR-0018 Decision 1), keyed by
		// channel id (`'meli'` today) so DELETE/SET are atomic map ops.
		channels?: Record<string, ProductChannelMapping>;

		// BARCODES (app#840/#841 model, shipped BE-first via api#1653). All
		// optional/additive. `barcodePrimary` denormalizes the isPrimary
		// entry's value for the `PK-barcodePrimary` lookup GSI + search.
		barcodes?: ProductBarcode[];
		barcodePrimary?: string;

		// VARIANTS (api#1653 Part B, fields only — the ML family fan-out is a
		// follow-up). Sibling Products sharing a variantGroupId form one
		// catalog family; each row keeps its own stock/prices. Distinct from
		// channels.mercadolibre.familyId (ML-ASSIGNED cluster, post-publish).
		variantGroupId?: string;
		// Differentiating attributes for family clustering (maps to ML
		// PARENT_PK/CHILD_PK — e.g. { id: 'COLOR', value: 'Negro' }).
		variantAttributes?: { id: string; value: string }[];

		// Manufacturer model — feeds channel attributes (ML MODEL) (api#1653).
		model?: string;

		// AI ENRICHMENT (api#1768). Optional/additive, operator-authored — set
		// via the suggestion-only enrichment endpoint's write-through on accept.
		// `attributes` is descriptive product metadata and is DISTINCT from
		// `variantAttributes` above (which clusters variant families). `evidence`
		// is a verbatim source-quote provenance for an attribute; it is
		// operator-only and MUST be stripped from any customer-facing projection.
		seoTitle?: string;
		seoDescription?: string;
		attributes?: { name: string; value: string; evidence?: string }[];
	}

	// One barcode on a product (app#841 design). `type` follows GS1 naming;
	// 'internal' = store-generated EAN-13 in the 20-29 prefix range.
	interface ProductBarcode {
		value: string;
		type: 'EAN13' | 'EAN8' | 'UPC' | 'GTIN14' | 'CODE128' | 'internal';
		isPrimary?: boolean;
		// Units per scan — a pack barcode can represent N sellable units.
		packSize?: number;
		source?: 'manual' | 'import' | 'generated';
	}

	type ProductChannelStatus =
		| 'linked' // live listing bound to this product
		| 'pending' // publish/link in flight
		| 'paused' // listing paused on the channel
		| 'rejected' // channel rejected the publish (Rechazadas) — see syncErrors
		| 'unlinked'; // explicitly detached; kept for history

	// One product↔listing link. For UP-migrated sellers the UP-variant is
	// the unit (api#1575/#1577) — `externalId` alone can't express it.
	interface ProductChannelMapping {
		externalId?: string; // ML item id (e.g. 'MLA123...').
		userProductId?: string; // UP-variant identity.
		familyId?: string; // ML-assigned variant cluster.
		variationId?: string; // legacy (non-UP) variation id.
		status: ProductChannelStatus;
		linkedAt?: number;
		lastSyncedAt?: number;
		// How the link was established: auto-match basis or manual.
		basis?: MlMatchBasis | 'manual';
		// Raw channel error causes (e.g. ML `cause[]`) for the rejected state.
		syncErrors?: string[];
		// UP-aware MercadoLibre stock regime (api#1635): classic single-SKU
		// listing vs. coexistence with a legacy pub, vs. multi-origin/UP-managed
		// — lets the FE render per-channel regime state without re-deriving it
		// from raw ML fields (api#1649).
		regime?: 'classic' | 'coexistence' | 'multi-origin';
		// Whether outbound stock sync should mirror the channel's own count
		// (e.g. Full fulfillment) rather than push local stock (api#1649).
		stockMirrorOnly?: boolean;
	}

}

export {}; // NOSONAR