declare global {
    /**
     * One entry of the generic order audit trail. A faithful projection of the
     * stored `AuditEntry` (the single storage shape for every audited entity).
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
         * Changed business fields only, before/after. Line-level detail and totals
         * live INSIDE these payloads, not as extra top-level columns, because the
         * generic writer has no such columns. Must be sanitized: no `PK`/`SK`, no
         * secrets, no unnecessary customer PII.
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
     * `GET /orders?mode=audit&orderId=…` response payload.
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
    /** Customer (or operator) cancellation — distinct from `order_disabled`. */
     | 'order_cancelled'
    /**
     * The AFIP service period or payment term on the order changed —
     * `serviceStartDate` / `serviceEndDate` / `dueDate`. Its own action rather
     * than `order_edited` because these three reach ARCA on the next
     * comprobante (`FchServDesde` / `FchServHasta` / `FchVtoPago`), so an
     * operator changing one is changing what a fiscal document will declare,
     * and the timeline should say so rather than render a generic edit.
     */
     | 'service_period_changed' | 'discount_changed' | 'payment_method_changed' | 'delivery_method_changed' | 'delivery_address_changed' | 'invoice_created' | 'credit_note_created'
    /**
     * MercadoPago dynamic-QR minted against an order. The ONE member not in
     * the `snake_case` taxonomy: the api has written this dotted literal into
     * the `AUDIT#ORDER#…` partition since before the union existed, so the
     * stored rows carry it verbatim. Publishing the value as-written is what
     * makes the union a faithful description of the partition — renaming it
     * would leave every historical row outside the type.
     */
     | 'mercadopago.dynamicQr.create';
    /** One ARCA fiscal SOAP interaction. Stored raw (CUIT unmasked) for 10y; masked at read. */
    interface FiscalAuditEvent {
        /** Schema version for forward-compat (start at 1). */
        schema_version: number;
        /** Unique id for this interaction (uuid). */
        event_id: string;
        /** Owning tenant store id, e.g. STO002. Partition-scoping key. */
        tenant_store_id: string;
        /** Unix ms when the interaction completed. */
        ts: number;
        /** Which ARCA fiscal op — see `ConstatarComprobante` (WSCDC), `FEXAuthorize` (WSFEX), `ConsultarApoc` (APOC registry check). */
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
        /** Raw ARCA Events.Evt[] passthrough — same treatment as errores/observaciones. */
        eventos?: {
            code: number;
            msg: string;
        }[];
        /** Wall-clock duration of the SOAP call in ms. */
        durationMs: number;
        /** Full request args + response body (raw), for the regulator record. */
        requestPayload: Record<string, unknown>;
        responsePayload: Record<string, unknown>;
        /**
         * Set ONLY when the interaction was triggered from inside a MANAGER
         * support-impersonation session. Absent means the tenant acted for itself,
         * which is the overwhelming majority — so absence is the normal case and
         * must never be read as "unknown actor".
         *
         * These records are retained 10 years and are the tenant's due-diligence
         * defence: an ARCA review reads them as proof the tenant checked a CUIT at
         * the time of the transaction. Without this field a platform operator's
         * lookups are indistinguishable from the tenant's own, so the tenant either
         * claims diligence it never performed or cannot account for the entry.
         */
        actedBy?: {
            /** Operator (MANAGER) user id — the impersonation JWT's `act.sub`. */
            operatorId: string;
            /** Impersonation session id — the JWT `sid`; correlates to the `IMPERSONATION#{operatorId}` registry row. */
            sessionId: string;
        };
    }
    /** APOC ("facturas apócrifas") CUIT check request. Source is ARCA's public registry snapshot imported daily into the api's `APOC` DDB partition (no per-check ARCA call). */
    interface ApocCheckRequest {
        /** The counterparty CUIT being checked (the invoice issuer, not this store). */
        cuit: string;
    }
    /** Result of an APOC registry check. Every check is logged to `FiscalAuditEvent` with operation `'ConsultarApoc'`. */
    interface ApocCheckResult {
        /** True if the CUIT appears in ARCA's APOC registry. */
        flagged: boolean;
        /** ISO date — when ARCA flagged this CUIT ("Fecha Condición Apócrifo"); present when flagged. */
        fraudConditionDate?: string;
        /** ISO date — when ARCA published the flag; present when flagged. */
        publicationDate?: string;
        /** ISO date — freshness of the imported registry snapshot (the file's "Generado" stamp). */
        registrySnapshotAt: string;
        /** True when `registrySnapshotAt` is older than the staleness threshold. `flagged` is still computed from the local snapshot; this only marks the answer as based on a potentially outdated registry. */
        stale: boolean;
        /** Days between `registrySnapshotAt` and `checkedAt`. */
        registryAgeDays: number;
        /** ISO timestamp of this check. */
        checkedAt: string;
    }
}
export {};
