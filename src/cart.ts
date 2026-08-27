
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
		/**
		 * CART000001 — minted through the atomic counter. Gaps are contractual and
		 * never reused.
		 *
		 * ⚠️ OPTIONAL, and permanently so. A LEGACY `BASKET#{storeId}` row is keyed
		 * by customerId and carries no `cartId` attribute at all; the migration is
		 * forward-only with a tolerant reader, so those rows are never rewritten
		 * and this is not a window that closes. `hydrateCart` returns them with the
		 * key absent, and on a live store they are still the MAJORITY of rows.
		 *
		 * ⚠️ Declaring it required was not cosmetic. `getRowId={(row) => row.cartId}`
		 * is the natural reading of a required field, and a MUI DataGrid THROWS
		 * rather than warns on an undefined row id — so the obvious client
		 * implementation broke the cart list for every store that had not yet
		 * written a cart under the new key, while `tsc` believed the field was a
		 * string on every row. Fall back to `customerId` for identity, or to `ref`
		 * for the physical key.
		 */
		cartId?: string;
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
		/**
		 * The coupon this cart carries, if any. Applied by `applyCoupon`, cleared
		 * by `removeCoupon`, and CONSUMED at checkout — holding it is not a
		 * redemption. See `CartCoupon`.
		 */
		coupon?: CartCoupon;
		/**
		 * The CART-LEVEL cut this coupon produced, re-derived on every write from
		 * `coupon`'s frozen grant against the current subtotal. Absent when no
		 * coupon is applied.
		 *
		 * ⚠️ CLAMPED at the subtotal, and the remainder is FORFEITED. A 500-unit
		 * coupon on a 300-unit cart cuts 300 and the other 200 is gone — the
		 * coupon is not a stored-value instrument and carries no balance. That is
		 * why `grandTotal` can reach 0 but never goes negative.
		 *
		 * ⚠️ Distinct from `CartLine.discount`, which is per line. `CartTotals.discount`
		 * is the SUM of both, so reading this alone under-reports.
		 */
		discount?: CartDiscount;
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
		/**
		 * This LINE's own cut — not the cart's. The cart-level one lives at
		 * `Cart.discount`, and `CartTotals.discount` is the sum of both.
		 *
		 * ⚠️ Its `value` survives a re-price and its `amount` does not. Every write
		 * rebuilds every line from the product row, so the grant is carried forward
		 * and the money recomputed against the line's current `price` × `quantity`.
		 * Stamping only the money would leave it recomputed against prices that
		 * moved, and clearing it on rebuild would make an unrelated add-to-cart
		 * silently delete the operator's discount.
		 *
		 * ⚠️ Invoicing reads the ORDER-LEVEL PERCENTAGE only — it never reads
		 * `Order.total`, and therefore never sees `grandTotal`. The voucher is built
		 * from `order.items`' gross `price × quantity` with
		 * `getDiscountMultiplier(order.discount)` applied per line, so a grant
		 * reaches the comprobante if and only if checkout folded it into that
		 * percentage. This docblock previously claimed the money arrived "via
		 * `grandTotal`"; it did not, and a cart carrying this grant was invoiced
		 * gross until checkout began deriving the percentage from
		 * `CartTotals.discount`.
		 *
		 * ⚠️ So the percentage must be derived from the AGGREGATE, never from the
		 * coupon alone — this per-line grant is the half that survives a
		 * coupon-shaped fix unnoticed.
		 *
		 * ⚠️ NEVER derive "what was charged" from `Order.total`. It is net of the
		 * cart's discount but GROSS of any operator percentage, and `mode: 'edit'`
		 * rewrites it as the gross line sum — so no single reading of that scalar is
		 * correct across the writers that produce it. The charged figure is the
		 * gross line sum times `getDiscountMultiplier(Order.discount)`, which is
		 * what the voucher, the credit note, the PDF and the till each compute.
		 */
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
		/** Gross: the sum of `price × quantity` over `lines`, before any discount. */
		subtotal: number;
		/**
		 * Every cut, as ABSOLUTE currency units — the cart-level coupon plus every
		 * line's own discount, summed.
		 *
		 * ⚠️ ABSOLUTE MONEY, unlike `Order.discount`, which is a PERCENTAGE. The
		 * two fields share a name and a `number` type and mean opposite things, so
		 * nothing typechecks a copy from one to the other: a 50-unit cart discount
		 * assigned to `Order.discount` becomes a 50% cut. Never assign across.
		 *
		 * ⚠️ Clamped so it never exceeds `subtotal`. A coupon larger than the cart
		 * forfeits its remainder rather than carrying a balance.
		 */
		discount: number;
		/** Reserved. Tax is derived per line from `ivaType` at invoicing. */
		tax: number;
		/** Reserved. Shipping is chosen at checkout. */
		shipping: number;
		/**
		 * What the customer pays: `subtotal - discount + tax + shipping`, floored
		 * at 0.
		 *
		 * ⚠️ This is the number checkout copies verbatim onto `Order.total`, so it
		 * is the money path and not a display field. It used to be a byte-identical
		 * copy of `subtotal` that subtracted nothing — which was harmless only
		 * while `discount` was structurally always 0.
		 *
		 * ⚠️ It is NET of the cart's discounts and GROSS of `Order.discount`. The
		 * operator's percentage composes on top — coupon first, then the percentage
		 * on what is left.
		 *
		 * ⚠️ But that composition does NOT happen against this figure. Invoicing
		 * never reads `Order.total`: the multiplier is applied per line to
		 * `price × quantity`, and each line's neto is derived from the already
		 * discounted total at that line's own `ivaType`. This docblock used to say
		 * the percentage was "applied to this figure at invoicing", which read as a
		 * guarantee that the two agreed — they are computed from different
		 * quantities and agree only up to per-line rounding.
		 *
		 * ⚠️ Applying the cut per line before the neto split is not an approximation
		 * chosen for convenience: Ley 23.349 Art. 11 presumes, without admitting
		 * proof to the contrary, that discounts operate PROPORTIONALLY to the precio
		 * neto and the tax invoiced. So this is the apportionment the statute
		 * assumes, and it is why a mixed-IVA cart needs no apportionment table.
		 */
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

	/**
	 * A discount, carrying BOTH what was granted and what it actually cut.
	 *
	 * ⚠️ `value` and `amount` are different numbers in different units and both
	 * are required. `value` is the GRANT — `20` under `type: 'percent'` means 20%
	 * off; `20` under `type: 'amount'` means 20 currency units off. `amount` is
	 * the DERIVED money, always absolute currency units, always `>= 0`, and
	 * always what the totals arithmetic uses.
	 *
	 * The split exists because collapsing them was ambiguous in the direction that
	 * silently overcharges: a percent discount whose single number held `15` was
	 * summed into `CartTotals.discount` as fifteen currency units. Nothing typed
	 * that — both are `number`.
	 *
	 * ⚠️ `amount` is SERVER-DERIVED and never accepted from the wire. A client
	 * names a coupon code or a grant; the server computes the money. A request
	 * carrying `amount` has it ignored, not honoured — the same rule that governs
	 * line prices.
	 *
	 * ⚠️ `value` is what SURVIVES a re-price and `amount` is not. Every cart write
	 * rebuilds every line from the product row, so a stored `amount` would be
	 * recomputed against prices that may have moved. Carry the grant forward and
	 * re-derive the money; never carry the money.
	 */
	interface CartDiscount {
		/**
		 * The coupon this came from. Absent on a discount an operator granted
		 * directly, which is why it cannot be used to tell a discount from a
		 * coupon — read the cart's own `coupon` for that.
		 */
		code?: string;
		type: 'percent' | 'amount';
		/** The GRANT, in the unit `type` names. */
		value: number;
		/** The DERIVED cut, in currency units. Server-owned. */
		amount: number;
	}

	/**
	 * The coupon a cart currently carries — the granted TERMS, frozen at apply
	 * time, not the money.
	 *
	 * ⚠️ Holding this does NOT mean a redemption has been consumed. Redemption
	 * happens at CHECKOUT, atomically, against the coupon's own counters. An
	 * abandoned cart therefore costs the store nothing, and `removeCoupon` needs
	 * no release path — which is the whole reason the count is not taken here.
	 * The consequence a client must handle: a coupon that validated at apply time
	 * can still be refused at checkout, because someone else redeemed the last one
	 * in between.
	 *
	 * ⚠️ The terms are FROZEN at apply time on purpose. A coupon edited or expired
	 * after a shopper applied it keeps working for that cart until checkout
	 * re-validates the window — so the shopper is never silently repriced
	 * mid-session, and the store's control point is checkout, where the money
	 * moves.
	 */
	interface CartCoupon {
		/** Normalized upper-case, matching the coupon row's own key. */
		code: string;
		type: 'percent' | 'amount';
		value: number;
		/** When the shopper applied it. */
		appliedAt: number;
		/**
		 * The coupon's minimum-subtotal floor at apply time, frozen with the rest
		 * of the terms. Absent means the coupon had no floor.
		 *
		 * ⚠️ Frozen here rather than re-read because the floor is CART-DEPENDENT and
		 * therefore has to be re-judged on every write, not only at apply. Without
		 * it, the terms were frozen incompletely: the grant survived and the
		 * condition on the grant did not, so a shopper could meet a floor, apply the
		 * code, remove lines back below it, and keep the cut. Freezing it lets that
		 * check run on the cart the write produces with no second read of the
		 * coupon row — which matters because it runs on EVERY cart write.
		 *
		 * ⚠️ Deliberately NOT re-read from the coupon row, for the same reason the
		 * grant is not: a coupon edited after a shopper applied it must not reprice
		 * them mid-session. The store's control point is checkout, which
		 * re-validates against the live row. This field is what the CART promised,
		 * not what the coupon currently says.
		 */
		minSubtotal?: number;
		/**
		 * The coupon's per-redemption money ceiling at apply time
		 * (`Coupon.maxDiscountAmount`), frozen with the rest of the terms. Absent
		 * means the coupon had no ceiling.
		 *
		 * ⚠️ Frozen for the SAME reason `minSubtotal` above is, and it is the same
		 * class of bug if it is not: the cart's coupon money is RE-DERIVED on every
		 * write from this object alone — the live coupon row is not read again
		 * except at apply and at checkout. A ceiling left un-frozen would apply on
		 * the write that granted it and silently vanish on the next unrelated
		 * add-to-cart, handing back exactly the money the cap exists to withhold.
		 *
		 * ⚠️ Like the grant and the floor, deliberately NOT re-read: a coupon whose
		 * ceiling the merchant lowers after a shopper applied it must not reprice
		 * them mid-session. The store's control point is checkout.
		 */
		maxDiscountAmount?: number;
	}

	/**
	 * A redeemable coupon. `PK: COUPON#{storeId}`, `SK: <normalized code>`.
	 *
	 * ⚠️ Keyed by the CODE, not by an allocated id — so uniqueness is the key's
	 * own property and a redemption is a point read rather than an index query.
	 * The normalization (upper-case) lives in the key factory, never at a call
	 * site, or a second write path mints `SUMMER10` beside `summer10` with no
	 * error and both are redeemable.
	 */
	interface Coupon {
		/*
		 * ⚠️ A STORE coupon, and only a store coupon. A bank or wallet promo —
		 * "30% los jueves con Banco X, tope $12.000" — is a `reintegro`: the
		 * customer pays the full ticket at the register, the bank credits the
		 * cardholder later against its own monthly cap, and THE MERCHANT NEITHER
		 * SHOWS IT ON THE COMPROBANTE NOR BEARS ITS COST. It never touches this
		 * entity and must not be modelled here — keying one as a coupon discounts
		 * the store's own money for a promotion someone else is funding, and the
		 * ticket, the voucher and the till all go wrong together.
		 *
		 * ⚠️ A discount for paying by cash or transfer is a THIRD thing, also not
		 * this. It is legal (Ley 25.065 art. 37(c) bars charging MORE for a card in
		 * a single payment, and survived DNU 70/2023, so discounting cash is not
		 * surcharging card) — but it applies once a payment method has been chosen,
		 * which is after the cart total has become the order total. Different
		 * lifecycle, different entity, not yet designed.
		 */
		PK?: string;
		SK?: string;
		storeId: string;
		/** Normalized upper-case. The SK carries the same value. */
		code: string;
		type: 'percent' | 'amount';
		/** The GRANT. Percent is `0 < value <= 100`; amount is `> 0`. */
		value: number;
		/**
		 * The catalogId this coupon's MONEY is denominated in — stamped at mint
		 * from the store's display currency at that moment, and read at
		 * redemption. Governs `value` when `type` is `'amount'`, and
		 * `minSubtotal`/`maxDiscountAmount`/`maxDiscountTotal` always.
		 *
		 * ⚠️ **Absent means "the store's `displayCurrency` at redemption time"** —
		 * the pre-existing behaviour, kept because this repo is forward-only and
		 * every coupon minted before this field existed has to keep working. New
		 * rows always carry it.
		 *
		 * ⚠️ **A mismatch at redemption is REFUSED, never converted.** A coupon is
		 * a promise the merchant made in a specific currency; converting it would
		 * mean choosing an FX rate for a promise that was denominated at mint, and
		 * there is no honest rate to choose — not today's (the merchant never
		 * agreed to it) and not the mint-time one (the shopper is not paying at
		 * it).
		 *
		 * ⚠️ This exists because the coupon was the one money-bearing entity in
		 * the system that was not self-describing. `value` and `minSubtotal` meant
		 * "units of whatever currency the cart happens to be in", resolved at
		 * redemption — so a store that changed `displayCurrency` after minting
		 * silently re-denominated every existing amount coupon and every floor. A
		 * 2 500-peso coupon became a US$2 500 coupon, with nothing failing.
		 *
		 * ℹ️ `'percent'` coupons are unit-free: the field is still stamped (the
		 * floor and the caps are money even when the grant is not) but a percent
		 * grant itself never depends on it.
		 */
		currency?: string;
		/**
		 * Validity window, ms epoch. Both open-ended when absent. Checked at
		 * APPLY and again at CHECKOUT — a cart can sit across the boundary.
		 */
		startsAt?: number;
		endsAt?: number;
		/** Global redemption ceiling. Unlimited when absent. */
		maxRedemptions?: number;
		/**
		 * Per-customer ceiling. Unlimited when absent.
		 *
		 * ⚠️ A walk-in ticket has no `customerId`, so a coupon carrying this cap
		 * cannot be attributed to anyone. Such a coupon is REFUSED on a
		 * customer-less cart (`COUPON_REQUIRES_CUSTOMER`) rather than silently
		 * sharing one anonymous bucket — which would either block the second
		 * walk-in of the day or, keyed on the empty string, hand every walk-in the
		 * same allowance.
		 */
		maxPerCustomer?: number;
		/**
		 * Redemptions consumed so far, incremented atomically at checkout under a
		 * condition. ⚠️ Never write this directly — the conditional increment IS
		 * the cap, and a plain overwrite loses every concurrent redemption.
		 */
		redemptions?: number;
		/**
		 * Minimum cart subtotal, in the cart's currency, before the coupon
		 * applies. Absent means no floor.
		 */
		minSubtotal?: number;
		/**
		 * **Per-redemption ceiling on the MONEY this coupon may grant**, in the
		 * cart's currency. Unlimited when absent.
		 *
		 * `maxRedemptions` bounds how many times a code is used, which is not the
		 * thing that costs money: 500 redemptions of a 50% coupon is unbounded
		 * spend under a cap that looks set. A percent coupon on a wholesale cart
		 * is unbounded by construction without this.
		 *
		 * Composes with — never replaces — the existing clamp to the cart's gross,
		 * so the granted amount is `min(derived, maxDiscountAmount, gross)` and a
		 * coupon still cannot take a cart below zero.
		 *
		 * ℹ️ This is the local idiom, not a new concept: Argentine shoppers read
		 * **"tope de reintegro"** on every bank promo, so a merchant setting it
		 * needs no explanation and a shopper reading it needs none either.
		 */
		maxDiscountAmount?: number;
		/**
		 * **Lifetime budget across ALL redemptions**, in the cart's currency.
		 * Unlimited when absent. Accumulates into `discountSpent` at redemption
		 * and refuses with `COUPON_BUDGET_EXHAUSTED` once crossed.
		 *
		 * The campaign-level sibling of `maxDiscountAmount`: that one bounds what
		 * any single shopper can take, this one bounds what the promotion can cost
		 * in total.
		 */
		maxDiscountTotal?: number;
		/**
		 * Money granted so far, accumulated atomically at checkout under the same
		 * conditional-increment shape as `redemptions`.
		 *
		 * ⚠️ Never write this directly, for the same reason as `redemptions` — the
		 * conditional increment IS the cap, and a plain overwrite loses every
		 * concurrent redemption's spend. Server-owned; refused from the wire.
		 */
		discountSpent?: number;
		/**
		 * Switched off without deleting the row, so the code cannot be re-minted
		 * with different terms while shoppers still hold the old one.
		 *
		 * ⚠️ Reported as `COUPON_NOT_FOUND`, deliberately — the same refusal an
		 * unknown code gets. A distinct "this coupon is disabled" answer would tell
		 * an enumerator that the code is real.
		 */
		disabled?: boolean;
		search?: string;
		entityType?: string;
		createdAt?: number;
		updatedAt?: number;
	}

	/**
	 * Why a coupon was refused. All bare SCREAMING_SNAKE, matching the `error`
	 * slot convention for a 4xx.
	 *
	 * ⚠️ `COUPON_EXHAUSTED` is reachable at BOTH apply and checkout, and means
	 * different things: at apply the cap was already full; at checkout it filled
	 * between the two. A client must handle it on the checkout leg too, where it
	 * is the one refusal a shopper did nothing to cause.
	 */
	type CouponRefusal =
		| 'COUPON_NOT_FOUND'
		| 'COUPON_NOT_ACTIVE'
		| 'COUPON_EXPIRED'
		| 'COUPON_EXHAUSTED'
		| 'COUPON_EXHAUSTED_AT_CHECKOUT'
		| 'COUPON_MIN_SUBTOTAL'
		| 'COUPON_REQUIRES_CUSTOMER'
		| 'COUPON_BUDGET_EXHAUSTED'
		| 'COUPON_RATE_LIMITED'
		| 'COUPON_CURRENCY_MISMATCH';

	/*
	 * ⚠️ `COUPON_BUDGET_EXHAUSTED` is NOT `COUPON_EXHAUSTED` with a different
	 * noun. They bound different things and a client that collapses them tells
	 * the shopper the wrong story:
	 *
	 *  - `COUPON_EXHAUSTED` — the COUNT ceiling (`maxRedemptions`) is full. The
	 *    code was used the agreed number of times.
	 *  - `COUPON_BUDGET_EXHAUSTED` — the MONEY ceiling (`maxDiscountTotal`) is
	 *    spent. The code may have been redeemed far fewer times than its count
	 *    allows; a handful of large carts can exhaust a budget a count cap would
	 *    have let run for months.
	 *
	 * Both are permanent until the merchant raises the respective cap, so both
	 * are safe to state plainly to the shopper. What differs is what the MERCHANT
	 * must change to bring the code back, which is why the operator log needs the
	 * two apart.
	 *
	 * ⚠️ `COUPON_RATE_LIMITED` is the only refusal in this union that is about
	 * the CALLER rather than the coupon, and it is deliberately answered for any
	 * code once the caller is over the limit — including a code that does not
	 * exist. Answering `COUPON_NOT_FOUND` past the limit would leak the very
	 * signal the limit exists to withhold, by letting an enumerator distinguish
	 * real codes from invented ones at whatever rate it is still allowed.
	 *
	 * ⚠️ It bounds the CALLER, never the coupon. Disabling a code after N failed
	 * attempts would convert guessing into a denial of service on a live promo —
	 * an attacker takes down a campaign by attempting it, which is a worse
	 * failure than the enumeration it prevents. Do not add a lockout.
	 */

	/*
	 * ⚠️ `COUPON_EXHAUSTED` and `COUPON_EXHAUSTED_AT_CHECKOUT` are the same
	 * condition reached two different ways, and they are split because the
	 * SHOPPER-FACING answer differs:
	 *
	 *  - `COUPON_EXHAUSTED` — the cap was already known spent when the request
	 *    was evaluated. The shopper is told the code is used up. Nothing they did
	 *    caused it and nothing they can do changes it.
	 *  - `COUPON_EXHAUSTED_AT_CHECKOUT` — the cap was NOT spent at evaluation and
	 *    the conditional increment then lost a race to a concurrent checkout. The
	 *    shopper watched this code be ACCEPTED on their own cart and then be
	 *    refused at the till. The right answer is an apology and a retry
	 *    affordance, not "this coupon is used up", which reads as blaming them for
	 *    a code the system already told them was good.
	 *
	 * Only the checkout leg can emit the second one — applying a coupon does not
	 * consume a redemption, so there is no race to lose there.
	 */

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
		| CartActionRestoreLine
		| CartActionRemoveSavedLine
		| CartActionApplyCoupon
		| CartActionRemoveCoupon
		| CartActionSetLineDiscount;

	/**
	 * WHICH cart an OPERATOR action acts on — the half of the operator request
	 * that `CartActionRequest` cannot carry.
	 *
	 * The storefront takes the cart from the authenticated identity, so a
	 * shopper's body names no target and `CartActionRequest` alone is complete
	 * there. The operator surface acts on someone else's cart and must say which,
	 * so `POST /baskets` refuses a body naming none of the three with
	 * `400 CART_TARGET_REQUIRED`. A client typing an operator body as the bare
	 * `CartActionRequest` therefore compiles and 400s on every write, which is
	 * exactly what this type exists to stop.
	 *
	 * Modelled as a UNION rather than three optional fields so "at least one" is
	 * enforced by `tsc` rather than discovered at runtime. Supplying more than one
	 * is legal; the server resolves them in the order below.
	 *
	 * ⚠️ `cartId` is the ONLY one that reaches a WALK-IN ticket. Such a cart has
	 * no `customerId` at all and the `PK-customerId` GSI is sparse, so no customer
	 * lookup can find it by any route.
	 */
	type OperatorCartTarget =
		/** That customer's own cart. */
		| { customerId: string; cartId?: string; terminalId?: string }
		/** One specific ticket, walk-ins included. */
		| { cartId: string; customerId?: string; terminalId?: string }
		/** The till's currently OPEN ticket, minted if it has none. */
		| { terminalId: string; customerId?: string; cartId?: string };

	/** The body `POST /baskets` accepts: any named action, plus a target. */
	type OperatorCartActionRequest = CartActionRequest & OperatorCartTarget;

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
	 * Removes a line from `savedLines` OUTRIGHT — the shelf's own delete.
	 *
	 * ⚠️ It exists because `removeLine` does NOT reach a saved line. That verb
	 * filters `lines` only, so handing it a saved `lineId` is an idempotent no-op
	 * `200` and the shelf is untouched — which left restore-then-remove as the
	 * only path off `savedLines`, and that path is not always available:
	 *
	 * - On a cart at `MAX_CART_LINES` the restore is refused
	 *   `400 BASKET_LINE_LIMIT` and nothing is written, so a saved line on a full
	 *   ticket was unreachable by any sequence of actions.
	 * - Saved lines spend `MAX_CART_BYTES`, and once the row is over it `saveLine`
	 *   is refused too — so a shelf could become the thing consuming the budget
	 *   with no way to shrink it.
	 *
	 * This verb touches `savedLines` alone, so the LINE guard cannot refuse it
	 * (the active count does not change) and it is a genuine reduction against the
	 * BYTE guard. That makes it the shelf's recovery path, not merely its
	 * convenience.
	 *
	 * ⚠️ It does NOT return the line to the cart. `restoreLine` is that verb; this
	 * one discards. A UI must not offer them behind the same affordance.
	 *
	 * A `lineId` that is not in `savedLines` is a no-op `200`, matching
	 * `removeLine`, `saveLine` and `restoreLine`.
	 */
	interface CartActionRemoveSavedLine extends CartActionBase {
		mode: 'removeSavedLine';
		/** Names a line in `savedLines` — NOT in `lines`. */
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

	/**
	 * WHY a product the request named did not make it onto the cart.
	 *
	 * ⚠️ The distinction that matters is REMEDIABLE vs NOT. `cartFull` is the
	 * shopper's to fix — remove a line and send it again — while the other two are
	 * facts about the catalogue that retrying cannot change. `droppedSkus` alone
	 * could not express that, so every consumer rendered one message for all of
	 * them, and the one that told the shopper "product not found" for a cart that
	 * was merely full was both wrong and unactionable.
	 *
	 * ⚠️ `notOffered` deliberately shares its spelling with
	 * `CartLineAvailability.reason`, because it is the same fact — the product is
	 * hidden from this channel. Two half-aligned vocabularies for one condition is
	 * the outcome this naming exists to avoid.
	 *
	 * ⚠️ Treat an UNRECOGNISED reason as unremediable rather than discarding the
	 * entry: a reason added later must degrade, not vanish, and guessing
	 * "remediable" would invite a retry loop that cannot succeed.
	 */
	interface CartLineDrop {
		productId: string;
		/**
		 * - `productUnavailable` — no product row resolved at all (deleted, or never
		 *   existed). Permanent from the caller's side.
		 * - `notOffered` — the product resolved but is `hiddenFromStorefront`, so it
		 *   is not sellable on this channel. Also permanent from the caller's side,
		 *   but a DIFFERENT fact: the product exists.
		 * - `cartFull` — the line was truncated because the resulting cart would
		 *   exceed the line cap. `merge` is the only action that truncates; every
		 *   other one refuses with `400 BASKET_LINE_LIMIT` instead. **Remediable.**
		 */
		reason: 'productUnavailable' | 'notOffered' | 'cartFull';
	}

	/**
	 * Applies a coupon to the cart by CODE. The server resolves the coupon, checks
	 * its window, its caps and any subtotal floor, and freezes the granted terms
	 * onto the cart.
	 *
	 * ⚠️ It does NOT consume a redemption — see `CartCoupon`. A refusal carries a
	 * bare `CouponRefusal` in the `error` slot and leaves the cart's money
	 * completely untouched, including its lines.
	 *
	 * ⚠️ A cart holds AT MOST ONE coupon. Applying a second REPLACES the first
	 * rather than stacking, and the response's cart shows which one won. Stacking
	 * was rejected because two percent grants compose differently depending on
	 * order, and nothing in the request says what that order should be.
	 */
	interface CartActionApplyCoupon extends CartActionBase {
		mode: 'applyCoupon';
		/** Case-insensitive; the server normalizes. */
		code: string;
	}

	/**
	 * Clears the cart's coupon and its derived cut.
	 *
	 * A cart carrying no coupon is a no-op `200`, matching every other removal
	 * verb here. Nothing is released, because nothing was consumed.
	 */
	interface CartActionRemoveCoupon extends CartActionBase {
		mode: 'removeCoupon';
	}

	/**
	 * Sets or clears ONE line's discount — the operator's per-line cut.
	 *
	 * ⚠️ OPERATOR SURFACE ONLY, and enforced as a CAPABILITY rather than by
	 * hiding the mode: the storefront never passes it, so a shopper naming this
	 * mode is refused `403 LINE_DISCOUNT_NOT_ALLOWED`. One schema set serves both
	 * surfaces on purpose — forking it per surface is what would let the two drift
	 * on everything else.
	 *
	 * ⚠️ Also gated on the store's own `config.changePrice`, the same switch that
	 * governs a typed price override. A per-line discount is a price override in
	 * everything but spelling, and two switches would let a store turn one off
	 * believing it had closed both.
	 *
	 * ⚠️ It carries a GRANT and never an amount. The money is derived server-side
	 * against the line's current price on every write, so there is no field a
	 * client could use to name its own discount.
	 *
	 * ⚠️ `value: 0` CLEARS the discount rather than granting a zero one — a zero
	 * grant and no grant are indistinguishable downstream, so storing the former
	 * would be a row attribute that costs bytes and means nothing.
	 */
	interface CartActionSetLineDiscount extends CartActionBase {
		mode: 'setLineDiscount';
		lineId: string;
		type: 'percent' | 'amount';
		/** The grant, in the unit `type` names. `0` clears. */
		value: number;
	}

	interface CartActionResponse {
		message: string;
		data: Cart;
		/**
		 * ⚠️ KEPT, and kept as `string[]`. It is not replaced by `dropped` below
		 * and must not be: both consumers parse this as an array of strings today,
		 * and one of them filters non-strings out — so changing its element type
		 * would degrade that client to reporting NOTHING, silently, in the
		 * direction that hides the problem. The reason travels alongside instead.
		 */
		droppedSkus: string[];
		/**
		 * The same drops as `droppedSkus`, each carrying WHY.
		 *
		 * ⚠️ REQUIRED and always present — an empty array when nothing dropped —
		 * for the same reason its two siblings are. One entry per entry in
		 * `droppedSkus`, in the same order, so a consumer that has already indexed
		 * one can zip them; new consumers should read this one and ignore
		 * `droppedSkus` entirely.
		 */
		dropped: CartLineDrop[];
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
		/**
		 * Set when this write DROPPED the cart's coupon because the coupon stopped
		 * qualifying — carrying the refusal that fired.
		 *
		 * ⚠️ This exists because a coupon's terms are checked against the cart the
		 * write PRODUCES, not the one it started from. A shopper can meet a
		 * `minSubtotal` floor, apply a code, then remove lines back below the floor;
		 * the coupon has to come off, or the cart quotes a discount it is not
		 * entitled to and checkout refuses the order at the till instead.
		 *
		 * ⚠️ OPTIONAL, unlike its three siblings above, and deliberately so. Those
		 * are always-present arrays because an empty array still answers their
		 * question ("nothing dropped", "nothing short"). This one is a per-request
		 * ADVISORY about an event: absent means the coupon was untouched, which
		 * includes the ordinary case of there never having been one. A required
		 * `null` would add a key every consumer must handle to say nothing happened.
		 *
		 * When present, `data.coupon` and `data.discount` are already gone from the
		 * cart and `totals` already reflect their absence — this names the reason so
		 * the shopper can be told why the total moved, rather than watching it jump.
		 *
		 * ⚠️ The CODE IS NOT RECOVERABLE from this response, and copy must not try:
		 * the coupon has already been removed from `data` by the time the advisory
		 * is set, so interpolating `data.coupon.code` yields an empty string. Say
		 * that a coupon was removed and why; do not name which one.
		 *
		 * ⚠️ Produced by the writes that CHANGE THE LINES — a scan, a quantity edit,
		 * a line removal — never by the coupon verbs themselves. `applyCoupon`
		 * failing its terms is a refusal, and `removeCoupon` is intentional; neither
		 * is a drop. So a consumer that handles this only in its coupon surface will
		 * never see it fire, which is the whole way this goes unnoticed.
		 */
		couponDropped?: CouponRefusal;
	}


}

export {}; // NOSONAR
