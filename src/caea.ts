declare global {
  /**
   * Three-state CAEA readiness signal for the till (ARCA RG 4290 lane).
   *
   * `pointOfSale` — whether a dedicated CAEA punto de venta is configured.
   * `activePeriod` — whether a CAEA period is active for the CURRENT fortnight
   * right now. `period` — that period's `YYYYMM`, present ONLY when
   * `activePeriod` is true.
   *
   * ⚠️ The two booleans are independent, and the combination that looks like a
   * contradiction is the one that matters most: a store can be
   * `pointOfSale: true` with `activePeriod: false`, meaning it is onboarded but
   * sitting between periods. That is exactly the gap a CAEA request for the
   * current fortnight exists to close, so a consumer must not collapse the two
   * into a single "CAEA ready" boolean — doing so hides the only state the
   * operator can act on. `pointOfSale: false` skips the contingency breaker
   * regardless of period state.
   */
  interface CaeaReadiness {
    pointOfSale: boolean;
    activePeriod: boolean;
    period?: string;
  }

  /**
   * CAEA contingency usage against ARCA's art. 18 proportion limits.
   *
   * `monthComprobantesPct` is the share of the month's vouchers authorised by
   * CAEA rather than online CAE.
   *
   * `monthMinutesPct` — the availability leg — is OPTIONAL because there is
   * nothing to compute it from: no CAEA-availability-duration history is kept
   * anywhere, only a live health snapshot. Treat its absence as "not measured",
   * never as zero.
   *
   * ⚠️ `monthsFlagged` is a deliberate SIMPLIFICATION of the regulation's real
   * trigger, which is two CONSECUTIVE or three alternating months above the
   * threshold. This counts how many individual months exceeded it over a
   * trailing window, with no consecutive-or-alternating grouping. So a store can
   * report `monthsFlagged: 2` without having met ARCA's actual trigger, if the
   * two months are not adjacent. It is a stated scope limit, not a defect, and a
   * consumer must not present this number as a regulatory breach on its own.
   */
  interface CaeaContingencyUsage {
    monthComprobantesPct: number;
    monthMinutesPct?: number;
    monthsFlagged: number;
  }
}

export {}; // NOSONAR
