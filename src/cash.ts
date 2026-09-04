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
    // catalogId — FK to PlatformCurrency. Self-describing
    // currency stamp matching the rest of the money entities
    // (ADR-0013).
    currency?: string;
    currencyValue?: number;
    // Unix ms at which `currencyValue` was effective.
    currencyValueAt?: number;
    // Per-currency balance accumulator. On CASH movements this is unused
    // (`income`/`outcome` + `currency` are sufficient); the api writes it on
    // the CASH#BALANCE snapshot row.
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

  // Cash-drawer shift management.
  type CashShiftStatus = 'OPEN' | 'CLOSED' | 'RECONCILED' | 'REJECTED';

  /**
   * Kinds of drawer movement.
   *
   * `'change'` is cash handed back to the customer while settling a sale. It is
   * its own row rather than a netting against the `'sale'` row, so the drawer
   * replays gross in and gross out. ⚠️ It is NOT `'refund'`, which reverses a
   * completed sale.
   */
  type CashEventType =
    | 'apertura'
    | 'cash-in'
    | 'cash-out'
    | 'sale'
    | 'change'
    | 'refund'
    | 'tip'
    | 'cierre'
    | 'reconcile';

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
    /**
     * The per-denomination breakdown behind `declaredCount`, when the cashier
     * declared one rather than a bare total.
     *
     * ⚠️ `declaredCount` stays the authoritative scalar and is ALWAYS the number
     * `variance` is computed from. When this field is present the api DERIVES
     * `declaredCount` from it and stamps both, so the two can never disagree — a
     * client that sends both does not get to pick. Deliberately a second field
     * rather than widening `declaredCount` to `number | DenominationCount`:
     * `variance` is `declaredCount - expectedBalance`, so a union would break
     * every existing reader that does arithmetic on it.
     */
    declaredDenominations?: DenominationCount;
    /**
     * Why a shift was closed by somebody other than its owner. Present only on a
     * forced close; `closedBy !== openedBy` is what identifies one, so no separate
     * boolean exists to fall out of sync with it.
     */
    forceCloseReason?: string;
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
    // Room for AFIP/DNU 731/2024 cash-tip compliance reports.
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
    userId: string; // who recorded the event
    createdAt: number; // ms epoch — also the EVENT# sort component
  }

  /**
   * A store's configurable bill/coin denomination catalog, used to validate a
   * blind-count declaration at close.
   *
   * Absent on `Store['config']` means the api's built-in Argentine default
   * applies — this is forward-only, so no store row carries the field until
   * somebody sets it, and absence is a real state rather than an empty catalog.
   */
  interface DenominationSet {
    bills: number[];
    coins: number[];
  }

  /**
   * One denomination face value to the quantity counted at a blind close.
   *
   * ⚠️ Keys are the denomination's numeric value AS A STRING, because JSON object
   * keys always are — `{ "10000": 3, "500": 12 }`, never `{ 10000: 3 }`. Every key
   * must be a member of the store's `DenominationSet`; the api validates that at
   * close time, the type cannot.
   */
  type DenominationCount = Record<string, number>;

  /**
   * The bands a reconcile's variance falls into, expressed in `currency`'s units.
   *
   * `|variance| <= autoApprove` auto-approves; up to and including `requireReview`
   * needs review; anything beyond escalates. The api validates
   * `autoApprove <= requireReview` — the type cannot express it.
   *
   * Self-describing per ADR-0013, and single-currency by construction to match the
   * ONE currency a `CashShift` carries. A store running shifts in several
   * currencies configures its primary one; multi-currency shifts are deferred.
   */
  interface VarianceThresholds {
    currency: string; // catalogId
    autoApprove: number;
    requireReview: number;
  }
}

export {}; // NOSONAR
