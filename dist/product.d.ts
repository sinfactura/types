declare global {
    /** Write shape for product create/update — carries the transient picture-removal control. */
    type ProductUpsertInput = Partial<Product> & {
        /** Request-only: pictures to delete; the BE removes them from storage and from `pictures[]`. */
        removePictures?: {
            url: string;
        }[];
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
        /**
         * Unix ms of the last movement that CREDITED this product's stock — a
         * receipt, a restock on a return or cancellation, a positive adjustment, or
         * a MercadoLibre sale being retracted.
         *
         * ⚠️ Absence means NO RECORDED INBOUND, not "never received". The three
         * `last*At` stamps are forward-only: nothing backfills them, so a product
         * whose last receipt predates the stamp reads as absent forever. A reader
         * that treats absence as "very old" is right about the aging question and
         * wrong about the audit one — never present it as a date.
         */
        lastInboundAt?: number;
        /**
         * Unix ms of the last movement that DEBITED this product — a sale, a service
         * part consumed, an edit that increased a line, or a negative adjustment.
         *
         * ⚠️ **This, not `lastMovementAt`, is what a dead-stock report ages on.** A
         * receipt does not make stock young: a product nobody has bought for a year
         * is dead stock whether or not a case of it arrived last week, and bucketing
         * on last movement would file exactly that case as fresh. `lastMovementAt`
         * answers a different question — when did this row's stock last change at
         * all — which is the one an audit or a reconciliation asks.
         *
         * ⚠️ A SERVICE line stamps this while moving no stock. `lastOutboundAt` means
         * "last sold or consumed", not "last decremented", so a service product that
         * carries no stock still records when it was last billed.
         *
         * ⚠️ Forward-only, like its two siblings — see `lastInboundAt`.
         */
        lastOutboundAt?: number;
        /**
         * Unix ms of the most recent movement in either direction — the max of
         * `lastInboundAt` and `lastOutboundAt` as of the last write.
         *
         * Stored rather than derived so a catalogue-wide "what has moved since X"
         * is one projection instead of a per-row comparison, and so a reader that
         * wants only recency does not have to know which stamps exist.
         *
         * ⚠️ Read the `lastOutboundAt` docblock before reaching for this one: for
         * dead stock it is the WRONG field, and it is the more obvious of the two.
         */
        lastMovementAt?: number;
        /**
         * Shipping weight, in GRAMS.
         *
         * ⚠️ **The unit is in the name because a bare `weight` is unrecoverable.**
         * Grams and kilograms are both plausible readings of the same number, both
         * numeric, and nothing downstream can tell them apart — so the error is three
         * orders of magnitude and it renders without complaint. Do not add a separate
         * unit column either: a unit field is a second thing to get wrong, and it can
         * disagree with the value it describes. A carrier payload wanting kilograms
         * converts once at its own boundary.
         *
         * Integer-valued in practice; sub-gram precision is not meaningful for
         * shipping and no consumer should assume it. Bound it at the wire — a
         * negative weight is not a value, and an implausibly large one is the tell
         * for exactly the unit confusion above.
         *
         * ⚠️ Absence means UNMEASURED, never zero. A zero-weight product would quote
         * a shipping cost of nothing; an absent one must refuse to quote at all.
         */
        weightGrams?: number;
        /**
         * Longest edge of the product's shipping envelope, in MILLIMETRES.
         *
         * ⚠️ Same naming rule as `weightGrams`, for the same reason — see its note.
         * The three dimensions carry no declared orientation beyond this one being
         * the longest; a packing algorithm that needs a specific axis must not infer
         * it from the field names.
         *
         * ⚠️ Absence means UNMEASURED. All three of `lengthMm`/`widthMm`/`heightMm`
         * are independently optional, so a partially-measured product is
         * representable — and a volumetric calculation must check for all three
         * rather than defaulting a missing one to zero, which would silently produce
         * a volume of nothing.
         */
        lengthMm?: number;
        /** Second edge of the shipping envelope, in MILLIMETRES. See {@link Product.lengthMm}. */
        widthMm?: number;
        /** Third edge of the shipping envelope, in MILLIMETRES. See {@link Product.lengthMm}. */
        heightMm?: number;
        limit?: number;
        incomes?: {
            stockId: string;
            orderId?: string;
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
        totalIncome?: number;
        totalSales?: number;
        zone?: string;
        currency: string;
        currencyValue?: number;
        currencyValueAt?: number;
        ivaType: number;
        categoryId: string;
        brandId: string;
        inOffer?: boolean;
        isNew: boolean;
        isService: boolean;
        cost: number;
        prices?: PriceSlot[];
        channels?: Record<string, ProductChannelMapping>;
        barcodes?: ProductBarcode[];
        barcodePrimary?: string;
        variantGroupId?: string;
        variantAttributes?: {
            id: string;
            value: string;
        }[];
        model?: string;
        seoTitle?: string;
        seoDescription?: string;
        attributes?: {
            name: string;
            value: string;
            evidence?: string;
        }[];
    }
    interface ProductBarcode {
        value: string;
        type: 'EAN13' | 'EAN8' | 'UPC' | 'GTIN14' | 'CODE128' | 'internal';
        isPrimary?: boolean;
        packSize?: number;
        source?: 'manual' | 'import' | 'generated';
    }
    type ProductChannelStatus = 'linked' | 'pending' | 'paused' | 'rejected' | 'unlinked';
    interface ProductChannelMapping {
        externalId?: string;
        userProductId?: string;
        familyId?: string;
        variationId?: string;
        status: ProductChannelStatus;
        linkedAt?: number;
        lastSyncedAt?: number;
        basis?: MlMatchBasis | 'manual';
        syncErrors?: string[];
        regime?: 'classic' | 'coexistence' | 'multi-origin';
        stockMirrorOnly?: boolean;
        permalink?: string;
        listingPrice?: number;
        listingStock?: number;
        mlStatus?: string;
        pricePaused?: boolean;
        priceListId?: number;
    }
}
export {};
