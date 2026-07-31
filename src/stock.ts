declare global {
  interface StockBase {
    storeId: string;
    stockId: string; // income-PROD000330
    createdAt: number; // add when insert an item
    cost: number; // 1.23
    skip?: boolean; // new to replace old notEvaluate // unnecesary in all new inserts
  }

  interface StockIncome extends StockBase {
    quantity: number; // income
    supplierId?: string; // income
    supplierName?: string; // income

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
    customerId?: string; // sale
    fullName?: string; // sale
    ivaType?: number; // sale
    orderId?: string; // sale
    price?: number; // sale
  }
}

export {}; // NOSONAR
