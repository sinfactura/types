
declare global {

	/** Write shape for product create/update — carries the transient picture-removal control. */
	type ProductUpsertInput = Partial<Product> & {
		/** Request-only: pictures to delete; the BE removes them from storage and from `pictures[]`. */
		removePictures?: { url: string }[];
	};

	/**
	 * The surfaces a product can be sold on. Deliberately a CAPABILITY list on
	 * `Product.sellableOn` rather than an enum, so a product can be sellable on
	 * any subset — `['service','counter']` (a part you fit AND sell over the
	 * counter) is the normal case in a repair shop, and an enum forbids it.
	 *
	 * - `storefront` — the public e-commerce checkout.
	 * - `counter` — the operator/POS checkout.
	 * - `service` — parts and labour consumed by a service-order delivery.
	 * - `marketplace` — external channels (MercadoLibre today), which have never
	 *   had a server-side sellability predicate at all.
	 *
	 * ⚠️ ADDING a member here is fail-closed by construction: a row carrying an
	 * explicit list does not gain the new channel, and every api call site that
	 * passes a `SaleChannel` literal must be revisited for the compiler to stay
	 * green. That is the point — the build breaks at the un-migrated site instead
	 * of one of them silently defaulting.
	 */
	type SaleChannel = 'storefront' | 'counter' | 'service' | 'marketplace';

	/**
	 * Movement-value class in an ABC analysis: `A` is the small share of products
	 * carrying most of the value that moves, `C` the long tail carrying little.
	 *
	 * Three members, and closed. The letters are the vocabulary every operator and
	 * every inventory text already shares, which is the point — a fourth class
	 * would have no agreed meaning outside this codebase, and a numeric score
	 * would move the decision about where to cut the bands from the job that has
	 * the sales data into whatever consumer reads the number.
	 *
	 * ⚠️ The class says nothing about MARGIN or importance — a cheap fast-moving
	 * consumable outranks an expensive slow one. Do not gate merchandising or
	 * pricing decisions on it; it is a counting-frequency and attention signal.
	 */
	type ABCClassification = 'A' | 'B' | 'C';

	interface Product {
		storeId: string;
		productId: string;
		createdAt: number;
		updatedAt: number;
		disabled: boolean;
		/**
		 * Storefront VISIBILITY. Independent of `disabled`: `disabled` means
		 * soft-deleted, gone everywhere (operator pickers included); this means
		 * "real and stocked, just not offered on the storefront" — a repair shop's
		 * spare parts, ingredients, internal-use items. Defaults to visible
		 * (`undefined`/`false`); operator-side READS (pickers, stock reports,
		 * service parts, search) are UNAFFECTED and keep seeing it regardless
		 * of this flag.
		 *
		 * ⚠️ It is NOT read-only, and that is the half the name hides: it also
		 * REFUSES THE SALE with a 409 `PRODUCT_NOT_AVAILABLE` — but only as the
		 * DERIVATION SOURCE now, never directly. The api's shared eligibility
		 * pass is `findIneligibleProductIds` (`stacks/helpers/saleEligibility.ts`),
		 * it resolves `sellableOn` rather than reading this flag, and it binds
		 * four order paths, each passing its own channel literal: the operator/POS
		 * checkout and `POST /orders mode=edit` (`'counter'`), the storefront
		 * checkout (`'storefront'`), and service-order delivery (`'service'`).
		 * Cite the SYMBOL, not a line — the pass moved once already and every line
		 * number this docblock used to carry sent a reader to nothing.
		 *
		 * The consequence for a LEGACY row is unchanged and deliberately so: with
		 * no `sellableOn`, hidden still derives to "sellable nowhere", so such a
		 * product remains unsellable at the counter too. That was rarely what the
		 * operator meant, and it is the whole reason `sellableOn` exists — but the
		 * fix is to WRITE the capability list, never to reinterpret this flag.
		 *
		 * `sellableOn` SUPERSEDES this flag for SELLABILITY: read it, not this, to
		 * answer "may this be sold here". `hiddenFromStorefront` keeps owning
		 * VISIBILITY — the public catalogue, the direct-link 404 and the shopper
		 * broadcast suppression — and stays the derivation source for a row that
		 * carries no explicit `sellableOn`.
		 */
		hiddenFromStorefront?: boolean;
		/**
		 * Per-channel sellability — the capability list that supersedes
		 * `hiddenFromStorefront` for "may this be sold here". Says nothing about
		 * VISIBILITY, which stays that flag's job.
		 *
		 * Three cases, all three load-bearing and distinct:
		 *
		 * 1. **Absent** ⇒ DERIVED from `hiddenFromStorefront`: `[]` when hidden,
		 *    every channel otherwise. This is the forward-only rule — every row
		 *    written before this field existed keeps its exact current behaviour,
		 *    and nothing is backfilled. The derivation belongs to ONE exported
		 *    resolver in the api; a call site that reimplements
		 *    `sellableOn?.includes(…)` inline reopens the divergence this field was
		 *    shaped to close.
		 * 2. **`[]`** ⇒ sellable NOWHERE. A legal explicit value, and NOT the same
		 *    thing as absent: absent means "pre-model row, ask the old flag",
		 *    `[]` means "the merchant said no everywhere". A reader that collapses
		 *    the two with `?.length ? … : ALL` makes an explicit refusal sell
		 *    everywhere.
		 * 3. A channel **added to the union later** is NOT retroactively granted to
		 *    a row that already carries an explicit list — absence from the list is
		 *    "the merchant has not said yes", so a new channel starts closed. This
		 *    is the property that makes the shape fail closed, and it is why a list
		 *    beat an enum: an enum re-interprets every stored member each time a
		 *    channel is added.
		 *
		 * The channel is a CALL-SITE constant, never a request parameter — a
		 * client-supplied channel would be a straight authorization hole, since any
		 * caller could claim `'counter'`.
		 *
		 * Orthogonal to `isService`, which is a stock-and-fiscal property (no stock
		 * decrement, ARCA `Concepto`, service period). A repair part is an ORDINARY
		 * product — `isService: false`, real `stock`, real `cost` — holding
		 * `sellableOn: ['service']`. "Part" is a capability, not a third kind.
		 *
		 * ⚠️ Clearing this on the api needs `removeAttributes`, not
		 * `fields: { sellableOn: undefined }`, which `dynamoUpdate` silently drops.
		 * Writers should always write the full list.
		 */
		sellableOn?: SaleChannel[];
		/**
		 * Lowercase '#'-joined index the api maintains on every write.
		 *
		 * UNLIKE the same-named field on the other entities (where it is internal
		 * and stripped at the wire boundary), this one is genuinely part of the
		 * product read contract: `GET /products` returns it and the app filters
		 * its product pickers on it client-side, so stripping it empties every
		 * local product search. Optional because legacy rows predate it.
		 */
		search?: string;
		// BASE
		sku: string;
		name: string;
		description?: string;
		pictures?: {
			url: string;
			base64?: string;
			primary?: boolean;
		}[];
		/** @deprecated Request-only control, never persisted or returned — use `ProductUpsertInput.removePictures`. */
		removePictures?: {
			url: string;
		}[];
		stock: number;
		// Per-product low-stock threshold. A sale that crosses `stock`
		// down to <= minStock fires a LOW_STOCK notification (unset => no
		// LOW_STOCK; OUT_OF_STOCK at stock <= 0 fires regardless).
		minStock?: number;
		/**
		 * Reorder point — the on-hand level at which a REPLENISHMENT should be
		 * raised, in units.
		 *
		 * ⚠️ It sits BESIDE `minStock` and does not rename, replace or reinterpret
		 * it. `minStock` is the edge-triggered alert threshold the backend already
		 * acts on; this is the planning figure a replenishment suggestion is
		 * computed from, and the two are normally different numbers because they
		 * answer different questions ("tell me it got low" vs "buy now or you will
		 * run out before the goods land"). A consumer that aliases them re-points a
		 * live notification at a planning number.
		 *
		 * ⚠️ NOT related to `limit`, which is a per-sale unit cap — how many of this
		 * product one customer may buy at once. It is not a stock threshold, has
		 * never been compared against `stock`, and the similar shape of the two
		 * numbers is the whole reason to say so here.
		 *
		 * ⚠️ Nothing derives this. Absence means no reorder point has been set, which
		 * is every row today — never zero, and never "reorder immediately".
		 */
		reorderPoint?: number;
		/**
		 * Buffer units held against demand and lead-time variability — the part of
		 * `reorderPoint` that is not expected consumption during the lead time.
		 *
		 * Stored rather than derived because the operator is allowed to override it:
		 * a formula cannot know that a supplier is unreliable this quarter, and an
		 * override that a recomputation silently discards is worse than no field.
		 */
		safetyStock?: number;
		/**
		 * Days between raising a replenishment and the goods being sellable —
		 * ORDER to SHELF, not order to dispatch. Receiving, inspection and putaway
		 * are inside it; a lead time that stops at the supplier's door understates
		 * the reorder point by exactly the part of the delay the store controls.
		 *
		 * Per-product rather than per-supplier because one supplier ships different
		 * goods at different speeds, and the reorder arithmetic is per-product.
		 */
		leadTimeDays?: number;
		/**
		 * Target probability of NOT stocking out during a replenishment cycle — the
		 * service level the safety stock is sized for.
		 *
		 * ⚠️ **A FRACTION in `[0, 1]`, never a percentage.** `0.95` is a 95% target;
		 * `95` is not a legal value. Both encodings look plausible to a reader and
		 * both are numbers, so nothing catches the confusion — but the safety-stock
		 * figure it feeds is off by orders of magnitude when it is guessed wrong.
		 * Validate the range at the wire boundary; the type cannot.
		 *
		 * ⚠️ `1` is not attainable and must be refused rather than clamped: perfect
		 * availability implies unbounded stock, and a silent clamp hides that the
		 * operator asked for something impossible.
		 */
		serviceLevel?: number;
		/**
		 * Whether receipts and outflows of this product are attributed to a `Lot`.
		 *
		 * ⚠️ Turning it ON is not retroactive. Units already on hand arrived on
		 * movement rows carrying no `lotId`, this platform never backfills, and
		 * nothing will invent a batch for them — so immediately after the flag is
		 * set the lots sum to LESS than `stock`, permanently, by exactly the
		 * pre-existing quantity. That gap is expected and is not data loss.
		 *
		 * ⚠️ It is a DECLARATION, not an enforcement. The flag does not make a
		 * writer stamp a `lotId`, and an outflow can always be un-attributable in
		 * practice (mixed shelf stock, an unreadable carton). Any refusal to sell
		 * un-attributed units is a handler decision, never something a reader may
		 * assume from this flag.
		 */
		lotTracking?: boolean;
		/**
		 * Movement-value class assigned by the periodic classification job — the
		 * few products worth counting often (`A`) against the many worth counting
		 * rarely (`C`).
		 *
		 * ⚠️ JOB-WRITTEN, not operator-authored. An operator edit is overwritten on
		 * the next run without warning, so a UI must not offer it as a field to
		 * type into; if a human classification is ever wanted it needs its own
		 * field, and a pin flag to stop the job.
		 *
		 * ⚠️ Absence means UNCLASSIFIED — a product the job has never seen, or a
		 * store where the job has never run. It is emphatically not `C`. Defaulting
		 * it to `C` puts every brand-new product into the count-rarely bucket, which
		 * is where a new fast-moving line least belongs.
		 */
		abcClass?: ABCClassification;
		/**
		 * Unix ms `abcClass` was last computed.
		 *
		 * A class with no timestamp cannot be told apart from a class that was right
		 * a year ago, and the ranking it encodes is a statement about a trailing
		 * window of sales — it decays. Read this before acting on `abcClass`;
		 * absence alongside a present `abcClass` means the stamp predates this
		 * field, not that the class is fresh.
		 */
		abcClassifiedAt?: number;
		limit?: number;
		incomes?: {
			stockId: string;
			// Present on a RETURN-sourced income: the SALES order the units came
			// back from. The purchase path does not set it.
			orderId?: string;
			// Set when this income is a customer return rather than a purchase —
			// the purchase-vs-return discriminator.
			returnId?: string;
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
		// Singular, matching the only writer (products/_post.ts increments
		// `totalIncome`). Published as `totalIncomes` up to 1.10.10, which no
		// row has ever carried.
		totalIncome?: number;
		totalSales?: number;
		zone?: string;

		// OPTIONS
		// catalogId — FK to PlatformCurrency. Was a
		// tenant-local integer; now resolves via the catalog directly.
		currency: string;
		// Self-describing currency stamp (ADR-0013): FX rate and
		// the Unix ms at which it was effective.
		currencyValue?: number;
		currencyValueAt?: number;
		ivaType: number;
		categoryId: string;
		brandId: string;
		// ⚠️ Intended as a READ-PROJECTION of "any slot has an active promo",
		// but the api implements NO derivation: the value is accepted
		// from the client on POST/import and persisted verbatim, and nothing
		// recomputes it when a promo window opens or expires. Optional because
		// no writer guarantees it. Do not gate promo UI on it until the
		// projection actually exists — read `prices[].promo` instead.
		inOffer?: boolean;
		isNew: boolean;
		isService: boolean;

		// PRICES
		cost: number;
		// Canonical pricing (A-prime). Operators author ONLY this. The
		// materialized price1..4 shim was removed end-of-epic; all consumers
		// read `prices[]` directly. See ADR-0014.
		prices?: PriceSlot[];

		// Per-channel listing links (ADR-0018 Decision 1), keyed by
		// channel id (`'meli'` today) so DELETE/SET are atomic map ops.
		channels?: Record<string, ProductChannelMapping>;

		// BARCODES (model, shipped BE-first). All
		// optional/additive. `barcodePrimary` denormalizes the isPrimary
		// entry's value for the `PK-barcodePrimary` lookup GSI + search.
		barcodes?: ProductBarcode[];
		barcodePrimary?: string;

		// VARIANTS (Part B, fields only — the ML family fan-out is a
		// follow-up). Sibling Products sharing a variantGroupId form one
		// catalog family; each row keeps its own stock/prices. Distinct from
		// channels.mercadolibre.familyId (ML-ASSIGNED cluster, post-publish).
		variantGroupId?: string;
		// Differentiating attributes for family clustering (maps to ML
		// PARENT_PK/CHILD_PK — e.g. { id: 'COLOR', value: 'Negro' }).
		variantAttributes?: { id: string; value: string }[];

		// Manufacturer model — feeds channel attributes (ML MODEL).
		model?: string;

		// AI ENRICHMENT. Optional/additive, operator-authored — set
		// via the suggestion-only enrichment endpoint's write-through on accept.
		// `attributes` is descriptive product metadata and is DISTINCT from
		// `variantAttributes` above (which clusters variant families). `evidence`
		// is a verbatim source-quote provenance for an attribute; it is
		// operator-only and MUST be stripped from any customer-facing projection.
		seoTitle?: string;
		seoDescription?: string;
		attributes?: { name: string; value: string; evidence?: string }[];
	}

	// One barcode on a product. `type` follows GS1 naming;
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
	// the unit — `externalId` alone can't express it.
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
		// UP-aware MercadoLibre stock regime: classic single-SKU
		// listing vs. coexistence with a legacy pub, vs. multi-origin/UP-managed
		// — lets the FE render per-channel regime state without re-deriving it
		// from raw ML fields.
		regime?: 'classic' | 'coexistence' | 'multi-origin';
		// Whether outbound stock sync should mirror the channel's own count
		// (e.g. Full fulfillment) rather than push local stock.
		stockMirrorOnly?: boolean;
		// Public listing URL (ML `GET /items/{id}`.permalink), persisted on link
		// success and backfilled for pre-existing links. A real
		// Product field (unlike the three below), so it round-trips untouched.
		permalink?: string;
		// Read-time-only enrichment sourced from the ML_ITEM webhook cache
		// — mirrors the regime/stockMirrorOnly precedent above.
		// NEVER persisted on Product; merged onto the response the same way.
		listingPrice?: number;
		listingStock?: number;
		mlStatus?: string;
		// Per-publication OUTBOUND price controls, read from the same ML_ITEM
		// pointer row as the three fields above — but the opposite direction and
		// a different trust level. `listingPrice`/`listingStock`/`mlStatus` are an
		// inbound cache of what ML last reported and may be stale; these two are
		// what the operator SET, so they are authoritative and a control bound to
		// them renders the real server state rather than optimistic local state.
		//
		// Both absent means "behave as before": `pricePaused` undefined is not
		// paused, and `priceListId` undefined defers to the store default. Neither
		// is persisted on Product — read-time enrichment only, like the three
		// above. Written by `POST /mercadolibre/products/{productId}/price-sync`.
		//
		// ⚠️ `pricePaused` holds PRICE pushes for this one publication; stock keeps
		// flowing. It is not the store-wide `syncPolicy.paused`, which freezes both
		// kinds for every publication at once.
		pricePaused?: boolean;
		priceListId?: number;
	}

}

export {}; // NOSONAR