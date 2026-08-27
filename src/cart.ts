
declare global {

	/**
	 * A cart, keyed by its OWN minted id rather than by the customer.
	 *
	 * Replaces `Basket`, which keyed one cart per customer at `BASKET#{storeId}` /
	 * `{customerId}`. `Basket` and `BasketItem` are now `@deprecated` — both front
	 * ends are cut over — but STAY published, so a stale consumer keeps compiling.
	 * New code uses `Cart` and `CartLine`.
	 */
	interface Cart {
		// CART000001 — minted through the atomic counter. Gaps are contractual and
		// never reused.
		cartId: string;
		storeId: string;
		// An ATTRIBUTE now, not the SK, and indexed by the existing PK-customerId
		// GSI. Optional because a parked POS ticket has no customer attached yet.
		customerId?: string;
		customer?: Partial<Customer>;
		channel: 'pos' | 'web';
		// The till holding a parked POS ticket. Populated by the park/resume pair.
		//
		// Opaque to the server: it is validated only as /^[A-Za-z0-9_-]{1,64}$/ and
		// used as the partition key of the sparse PK-terminalId GSI, which is what
		// makes "list this till's held tickets" a query rather than a store-wide
		// scan. Nothing derives meaning from its value, enumerates known terminals,
		// or joins it to an entity — a per-device UUID and an operator-named till
		// are equally valid.
		//
		// ⚠️ Sparse, and never unset. A ticket parked with NO terminal is absent
		// from that index and unreachable by till listing. Resume does not clear
		// this either — no verb unsets it — so an active cart may still carry the
		// terminal that last held it.
		terminalId?: string;
		// The cart lifecycle. Populated by the park/resume pair ('parked' on park,
		// back to 'active' on resume) and by the abandonment sweep ('abandoned').
		status?: 'active' | 'abandoned' | 'converted' | 'parked';
		// The user who parked this ticket, for showing WHO holds it alongside which
		// till (`terminalId`).
		//
		// ⚠️ Only meaningful while `status === 'parked'` — read it gated on
		// `status`, never on its own presence. Rows parked before this field
		// existed carry nothing, and rows parked before resume began clearing it
		// can carry a stale id on an ACTIVE cart.
		parkedBy?: string;
		// When this ticket was parked, in epoch ms — the field a "held for 12
		// minutes" age is measured from.
		//
		// ⚠️ Use THIS for age, never `updatedAt`. An ordinary mutation of a parked
		// ticket (a cashier scanning another item into it) moves `updatedAt` and
		// deliberately does NOT move `parkedAt`, so an age derived from `updatedAt`
		// reports a long-held ticket as freshly parked. Set once per park and
		// cleared on resume.
		//
		// ⚠️ Same gating as `parkedBy`, and additionally absent on every ticket
		// parked before this field shipped — those are readable and resumable but
		// have no age. Render the age as unknown rather than as zero.
		parkedAt?: number;
		ttl?: number;
		// Optimistic-concurrency token, same two-way optionality as `Basket.version`:
		// omit it for an unconditional write, send it to make the write a CAS whose
		// mismatch is `409 BASKET_VERSION_CONFLICT` carrying the current row.
		// ⚠️ Unlike the legacy path there is NO expected-0 sentinel here. A client
		// cannot address a cart it has no `cartId` for, so "expected 0" has no
		// client-side meaning; existence is asserted with `attribute_not_exists(PK)`
		// against a fresh SK, which — unlike `attribute_not_exists(version)` — cannot
		// be poisoned by a stray stored attribute.
		version?: number;
		lines: CartLine[];
		/**
		 * Save-for-later: a quantity-bearing list held on the CART row, distinct from
		 * `Customer.favorites`, which is quantity-less and lives on the customer.
		 *
		 * ⚠️ OPTIONAL, and it must stay optional. This repo is forward-only and never
		 * backfills, so every row written before this shipped has no such attribute.
		 * `droppedSkus` and `availability` can be required because they are ENVELOPE
		 * keys the server rebuilds on every response; this is a STORED field, so
		 * requiring it would make the declaration lie about every existing row. Read
		 * it as `[]` when absent.
		 *
		 * ⚠️ Saved lines are NOT part of the cart's economics and never reach an
		 * order. They are excluded from `totals` (which derives only from `lines`),
		 * excluded from checkout, and excluded from the line cap — that cap is
		 * bounded by CHECKOUT, and a saved line does not check out. They DO count
		 * toward the row's byte ceiling, because they occupy the same row.
		 *
		 * ⚠️ Their `lineId`s stay live for id-allocation purposes. `lineId` is minted
		 * from the row's high-water mark precisely so a removed line's id is never
		 * reissued to a different product; if saving a line freed its id, a new line
		 * would re-mint it and a later restore would collide with a different
		 * product under the same key.
		 */
		savedLines?: CartLine[];
		totals: CartTotals;
		convertedOrderId?: string;
		createdAt: number;
		updatedAt: number;
		entityType?: string;
	}

	interface CartLine {
		// Distinct from `productId` ON PURPOSE — this is what lets the same product
		// appear twice on one cart with different notes, serials, options or gift
		// messages, which the `BasketItem` shape made impossible.
		lineId: string;
		productId: string;
		dated: number;
		sku: string;
		pictures: Product['pictures'];
		name: string;
		zone?: string;
		quantity: number;
		ivaType: number;
		cost: number;
		// The resolved unit price, in the line's own currency.
		price: number;
		// Price provenance, carried over from `BasketItem` verbatim. Do NOT rename:
		// the write path populates these and the names are the contract.
		listId?: number;
		currency?: string;
		// Self-describing currency stamp (ADR-0013): FX rate + the Unix ms it was
		// effective. PER LINE, because each line is stamped at its own re-price
		// instant — which is precisely why `CartTotals` carries no such pair.
		currencyValue?: number;
		currencyValueAt?: number;
		priceSource?: 'percent' | 'amount';
		appliedMinQty?: number;
		promoApplied?: boolean;
		basePrice?: number;
		// Reserved for cart-level discounts; nothing populates it yet.
		discount?: CartDiscount;
		// When this line was moved to `savedLines`. Set by `saveLine`, cleared by
		// `restoreLine` — present only on a line that is currently saved.
		savedAt?: number;
	}

	/**
	 * Row-level totals, replacing `Basket`'s loose `cost` / `total` / `quantity`
	 * scalars.
	 *
	 * ⚠️ There is deliberately NO `currencyValue` / `currencyValueAt` here. On
	 * `Basket` they were declared and never written — but the reason they are gone
	 * is stronger than "unwritten": a cart CANNOT HAVE one correct value for them.
	 * Lines are stamped independently at their own re-price instants, so a cart
	 * whose lines were priced ten minutes apart carries two rates and there is no
	 * principled way to pick one. The field is unrepresentable, not merely a
	 * phantom. Read the rate per line. `currency` stays: it is row-level and
	 * load-bearing, sourcing the order's currency at checkout.
	 */
	interface CartTotals {
		subtotal: number;
		// Slot reserved for cart-level discounts; 0 until then.
		discount: number;
		tax: number;
		shipping: number;
		grandTotal: number;
		currency: string;
		// ⚠️ REQUIRED, and not cosmetic: checkout copies this onto the ORDER row and
		// onto the SALE audit row. Drop it and every order created from a cart
		// records a cost of 0, silently zeroing margin reporting.
		cost: number;
		// Not read by the api. Both front ends render a cart badge from it, and it
		// is a total, so it belongs here.
		quantity: number;
	}

	interface CartDiscount {
		code?: string;
		amount: number;
		type: 'percent' | 'amount';
	}

	/**
	 * The PHYSICAL key a cart was read from.
	 *
	 * ⚠️ Exists because a re-key makes a re-derived key silently wrong rather than
	 * loudly wrong: DynamoDB's `Delete` on a key that does not exist SUCCEEDS, so a
	 * writer that rebuilds `{ PK: BASKET#{storeId}, SK: customerId }` against a row
	 * now living at `CART#{storeId}` / `{cartId}` completes, reports success, and
	 * empties nothing. Carry this from the read and use it — never re-derive.
	 */
	interface CartRef {
		// 'CART#{storeId}' | 'BASKET#{storeId}'
		PK: string;
		// '{cartId}' | '{customerId}'
		SK: string;
		// The row was read from a legacy BASKET# partition.
		legacy: boolean;
	}

	/**
	 * The request body for every cart mutation, discriminated on `mode`.
	 *
	 * Replaces the overloaded `POST /basket`, where ONE verb carried five meanings
	 * — set, sum, remove, clear, and an emergent "empty the last line and the row
	 * disappears" — distinguished only by which fields happened to be present.
	 *
	 * ⚠️ ONE schema set serves BOTH surfaces (`/baskets` on the App API and
	 * `/basket` on the Web API). That is what makes the unresolvable-product policy
	 * identical across them STRUCTURALLY, rather than two implementations that
	 * agree today. Do not fork it per surface.
	 *
	 * Constraints the type system cannot express, enforced in zod at the handler
	 * and stated here because a `.d.ts` reader has no other way to learn them:
	 * - `productId` matches `/^PROD\d{6,10}$/`; `lineId` matches `/^L\d{4,}$/`.
	 * - `quantity` is `min(0).max(1_000_000)` and is deliberately NOT an integer:
	 *   weight-priced products carry fractional quantities. The maximum is overflow
	 *   hygiene — an absurd quantity takes the running total to `Infinity` and dies
	 *   at the DynamoDB marshaller instead of at validation.
	 * - `merge.items` is `min(1).max(50)`.
	 */
	type CartActionRequest =
		| CartActionAddLine
		| CartActionChangeQuantity
		| CartActionRemoveLine
		| CartActionClear
		| CartActionMerge
		| CartActionSaveLine
		| CartActionRestoreLine;

	/**
	 * Fields common to every action.
	 *
	 * ⚠️ `version` being OPTIONAL is what lets the server deploy ahead of either
	 * front end: an FE that does not yet send it gets an unconditional write rather
	 * than a rejection. Send it to make the write a CAS whose mismatch is a `409`
	 * carrying the current row.
	 */
	interface CartActionBase {
		// Integer >= 0. Absent means an unconditional write.
		version?: number;
		idempotencyKey?: string;
	}

	/**
	 * SUMS into an existing line. Contrast `CartActionChangeQuantity`, which SETS —
	 * the split between these two is the entire point of the named-action contract.
	 */
	interface CartActionAddLine extends CartActionBase {
		mode: 'addLine';
		productId: string;
		// The ONE quantity that excludes 0: adding zero of something is not an add,
		// and removal has its own action.
		quantity: number;
		/**
		 * Targets one specific line when several share a `productId` — a state
		 * `lineId` exists to make addressable.
		 *
		 * Resolution when ABSENT is total and never errors: sum into the sole line
		 * for that product; create one if none exists; APPEND a new line if several
		 * do. Named-but-unknown is a client error, unlike a removal, which has an
		 * idempotent reading.
		 */
		lineId?: string;
		// Accepted for FE back-compat and DISCARDED — the server re-derives every
		// price. Declared rather than dropped so the next implementer does not
		// conclude it is honoured.
		price?: number;
	}

	/** SETS the line to `quantity`. A quantity of 0 removes the line. */
	interface CartActionChangeQuantity extends CartActionBase {
		mode: 'changeQuantity';
		lineId: string;
		// 0 removes. On an ALREADY-ABSENT line this is a no-op rather than an error,
		// because a removal is idempotent.
		quantity: number;
		// Accepted and DISCARDED — see `CartActionAddLine.price`.
		price?: number;
	}

	interface CartActionRemoveLine extends CartActionBase {
		mode: 'removeLine';
		lineId: string;
	}

	/**
	 * Moves an ACTIVE line to `savedLines`, keeping its quantity.
	 *
	 * A move, not a copy — the line leaves `lines`, so `totals` drop by its
	 * contribution and it can no longer be checked out.
	 */
	interface CartActionSaveLine extends CartActionBase {
		mode: 'saveLine';
		lineId: string;
	}

	/**
	 * Moves a SAVED line back into `lines`, keeping its `lineId`.
	 *
	 * ⚠️ The line is RE-PRICED on the way back, from the product row, exactly as
	 * any other write re-prices. A saved line can sit for weeks, and copying its
	 * stored stamp back into the active cart would sell at a price the catalogue
	 * no longer offers. The stored line is the source of the quantity and the id,
	 * never of the money.
	 *
	 * ⚠️ The `lineId` is KEPT rather than re-minted. It is the same line, and two
	 * lines of the same product coexisting is already supported — telling them
	 * apart is what `lineId` exists for. This is safe only because saved lines
	 * remain inside the high-water-mark computation (see `Cart.savedLines`).
	 */
	interface CartActionRestoreLine extends CartActionBase {
		mode: 'restoreLine';
		lineId: string;
	}

	/**
	 * Empties `lines` to `[]`.
	 *
	 * ⚠️ The ROW AND ITS `cartId` SURVIVE. The pre-2-F behaviour deleted the row
	 * when the last line went, which threw away the stable identity the re-key
	 * existed to mint — and made `status: 'abandoned'` unrepresentable for exactly
	 * the carts most likely to be abandoned. Physical deletion now survives only at
	 * checkout conversion and tenant purge.
	 */
	interface CartActionClear extends CartActionBase {
		mode: 'clear';
	}

	/**
	 * Bulk-folds a client-side cart into the stored one.
	 *
	 * ⚠️ Per-item quantity SUMS into the existing line, EXCEPT `0`, which sets the
	 * line to zero and removes it. An FE reading "merge sums" and sending 0
	 * expecting a no-op will remove the line instead. Two consequences fall out:
	 * intra-request dedupe happens FIRST, so a payload naming one product twice
	 * sums against itself before it sums against the stored line; and a brand-new
	 * product at quantity 0 adds nothing, being a removal of something absent.
	 */
	interface CartActionMerge extends CartActionBase {
		mode: 'merge';
		items: { productId: string; quantity: number }[];
	}

	/**
	 * The response envelope for every cart mutation.
	 *
	 * ⚠️ `droppedSkus` is a SIBLING of `data`, not a field inside it. That follows
	 * the house envelope — `{ message, data, LastEvaluatedKey?, truncated? }` — where
	 * properties of the OPERATION hang off the envelope while `data` stays the
	 * entity. Nesting the cart one level deeper would buy the same isolation while
	 * spending a convention to get it. (`mergeMeta` used to occupy this slot on
	 * this very route; it is gone, and `BasketMergeMeta` is deprecated.)
	 *
	 * ⚠️ It is REQUIRED and always present — an empty array when nothing was
	 * dropped — so an FE cannot treat it as an optional diagnostic. An unresolvable
	 * product is SOFT-DROPPED on every action, so a single-item `addLine` naming a
	 * deleted product returns 200 having done nothing, and this array is the only
	 * thing that says so.
	 *
	 * Soft-drop is uniform by design. The alternative — a hard 400, which the
	 * pre-2-F single POST did — strands a shopper behind a line whose product was
	 * deleted, unable to remove it because removing it is itself a write that
	 * re-validates the product.
	 */
	/**
	 * One cart line the store could not fully satisfy, reported AFTER the write.
	 *
	 * ⚠️ This is a READ, never a reservation, and never a refusal. The line LANDED
	 * — a `200` carrying entries means "written, with a caveat", and nothing here
	 * produces a non-2xx. That separation is load-bearing and was collapsed once
	 * already by a consumer who agreed to it in writing first: a landed
	 * `notOffered` was published under the same token that meant "the write did
	 * not land", so an operator saw a line that IS in the cart reported as one
	 * that never made it. The two conditions want the same RENDERING — both are
	 * red, both stop the cashier — which is why the contract has to keep them
	 * apart rather than trusting each consumer to.
	 *
	 * Entries appear ONLY for constrained lines. A fully available line produces
	 * none, so absence means "nothing to say" — never "in stock".
	 */
	interface CartLineAvailability {
		// The line as written. Post-write, so it names a line that exists.
		lineId: string;
		/*
		 * ⚠️ Carried even though `lineId` identifies the line, because it is the
		 * only stable key across the write. A newly created line's `lineId` did not
		 * exist before the request, so a client holding the product the operator
		 * just acted on has nothing to match `lineId` against until it has the
		 * echoed row — and that is the FIRST-add-of-a-product case, which for a
		 * shortfall warning is the common one, not the edge. Without it a consumer
		 * falls back to naming no product at all.
		 */
		productId: string;
		// The quantity now ON the line, not the increment that was requested.
		requested: number;
		/*
		 * ⚠️ Guaranteed `>= 0`, clamped server-side. Stock is advisory on this path
		 * — the write lands regardless — so the underlying figure goes negative in
		 * exactly the case this signal exists to describe, and the raw number
		 * reaches an operator as "quedan -2". `Number.isFinite(-2)` is `true`, so a
		 * finiteness check does not catch it. Clamped once here rather than in
		 * every consumer.
		 */
		available: number;
		/*
		 * ⚠️ Treat an UNRECOGNISED value as the softer case rather than discarding
		 * the entry — a reason added later must degrade, not vanish. `notOffered`
		 * is `hiddenFromStorefront` and is reported regardless of real stock.
		 */
		reason: 'insufficientStock' | 'notOffered';
	}

	interface CartActionResponse {
		message: string;
		data: Cart;
		droppedSkus: string[];
		/*
		 * ⚠️ REQUIRED and always present — an empty array when every line was
		 * satisfied — for the same reason `droppedSkus` is. A key that vanishes
		 * when empty is one no client remembers to handle.
		 *
		 * Empty ALSO when the store has stock control off (`store.config.stock`),
		 * which is not the same statement as "everything is in stock": it means the
		 * store does not track stock, so there is nothing to report. Consumers must
		 * not render an empty array as an availability guarantee.
		 */
		availability: CartLineAvailability[];
	}


}

export {}; // NOSONAR
