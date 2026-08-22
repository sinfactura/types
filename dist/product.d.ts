declare global {
    /** Write shape for product create/update — carries the transient picture-removal control. */
    type ProductUpsertInput = Partial<Product> & {
        /** Request-only: pictures to delete; the BE removes them from storage and from `pictures[]`. */
        removePictures?: {
            url: string;
        }[];
    };
    interface Product {
        storeId: string;
        productId: string;
        createdAt: number;
        updatedAt: number;
        disabled: boolean;
        /**
         * Independent of `disabled`. `disabled` means soft-deleted, gone
         * everywhere (operator pickers included); this means "real and
         * stocked, just not offered on the storefront" — a repair shop's
         * spare parts, ingredients, internal-use items. Defaults to visible
         * (`undefined`/`false`); operator-side reads (pickers, stock reports,
         * service parts, search) are UNAFFECTED and keep seeing it regardless
         * of this flag.
         */
        hiddenFromStorefront?: boolean;
        /**
         * Lowercase '#'-joined index the api maintains on every write.
         *
         * UNLIKE the same-named field on the other entities (where it is internal
         * and stripped at the wire boundary), this one is genuinely part of the
         * product read contract: `GET /products` returns it and the app filters
         * its product pickers on it client-side, so stripping it empties every
         * local product search. Optional because legacy rows predate it.
         */
        search?: string;
        sku: string;
        name: string;
        description?: string;
        pictures?: {
            url: string;
            base64?: string;
            primary?: boolean;
        }[];
        /** @deprecated Request-only control, never persisted or returned — use `ProductUpsertInput.removePictures`. */
        removePictures?: {
            url: string;
        }[];
        stock: number;
        minStock?: number;
        limit?: number;
        incomes?: {
            stockId: string;
            orderId?: string;
            returnId?: string;
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
        totalIncome?: number;
        totalSales?: number;
        zone?: string;
        currency: string;
        currencyValue?: number;
        currencyValueAt?: number;
        ivaType: number;
        categoryId: string;
        brandId: string;
        inOffer?: boolean;
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
        permalink?: string;
        listingPrice?: number;
        listingStock?: number;
        mlStatus?: string;
    }
}
export {};
