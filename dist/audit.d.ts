declare global {
    /**
     * One entry of the generic order audit trail (api#548).
     *
     * ⚠️ **Reshaped in types#111.** The previous declaration invented its own
     * columns (`auditId`, `changes[]`, `itemChanges`, `oldTotal`, `newTotal`)
     * that did not match what the api's `writeAuditEntry`/`listAuditEntries`
     * actually persist and return — so a handler could not satisfy both. This is
     * now a faithful projection of the stored `AuditEntry`, which is the single
     * storage shape for every audited entity.
     *
     * Safe to reshape: nothing imported the old declaration (it was referenced
     * only inside this file), and the order audit read endpoint does not exist yet.
     *
     * Storage: `PK = AUDIT#ORDER#{storeId}#{orderId}`, `SK = {timestampMs}`
     * zero-padded to 13 chars, newest-first on read. `PK`/`SK` are stripped
     * before the row reaches the wire.
     */
    interface OrderAuditEntry {
        entity: 'ORDER';
        /** The `orderId`. */
        entityId: string;
        storeId: string;
        /** ms epoch; also the source of the sort key. */
        timestamp: number;
        actor: OrderAuditActor;
        action: OrderAuditAction;
        /**
         * Changed business fields only, before and after. Line-level detail
         * (added/removed/modified lines, keyed by original order-array index) and
         * totals live INSIDE these payloads rather than as extra top-level
         * columns, because the generic writer has no such columns.
         *
         * Must be sanitized: no `PK`/`SK`, no secrets, no unnecessary customer PII.
         */
        before: Record<string, unknown>;
        after: Record<string, unknown>;
        /** Why the mutation happened. Required by the generic writer. */
        reason: string;
        createdAt: number;
    }
    /** Who performed an audited order mutation. `fullName` is denormalized at write time. */
    interface OrderAuditActor {
        userId: string;
        fullName: string;
    }
    /**
     * `GET /orders?mode=audit&orderId=…` response payload (api#548).
     *
     * `cursor` is an opaque base64url encoding of the underlying
     * `LastEvaluatedKey`; raw DynamoDB keys are never exposed. Absent when there
     * is no further page. An order with no history is `items: []`, not a 404.
     */
    interface OrderAuditPage {
        items: OrderAuditEntry[];
        cursor?: string;
    }
    type OrderAuditAction = 'order_created' | 'order_edited' | 'order_ready' | 'order_delivered' | 'order_delivery_cancelled' | 'order_disabled' | 'order_enabled' | 'order_returned'
    /** Customer (or operator) cancellation — distinct from `order_disabled` (api#591). */
     | 'order_cancelled' | 'discount_changed' | 'payment_method_changed' | 'delivery_method_changed' | 'delivery_address_changed' | 'invoice_created' | 'credit_note_created';
    /** One ARCA fiscal SOAP interaction (FECAESolicitar | FECompConsultar | ConstatarComprobante). Stored raw (CUIT unmasked) for 10y; masked at read. */
    interface FiscalAuditEvent {
        /** Schema version for forward-compat (start at 1). */
        schema_version: number;
        /** Unique id for this interaction (uuid). */
        event_id: string;
        /** Owning tenant store id, e.g. STO002. Partition-scoping key. */
        tenant_store_id: string;
        /** Unix ms when the interaction completed. */
        ts: number;
        /** Which ARCA fiscal op. `ConstatarComprobante` added for WSCDC
         * third-party voucher verification (api#1500), which logs every check
         * to this same table per its AC. `FEXAuthorize` (WSFEX export
         * issuance) was already accepted by the api's runtime Zod mirror —
         * added here to close the drift. `ConsultarApoc` added for the APOC
         * apocryphal-CUIT registry check (api#1563). */
        operation: 'FECAESolicitar' | 'FECompConsultar' | 'FEXAuthorize' | 'ConstatarComprobante' | 'ConsultarApoc';
        /** Issuer CUIT (RAW — masked only at display). */
        cuit: string;
        /** AFIP environment the call hit. */
        environment: 'homologacion' | 'produccion';
        /** Sales point + voucher type + number when known. */
        salesPoint?: number;
        voucherType?: number;
        voucherNumber?: number;
        /** Internal invoice id correlation (INV000123) when available. */
        invoiceId?: string;
        /** Outcome of the interaction. */
        outcome: 'authorized' | 'rejected' | 'unresolved' | 'queried';
        /** CAE + expiry on success. */
        cae?: string;
        caeExpiration?: string;
        /** Raw ARCA Errores[]/Observaciones[] passthrough (no flattening). */
        errores?: {
            code: number;
            msg: string;
        }[];
        observaciones?: {
            code: number;
            msg: string;
        }[];
        /** Raw ARCA Events.Evt[] passthrough (api#1559 follow-up, PR api#1571) — same treatment as errores/observaciones. */
        eventos?: {
            code: number;
            msg: string;
        }[];
        /** Wall-clock duration of the SOAP call in ms. */
        durationMs: number;
        /** Full request args + response body (raw), for the regulator record. */
        requestPayload: Record<string, unknown>;
        responsePayload: Record<string, unknown>;
    }
    /** APOC (base e-Apoc, "facturas apócrifas") CUIT check request — api#1563.
     * Data source is ARCA's public registry snapshot imported daily into the
     * api's `APOC` DDB partition (no per-check ARCA call). */
    interface ApocCheckRequest {
        /** The counterparty CUIT being checked (the invoice issuer, not this store). */
        cuit: string;
    }
    /** Result of an APOC registry check. Every check is logged to
     * FiscalAuditEvent with operation 'ConsultarApoc'. */
    interface ApocCheckResult {
        /** True if the CUIT appears in ARCA's APOC registry. */
        flagged: boolean;
        /** ISO date — when ARCA flagged this CUIT ("Fecha Condición Apócrifo"); present when flagged. */
        fraudConditionDate?: string;
        /** ISO date — when ARCA published the flag; present when flagged. */
        publicationDate?: string;
        /** ISO date — freshness of the imported registry snapshot (the file's "Generado" stamp). */
        registrySnapshotAt: string;
        /** True when `registrySnapshotAt` is older than the staleness threshold — api#1903.
         * `flagged` is still computed from the local snapshot either way; this never suppresses
         * an answer, only marks it as based on a potentially outdated registry. */
        stale: boolean;
        /** Days between `registrySnapshotAt` and `checkedAt` — api#1903. */
        registryAgeDays: number;
        /** ISO timestamp of this check. */
        checkedAt: string;
    }
}
export {};
