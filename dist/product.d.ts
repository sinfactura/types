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
        minStock?: number;
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
        currencyValue?: number;
        currencyValueAt?: number;
        ivaType: number;
        categoryId: string;
        brandId: string;
        inOffer: boolean;
        isNew: boolean;
        isService: boolean;
        cost: number;
        prices?: PriceSlot[];
        channels?: Record<string, ProductChannelMapping>;
        barcodes?: ProductBarcode[];
        barcodePrimary?: string;
        variantGroupId?: string;
        variantAttributes?: {
            id: string;
            value: string;
        }[];
        model?: string;
        seoTitle?: string;
        seoDescription?: string;
        attributes?: {
            name: string;
            value: string;
            evidence?: string;
        }[];
    }
    interface ProductBarcode {
        value: string;
        type: 'EAN13' | 'EAN8' | 'UPC' | 'GTIN14' | 'CODE128' | 'internal';
        isPrimary?: boolean;
        packSize?: number;
        source?: 'manual' | 'import' | 'generated';
    }
    type ProductChannelStatus = 'linked' | 'pending' | 'paused' | 'rejected' | 'unlinked';
    interface ProductChannelMapping {
        externalId?: string;
        userProductId?: string;
        familyId?: string;
        variationId?: string;
        status: ProductChannelStatus;
        linkedAt?: number;
        lastSyncedAt?: number;
        basis?: MlMatchBasis | 'manual';
        syncErrors?: string[];
        regime?: 'classic' | 'coexistence' | 'multi-origin';
        stockMirrorOnly?: boolean;
    }
}
export {};
