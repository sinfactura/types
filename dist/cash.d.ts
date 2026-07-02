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
        incomeByCurrency?: Record<string, number>;
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
     * Append-only audit row for every drawer movement. PK `SHIFT#{shiftId}`,
     * SK `EVENT#{createdAt}#{eventId}`. Never overwritten or deleted —
     * reconciliation replays it.
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
