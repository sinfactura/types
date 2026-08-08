declare global {
    type FiscalStatus = 'pending_cae' | 'authorized_cae' | 'authorized_caea' | 'caea_reported' | 'rejected' | 'voided';
    /**
     * One discriminated IVA alicuota on an issued voucher (api#1961).
     *
     * `id` is AFIP's WSFE `Iva[].Id`, which is ALSO the Libro IVA Digital alicuota
     * code once 4-padded — verified against ARCA's *Tablas del SISTEMA* section 1:
     * 0003 = 0,00 % · 0004 = 10,50 % · 0005 = 21,00 % · 0006 = 27,00 % ·
     * 0008 = 5,00 % · 0009 = 2,50 %. Those six are the whole valid domain; Ids 1
     * and 2 (No Gravado / Exento) are Codigos de Operacion, not alicuotas, and
     * WSFEv1 rejects them inside `Iva[]`.
     *
     * A bucket is meaningful when `baseImp !== 0`: a 0 %-rated line has
     * `importe === 0` but is still a real, declarable alicuota.
     */
    interface InvoiceAlicuota {
        /** AFIP WSFE `Iva[].Id` — one of 3, 4, 5, 6, 8, 9. */
        id: number;
        /** Neto gravado at this rate. */
        baseImp: number;
        /** IVA liquidado at this rate; `0` for the 0 % rate. */
        importe: number;
    }
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
        /**
         * api#1961 — the FULL per-alicuota IVA breakdown, one entry per declared rate.
         *
         * The `neto10`/`neto21`/`iva10`/`iva21` quartet above only ever captured AFIP
         * Iva Ids 4 (10,5 %) and 5 (21 %). The catalog has SIX rates, so the other
         * four (0 %, 2,5 %, 5 %, 27 %) were declared to ARCA yet dropped from the row,
         * while `total` included every bucket — silently under-reporting the Libro IVA
         * Digital, the RG 3685 export, the F.2051 apertura and the invoice PDF.
         *
         * Forward-only, no backfill: absent on every row issued before api#1961, and
         * never set on the WSFEX export path. Consumers MUST fall back to the legacy
         * quartet when it is absent rather than treating an empty result as "no IVA".
         * The quartet is retained, not deprecated — still written on every new row.
         */
        alicuotas?: InvoiceAlicuota[];
        discount?: number;
        total: number;
        cae: string;
        caeExpiration: string;
        observations?: string;
        fiscalStatus?: FiscalStatus;
        arcaError?: ArcaError;
        arcaObservations?: InvoiceObservation[];
        arcaEvents?: InvoiceObservation[];
        facturaMLegend?: 'retencion' | 'cbu_informada';
        cbu?: string;
        caea?: string;
        caeaPeriod?: string;
        caeaDet?: CaeaInformDet;
        export?: ExportInvoiceFields;
        fce?: FceFields;
        serviceStartDate?: number;
        serviceEndDate?: number;
        paymentDueDate?: number;
        serviceOrderId?: string;
        attemptedCbteNro?: number;
        attemptedCbteFch?: string;
        invoicePrinted?: boolean;
        /**
         * Server-derived ms epoch (api#642), stamped by the WSS `ack` handler on an
         * `ACK_PRINTED` that correlates to this row's CURRENT `printJobId`.
         *
         * **Absent = not confirmed printed** — never seeded to `0`. Cleared on every
         * reprint, so it only ever describes the current `printJobId`. Distinct from
         * `invoicePrinted`, which is stamped optimistically at dispatch.
         */
        printedAt?: number;
        /** BE-minted pointer to the most recent print dispatch (api#642). Last-write-wins on reprint. */
        printJobId?: string;
        /**
         * DynamoDB TTL, Unix SECONDS (api#1559).
         *
         * ⚠️ A COST BOUNDARY on the hot tier — it carries no legal meaning and is NOT
         * the fiscal retention term. **Never surface this to a user as a retention or
         * expiry date.** The no-expiry S3 cold archive is the record of retention
         * (api#1949): the duty runs to ~12 years from the operation and is not even a
         * fixed term, since Ley 11.683 arts. 65/67 suspend and interrupt the
         * prescription it derives from.
         *
         * Optional: forward-only, so rows written before api#1559 carry no ttl.
         */
        ttl?: number;
        /**
         * Expected payment due date, Unix ms (api#713 / types#110).
         *
         * Optional and forward-only. Unrelated to `ttl` above (a DDB cost boundary)
         * and to `caeExpiration` (an ARCA authorization window) — this is a
         * commercial payment term.
         *
         * ⚠️ DECLARATIVE ONLY — nothing populates it. No invoice creation path
         * writes `dueDate`, and `invoicePostSchema` strips it from the request
         * body, so it is absent on every stored invoice. Reserved for the dunning
         * work in api#713, which is open and deliberately blocked. Mirrors the
         * caveat its Order twin already carries.
         */
        dueDate?: number;
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
     * `GET /reports?mode=iva-simple-apertura&date=YYYYMM` response (api#1741,
     * IVA Simple F.2051). `rows` is the CRLF-terminated, header-less apertura
     * CSV (`;` separators, `,` decimals) for the accountant to import into
     * Portal IVA; empty string = empty period. `count` = aggregated bucket
     * rows, NOT source vouchers. Requires `Afip.actividades` configured —
     * otherwise `400 ACTIVIDADES_NOT_CONFIGURED`.
     */
    interface IvaSimpleAperturaResponse {
        period: string;
        rows: string;
        count: number;
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
        fchTopeInf?: string;
        order?: 1 | 2;
        phase?: 'upcoming' | 'active' | 'past';
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
        pendingInvoices: number;
        classification?: 'inform' | 'recovered' | 'zero-movement' | 'drift';
    }
    /**
     * Frozen `FECAEADetRequest`-shaped snapshot, persisted on `Invoice.caeaDet`
     * at CAEA-stamp time and replayed verbatim by the deferred
     * `FECAEARegInformativo` step (api#1580). PascalCase keys are AFIP wire
     * vocabulary, stored exactly as the voucher body was built at stamp time.
     * Array fields (`Iva`, `CbtesAsoc`, `Tributos`) stay FLAT here (the afip.ts
     * SDK-wrapper flavor); the Inform sender re-nests them into the raw SOAP
     * envelope shape (`Iva: { AlicIva: [...] }`, etc.) at call time.
     */
    interface CaeaInformDet {
        Concepto: number;
        DocTipo: number;
        DocNro: number;
        CbteDesde: number;
        CbteHasta: number;
        CbteFch: string;
        FchServDesde?: string;
        FchServHasta?: string;
        FchVtoPago?: string;
        ImpTotal: number;
        ImpTotConc: number;
        ImpNeto: number;
        ImpOpEx: number;
        ImpIVA: number;
        ImpTrib: number;
        MonId: string;
        MonCotiz: number;
        CanMisMonExt?: number;
        CondicionIVAReceptorId?: number;
        Iva?: {
            Id: number;
            BaseImp: number;
            Importe: number;
        }[];
        CbtesAsoc?: {
            Tipo: number;
            PtoVta: number;
            Nro: number;
            Cuit?: string;
            CbteFch?: string;
        }[];
        Tributos?: {
            Id: number;
            Desc?: string;
            BaseImp: number;
            Alic: number;
            Importe: number;
        }[];
        CAEA: string;
        CbteFchHsGen: string;
    }
    /** Export-invoice-specific fields, present only when Invoice.invoiceType is an
     * export voucher (19 Factura E / 20 ND E / 21 NC E). Amended per the api#1557
     * preflight read of the WSFEX manual (v2.0.1 §2.1.3). */
    interface ExportInvoiceFields {
        /** Tipo_expo: 1=exportación definitiva de bienes, 2=servicios (RG 4401), 4=otros.
         * REQUIRED on the wire — drives every Permiso rule (err 1720). */
        tipoExpo: 1 | 2 | 4;
        dstCmp: number;
        cliente: string;
        domicilioCliente: string;
        /** Cuit_pais_cliente (GetPARAM_DST_CUIT) — ONE OF this or idImpositivo is required (err 1580). */
        cuitPaisCliente?: number;
        idImpositivo?: string;
        /** AFIP-wire projection of Invoice.currency (GetPARAM_MON code, e.g. "DOL") — MUST agree
         * with the row's own currency stamp; never a second source of truth. */
        monedaId: string;
        /** AFIP-wire projection of Invoice.currencyValue (Moneda_Ctz) — MUST agree with the row. */
        monedaCtz: number;
        incoterms?: string;
        incotermsDs?: string;
        /** 'S'/'N'; MUST be absent when Cbte_Tipo is 20/21, or 19 with tipoExpo 2/4 (err 1550). */
        permisoExistente?: 'S' | 'N';
        permisoExistenteTipo?: string;
        permisoExistenteNro?: string;
        idiomaCbte: 1 | 2 | 3;
        fechaPago?: string;
        /** "Cancelación en Misma Moneda Extranjera" — wire value 'S'/'N' (was boolean pre-1.6.42;
         * zero consumers existed). Required when settled in the same foreign currency the invoice
         * was issued in; Moneda_Ctz must then match BNA's prior-business-day quote (RG 5616/2024,
         * WSFEX manual v3.0.0 2025-03-17; error codes 1602-1607). */
        canMisMonExt?: 'S' | 'N';
    }
    /** Reference data cached from WSFEXV1 `GetPARAM_*` operations, refreshed on a schedule.
     * Persists as the platform-wide singleton PLATFORM / WSFEX_PARAMS (AFIP-global tables,
     * not per-store) — api#1557. */
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
        /** GetPARAM_UMed — Pro_umed is REQUIRED per line item; the Factura E form needs this catalog. */
        unitsOfMeasure: {
            id: number;
            name: string;
        }[];
        /** GetPARAM_MON_CON_COTIZACION — currencies quotable for service exports (tipoExpo 2). */
        currenciesWithQuote?: {
            id: string;
            name: string;
        }[];
        fetchedAt: string;
    }
    /** WSFECRED rejection-motivo catalog (`consultarTiposMotivosRechazo`), refreshed on a
     * schedule. Persists as the platform-wide singleton PLATFORM / FCE_MOTIVOS (AFIP-global,
     * not per-store) — api#1647; mirrors WsfexReferenceData. */
    interface FceMotivosCatalog {
        motivos: {
            codigo: number;
            descripcion?: string;
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
        /**
         * api#1754 — epoch-ms last-write trace, set by the api on every threshold
         * write and echoed on GET /config + the POST response (api PLATFORM_API.md
         * section 20). OPTIONAL by design: a row written before the field carries
         * none, so a reader must not treat its absence as "never updated".
         */
        updatedAt?: number;
    }
}
export {};
