declare global {
    interface Cash {
        storeId: string;
        cashId: string;
        createdAt: number;
        dated: number;
        description: string;
        income?: number;
        outcome?: number;
        balance?: number;
        subject?: string;
        currency?: string;
        currencyValue?: number;
        currencyValueAt?: number;
        balanceByCurrency?: Record<string, number>;
        /**
         * @deprecated The api neither stores nor returns this on any Cash path —
         * the server-side synthetic `cashStart` opening row that once carried it
         * was decommissioned. It survives only as an app-view field on the
         * client-synthesized opening row: see `CashOpeningDisplayRow`.
         */
        incomeByCurrency?: Record<string, number>;
    }
    /**
     * The client-synthesized opening row prepended to the cash listing — carries
     * the per-currency opening accumulator (from the response envelope's
     * `openingBalanceByCurrency`) that the api once emitted as a server-side
     * `cashStart` row and no longer does. A display shape only: never a stored
     * entity, never sent to the api.
     */
    interface CashOpeningDisplayRow extends Cash {
        incomeByCurrency: Record<string, number>;
    }
    type CashShiftStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'REJECTED';
    type CashEventType = 'apertura' | 'cash-in' | 'cash-out' | 'sale' | 'refund' | 'tip' | 'cierre' | 'reconcile';
    /**
     * A cashier's drawer shift — one per cashier per day. PK `STORE#{storeId}`,
     * SK `SHIFT#{shiftId}` where `shiftId = ${date}-${userId}`. State machine:
     * OPEN → CLOSED (blind count) → RECONCILED | REJECTED (manager).
     */
    interface CashShift {
        shiftId: string;
        storeId: string;
        userId: string;
        date: number;
        status: CashShiftStatus;
        float: number;
        currency: string;
        openedAt: number;
        openedBy: string;
        openedByName?: string;
        closedAt?: number;
        closedBy?: string;
        closedByName?: string;
        declaredCount?: number;
        expectedBalance?: number;
        eventSeq?: number;
        reconciledAt?: number;
        reconciledBy?: string;
        reconciledByName?: string;
        variance?: number;
        reconcileDecision?: 'approved' | 'rejected';
        reconcileNote?: string;
        tipDistribution?: Record<string, number>;
        createdAt: number;
        updatedAt?: number;
    }
    /**
     * Append-only audit row for every drawer movement.
     * PK `SHIFT#{storeId}#{shiftId}`, SK `EVENT#{createdAt}#{eventId}`.
     * Never overwritten or deleted — reconciliation replays it.
     *
     * The storeId segment is load-bearing, not decoration: shiftIds are
     * per-store counters, so a bare `SHIFT#{shiftId}` would merge two tenants'
     * drawer history into one partition. The api's key factory rejects the bare
     * form for exactly that reason — do not "simplify" this back.
     * (`CashShift`'s own SK `SHIFT#{shiftId}` below is correct and unrelated.)
     */
    interface CashEvent {
        eventId: string;
        shiftId: string;
        storeId: string;
        type: CashEventType;
        amount: number;
        direction?: 'income' | 'outcome';
        concept?: string;
        currency: string;
        userId: string;
        createdAt: number;
    }
}
export {};
