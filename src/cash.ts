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
}

export {}; // NOSONAR
