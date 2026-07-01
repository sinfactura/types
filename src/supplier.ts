
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