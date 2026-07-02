declare global {
    type FiscalStatus = 'pending_cae' | 'authorized_cae' | 'authorized_caea' | 'caea_reported' | 'rejected' | 'voided';
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
        currency?: string;
        currencyValue?: number;
        currencyValueAt?: number;
        fiscalCondition: string;
        condicionIvaReceptor?: number;
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
        fiscalStatus?: FiscalStatus;
        arcaError?: ArcaError;
        arcaObservations?: InvoiceObservation[];
        caea?: string;
        caeaPeriod?: string;
        export?: ExportInvoiceFields;
        fce?: FceFields;
        serviceStartDate?: number;
        serviceEndDate?: number;
        paymentDueDate?: number;
        serviceOrderId?: string;
        attemptedCbteNro?: number;
        attemptedCbteFch?: string;
        invoicePrinted?: boolean;
    }
    interface InvoiceItem {
        code: string;
        description: string;
        quantity: number;
        iva: number;
        neto: number;
        unitPrice?: number;
        listId?: number;
        appliedMinQty?: number;
        promoApplied?: boolean;
        basePrice?: number;
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
        currency: string;
        currencyValue: number;
        total: number;
        observations?: string;
        invoiceType: number;
        condicionIvaReceptor?: number;
    }
    type Neto = Record<string, {
        Id: number;
        BaseImp: number;
        Importe: number;
    }>;
    /**
     * `GET /reports?mode=libro-iva-digital&date=YYYYMM[&book=ventas|compras|all]`
     * response (api#1501, RG 4597). Returns the four CRLF-terminated
     * fixed-width payloads; an empty string means an empty period or a book
     * not requested. See docs/LIBRO_IVA_DIGITAL.md.
     */
    interface LibroIvaDigitalResponse {
        period: string;
        ventasCbte: string;
        ventasAlicuotas: string;
        comprasCbte: string;
        comprasAlicuotas: string;
    }
    /**
     * ARCA Obs.Code/Obs.Msg pair, parsed from FECAESolicitar's Observaciones[]
     * when Resultado='O' (approved-with-warnings). (api#1559)
     *
     * `code`/`msg` naming matches the already-shipped `FiscalAuditEvent.observaciones`
     * / `.errores` shape (api#1498, audit.ts) rather than inventing a second
     * convention for the same ARCA concept.
     */
    interface InvoiceObservation {
        code: number;
        msg: string;
    }
    /**
     * Structured ARCA rejection/observation error (api#1380). Reused by
     * `CAEAInformResult.errors` below rather than inventing a second shape.
     */
    interface ArcaError {
        code: number;
        msg: string;
        category?: 'data_validation' | 'authorization' | 'fiscal_rules' | 'service' | 'infrastructure';
        observations?: string[];
    }
    /** A single CAEA fortnightly period, requested and tracked per store. */
    interface CAEAPeriod {
        storeId: string;
        period: string;
        caea: string;
        validFrom: string;
        validTo: string;
        status: 'active' | 'used' | 'informed' | 'expired';
        invoiceCount: number;
        informedAt?: string;
    }
    /** Result of requesting a new CAEA code for an upcoming period. */
    interface CAEARequestResult {
        period: CAEAPeriod;
        requestedAt: string;
    }
    /** Result of informing ARCA of CAEA-stamped invoices for a period. */
    interface CAEAInformResult {
        period: string;
        invoiceCount: number;
        informedAt: string;
        errors?: ArcaError[];
    }
    /** Export-invoice-specific fields, present only when Invoice.invoiceType === 19 (Factura E). */
    interface ExportInvoiceFields {
        dstCmp: number;
        idImpositivo?: string;
        monedaId: string;
        monedaCtz: number;
        incoterms?: string;
        incotermsDs?: string;
        permisoExistente?: 'S' | 'N';
        permisoExistenteTipo?: string;
        permisoExistenteNro?: string;
        idiomaCbte: 1 | 2 | 3;
        /** "Cancelación en Misma Moneda Extranjera" -- required only when settled in the same
         * foreign currency the invoice was issued in (RG 5616/2024 FX-precision rule reaching
         * voucher class E; added to the WSFEXV1 manual in v3.0.0, 2025-03-17). */
        canMisMonExt?: boolean;
    }
    /** Reference data cached from WSFEXV1 `GetPARAM_*` operations, refreshed on a schedule. */
    interface WsfexReferenceData {
        currencies: {
            id: string;
            name: string;
        }[];
        countries: {
            id: number;
            name: string;
        }[];
        incoterms: {
            id: string;
            name: string;
        }[];
        languages: {
            id: 1 | 2 | 3;
            name: string;
        }[];
        voucherTypes: {
            id: number;
            name: string;
        }[];
        exportTypes: {
            id: number;
            name: string;
        }[];
        fetchedAt: string;
    }
    type FceStatus = 'emitted' | 'accepted' | 'rejected' | 'ceded';
    /** FCE-specific fields, present only when Invoice.invoiceType is 201/202/203, 206/207/208, or 211/212/213. */
    interface FceFields {
        cbu: string;
        sca: boolean;
        status: FceStatus;
        statusChangedAt?: string;
        acceptanceDeadline: string;
        cesionId?: string;
    }
    /**
     * The annually/periodically-adjusted FCE threshold -- do not hard-code the
     * amount anywhere else; read it from this single config source.
     */
    interface FceThresholdConfig {
        amountArs: number;
        effectiveFrom: string;
        acceptanceWindowDays: number;
        acceptanceWindowValidThrough?: string;
    }
}
export {};
