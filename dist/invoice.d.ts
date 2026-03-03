declare global {
    interface Invoice {
        storeId: string;
        invoiceId: string;
        customerId: string;
        orderId: string;
        createdAt: number;
        dated: number;
        invoiceType: number;
        pointOfSale: number;
        invoiceNumber: number;
        razonSocial: string;
        address: string;
        location: string;
        concept: number;
        cuitType: number;
        cuit: string;
        currency?: "PES" | "DOL";
        currencyValue?: number;
        fiscalCondition: string;
        paymentCondition: string;
        deliveryCondition: string;
        items: InvoiceItem[];
        neto10: number;
        neto21: number;
        iva10: number;
        iva21: number;
        discount?: number;
        total: number;
        cae: string;
        caeExpiration: string;
        observations?: string;
    }
    interface InvoiceItem {
        code: string;
        description: string;
        quantity: number;
        iva: number;
        neto: number;
    }
    interface InvoiceWithCustomer extends Invoice {
        customer: Customer;
    }
    interface ResponseMakeAfip {
        cae: string;
        caeExpiration: string;
        invoiceNumber: number;
        fiscalCondition: FiscalCondition;
        netos: Neto;
        ivaTypes: Method[];
        currency: "PES" | "DOL";
        currencyValue: number;
        total: number;
        observations?: string;
        invoiceType: number;
    }
    type Neto = Record<string, {
        Id: number;
        BaseImp: number;
        Importe: number;
    }>;
}
export {};
