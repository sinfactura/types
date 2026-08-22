declare global {
    /**
     * WebSocket broadcast payload for the `payment_received` action, fired when a
     * "money received" event is persisted (MP webhook, Stripe webhook, or MP
     * movements poller). FE should toast with `total`+`currency`+`payerName` and
     * invalidate `PaymentReceived`/`PaymentReceivedUnlinked` RTK Query tags.
     */
    type PaymentReceivedSource = "mp" | "stripe" | "mp_movement";
    interface PaymentReceivedWsPayload {
        source: PaymentReceivedSource;
        paymentId: string;
        total: number;
        currency: string;
        payerName?: string;
        paidAt: number;
        customerId?: string;
        orderId?: string;
        invoiceId?: string;
        externalReference?: string;
    }
    /**
     * REST shape of a payment row returned by `GET /payments/received`. Distinct
     * from `PaymentReceivedWsPayload` (the lean live-tail WS event): this carries
     * denormalized labels (customerName, orderCode, invoiceCode) attached
     * server-side so the FE doesn't N+1 fetch.
     */
    interface PaymentReceived {
        paymentId: string;
        source: PaymentReceivedSource;
        total: number;
        currency: string;
        currencyValue?: number;
        currencyValueAt?: number;
        payerName?: string;
        payerEmail?: string;
        payerCuit?: string;
        paidAt: number;
        customerId?: string;
        customerName?: string;
        orderId?: string;
        orderCode?: string;
        invoiceId?: string;
        invoiceCode?: string;
        accountId?: string;
        linkedAt?: number;
        linkSource?: "auto" | "manual";
        /**
         * MP/Stripe-side `external_reference`, persisted on the row and already
         * carried by `PaymentReceivedWsPayload`. Optional here because the REST
         * projection of older api builds omits it — treat absence as "not
         * projected", not "no reference".
         */
        externalReference?: string;
        reconciled?: boolean;
        reconcileReason?: string;
    }
    /**
     * Confidence tier for a link suggestion.
     *
     * Mapped from heuristic match strength:
     *   - 'Alta': customer CUIT/email exact OR order amount-exact + ±24h
     *   - 'Media': order amount ±5% within ±7d
     *   - 'Baja': reserved for future broader heuristics (currently unused)
     */
    export type LinkSuggestionConfidence = "Alta" | "Media" | "Baja";
    /**
     * One ranked customer candidate for a payment's link dialog.
     * The FE renders the chip with `fullName`, the confidence badge, and the
     * `reason` text verbatim.
     */
    interface CustomerCandidate {
        customerId: string;
        fullName: string;
        cuit?: string;
        email?: string;
        confidence: LinkSuggestionConfidence;
        reason: string;
        score: number;
    }
    /**
     * One ranked order candidate for a payment's link dialog. `orderCode` is
     * currently identical to `orderId` (no separate short code on Order today).
     * `currency`/`total` are always in ARS (v1's storage currency); USD-priced
     * orders surface their ARS-equivalent.
     */
    interface OrderCandidate {
        orderId: string;
        orderCode: string;
        customerId: string;
        customerName: string;
        total: number;
        currency: string;
        dated: number;
        confidence: LinkSuggestionConfidence;
        reason: string;
        score: number;
    }
    /**
     * Response shape of `GET /payments/{source}/{paymentId}/link-suggestions`.
     * Both arrays may be empty when no signal — FE renders "Sin sugerencias
     * automáticas" and falls back to manual customer / order search inputs.
     */
    interface LinkSuggestionsResponse {
        customers: CustomerCandidate[];
        orders: OrderCandidate[];
    }
}
export {};
