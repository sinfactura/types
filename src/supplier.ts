
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
		// catalogId — FK to PlatformCurrency.
		currencyId: string;
		service: boolean;
		disabled: boolean;
	}

	interface SupplierInvoice {
		// Synthesized from the DynamoDB keys on the public read path (`PK` →
		// storeId, `SK` → invoiceId), so both are reliably present on responses.
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
		// catalogId — FK to PlatformCurrency (ADR-0013).
		currency?: string;
		/** Optional: stamped only when an FX resolution was available at write time; absence preserves any stored rate. */
		currencyValue?: number;
		// Unix ms at which `currencyValue` was effective (ADR-0013).
		currencyValueAt?: number;
		/**
		 * @deprecated Lowercase '#'-joined WRITE-SIDE index, stamped on every
		 * insert/update. Internal — not part of the read contract, even where
		 * legacy responses still include it; never consume it.
		 */
		search?: string;
		// Per-alícuota IVA discrimination required by the Libro IVA
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
		// Real ARCA comprobante class. `type` (FAC/ND/NC) alone can't
		// distinguish A/B/C, so the Libro IVA Digital compras export mis-stamped
		// every non-A purchase. Optional/forward-only — legacy rows without it
		// fall back to A-class in the builder.
		cbteClass?: 'A' | 'B' | 'C';

		// WSCDC constatación inputs (forward-only; populated by manual
		// entry now, by the AI extractor later — same fields).
		voucherDate?: number; // yyyymmdd — voucher's REAL emission date (WSCDC CbteFch); distinct from `dated` (load date).
		pointOfSale?: number; // WSCDC PtoVta
		invoiceNumber?: number; // WSCDC CbteNro
		authorizationCode?: string; // CAE/CAEA/CAI (WSCDC CodAutorizacion)
		authorizationMode?: 'CAE' | 'CAEA' | 'CAI'; // WSCDC CbteModo (defaults 'CAE')
		constatacion?: SupplierInvoiceConstatacion; // WSCDC result, written async by the supplier-constatar consumer

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
	}

	// Generic per-invoice ARCA trust-check status, shared across
	// WSCDC and APOC so the FE renders one uniform
	// chip. Each check keeps its own payload (constatacion/apoc are separate
	// top-level SupplierInvoice fields — collision-safe for concurrent writers).
	type SupplierInvoiceCheckStatus =
		| 'pending' // enqueued / in-flight
		| 'passed' // WSCDC 'A' (verde)
		| 'warning' // WSCDC 'O' — observado (ámbar)
		| 'failed' // WSCDC 'R' — no encontrado / total no coincide (rojo)
		| 'not_applicable' // CAE absent, type outside grid, or store has no AFIP cert (gris)
		| 'error'; // WSCDC unreachable / transient auth failure (reintentar)

	// WHY a row is `not_applicable`. Without this the status conflated
	// a permanent property of the comprobante with a transient property of the
	// TENANT, and the FE re-derived the difference by reimplementing the BE's
	// own eligibility rule — which silently drifts when that rule
	// changes. Only ever meaningful alongside `status: 'not_applicable'`.
	type SupplierInvoiceNotApplicableReason =
		| 'not_constatable' // permanent(ish): missing CAE/coordinates/cuit/total, or type outside the CbteTipo grid. A property of THIS voucher — becomes stale only if the row is edited to completeness.
		| 'wscdc_not_configured' // transient: the tenant hasn't switched WSCDC on. Nobody ever asked ARCA about this row, so the write path re-evaluates it once the toggle flips.
		| 'wscdc_not_authorized'; // the tenant HAS switched WSCDC on, but ARCA refused the certificate for the `wscdc` service (relación incomplete) — `coe.notAuthorized`. Distinct from the above because ARCA *was* contacted: this is the consumer's verdict, so the write path must not re-enqueue it on every edit (that loops one WSAA login per save). Clears when the relación completes and the CAE is re-submitted.

	// WSCDC ComprobanteConstatar outcome persisted on the row.
	interface SupplierInvoiceConstatacion {
		status: SupplierInvoiceCheckStatus;
		result?: 'A' | 'O' | 'R'; // ARCA Resultado (A→passed, O→warning, R→failed)
		reason?: string; // present when failed — ARCA's own prose. NOT the not_applicable discriminator; see notApplicableReason.
		notApplicableReason?: SupplierInvoiceNotApplicableReason; // present when status is 'not_applicable'
		observations?: InvoiceObservation[]; // present when observado
		verifiedAt?: string; // ISO — WSCDC FchProceso
	}

	/**
	 * WSCDC `ConstatarComprobante` request -- verifies a
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
	 * WSCDC `ConstatarComprobante` result. `result` mirrors the
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
		createdAt: number; // timestamp
		dated: number; // 20220123
		fullName: string;
		subject: string;
		details: string;
		debit: number;
		credit: number;
		amount: number;
		// catalogId — FK to PlatformCurrency (ADR-0013).
		currency?: string;
		currencyValue: number;
		// Unix ms at which `currencyValue` was effective (ADR-0013).
		currencyValueAt?: number;
		balance: number;
		deleted: boolean;
	}

}

export {}; // NOSONAR