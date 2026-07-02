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

  interface Invoice {
    storeId: string;
    invoiceId: string; // ID
    customerId: string; // CLIENTE_ID
    orderId: string; // PEDIDO_ID
    createdAt: number; // FECHA
    dated: number;

    invoiceType: number; // CBTE_TIPO / 1 FAC A  / 6 FAC B
    pointOfSale: number; // PTO_VTA
    invoiceNumber: number; // CBTE_NUMERO
    razonSocial: string; // RAZON_SOCIAL
    address: string; // address and postalCode
    location: string; // city and province
    concept: number; // CONCEPTO 1 productos 2 servicios
    cuitType: number; // CUIT_TIPO
    cuit: string; // CUIT CF?
    // catalogId (api#942) — FK to PlatformCurrency. AFIP `'PES'/'DOL'`
    // projection happens at invoice-write time via `catalog.afipCode`.
    currency?: string;
    currencyValue?: number;
    // Unix ms at which `currencyValue` was effective (app#1539 / ADR-0013).
    currencyValueAt?: number;
    fiscalCondition: string; // COND_FISCAL / RESPONSABLE INSCRIPTO
    // ARCA RG 5616 — buyer's IVA condition under the 1-13 codeset.
    // Mapped server-side from legacy `condFiscal` (20/30/32/96/99) on every
    // issued invoice. Audit field — the value sent to AFIP. (api#1173)
    condicionIvaReceptor?: number;
    paymentCondition: string; // COND_VENTA
    deliveryCondition: string; // COND_ENTREGA

    items: InvoiceItem[];
    neto10: number; // NETO10
    neto21: number; // NETO21
    iva10: number;
    iva21: number;
    discount?: number;
    total: number; // IMP_TOTAL

    cae: string; // CAE
    caeExpiration: string; // CAE_VENCIMIENTO
    observations?: string; // afip observations
    // ARCA fiscal lifecycle (app#1409 / app#1023 split A). Optional —
    // absent means `authorized_cae` (V1.0 implicit happy path). BE sets
    // `pending_cae` when WSFEv1 network-failed, `rejected` on business
    // validation errors. See ADR-0012 for the CAEA states.
    fiscalStatus?: FiscalStatus;
    // Structured ARCA rejection detail (api#1380). Present when
    // fiscalStatus === 'rejected'; supersedes regex-parsing the legacy
    // `observations` string above for FE error classification.
    arcaError?: ArcaError;
    // ARCA observaciones (api#1559). Structured Resultado='O' warnings
    // parsed from every FECAESolicitar response. Deliberately a NEW field
    // rather than widening `observations` above — that field is free text
    // (string) and is already consumed as FiscalStatusBanner's errorMessage
    // (app), so changing its type would be a breaking change.
    arcaObservations?: InvoiceObservation[];
    // ARCA CAEA contingency (api#1556). Set only when fiscalStatus is
    // 'authorized_caea' | 'caea_reported'.
    caea?: string; // 14-digit ARCA-issued CAEA code
    caeaPeriod?: string; // "202608#1" -- links to CAEAPeriod.period
    // ARCA WSFEXV1 export invoicing (api#1557). Present only when
    // invoiceType is an export voucher (19/20/21, Factura E).
    export?: ExportInvoiceFields;
    // ARCA WSFECRED FCE MiPyME credit invoices (api#1558). Present only when
    // invoiceType is an FCE voucher (201/202/203, 206/207/208, 211/212/213).
    fce?: FceFields;
    // Service order integration (sinfactura/types#30). AFIP concept=2 service
    // invoices carry the service period + payment due date. All Unix ms.
    serviceStartDate?: number; // AFIP FchServDesde
    serviceEndDate?: number; // AFIP FchServHasta
    paymentDueDate?: number; // AFIP FchVtoPago
    serviceOrderId?: string; // link to the originating ServiceOrder
    // ARCA contingency reconciliation (api#1314). When a FECAESolicitar submit
    // dies mid-call and retry-on-query can't settle whether the voucher landed,
    // the pending_cae row records the targeted voucher number + as-submitted date
    // (yyyymmdd) so the drain reconciles (FECompConsultar) before re-submitting.
    // NOT the row's own number — pending rows keep the invoiceNumber=0 sentinel.
    attemptedCbteNro?: number;
    attemptedCbteFch?: string;
    // Mirror of Order.orderPrinted (api#643) — set when the invoice is printed.
    invoicePrinted?: boolean;
  }

  interface InvoiceItem {
    code: string;
    description: string;
    quantity: number;
    iva: number;
    neto: number; // net base in the INVOICE HEADER currency (lines convert to it)
    // Audit / re-sourcing (#1780 / types#86). NO per-line currency: one AFIP
    // voucher = one MonId/MonCotiz; each line converts to the header currency at
    // issuance (api#1416), with the per-line FX kept on the ORDER line (BasketItem).
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
    // catalogId (api#942) — projection to AFIP `'PES'/'DOL'` happens
    // at the AFIP-package boundary, not in this response shape.
    currency: string;
    currencyValue: number;
    total: number;
    observations?: string;
    invoiceType: number;
    // ARCA RG 5616 — passed back from AFIP request so _post.ts can stamp
    // it on the persisted Invoice. (api#1173)
    condicionIvaReceptor?: number;
  }

  type Neto = Record<string, { Id: number; BaseImp: number; Importe: number }>;

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
    code: number; // ARCA Obs.Code
    msg: string; // ARCA Obs.Msg
  }

  /**
   * Structured ARCA rejection/observation error (api#1380). Reused by
   * `CAEAInformResult.errors` below rather than inventing a second shape.
   */
  interface ArcaError {
    code: number; // ARCA Err.Code / Obs.Code
    msg: string; // ARCA Err.Msg / Obs.Msg
    category?: 'data_validation' | 'authorization' | 'fiscal_rules' | 'service' | 'infrastructure';
    observations?: string[]; // raw FECAESolicitar Observaciones / Errores
  }

  // ARCA CAEA contingency (api#1556) — fallback authorization path used when
  // FECAESolicitar (real-time CAE) is unavailable. Mandatory 2026-08-01
  // (RG 5782/2025 + RG 5785/2025, postponed from 2026-06-01 by RG 5852/2026).

  /** A single CAEA fortnightly period, requested and tracked per store. */
  interface CAEAPeriod {
    storeId: string;
    period: string; // "202608" -- YYYYMM only; the fortnight order (1 = days 1-15, 2 = 16-end) is a separate, non-typed DDB bookkeeping attribute alongside this row (see sinfactura/api docs/ENTITIES.md), not concatenated into `period`
    caea: string; // 14-digit ARCA-issued code
    validFrom: string; // ISO date
    validTo: string; // ISO date
    status: 'active' | 'used' | 'informed' | 'expired';
    invoiceCount: number;
    informedAt?: string; // ISO timestamp -- set once the ARCA inform step completes
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
  }

  // ARCA WSFEXV1 export invoicing (api#1557). RG 2758/2010 + RG 4401/2019.

  /** Export-invoice-specific fields, present only when Invoice.invoiceType === 19 (Factura E). */
  interface ExportInvoiceFields {
    dstCmp: number; // destination country code (WSFEXV1 GetPARAM_DST_pais table)
    idImpositivo?: string; // buyer's foreign tax ID (optional -- not all destinations require one)
    monedaId: string; // ISO-ish currency code (WSFEXV1 GetPARAM_MON table, e.g. "DOL", "PES")
    monedaCtz: number; // exchange rate at time of authorization
    incoterms?: string; // WSFEXV1 GetPARAM_Incoterms code (FOB, CIF, ...)
    incotermsDs?: string; // free-text incoterms detail, required by some destinations
    permisoExistente?: 'S' | 'N'; // customs permit reference exists
    permisoExistenteTipo?: string; // permit type, required when permisoExistente === 'S'
    permisoExistenteNro?: string; // permit number, required when permisoExistente === 'S'
    idiomaCbte: 1 | 2 | 3; // 1=Spanish, 2=English, 3=Portuguese
    /** "Cancelación en Misma Moneda Extranjera" -- required only when settled in the same
     * foreign currency the invoice was issued in (RG 5616/2024 FX-precision rule reaching
     * voucher class E; added to the WSFEXV1 manual in v3.0.0, 2025-03-17). */
    canMisMonExt?: boolean;
  }

  /** Reference data cached from WSFEXV1 `GetPARAM_*` operations, refreshed on a schedule. */
  interface WsfexReferenceData {
    currencies: { id: string; name: string }[]; // GetPARAM_MON
    countries: { id: number; name: string }[]; // GetPARAM_DST_pais
    incoterms: { id: string; name: string }[]; // GetPARAM_Incoterms
    languages: { id: 1 | 2 | 3; name: string }[]; // GetPARAM_Idiomas
    voucherTypes: { id: number; name: string }[]; // GetPARAM_Cbte_Tipo
    exportTypes: { id: number; name: string }[]; // GetPARAM_Tipo_Expo
    fetchedAt: string; // ISO timestamp -- drives cache invalidation
  }

  // ARCA WSFECRED FCE MiPyME credit invoices (api#1558). Ley 27.440 +
  // Decreto 471/2018 + RG 4367/2018 (amended by RG 4919/2021, RG 5395/2023,
  // RG 5764/2025).

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
  }
}

export {}; // NOSONAR