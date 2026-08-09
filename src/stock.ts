declare global {
  interface StockBase {
    storeId: string;
    stockId: string; // e.g. "income-PROD000330"
    createdAt: number; // insertion timestamp
    cost: number;
    skip?: boolean; // supersedes legacy notEvaluate; unused on new inserts
  }

  interface StockIncome extends StockBase {
    quantity: number;
    supplierId?: string;
    supplierName?: string;

    /**
     * Set when this inflow is a customer RETURN restocking a sellable unit,
     * not a supplier purchase. Rides the `INCOME#` partition deliberately —
     * on-hand is `Σ INCOME − Σ SALE`, so reusing it needs no reader change.
     * Presence of `returnId` is the discriminator — purchase/supplier COST
     * views MUST exclude rows that carry it.
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

export {}; // NOSONAR
