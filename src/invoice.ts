declare global {
  // Fiscal lifecycle state. V1.0 issues only `authorized_cae`, `pending_cae`,
  // `rejected`, `voided`; CAEA states ship in V1.2 (ADR-0012) but are defined
  // up-front to avoid a breaking type change on retrofit. Optional on Invoice
  // for backwards compatibility — existing rows treat absence as
  // `authorized_cae` (the implicit V1.0 happy path).
  type FiscalStatus =
    | 'pending_cae'
    | 'authorized_cae'
    | 'authorized_caea'
    | 'caea_reported'
    | 'rejected'
    | 'voided';

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

    invoiceType: number; // CBTE_TIPO / 1 FAC A  / 6 FAC B
    pointOfSale: number;
    invoiceNumber: number;
    razonSocial: string;
    address: string; // address and postalCode
    location: string; // city and province
    concept: number; // CONCEPTO 1 productos 2 servicios
    // cuitType/cuit carry the RESOLVED receptor identity declared on the voucher
    // (explicit docType/docNumber override, or the condFiscal-derived fallback):
    // cuitType = ARCA DocTipo (80 CUIT / 86 CUIL / 96 DNI / 99 CF), cuit = DocNro
    // as string ('0' for CF). An NC freezes its identity to the original FAC's values.
    cuitType: number;
    cuit: string;
    // catalogId — FK to PlatformCurrency. AFIP `'PES'/'DOL'` projection happens
    // at invoice-write time via `catalog.afipCode`.
    currency?: string;
    currencyValue?: number;
    currencyValueAt?: number; // Unix ms at which `currencyValue` was effective (ADR-0013)
    fiscalCondition: string; // COND_FISCAL / RESPONSABLE INSCRIPTO
    // ARCA RG 5616 — buyer's IVA condition under the 1-13 codeset, mapped
    // server-side from legacy `condFiscal` (20/30/32/96/99). Audit field: the value sent to AFIP.
    condicionIvaReceptor?: number;
    paymentCondition: string; // COND_VENTA
    deliveryCondition: string; // COND_ENTREGA

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
    observations?: string; // afip observations
    // ARCA fiscal lifecycle (split A). Optional — absent means `authorized_cae`
    // (V1.0 implicit happy path). BE sets `pending_cae` on WSFEv1 network failure,
    // `rejected` on business validation errors. See ADR-0012 for the CAEA states.
    fiscalStatus?: FiscalStatus;
    /**
     * ARCA voucher number carried on PENDING credit-note rows: sent request-side
     * on NC creation and persisted only when the row is written with a pending
     * cause. Distinct from `invoiceNumber`; absent on every other row.
     */
    cbte_numero?: number;
    // Structured ARCA rejection detail, present when fiscalStatus === 'rejected';
    // supersedes regex-parsing the legacy `observations` string above.
    arcaError?: ArcaError;
    // ARCA observaciones — structured Resultado='O' warnings parsed from every
    // FECAESolicitar response. A NEW field rather than widening `observations`
    // above, which is free text already consumed as FiscalStatusBanner's errorMessage (app).
    arcaObservations?: InvoiceObservation[];
    // ARCA events — AFIP's Events.Evt[], the third message array alongside
    // Observaciones.Obs[] (above) and Errors.Err[]: envelope-level, informational,
    // independent of Resultado. Same {code, msg} shape, so InvoiceObservation is reused.
    arcaEvents?: InvoiceObservation[];
    // RG 5762/2025 Factura M elimination. Frozen on the Invoice row AT ISSUANCE
    // (not re-derived at render time) so a historical PDF keeps the legend that
    // applied when the CAE was requested. `cbu` is only set alongside 'cbu_informada'.
    facturaMLegend?: 'retencion' | 'cbu_informada';
    cbu?: string;
    // Provincial ISIB transparency legends (Ley 27.743 art. 99). Frozen on the
    // Invoice row AT ISSUANCE, exactly like `facturaMLegend`/`cbu` above and for
    // the same reason: re-deriving them at render time from live store config
    // means a later config edit silently rewrites the legends printed on already
    // issued comprobantes, which ARCA treats as immutable. One entry per
    // jurisdiction; `lines` is the rendered text in print order, so the stored
    // row stays truthful even if the norm or the store's rate later changes.
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
    // ARCA CAEA contingency. Set only when fiscalStatus is
    // 'authorized_caea' | 'caea_reported'.
    caea?: string; // 14-digit ARCA-issued CAEA code
    caeaPeriod?: string; // "202608#1" -- links to CAEAPeriod.period
    // Frozen FECAEADetRequest-shaped snapshot captured at CAEA-stamp time. The
    // plain Invoice row is LOSSY for Inform replay (only 10.5%/21% alicuotas
    // survive as neto10/21+iva10/21; MonId, ImpTotConc, CanMisMonExt,
    // CondicionIVAReceptorId are dropped), so the deferred FECAEARegInformativo
    // step replays THIS snapshot verbatim. Absent on non-CAEA/pre-snapshot rows.
    // `FchServ*` used to be in that dropped list and no longer is — the row now
    // carries the window as `serviceStartDate`/`serviceEndDate` — but the
    // snapshot stays authoritative for replay: it holds what was STAMPED, and
    // recomputing yyyymmdd from ms would re-derive rather than replay.
    caeaDet?: CaeaInformDet;
    // ARCA WSFEXV1 export invoicing. Present only when invoiceType is an
    // export voucher (19/20/21, Factura E).
    export?: ExportInvoiceFields;
    // ARCA WSFECRED FCE MiPyME credit invoices. Present only when invoiceType
    // is an FCE voucher (201/202/203, 206/207/208, 211/212/213).
    fce?: FceFields;
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
    serviceStartDate?: number; // AFIP FchServDesde
    serviceEndDate?: number; // AFIP FchServHasta
    serviceOrderId?: string; // link to the originating ServiceOrder
    /**
     * The ServiceOrder the originating ticket was a rework OF. A STAMPED COPY of
     * `Order.parentServiceOrderId`, taken by the same route and at the same
     * instant as `serviceOrderId` above, on both the domestic and the
     * WSFEX/export branch. Absent unless the ticket is itself a rework.
     */
    parentServiceOrderId?: string;
    // ARCA contingency reconciliation. When a FECAESolicitar submit dies
    // mid-call and retry-on-query can't settle whether the voucher landed, the
    // pending_cae row records the targeted voucher number + as-submitted date
    // (yyyymmdd) so the drain reconciles (FECompConsultar) before re-submitting.
    // NOT the row's own number — pending rows keep the invoiceNumber=0 sentinel.
    attemptedCbteNro?: number;
    attemptedCbteFch?: string;
    // Mirror of Order.orderPrinted — set when the invoice is printed.
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
    neto: number; // net base in the INVOICE HEADER currency (lines convert to it)
    // Audit / re-sourcing only. NO per-line currency: one AFIP voucher = one
    // MonId/MonCotiz; each line converts to the header currency at issuance,
    // with the per-line FX kept on the ORDER line (BasketItem).
    unitPrice?: number; // frozen per-unit price (today only `neto` survives)
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
    // catalogId — projection to AFIP `'PES'/'DOL'` happens at the
    // AFIP-package boundary, not in this response shape.
    currency: string;
    currencyValue: number;
    total: number;
    observations?: string;
    invoiceType: number;
    // ARCA RG 5616 — passed back from AFIP request so _post.ts can stamp it
    // on the persisted Invoice.
    condicionIvaReceptor?: number;
  }

  type Neto = Record<string, { Id: number; BaseImp: number; Importe: number }>;

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
    code: number; // ARCA Obs.Code
    msg: string; // ARCA Obs.Msg
  }

  /**
   * Structured ARCA rejection/observation error. Reused by
   * `CAEAInformResult.errors` below rather than inventing a second shape.
   */
  interface ArcaError {
    code: number; // ARCA Err.Code / Obs.Code
    msg: string; // ARCA Err.Msg / Obs.Msg
    category?: 'data_validation' | 'authorization' | 'fiscal_rules' | 'service' | 'infrastructure';
    observations?: string[]; // raw FECAESolicitar Observaciones / Errores
  }

  // ARCA CAEA contingency — fallback authorization path used when
  // FECAESolicitar (real-time CAE) is unavailable. Mandatory 2026-08-01
  // (RG 5782/2025 + RG 5785/2025, postponed from 2026-06-01 by RG 5852/2026).

  /** A single CAEA fortnightly period, requested and tracked per store. */
  interface CAEAPeriod {
    storeId: string;
    period: string; // "202608" -- YYYYMM only; fortnight order (1/2) is a separate non-typed DDB attribute, not concatenated here (see sinfactura/api docs/ENTITIES.md)
    caea: string; // 14-digit ARCA-issued code
    validFrom: string; // ISO date
    validTo: string; // ISO date
    status: 'active' | 'used' | 'informed' | 'expired';
    invoiceCount: number;
    informedAt?: string; // ISO timestamp -- set once the ARCA inform step completes
    // ARCA-supplied Inform deadline, captured verbatim from
    // FECAEASolicitar/FECAEAConsultar's ResultGet.FchTopeInf (wire yyyymmdd,
    // converted to ISO yyyy-mm-dd) — the authoritative per-period cutoff to
    // inform CAEA-stamped invoices, NOT a hardcoded day-count assumption.
    fchTopeInf?: string;
    // The fortnight half this period covers (1 = days 1-15, 2 = 16-end) —
    // previously surfaced only via an ad hoc intersection type; promoted here
    // so `GET /caea`'s period-history response can carry it directly.
    order?: 1 | 2;
    // Calendar-relative annotation `GET /caea` computes per row (never stored).
    phase?: 'upcoming' | 'active' | 'past';
  }

  /** Result of requesting a new CAEA code for an upcoming period. */
  interface CAEARequestResult {
    period: CAEAPeriod;
    requestedAt: string; // ISO timestamp
  }

  /** Result of informing ARCA of CAEA-stamped invoices for a period. */
  interface CAEAInformResult {
    period: string;
    invoiceCount: number;
    informedAt: string; // ISO timestamp
    errors?: ArcaError[];
    // Count of CAEA-stamped invoices still awaiting Inform for this period —
    // mirrors the outcome `informCaeaPeriodForStore` already computes, so the
    // on-demand admin trigger endpoint can surface the same shape the cron produces.
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
    Concepto: number; // 1 products, 2 services, 3 both
    DocTipo: number; // buyer doc type (80 CUIT, 96 DNI, 99 unidentified)
    DocNro: number;
    CbteDesde: number; // == CbteHasta == the claimed voucher number
    CbteHasta: number;
    CbteFch: string; // yyyymmdd, as stamped
    FchServDesde?: string; // present only when Concepto is 2 | 3
    FchServHasta?: string;
    FchVtoPago?: string;
    ImpTotal: number;
    ImpTotConc: number;
    ImpNeto: number;
    ImpOpEx: number;
    ImpIVA: number;
    ImpTrib: number;
    MonId: string; // AFIP currency code ('PES' | 'DOL'), NOT the catalogId
    MonCotiz: number;
    CanMisMonExt?: number; // RG 5616 FX-precision field, foreign-currency vouchers only
    CondicionIVAReceptorId?: number; // RG 5616 -- inherited by FECAEADetRequest via the patched FEDetRequest WSDL base
    Iva?: { Id: number; BaseImp: number; Importe: number }[];
    CbtesAsoc?: { Tipo: number; PtoVta: number; Nro: number; Cuit?: string; CbteFch?: string }[];
    Tributos?: { Id: number; Desc?: string; BaseImp: number; Alic: number; Importe: number }[];
    CAEA: string; // the 14-digit code the invoice was stamped with
    CbteFchHsGen: string; // yyyymmddhhmiss, Buenos Aires local, from the row's createdAt
  }

  // ARCA WSFEXV1 export invoicing. RG 2758/2010 + RG 4401/2019.

  /** Export-invoice-specific fields, present only when Invoice.invoiceType is an
   * export voucher (19 Factura E / 20 ND E / 21 NC E). Amended per the
   * preflight read of the WSFEX manual (v2.0.1 §2.1.3). */
  interface ExportInvoiceFields {
    /** Tipo_expo: 1=exportación definitiva de bienes, 2=servicios (RG 4401), 4=otros.
     * REQUIRED on the wire — drives every Permiso rule (err 1720). */
    tipoExpo: 1 | 2 | 4;
    dstCmp: number; // destination country code (WSFEXV1 GetPARAM_DST_pais table)
    cliente: string; // Cliente (C200, required) — buyer's name as printed on the voucher
    domicilioCliente: string; // Domicilio_cliente (C300, required)
    /** Cuit_pais_cliente (GetPARAM_DST_CUIT) — ONE OF this or idImpositivo is required (err 1580). */
    cuitPaisCliente?: number;
    idImpositivo?: string; // buyer's foreign tax ID — one-of with cuitPaisCliente (err 1580)
    /** AFIP-wire projection of Invoice.currency (GetPARAM_MON code, e.g. "DOL") — MUST agree
     * with the row's own currency stamp; never a second source of truth. */
    monedaId: string;
    /** AFIP-wire projection of Invoice.currencyValue (Moneda_Ctz) — MUST agree with the row. */
    monedaCtz: number;
    incoterms?: string; // WSFEXV1 GetPARAM_Incoterms code (FOB, CIF, ...)
    incotermsDs?: string; // free-text incoterms detail, required by some destinations
    /** 'S'/'N'; MUST be absent when Cbte_Tipo is 20/21, or 19 with tipoExpo 2/4 (err 1550). */
    permisoExistente?: 'S' | 'N';
    permisoExistenteTipo?: string; // permit type, required when permisoExistente === 'S'
    permisoExistenteNro?: string; // permit number (99999AAXXX999999A), required when permisoExistente === 'S'
    idiomaCbte: 1 | 2 | 3; // 1=Spanish, 2=English, 3=Portuguese
    fechaPago?: string; // Fecha_pago (yyyymmdd) — service exports (RG 4401 payment-date rules)
    /** "Cancelación en Misma Moneda Extranjera" — wire value 'S'/'N' (was boolean pre-1.6.42;
     * zero consumers existed). Required when settled in the same foreign currency the invoice
     * was issued in; Moneda_Ctz must then match BNA's prior-business-day quote (RG 5616/2024,
     * WSFEX manual v3.0.0 2025-03-17; error codes 1602-1607). */
    canMisMonExt?: 'S' | 'N';
  }

  /** Reference data cached from WSFEXV1 `GetPARAM_*` operations, refreshed on a schedule.
   * Persists as the platform-wide singleton PLATFORM / WSFEX_PARAMS (AFIP-global tables,
   * not per-store). */
  interface WsfexReferenceData {
    currencies: { id: string; name: string }[]; // GetPARAM_MON
    countries: { id: number; name: string }[]; // GetPARAM_DST_pais
    incoterms: { id: string; name: string }[]; // GetPARAM_Incoterms
    languages: { id: 1 | 2 | 3; name: string }[]; // GetPARAM_Idiomas
    voucherTypes: { id: number; name: string }[]; // GetPARAM_Cbte_Tipo
    exportTypes: { id: number; name: string }[]; // GetPARAM_Tipo_Expo
    /** GetPARAM_UMed — Pro_umed is REQUIRED per line item; the Factura E form needs this catalog. */
    unitsOfMeasure: { id: number; name: string }[];
    /** GetPARAM_MON_CON_COTIZACION — currencies quotable for service exports (tipoExpo 2). */
    currenciesWithQuote?: { id: string; name: string }[];
    fetchedAt: string; // ISO timestamp — drives cache invalidation (string per original convention; AfipHealth uses epoch ms)
  }

  // ARCA WSFECRED FCE MiPyME credit invoices. Ley 27.440 +
  // Decreto 471/2018 + RG 4367/2018 (amended by RG 4919/2021, RG 5395/2023,
  // RG 5764/2025).

  /** WSFECRED rejection-motivo catalog (`consultarTiposMotivosRechazo`), refreshed on a
   * schedule. Persists as the platform-wide singleton PLATFORM / FCE_MOTIVOS (AFIP-global,
   * not per-store); mirrors WsfexReferenceData. */
  interface FceMotivosCatalog {
    motivos: { codigo: number; descripcion?: string }[];
    fetchedAt: string; // ISO timestamp — same convention as WsfexReferenceData
  }

  type FceStatus = 'emitted' | 'accepted' | 'rejected' | 'ceded';

  /** FCE-specific fields, present only when Invoice.invoiceType is 201/202/203, 206/207/208, or 211/212/213. */
  interface FceFields {
    cbu: string; // seller's 22-digit bank account
    sca: boolean; // Sistema de Circulación Abierta flag
    status: FceStatus;
    statusChangedAt?: string; // ISO timestamp of the last status transition
    acceptanceDeadline: string; // ISO date -- issuedAt + the currently-operative window (21d today, see FceThresholdConfig)
    cesionId?: string; // set once FECredRegistrarCesion succeeds, links to the ceded credit instrument
  }

  /**
   * The annually/periodically-adjusted FCE threshold -- do not hard-code the
   * amount anywhere else; read it from this single config source.
   */
  interface FceThresholdConfig {
    amountArs: number; // e.g. 5549862 as of 2026-04-14 (Resolución 1/2026 SEPYMEyEC)
    effectiveFrom: string; // ISO date
    acceptanceWindowDays: number; // 21 as of Res. 219/2025 (through 2026-10-31); statutory fallback is 30
    acceptanceWindowValidThrough?: string; // ISO date -- when the exceptional window's own extension expires
    /**
     * Epoch-ms last-write trace, set by the api on every threshold
     * write and echoed on GET /config + the POST response (api PLATFORM_API.md
     * section 20). OPTIONAL by design: a row written before the field carries
     * none, so a reader must not treat its absence as "never updated".
     */
    updatedAt?: number;
  }
}

export {}; // NOSONAR