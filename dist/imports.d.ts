declare global {
    interface ProductSale {
        pk: string;
        sk: string;
        orderId: string;
        customerId: string;
        fullName: string;
        quantity: number;
        price: number;
    }
    interface ProductIncome {
        pk: string;
        sk: string;
        orderId?: string;
        supplierId: string;
        supplierName?: string;
        quantity: number;
        cost: number;
    }
}
export {};
