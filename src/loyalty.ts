declare global {
  /**
   * The store's loyalty configuration — one row per store, so reading the
   * program is a point read rather than a query.
   *
   * ⚠️ Every points-to-money conversion happens where the ledger is written,
   * never on a consumer. A client that multiplied a balance by a rate would be
   * displaying a second answer nobody wrote down, and the two would disagree
   * the first time a rate changed between the read and the redemption.
   */
  interface LoyaltyProgram {
    storeId: string;
    /**
     * Whether the program accrues and redeems today.
     *
     * ⚠️ Off is a pause, never an erasure: balances, tiers and ledger rows all
     * survive it. Points a customer was told they had are a promise the store
     * made, and a switch is not how a promise is withdrawn.
     */
    enabled: boolean;
    /** Points granted per ONE unit of `currency` actually charged. */
    earnRate: number;
    /**
     * Points required per ONE unit of `currency` granted back at redemption —
     * the divisor, so the coupon's grant is `floor(points / redemptionRate)`.
     *
     * Deliberately NOT the reciprocal of `earnRate`: the spread between the two
     * is the program's cost, and expressing redemption as "earn, inverted"
     * would make that cost impossible to set.
     */
    redemptionRate: number;
    /**
     * The catalogId this program's MONEY is denominated in (ADR-0013 §3) —
     * the currency a redemption's coupon is minted in and the currency an earn
     * is measured against.
     *
     * ⚠️ **An amount in a currency the store does not price REFUSES the earn.**
     * Never accrue at an assumed rate of 1: a missing rate is an unknown
     * quantity, and treating it as parity silently mints points against a
     * number that means nothing.
     */
    currency: string;
    /** Floor, in POINTS, below which a redemption is refused. */
    minRedemption: number;
    createdAt: number;
    updatedAt: number;
  }

  /**
   * One rung of the store's tier table.
   *
   * A configurable ROW, never a hardcoded Bronze/Silver/Gold/Platinum enum:
   * how many tiers a store runs is a row count. A store running two rungs has
   * two rows, and a store running none has none — rather than four members it
   * has to pretend not to use.
   */
  interface LoyaltyTier {
    storeId: string;
    tierId: string;
    name: string;
    /**
     * The `lifetimePoints` at which this rung is reached.
     *
     * ⚠️ Evaluated against `LoyaltyAccount.lifetimePoints`, never `balance` —
     * spending points must not demote the customer who spent them.
     */
    threshold: number;
    /** Percentage cut this rung grants. Absent means the rung is status only. */
    discountPercent?: number;
    /**
     * Display order. Presentation only — `threshold` is the rule, and the two
     * can disagree in stored data, so never infer one from the other.
     */
    order: number;
  }

  /**
   * A customer's live points balance — one row per (store, customer). The
   * ledger holds the history; this holds the running total.
   */
  interface LoyaltyAccount {
    storeId: string;
    customerId: string;
    /**
     * Spendable points.
     *
     * ⚠️ **Never write this directly.** It moves only under a conditional
     * update, in the same shape as `Coupon.redemptions` / `Coupon.discountSpent`
     * — the condition IS the guard, and a plain overwrite loses every
     * concurrent redemption, letting two requests spend the same points.
     * Server-owned; refused from the wire.
     */
    balance: number;
    /**
     * Points EARNED over the account's life. Never decremented by a redemption:
     * it is what the tier is evaluated against, so spending has to leave it
     * alone or every redemption would demote.
     */
    lifetimePoints: number;
    /**
     * The rung whose `threshold` this account's `lifetimePoints` last crossed —
     * an FK into the store's own tier table.
     *
     * Optional: absent until `lifetimePoints` first crosses a rung, and for a
     * store that runs no tiers. Never an empty string — a consumer resolving an
     * id against a missing row cannot tell "no tier yet" from "tier deleted",
     * and both render as no discount.
     */
    tierId?: string;
    updatedAt: number;
  }

  /**
   * What a ledger row did to the balance. `'adjust'` is the correction verb —
   * a manual grant and a clawback are both adjustments, told apart by the sign
   * of `points`, not by a member of their own.
   */
  type LoyaltyTransactionKind = 'earn' | 'redeem' | 'adjust';

  /**
   * One immutable ledger row.
   *
   * ⚠️ **The ledger is APPEND-ONLY.** A correction is a NEW compensating
   * `'adjust'` row — never an edit of an existing row and never a delete. Same
   * rule as a nota de crédito, and for the same reason (ADR-0013 §4): what a
   * customer was told they had is evidence, and rewriting it destroys the only
   * record that the balance and the grants ever agreed.
   */
  interface LoyaltyTransaction {
    storeId: string;
    customerId: string;
    transactionId: string;
    kind: LoyaltyTransactionKind;
    /**
     * SIGNED, and the sign follows `kind`: an `'earn'` is positive, a
     * `'redeem'` negative, an `'adjust'` either.
     *
     * ⚠️ Read the value as written. Taking a magnitude here and re-deriving the
     * sign from `kind` at the call site is how a compensating adjustment lands
     * on the wrong side of the balance.
     */
    points: number;
    /**
     * The order this row was computed from. Set on an `'earn'`.
     *
     * ⚠️ The earn is computed from the amount ACTUALLY CHARGED, so a redemption
     * never earns points back against the value it just redeemed.
     */
    orderId?: string;
    /**
     * The `Coupon` code this redemption minted. Set on a `'redeem'`.
     *
     * A loyalty reward IS a coupon the store mints — `type: 'amount'`,
     * `maxRedemptions: 1`, `customerId` bound — so the redemption's treatment
     * on a comprobante is a coupon's, not a second fiscal question. The debit
     * and the mint are one transaction: a partial failure leaves neither a
     * coupon nor a debit.
     */
    couponCode?: string;
    /**
     * The reward a `redeem` row bought. Set on every `redeem` row (the minted
     * coupon alone cannot say which reward it came from); absent on `earn` and
     * `adjust`.
     */
    rewardId?: string;
    /**
     * ADR-0013 §1 self-describing money stamp, FROZEN AT WRITE: the catalogId,
     * the FX rate used, and the Unix ms at which that rate was effective.
     *
     * Required on EVERY row, `'adjust'` included. A ledger row whose money
     * cannot be read back in the currency it was earned in is a number with no
     * unit, and re-deriving the rate at read time re-prices history every time
     * the rate moves.
     *
     * ⚠️ A currency the store does not price REFUSES the write. Never stamp an
     * assumed rate of 1.
     */
    currency: string;
    currencyValue: number;
    currencyValueAt: number;
    createdAt: number;
    /**
     * The acting user's id. The ledger names who moved the points, which is
     * what makes an `'adjust'` auditable at all.
     */
    createdBy: string;
  }

  /**
   * A catalogue entry a customer can spend points on.
   *
   * ⚠️ It carries NO money mechanics of its own. Redeeming one mints a
   * `Coupon`, and every money field — the grant, its currency, the caps — stays
   * owned by that coupon. A second place that can disagree on the terms is a
   * second answer to what the customer actually got.
   */
  interface LoyaltyReward {
    storeId: string;
    rewardId: string;
    name: string;
    /**
     * Price in POINTS, never money. The money follows at redemption from
     * `LoyaltyProgram.redemptionRate`, so a rate change re-prices the whole
     * catalogue at once instead of leaving stale amounts on every row.
     */
    pointsCost: number;
    /**
     * Archived retires the entry from the catalogue without deleting the row,
     * so a reward that was offered stays readable after it stops being
     * offered.
     *
     * ⚠️ A `'redeem'` ledger row names the `Coupon` it minted, not the reward —
     * so a deleted row would leave nothing at all to read back about what was
     * on offer. Archive; never delete.
     */
    status: 'active' | 'archived';
  }
}

export {}; // NOSONAR
