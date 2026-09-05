declare global {
    /**
     * ADR-0013 self-describing money stamp — STRICT (frozen rate required).
     * Used ONLY on the new pricing-authoring shapes (PriceSlot[absolute] /
     * PriceBreak / PricePromo). Do NOT half-narrow `currency` to `CatalogId`
     * while entity stamps stay `string`; do NOT retrofit onto SupplierInvoice /
     * SupplierAccount (optional-currency by design).
     */
    interface CurrencyStamp {
        currency: string;
        currencyValue: number;
        currencyValueAt: number;
    }
    /**
     * A named, extensible price list, split OUT of the shared `Method` blob
     * (reused by 7 unrelated Store arrays — don't leak pricing into
     * paymentMethods/ivaTypes). Structurally a superset of `Method` so
     * `store.priceLists: Method[] → PriceList[]` stays type-compatible.
     * `id` is the FK target for `Customer.priceList` + `PriceSlot.listId`.
     */
    interface PriceList {
        id: number;
        name: string;
        value?: number;
        removable?: boolean;
        editable?: boolean;
        order?: number;
        defaultCurrency?: string;
        tierGated?: boolean;
    }
    /**
     * Quantity break within a slot. Resolution: highest `minQty <= qty` wins.
     * Stored sorted ascending by `minQty`; no two breaks share a `minQty`
     * (BE-validated). Open-ended top tier (no `maxQty` — ranges derive from the
     * next break's `minQty`).
     */
    interface PriceBreak extends CurrencyStamp {
        minQty: number;
        amount: number;
    }
    /** Time-limited promo override. `amount` is absolute. */
    interface PricePromo extends CurrencyStamp {
        from?: number;
        until: number;
        amount: number;
    }
    /**
     * One price list's pricing for a product. A discriminated union kills the
     * `{}`/both-set/neither-set invalid states — `kind:'absolute'` implies a
     * `CurrencyStamp`. `listId` is an FK to `PriceList.id`.
     */
    type PriceSlot = {
        kind: 'percent';
        listId: number;
        percent: number;
        breaks?: PriceBreak[];
        promo?: PricePromo;
        visibleOnStorefront?: boolean;
    } | ({
        kind: 'absolute';
        listId: number;
        amount: number;
        /**
         * DISPLAY ANCHOR — the PRE-OVERLAY base that this slot's `amount` was
         * derived from, for the case where `amount` already has an active promo
         * (or a qty break) folded into it. It is **not a price**: nothing may
         * ever charge it, quote it, total it or send it to an external system.
         * The charged per-unit figure is `amount`, always. Its only job is to
         * give a struck-through "was" figure something true to point at.
         *
         * Denominated exactly like `amount` — this slot's own `currency` /
         * `currencyValue` stamp. `breaks[]` and `promo` carry their OWN stamps
         * and are not comparable with either without conversion.
         *
         * It appears ONLY on a slot the api DERIVED from a `kind:'percent'` slot
         * on the storefront read path: the percent must never reach a shopper, so
         * it is materialized into an absolute `amount` — and the figure available
         * to materialize with is the already-resolved, post-overlay one. An
         * author-time `kind:'absolute'` slot is passed through untouched, its
         * `amount` IS the base, and it legitimately carries no `baseAmount`.
         * Absence there is correct, not missing data.
         *
         * ⚠️ OPTIONAL, and absence is ambiguous on purpose — it also means "this
         * slot predates the field". Forward-only: nothing is backfilled and no
         * stored row is rewritten. A consumer that finds it absent must fall back
         * to its pre-field behaviour, or suppress the strike-through outright, and
         * must NEVER treat `amount` as the base.
         *
         * ⚠️ The tell that the anchor is missing rather than merely equal is an
         * EXACT TIE, and it is the case that proves a missing field rather than a
         * stricter comparison is the fix. Base 100, active promo 80, break 80 at
         * the line's qty: a consumer asking `promoAmount < amount` gets `80 < 80`
         * → false and shows no sale at all, while the same line in the cart — the
         * api resolves that one against the true base — reports the break applied
         * and strikes 100. No comparison against `amount` can reconcile the two;
         * anchoring on `baseAmount` when it is present is what does.
         */
        baseAmount?: number;
        breaks?: PriceBreak[];
        promo?: PricePromo;
        visibleOnStorefront?: boolean;
    } & CurrencyStamp);
}
export {};
