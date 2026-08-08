declare global {
    /**
     * `GET /reports?mode=sales&date=YYYYMM` response row — one entry per day
     * (api#549 / types#111).
     *
     * Revenue is attributed by DELIVERY date and returns by their OWN `dated`, so
     * a return of a January order processed in February lands in February. The
     * two therefore do not net to zero within a single row, by design.
     *
     * ⚠️ `returns`, `returnCost`, and `returnCount` are POSITIVE magnitudes — the
     * netting is expressed by `net`/`netCost`, not by a sign on the return
     * fields. This mirrors the fiscal convention elsewhere in the platform, where
     * credit-note rows also stay positive and the voucher type carries the sign.
     */
    interface ReportSales {
        /** `YYYYMMDD` as a number, matching the API wire type. */
        date: number;
        /** Count of delivered orders on this date. */
        quantity: number;
        /** GROSS COGS of those delivered orders. */
        cost: number;
        /** GROSS revenue of those delivered orders (post-order-discount). */
        total: number;
        /** Positive sum of credited return totals dated this day. */
        returns: number;
        /** Count of returns dated this day. */
        returnCount: number;
        /** Positive cost of the returned units. */
        returnCost: number;
        /** `total - returns`. */
        net: number;
        /** `cost - returnCost`. */
        netCost: number;
    }
    /**
     * One FAC/NC/net bucket of the ventas IVA summary (api#2011).
     *
     * ⚠️ Every amount is a POSITIVE magnitude, including `credit`. The netting is
     * expressed by the `net` bucket, never by a sign on `credit` — same
     * convention the fiscal files use, where a credit-note row also stays
     * positive and the `CbteTipo` carries the sign semantics.
     */
    interface ReportInvoicesAmounts {
        /** Voucher count in this bucket. */
        quantity: number;
        /** Neto gravado summed over every declared alícuota. */
        neto: number;
        /** Débito fiscal (IVA) summed over every declared alícuota. */
        iva: number;
        /** `ImpTotal` sum. */
        total: number;
    }
    /**
     * One day of the `GET /reports?mode=invoices&date=YYYYMM` ventas summary
     * (api#2011 / types#113).
     *
     * Covers only AUTHORIZED (deliverable) vouchers — `pending_cae` and
     * `rejected` are excluded upstream, and legacy rows with no `fiscalStatus`
     * count as authorized.
     */
    interface ReportInvoicesResume {
        /**
         * `YYYYMMDD` as a NUMBER.
         *
         * ⚠️ Was typed `string` in the app's local copy of this shape while the
         * API has always returned `Invoice.dated`, a number. Canonicalizing here
         * fixes that drift — the same class of bug as `ReportSales.date`.
         */
        date: number;
        /** Count of ALL deliverable vouchers this day, credit notes included. */
        quantity: number;
        /**
         * Legacy roll-up columns. These sum EVERY deliverable voucher with a
         * POSITIVE sign — credit notes included — so `total` is a mixture of
         * debits and credits rather than a meaningful sales figure. Retained
         * unchanged for wire compatibility; prefer `gross`/`credit`/`net` below.
         *
         * `neto10`/`neto21`/`iva10`/`iva21` only ever covered AFIP `Iva[].Id` 4
         * (10,5 %) and 5 (21 %); `neto`/`iva` are the all-alícuota roll-ups added
         * by api#1961.
         */
        neto10: number;
        neto21: number;
        iva10: number;
        iva21: number;
        neto: number;
        iva: number;
        total: number;
        /** Non-credit vouchers — facturas and notas de débito. */
        gross: ReportInvoicesAmounts;
        /**
         * Notas de crédito only, as positive magnitudes. Classified via the
         * canonical `NC_CBTE_TIPOS` family, NOT a hardcoded `[3, 8, 13]`.
         *
         * ⚠️ Notas de DÉBITO are deliberately NOT here — a débito increases what
         * is owed, so it belongs in `gross`. Netting both would move the total in
         * the wrong direction.
         */
        credit: ReportInvoicesAmounts;
        /** `gross - credit`, field by field. The figure an operator should read. */
        net: ReportInvoicesAmounts;
    }
    /**
     * One voucher row of the ventas summary's spreadsheet export.
     *
     * ⚠️ Mixed string/number by design — the padded fiscal columns are strings
     * while the amounts are numbers. The app's local copy typed this
     * `Record<string, string>[]`, which was wrong for five of the ten fields.
     */
    interface ReportInvoicesVoucherRow {
        FECHA: string;
        CBTE_TIPO: string;
        PTO_VTA: string;
        CBTE_NUMERO: number;
        RAZON_SOCIAL: string;
        CUIT: string;
        NETO: number;
        NETO10: number;
        NETO21: number;
        TOTAL: number;
    }
    /**
     * `GET /reports?mode=invoices&date=YYYYMM` response payload.
     *
     * Carries BOTH the operator-facing summary (`resume`, `period`) and the ARCA
     * REGINFO_CV_VENTAS flat files (`customers`, `reg_alicuotas`, `reg_cbte`).
     *
     * ⚠️ The two are produced from the same voucher set but must never share sign
     * semantics: the summary nets credit notes, the flat files keep every voucher
     * a positive magnitude carrying its own `CbteTipo`. A sign leak into the
     * fixed-width records corrupts a filing.
     */
    interface ReportInvoices {
        /** Per-day rows, ascending by `date`. */
        resume: ReportInvoicesResume[];
        /** Same FAC/NC/net split aggregated over the whole selected period (api#2011). */
        period: {
            gross: ReportInvoicesAmounts;
            credit: ReportInvoicesAmounts;
            net: ReportInvoicesAmounts;
        };
        invoices: ReportInvoicesVoucherRow[];
        /** REGINFO_CV_VENTAS fixed-width padrón de clientes. */
        customers: string;
        /** REGINFO_CV_VENTAS_ALICUOTAS.TXT — one record per declared alícuota. */
        reg_alicuotas: string;
        /** REGINFO_CV_VENTAS_CBTE.TXT — one record per voucher. */
        reg_cbte: string;
    }
}
export {};
