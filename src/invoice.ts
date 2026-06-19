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
}

export {}; // NOSONAR