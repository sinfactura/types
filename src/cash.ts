declare global {
  interface Cash {
    storeId: string;
    cashId: string;
    createdAt: number; //timeStamp
    dated: number; // 20220123
    description: string;
    income?: number;
    outcome?: number;
    balance?: number;
    subject?: string;
    // catalogId (api#942) — FK to PlatformCurrency. Self-describing
    // currency stamp matching the rest of the money entities
    // (api#1184 / app#1539 / ADR-0013).
    currency?: string;
    currencyValue?: number;
    // Unix ms at which `currencyValue` was effective.
    currencyValueAt?: number;
    // Per-currency totals. On CASH movements this is unused
    // (`income`/`outcome` + `currency` are sufficient). On the
    // CASH#BALANCE snapshot and the synthetic cashStart opening row,
    // these carry the bucketed accumulator (api#986).
    balanceByCurrency?: Record<string, number>;
    incomeByCurrency?: Record<string, number>;
  }

  // Cash-drawer shift management (api#987 — BE companion to app#949 / epic app#946).
  type CashShiftStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'REJECTED';

  type CashEventType = 'apertura' | 'cash-in' | 'cash-out' | 'sale' | 'refund' | 'tip' | 'cierre' | 'reconcile';

  /**
   * A cashier's drawer shift — one per cashier per day. PK `STORE#{storeId}`,
   * SK `SHIFT#{shiftId}` where `shiftId = ${date}-${userId}`. State machine:
   * OPEN → CLOSED (blind count) → RECONCILED | REJECTED (manager).
   */
  interface CashShift {
    shiftId: string; // `${date}-${userId}` — URL-safe id
    storeId: string;
    userId: string; // cashier who opened the shift
    date: number; // YYYYMMDD (Buenos Aires TZ)
    status: CashShiftStatus;
    float: number; // apertura — opening cash amount
    currency: string; // currency catalogId
    openedAt: number; // ms epoch
    openedBy: string; // userId
    openedByName?: string;
    closedAt?: number;
    closedBy?: string;
    closedByName?: string;
    declaredCount?: number; // cashier's blind cash count at cierre
    // Computed at close from the event log. NOT exposed in the close response
    // (blind) — revealed only after reconciliation.
    expectedBalance?: number;
    // Optimistic-concurrency seq — bumped on apertura + every movement so a
    // movement racing the close aborts it (TOCTOU guard).
    eventSeq?: number;
    reconciledAt?: number;
    reconciledBy?: string;
    reconciledByName?: string;
    variance?: number; // declaredCount - expectedBalance (set at reconcile)
    reconcileDecision?: 'approved' | 'rejected';
    reconcileNote?: string;
    // Room for AFIP/DNU 731/2024 cash-tip compliance reports (app#960).
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
    userId: string; // who recorded the event
    createdAt: number; // ms epoch — also the EVENT# sort component
  }
}

export {}; // NOSONAR
