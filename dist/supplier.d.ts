declare global {
    /** Write shape for supplier create/update — carries the transient photo controls. */
    type SupplierUpsertInput = Partial<Supplier> & PhotoUploadControls;
    interface Supplier {
        storeId: string;
        userId: string;
        supplierId: string;
        createdAt: number;
        photoURL: string;
        /** @deprecated Request-only upload control (transient base64), never persisted or returned — use `SupplierUpsertInput.photoData`. */
        photoData?: string;
        /** @deprecated Request-only control, never persisted or returned — use `SupplierUpsertInput.removePhotoURL`. */
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
        invoiceId: string;
        userId: string;
        /**
         * Optional in the write schema and never defaulted — a row CAN persist
         * without it (normal persisted attribute, NOT key-derived).
         */
        supplierId?: string;
        createdAt: number;
        type: 'FAC' | 'ND' | 'NC';
        dated: number;
        number: string;
        razonSocial: string;
        cuit: string;
        /** Optional: unmodeled by the write schema and never defaulted — legacy and partial rows lack it. */
        neto?: number;
        /** Optional in the write schema; readers must default to 0. */
        iva10?: number;
        /** Optional in the write schema; readers must default to 0. */
        iva21?: number;
        total: number;
        /** Optional: unmodeled by the write schema; readers must default to 0. */
        per_iibb?: number;
        /** Optional: unmodeled by the write schema; readers must default to 0. */
        per_iva?: number;
        /** Present only when a PDF was actually stored for the row (and cleared when removed). */
        file?: string;
        currency?: string;
        /** Optional: stamped only when an FX resolution was available at write time; absence preserves any stored rate. */
        currencyValue?: number;
        currencyValueAt?: number;
        /**
         * @deprecated Lowercase '#'-joined WRITE-SIDE index, stamped on every
         * insert/update. Internal — not part of the read contract, even where
         * legacy responses still include it; never consume it.
         */
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
        /**
         * DynamoDB TTL, Unix SECONDS. Mirrors `Invoice.ttl`.
         *
         * ⚠️ A COST BOUNDARY on the hot tier — it carries no legal meaning and is NOT
         * the fiscal retention term. **Never surface this to a user as a retention or
         * expiry date.** The no-expiry S3 PDF is the record of retention.
         *
         * Optional: forward-only, so older rows carry no ttl.
         */
        ttl?: number;
        /** Buyer-side FCE state. Present only when this row IS an FCE voucher. */
        fce?: SupplierInvoiceFce;
    }
    /**
     * Buyer/receiving side of an FCE MiPyME, on the tenant that RECEIVED the
     * credit instrument.
     *
     * ⚠️ Deliberately NOT `FceFields`, and the two must not be merged. `FceFields`
     * is written at EMISSION time from the issuer's viewpoint and carries `cbu`
     * and `sca` — the EMISOR's fields on the instrument, which a buyer never sets.
     * Its `FceStatus` opens with `'emitted'`, an event that on a SupplierInvoice
     * belongs to somebody else and cannot express the state the buyer actually
     * needs: "an accept/reject is owed and the clock is running". Sharing one enum
     * across both sides is precisely the semantic collision `typecheck` cannot police.
     */
    type SupplierInvoiceFceStatus = 'pending' | 'accepted' | 'rejected' | 'ceded';
    interface SupplierInvoiceFce {
        status: SupplierInvoiceFceStatus;
        statusChangedAt?: string;
        acceptanceDeadline?: string;
        /** ARCA cuenta-corriente id — the `codCtaCte` branch of `IdCtaCteType`. */
        codCtaCte?: number;
        /**
         * ARCA voucher-type code (201/206/211 …).
         *
         * ⚠️ NOT redundant with `cbteClass` + `pointOfSale` + `invoiceNumber`. Those
         * satisfy every part of ARCA's `idFactura: { CUITEmisor, codTipoCmp, ptoVta,
         * nroCmp }` branch EXCEPT the numeric voucher type, and the repo's only
         * letter→code mapping (`CBTE_TIPO_GRID`) covers FAC/ND/NC × A/B/C only,
         * mapping everything else — FCE included — to `null`. Without this field a
         * SupplierInvoice cannot express that it IS an FCE voucher.
         *
         * It lives here rather than widening `cbteClass` on purpose: widening would
         * ripple into constatación, and FCE genuinely is not WSCDC-constatable, so
         * that `null` is correct behaviour rather than a defect to route around.
         */
        codTipoCmp?: number;
        /** The EMISOR's CBU. The buyer never sets this — recorded as observed. */
        emisorCbu?: string;
        cesionId?: string;
        /** From WSFECRED `MotivoRechazoType`, stamped when THIS tenant rejected. */
        rejection?: {
            codMotivo: number;
            descMotivo: string;
            justificacion: string;
        };
    }
    type SupplierInvoiceCheckStatus = 'pending' | 'passed' | 'warning' | 'failed' | 'not_applicable' | 'error';
    type SupplierInvoiceNotApplicableReason = 'not_constatable' | 'wscdc_not_configured' | 'wscdc_not_authorized';
    interface SupplierInvoiceConstatacion {
        status: SupplierInvoiceCheckStatus;
        result?: 'A' | 'O' | 'R';
        reason?: string;
        notApplicableReason?: SupplierInvoiceNotApplicableReason;
        observations?: InvoiceObservation[];
        verifiedAt?: string;
    }
    /**
     * WSCDC `ConstatarComprobante` request -- verifies a
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
     * WSCDC `ConstatarComprobante` result. `result` mirrors the
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
     * WSCDC endpoint error-code vocabulary -- the 502 `error` values
     * of `POST /afip {mode:'wscdc'}` (mirrors the MlOauthErrorCode pattern).
     * Producer: api `stacks/lambdas/afip/helpers/wscdc.ts`
     * (`ConstatarComprobanteOutcome`). `WSCDC_NOT_CONFIGURED` = expected
     * pre-enablement state (FE: disabled panel + Sentry suppression); the other
     * two are genuine incidents that must surface.
     */
    type WscdcErrorCode = 'WSCDC_NOT_CONFIGURED' | 'WSCDC_AUTH_FAILED' | 'WSCDC_COMPROBANTE_CONSTATAR_FAILED';
    /**
     * `GET /reports?mode=supplier-invoices` per-date resume row --
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
        /**
         * Mirrors `Account.kind` — see that field's contract. Absent = an
         * ordinary movement. Reconciliation is by `currency`, never by a
         * pointer, and the rate trace belongs in `details`.
         */
        kind?: 'fxAdjustment';
        currency?: string;
        currencyValue: number;
        currencyValueAt?: number;
        balance: number;
        deleted: boolean;
    }
}
export {};
