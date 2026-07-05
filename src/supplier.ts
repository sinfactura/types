
declare global {

	interface Supplier {
		storeId: string;
		userId: string;
		supplierId: string;
		createdAt: number;
		photoURL: string;
		photoData?: string; // transient base64 image upload (matches Brand/Category/Store)
		removePhotoURL?: string;
		company: string;
		cuit: string;
		razonSocial: string;
		// contact
		contactName: string;
		phone: string;
		email: string;
		// options
		balance: number;
		// catalogId (api#942) — FK to PlatformCurrency.
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
		// invoice data
		type: 'FAC' | 'ND' | 'NC';
		dated: number;
		number: string;
		razonSocial: string;
		cuit: string;
		// details
		neto: number;
		iva10: number;
		iva21: number;
		total: number;
		per_iibb: number;
		per_iva: number;
		file: string;
		// catalogId (api#942) — FK to PlatformCurrency (app#1539 / ADR-0013).
		currency?: string;
		currencyValue: number;
		// Unix ms at which `currencyValue` was effective (app#1539 / ADR-0013).
		currencyValueAt?: number;
		// Lowercase '#'-joined search index, written by
		// `buildSupplierInvoiceSearch` on every insert/update (api#1233).
		search?: string;
		// api#1501 — per-alícuota IVA discrimination required by the Libro IVA
		// Digital COMPRAS records (docs/LIBRO_IVA_DIGITAL.md §3–4). Mirrors the
		// ventas Invoice shape (neto10/neto21 + iva10/iva21, where the `10` slot
		// is AR's 10,5% reduced rate) plus the 27% rate common on purchases.
		// Forward-only — existing rows carry none of these.
		neto10?: number; // neto gravado 10,5%
		neto21?: number; // neto gravado 21%
		neto27?: number; // neto gravado 27%
		iva27?: number; // impuesto liquidado 27%
		noGravado?: number; // conceptos no gravados (compras CBTE campo 10)
		exento?: number; // operaciones exentas (compras CBTE campo 11)
		// api#1542 — real ARCA comprobante class. `type` (FAC/ND/NC) alone can't
		// distinguish A/B/C, so the Libro IVA Digital compras export mis-stamped
		// every non-A purchase. Optional/forward-only — legacy rows without it
		// fall back to A-class in the builder.
		cbteClass?: 'A' | 'B' | 'C';
	}

	/**
	 * WSCDC `ConstatarComprobante` request (api#1500) -- verifies a
	 * third-party (supplier) voucher was genuinely authorized by ARCA before
	 * it's booked/credited as IVA input. Fields per the ticket's tech spec.
	 */
	interface VoucherVerificationRequest {
		cuit: string; // emitter's CUIT (the supplier, not this store)
		pointOfSale: number; // PV
		invoiceType: number; // CbteTipo
		invoiceNumber: number; // CBTE_NUMERO
		dated: number; // voucher date, yyyymmdd
		total: number; // IMP_TOTAL
		authorizationCode: string; // ARCA authorization code to verify -- CAE/CAEA/CAI (WSCDC CodAutorizacion)
		authorizationMode?: 'CAE' | 'CAEA' | 'CAI'; // WSCDC CbteModo; server defaults to 'CAE' when absent
		receptorDocType?: number; // receptor document type -- DocTipo codeset id (WSCDC DocTipoReceptor), required by ARCA for A-type comprobantes
		receptorDocNumber?: string; // receptor document number (WSCDC DocNroReceptor)
	}

	/**
	 * WSCDC `ConstatarComprobante` result (api#1500). `result` mirrors the
	 * A/O/R convention already used for `FECAESolicitar`'s own `Resultado`
	 * and `FiscalAuditEvent` (Aceptado/Observado/Rechazado) -- every
	 * verification call is also logged to that same audit table per the
	 * ticket's AC (`FiscalAuditEvent.operation` includes `ConstatarComprobante`).
	 */
	interface VoucherVerificationResult {
		result: 'A' | 'O' | 'R'; // Aceptado / Observado / Rechazado
		reason?: string; // present when result === 'R'
		observations?: InvoiceObservation[]; // present when result === 'O'
		verifiedAt: string; // ISO timestamp
	}

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
		createdAt: number; // timestamp
		dated: number; // 20220123
		fullName: string;
		subject: string;
		details: string;
		debit: number;
		credit: number;
		amount: number;
		// catalogId (api#942) — FK to PlatformCurrency. Promoted from the
		// api#945 module augmentation (app#1539 / ADR-0013).
		currency?: string;
		currencyValue: number;
		// Unix ms at which `currencyValue` was effective (app#1539 / ADR-0013).
		currencyValueAt?: number;
		balance: number;
		deleted: boolean;
	}

}

export {}; // NOSONAR