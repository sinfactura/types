declare global {
    interface StockBase {
        storeId: string;
        stockId: string;
        createdAt: number;
        cost: number;
        skip?: boolean;
    }
    interface StockIncome extends StockBase {
        quantity: number;
        supplierId?: string;
        supplierName?: string;
        /**
         * Set when this inflow is a customer RETURN restocking a sellable unit
         * rather than a supplier purchase (api#547).
         *
         * Sellable returns ride the `INCOME#` partition deliberately: the on-hand
         * figure is `Σ INCOME − Σ SALE`, so reusing it keeps stock correct with no
         * reader change and no new partition to register. Presence of `returnId` is
         * the discriminator — purchase/supplier COST views MUST exclude rows that
         * carry it, or a return inflates reported purchases (api#549).
         *
         * ⚠️ Never set `skip`/`notEvaluate` on a return income row — that would
         * exclude it from the on-hand sum and silently lose the restocked unit.
         */
        returnId?: string;
        /** Originating order, for traceability. Present alongside `returnId`. */
        orderId?: string;
        /** Index of the returned line in the originating `Order.items`. */
        orderItemIndex?: number;
    }
    interface StockSale extends StockBase {
        customerId?: string;
        fullName?: string;
        ivaType?: number;
        orderId?: string;
        price?: number;
    }
}
export {};
