declare global {
    /**
     * @deprecated Use `Cart`. Superseded by the re-keyed cart (one row per cart at
     * its own minted `cartId`, rather than one row per customer at
     * `BASKET#{storeId}` / `{customerId}`).
     *
     * Both front ends are off this shape. It stays PUBLISHED so any consumer still
     * compiling against it keeps compiling — the tag is a compiler nudge, not a
     * removal announcement. New code must not reference it.
     *
     * ⚠️ `Order.items` is NOT covered by this: it is `Partial<CartLine>[]`, and
     * `CartLine` is structurally a superset of `BasketItem`. Anywhere an order
     * line is being typed, `CartLine` is the correct name and always was.
     */
    interface Basket {
        storeId: string;
        customerId: string;
        customer: Partial<Customer>;
        createdAt: number;
        updatedAt: number;
        version?: number;
        quantity: number;
        currency: string;
        currencyValue?: number;
        currencyValueAt?: number;
        cost: number;
        total: number;
        items: BasketItem[];
    }
    /**
     * @deprecated Use `CartLine`, which is a structural superset — every field
     * below is present on it, plus `lineId`. See the note on `Basket`.
     */
    interface BasketItem {
        dated: number;
        productId: string;
        sku: string;
        pictures: Product['pictures'];
        name: string;
        zone?: string;
        quantity: number;
        ivaType: number;
        cost: number;
        price: number;
        listId?: number;
        currency?: string;
        currencyValue?: number;
        currencyValueAt?: number;
        priceSource?: 'percent' | 'amount';
        appliedMinQty?: number;
        promoApplied?: boolean;
        basePrice?: number;
    }
    /**
     * @deprecated Nothing emits this. `?mode=merge` and its sibling actions now
     * return ONE envelope — `{ message, data, droppedSkus }` — with `droppedSkus`
     * as a top-level key rather than nested under `mergeMeta`, and `mergedCount`
     * derived by the caller from what was NOT dropped.
     */
    interface BasketMergeMeta {
        droppedSkus: string[];
        mergedCount: number;
    }
}
export {};
