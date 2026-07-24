declare global {
    interface Supplier {
        storeId: string;
        userId: string;
        supplierId: string;
        createdAt: number;
        photoURL: string;
        photoData?: string;
        removePhotoURL?: string;
        company: string;
        cuit: string;
        razonSocial: string;
        contactName: string;
        phone: string;
        email: string;
        balance: number;
        currencyId: string;
        service: boolean;
        disabled: boolean;
    }
    interface SupplierInvoice {
        storeId: string;
        userId: string;
        invoiceId: string;
        supplierId: string;
        createdAt: number;
        type: 'FAC' | 'ND' | 'NC';
        dated: number;
        number: string;
        razonSocial: string;
        cuit: string;
        neto: number;
        iva10: number;
        iva21: number;
        total: number;
        per_iibb: number;
        per_iva: number;
        file: string;
        currency?: string;
        currencyValue: number;
        currencyValueAt?: number;
        search?: string;
        neto10?: number;
        neto21?: number;
        neto27?: number;
        iva27?: number;
        noGravado?: number;
        exento?: number;
        cbteClass?: 'A' | 'B' | 'C';
        voucherDate?: number;
        pointOfSale?: number;
        invoiceNumber?: number;
        authorizationCode?: string;
        authorizationMode?: 'CAE' | 'CAEA' | 'CAI';
        constatacion?: SupplierInvoiceConstatacion;
    }
    type SupplierInvoiceCheckStatus = 'pending' | 'passed' | 'warning' | 'failed' | 'not_applicable' | 'error';
    interface SupplierInvoiceConstatacion {
        status: SupplierInvoiceCheckStatus;
        result?: 'A' | 'O' | 'R';
        reason?: string;
        observations?: InvoiceObservation[];
        verifiedAt?: string;
    }
    /**
     * WSCDC `ConstatarComprobante` request (api#1500) -- verifies a
     * third-party (supplier) voucher was genuinely authorized by ARCA before
     * it's booked/credited as IVA input. Fields per the ticket's tech spec.
     */
    interface VoucherVerificationRequest {
        cuit: string;
        pointOfSale: number;
        invoiceType: number;
        invoiceNumber: number;
        dated: number;
        total: number;
        authorizationCode: string;
        authorizationMode?: 'CAE' | 'CAEA' | 'CAI';
        receptorDocType?: number;
        receptorDocNumber?: string;
    }
    /**
     * WSCDC `ConstatarComprobante` result (api#1500). `result` mirrors the
     * A/O/R convention already used for `FECAESolicitar`'s own `Resultado`
     * and `FiscalAuditEvent` (Aceptado/Observado/Rechazado) -- every
     * verification call is also logged to that same audit table per the
     * ticket's AC (`FiscalAuditEvent.operation` includes `ConstatarComprobante`).
     */
    interface VoucherVerificationResult {
        result: 'A' | 'O' | 'R';
        reason?: string;
        observations?: InvoiceObservation[];
        verifiedAt: string;
    }
    /**
     * WSCDC endpoint error-code vocabulary (api#1682) -- the 502 `error` values
     * of `POST /afip {mode:'wscdc'}` (mirrors the MlOauthErrorCode pattern).
     * Producer: api `stacks/lambdas/afip/helpers/wscdc.ts`
     * (`ConstatarComprobanteOutcome`). `WSCDC_NOT_CONFIGURED` = expected
     * pre-enablement state (FE: disabled panel + Sentry suppression); the other
     * two are genuine incidents that must surface.
     */
    type WscdcErrorCode = 'WSCDC_NOT_CONFIGURED' | 'WSCDC_AUTH_FAILED' | 'WSCDC_COMPROBANTE_CONSTATAR_FAILED';
    /**
     * `GET /reports?mode=supplier-invoices` per-date resume row (api#1550) --
     * compras-side mirror of the ventas `mode=invoices` resume shape. Unlike
     * ventas Invoice, SupplierInvoice has no CAE-authorization concept, so
     * every row in range counts (no fiscalStatus filter).
     */
    interface SupplierInvoicesResumeRow {
        date: number;
        quantity: number;
        neto10: number;
        neto21: number;
        neto27: number;
        iva10: number;
        iva21: number;
        iva27: number;
        noGravado: number;
        exento: number;
        total: number;
    }
    interface ReportSupplierInvoicesResponse {
        resume: SupplierInvoicesResumeRow[];
    }
    interface SupplierAccount {
        storeId: string;
        userId: string;
        accountId: string;
        supplierId: string;
        createdAt: number;
        dated: number;
        fullName: string;
        subject: string;
        details: string;
        debit: number;
        credit: number;
        amount: number;
        currency?: string;
        currencyValue: number;
        currencyValueAt?: number;
        balance: number;
        deleted: boolean;
    }
}
export {};
