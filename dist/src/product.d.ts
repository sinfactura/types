declare global {
    interface Product {
        storeId: string;
        productId: string;
        createdAt: number;
        updatedAt: number;
        disabled: boolean;
        search: string;
        sku: string;
        name: string;
        description?: string;
        pictures?: {
            url: string;
            base64?: string;
            primary?: boolean;
        }[];
        stock: number;
        limit?: number;
        incomes?: {
            stockId: string;
            orderId?: string;
            supplierName?: string;
            quantity: number;
            cost: number;
        }[];
        sales?: {
            stockId: string;
            orderId: string;
            fullName: string;
            quantity: number;
            price: number;
        }[];
        totalIncomes?: number;
        totalSales?: number;
        zone?: string;
        currency: string;
        ivaType: number;
        categoryId: string;
        brandId: string;
        inOffer: boolean;
        isNew: boolean;
        isService: boolean;
        cost: number;
        price1: number;
        price2: number;
        price3: number;
        price4: number;
    }
}
export {};
