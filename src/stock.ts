declare global {
  interface StockBase {
    storeId: string;
    stockId: string; // e.g. "income-PROD000330"
    createdAt: number; // insertion timestamp
    cost: number;
    skip?: boolean; // supersedes legacy notEvaluate; unused on new inserts
  }

  /**
   * Attributes persisted on every stock-movement row. `storeId` and `stockId`
   * deliberately do not belong here: the DynamoDB partition and sort keys carry
   * them, and stock readers synthesize the public hydrated fields from those
   * keys. Writers must use a stored shape so the compiler checks every attribute
   * that is actually sent to DynamoDB.
   */
  interface StoredStockBase {
    createdAt: number;
    cost: number;
    skip?: boolean;
  }

  interface StockIncomeWrite extends StoredStockBase {
    dated: number;
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

  interface StockSaleWrite extends StoredStockBase {
    /**
     * Units leaving stock on this outflow. REQUIRED, mirroring
     * `StockIncomeWrite.quantity` — on-hand is `Σ INCOME − Σ SALE`, so a SALE
     * row without it cannot participate in the sum at all.
     */
    quantity: number;
    customerId?: string;
    fullName?: string;
    ivaType?: number;
    orderId?: string;
    /**
     * Set when the outflow is a PART consumed on a service order rather than a
     * product sold on an order. Rides the `SALE#` partition deliberately —
     * on-hand is `Σ INCOME − Σ SALE`, so a part fitted to a repair depletes
     * stock through the path that already exists and needs no reader change.
     *
     * Presence of `serviceOrderId` is the discriminator, mirroring
     * `StockIncome.returnId`: a row carrying it has no `orderId`, and any view
     * that attributes revenue to ORDERS must exclude it or the same money is
     * counted under both.
     */
    serviceOrderId?: string;
    price?: number;
  }

  /** Hydrated movement returned by readers after deriving ids from DynamoDB keys. */
  interface StockIncome extends StockBase, StockIncomeWrite {}

  /** Hydrated movement returned by readers after deriving ids from DynamoDB keys. */
  interface StockSale extends StockBase, StockSaleWrite {}
}

export {}; // NOSONAR
