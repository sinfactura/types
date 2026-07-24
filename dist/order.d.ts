declare global {
    interface Order {
        storeId: string;
        orderId: string;
        customerId: string;
        customer: Partial<Customer>;
        createdAt: number;
        updatedAt?: number;
        readyAt?: number;
        deliveredAt?: number;
        deliveredDate?: number;
        comments?: string;
        currency: string;
        currencyValue?: number;
        currencyValueAt?: number;
        paymentMethod: number;
        deliveryMethod: number;
        invoiceMethod?: {
            condFiscal: number;
            condFiscalName: string;
            cuit: string;
            razonSocial: string;
            docType?: number;
            docNumber?: string;
        };
        cost: number;
        total: number;
        discount: number;
        orderPrinted?: boolean;
        tagPrinted?: boolean;
        invoices?: Partial<Invoice>[];
        returns?: Partial<Return>[];
        mercadolibreCreditNote?: {
            creditNoteNumber?: number;
            emittedAt?: number;
            status?: "emitted" | "skipped" | "failed";
            reason?: string;
            claimId?: string;
            source?: 'auto' | 'manual';
        };
        disabled?: boolean;
        items: Partial<BasketItem>[];
        rating?: number;
        comment?: string;
        surveyDate?: number;
        deliveryAddress?: {
            fullName: string;
            address: string;
            phone: string;
            city: string;
            province: string;
            postalCode: string;
        };
        mercadopago?: {
            dynamicQr?: {
                qrData: string;
                inStoreOrderId: string;
                posId: string;
                externalReference: string;
                amount: number;
                currency: string;
                expiresAt: number;
                createdAt: number;
            };
        };
        linkedPayments?: Record<string, LinkedPaymentEntry>;
        channel?: OrderChannel;
        mercadolibre?: OrderMercadolibre;
    }
    type OrderChannel = 'meli';
    interface MercadolibreCreditNoteStamp {
        creditNoteNumber?: number;
        emittedAt?: number;
        status?: 'emitted' | 'skipped' | 'failed';
        reason?: string;
        claimId?: string;
        source: 'manual' | 'auto';
    }
    interface OrderMercadolibre {
        mlOrderId: string;
        packId?: string;
        buyerNickname?: string;
        shipmentId?: string;
        logisticType?: string;
        mlLastUpdated?: number;
        paid?: boolean;
        items?: OrderMercadolibreItem[];
        fees?: {
            saleFee?: number;
            shippingCostSeller?: number;
            currency: string;
            currencyValue?: number;
            currencyValueAt?: number;
        };
        billingInfo?: {
            docType?: string;
            docNumber?: string;
            custType?: 'CO' | 'BU';
            taxpayerType?: string;
            iibbNumber?: string;
        };
        discrepancies?: {
            priceMismatch?: boolean;
            oversell?: boolean;
            missingCuit?: boolean;
        };
        fiscalDocumentStatus?: 'uploaded' | 'failed' | 'pending';
    }
    interface OrderMercadolibreItem {
        mlItemId: string;
        variationId?: string;
        userProductId?: string;
        sellerSku?: string;
        quantity: number;
        stock?: {
            mlStoreId?: string;
            networkNodeId?: string;
        }[];
    }
    interface LinkedPaymentEntry {
        source: 'mp' | 'stripe' | 'mp_movement';
        total: number;
        linkedAt: number;
    }
    interface ZebraTag {
        orderId: string;
        fullName: string;
        phone: string;
        address: string;
        city: string;
        quantity: number;
        comments: string;
        sender: {
            razonSocial: string;
            cuit: string;
            phone: string;
            address: string;
            city: string;
            postalCode: string;
            province: string;
        };
    }
}
export {};
