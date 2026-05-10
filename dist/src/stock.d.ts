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
        supplierId?: number;
        supplierName?: string;
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
