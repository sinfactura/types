declare global {
    type FiscalStatus = 'pending_cae' | 'authorized_cae' | 'authorized_caea' | 'caea_reported' | 'rejected' | 'voided';
    /**
     * One discriminated IVA alicuota on an issued voucher.
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
         * The FULL per-alicuota IVA breakdown, one entry per declared rate.
         *
         * The `neto10`/`neto21`/`iva10`/`iva21` quartet above only ever captured AFIP
         * Iva Ids 4 (10,5 %) and 5 (21 %). The catalog has SIX rates, so the other
         * four (0 %, 2,5 %, 5 %, 27 %) were declared to ARCA yet dropped from the row,
         * while `total` included every bucket — silently under-reporting the Libro IVA
         * Digital, the RG 3685 export, the F.2051 apertura and the invoice PDF.
         *
         * Forward-only, no backfill: absent on every row issued before this field
         * shipped, and never set on the WSFEX export path. Consumers MUST fall back
         * to the legacy quartet when it is absent rather than treating an empty
         * result as "no IVA". The quartet is retained, not deprecated — still
         * written on every new row.
         */
        alicuotas?: InvoiceAlicuota[];
        discount?: number;
        total: number;
        cae: string;
        caeExpiration: string;
        observations?: string;
        fiscalStatus?: FiscalStatus;
        /**
         * ARCA voucher number carried on PENDING credit-note rows: sent request-side
         * on NC creation and persisted only when the row is written with a pending
         * cause. Distinct from `invoiceNumber`; absent on every other row.
         */
        cbte_numero?: number;
        arcaError?: ArcaError;
        arcaObservations?: InvoiceObservation[];
        arcaEvents?: InvoiceObservation[];
        facturaMLegend?: 'retencion' | 'cbu_informada';
        cbu?: string;
        iibbLegends?: Array<{
            jurisdiction: string;
            lines: string[];
            /** Frozen alicuota, percent (e.g. 3.5), for jurisdictions that annotate the
             * ITEM TABLE rather than only the footer — Entre Rios (ATER 128/26 art. 3)
             * prints the rate beside each line's IVA rate. `lines` freezes footer text
             * only, so without this the item-table figure would still be re-derived
             * from live store config at render time, which is exactly the defect the
             * rest of this block exists to close.
             *
             * Deliberately NOT paired with a frozen amount: Entre Rios' document-level
             * total is `neto gravado x rate`, and the neto is already immutable on this
             * row, so the rate is the only live-config input. Do not add `amount` --
             * two sources for one figure is how they drift. */
            rate?: number;
        }>;
        caea?: string;
        caeaPeriod?: string;
        caeaDet?: CaeaInformDet;
        export?: ExportInvoiceFields;
        fce?: FceFields;
        /**
         * Whether the long-term archive write for this invoice succeeded.
         *
         * Stamped only once an archive attempt has resolved, so ABSENT means "not
         * yet attempted or not yet resolved" — never "succeeded". A reader looking
         * for work must therefore test `attribute_not_exists(archiveState) OR
         * archiveState = 'failed'`, never `archiveState <> 'ok'`: the inequality
         * form silently skips every row written before this field existed, which is
         * every row that exists today.
         */
        archiveState?: 'ok' | 'failed';
        /**
         * The service period actually declared to ARCA, frozen at issue time. Unix ms.
         *
         * These are a STAMPED COPY, not an input: the voucher is built from the
         * `Order` (`Order.serviceStartDate` / `serviceEndDate`), which is what the
         * live submission, the CAEA snapshot and the ARCA drain all read — the drain
         * re-reads the live Order and rebuilds, so the Order is the single source.
         * Present only on a service invoice (AFIP Concepto 2 or 3); absent means the
         * voucher reported same-day, which is correct for a goods sale.
         *
         * Payment due rides `dueDate` below, NOT a field of its own — an earlier
         * `paymentDueDate` here duplicated it and never had a reader.
         */
        serviceStartDate?: number;
        serviceEndDate?: number;
        serviceOrderId?: string;
        /**
         * The ServiceOrder the originating ticket was a rework OF. A STAMPED COPY of
         * `Order.parentServiceOrderId`, taken by the same route and at the same
         * instant as `serviceOrderId` above, on both the domestic and the
         * WSFEX/export branch. Absent unless the ticket is itself a rework.
         */
        parentServiceOrderId?: string;
        attemptedCbteNro?: number;
        attemptedCbteFch?: string;
        invoicePrinted?: boolean;
        /**
         * Server-derived ms epoch, stamped by the WSS `ack` handler on an
         * `ACK_PRINTED` correlating to this row's CURRENT `printJobId`.
         * **Absent = not confirmed printed** — never seeded to `0`, and cleared on
         * every reprint. Distinct from `invoicePrinted`, stamped optimistically at dispatch.
         */
        printedAt?: number;
        /** BE-minted pointer to the most recent print dispatch. Last-write-wins on reprint. */
        printJobId?: string;
        /**
         * DynamoDB TTL, Unix SECONDS. A COST BOUNDARY on the hot tier — carries no
         * legal meaning and is NOT the fiscal retention term; never surface as a
         * retention/expiry date. The no-expiry S3 cold archive is the retention
         * record (~12 years, not even a fixed term — Ley 11.683 arts. 65/67 suspend
         * and interrupt the prescription it derives from). Optional: forward-only.
         */
        ttl?: number;
        /**
         * Expected payment due date, Unix ms. Unrelated to `ttl` above (a DDB cost
         * boundary) and to `caeExpiration` (an ARCA authorization window) — this is
         * a commercial payment term.
         *
         * Feeds AFIP `FchVtoPago`, which ARCA requires on every service voucher
         * (Concepto 2/3) AND on every FCE regardless of Concepto (code 10163).
         * Precedence at build time: the FCE request's own `fchVtoPago`, else the
         * ORDER's `dueDate`, else the invoice date. Stamped here from the order at
         * issue time, so this row records what was actually declared.
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
        /**
         * The per-line figures EXACTLY as sent to WSFEX `FEXAuthorize` — the
         * `Pro_precio_uni` and `Pro_total_item` of this line's `IFexItem`.
         *
         * ⚠️ **Voucher currency, never pesos.** On an export voucher the header
         * carries one `MonId`/`MonCotiz` and every line is already converted to it,
         * so these are denominated in the voucher's currency at the voucher's rate —
         * a factor of `export.monedaCtz` away from the peso figures on the same row.
         *
         * ⚠️ **Do not confuse `fex.precioUni` with `unitPrice` above.** `unitPrice`
         * is the PESO per-unit total; `fex.precioUni` is `Pro_precio_uni`, in voucher
         * currency and carried at 6 decimal places. Same concept, different
         * denomination and different precision — there is no safe arithmetic
         * relationship between them that does not go through the rate.
         *
         * Exists so the rendered breakdown cannot silently disagree with the voucher
         * it claims to represent. The PDF otherwise RE-DERIVES each line from the
         * persisted peso base, which is an independent computation that has already
         * drifted from the issuance path in production once. Persisting closes the
         * class rather than the instance; a renderer should prefer this and fall back
         * to re-derivation only when it is absent.
         *
         * ⚠️ **This is what WE SENT, not an echo from ARCA.** WSFEX's authorize
         * response carries header fields only — it returns no per-line data at all —
         * so no per-line figure here was ever confirmed back by ARCA. What the CAE
         * attests is that `FEXAuthorize` returned an authorization for exactly this
         * request.
         *
         * Forward-only: absent on every row written before this shipped, and absent
         * by design on peso (`PES`) vouchers and on every non-export invoice. Absent
         * means "not stamped", never zero.
         */
        fex?: {
            precioUni: number;
            totalItem: number;
        };
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
     * response, RG 4597. Returns the four CRLF-terminated
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
     * `GET /reports?mode=iva-simple-apertura&date=YYYYMM` response,
     * IVA Simple F.2051. `rows` is the CRLF-terminated, header-less apertura
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
     * when Resultado='O' (approved-with-warnings).
     *
     * `code`/`msg` naming matches the already-shipped `FiscalAuditEvent.observaciones`
     * / `.errores` shape (audit.ts) rather than inventing a second
     * convention for the same ARCA concept.
     */
    interface InvoiceObservation {
        code: number;
        msg: string;
    }
    /**
     * Structured ARCA rejection/observation error. Reused by
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
     * `FECAEARegInformativo` step. PascalCase keys are AFIP wire
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
     * export voucher (19 Factura E / 20 ND E / 21 NC E). Amended per the
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
        /**
         * The `Imp_total` WSFEX actually AUTHORIZED, stamped exactly as submitted.
         *
         * ⚠️ Voucher currency, never pesos — it is the figure ARCA holds against
         * this CAE, so a reader that converts it has changed what the voucher says.
         *
         * ⚠️ OPTIONAL, and that is load-bearing rather than caution: writes here are
         * forward-only and never backfilled, so every row written before this field
         * existed lacks it permanently. A reader MUST tolerate its absence and fall
         * back to re-deriving the total. Making it required would make every
         * historical row fail to typecheck as an `Invoice`.
         */
        impTotal?: number;
    }
    /** Reference data cached from WSFEXV1 `GetPARAM_*` operations, refreshed on a schedule.
     * Persists as the platform-wide singleton PLATFORM / WSFEX_PARAMS (AFIP-global tables,
     * not per-store). */
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
     * not per-store); mirrors WsfexReferenceData. */
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
         * Epoch-ms last-write trace, set by the api on every threshold
         * write and echoed on GET /config + the POST response (api PLATFORM_API.md
         * section 20). OPTIONAL by design: a row written before the field carries
         * none, so a reader must not treat its absence as "never updated".
         */
        updatedAt?: number;
    }
}
export {};
