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
        breaks?: PriceBreak[];
        promo?: PricePromo;
        visibleOnStorefront?: boolean;
    } & CurrencyStamp);
}
export {};
