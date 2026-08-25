declare global {
  // Employee time & attendance. Event-sourced: an append-only `ClockEvent`
  // ledger is the system of record, and `AttendanceShift` is a projection
  // rebuilt from it — so a shift can always be recomputed and never has to be
  // trusted on its own. Deliberately NOT an extension of `CashShift`/`CashEvent`:
  // that pair reconciles a till, this pair records presence and hours. Only the
  // naming and the `${date}-${userId}` composite-key convention are borrowed.

  type ClockEventType = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';

  type ClockEventSource = 'app' | 'kiosk' | 'whatsapp';

  /**
   * One immutable punch. PK `STORE#{storeId}#EMP#{userId}`,
   * SK `EVENT#{ts}#{eventId}` — one item collection per employee per store,
   * chronologically sortable and collision-safe.
   *
   * ⚠️ Append-only: never `UpdateItem` or `DeleteItem` against this collection.
   * A correction is a NEW row carrying `correctionOf`, so the original punch and
   * the fix both survive — which is the whole point of keeping the ledger
   * separate from the projection. `reasonCode` and `approvedBy` are required
   * whenever `correctionOf` is set (a correction with no reason and no approver
   * is indistinguishable from a silent edit).
   */
  interface ClockEvent {
    eventId: string;
    storeId: string;
    userId: string;
    type: ClockEventType;
    // ms epoch, SERVER-assigned. Never the client clock — this feeds payroll,
    // and a device with a wrong or deliberately-set time would otherwise write
    // hours nobody worked.
    ts: number;
    source: ClockEventSource;
    // Soft signal only — a geofence miss flags a shift for review, it never
    // blocks a punch. An employee whose phone cannot get a fix still has to be
    // able to clock in.
    geohash?: string;
    deviceId?: string;
    // SK of the event this one corrects. Present only on correction rows.
    correctionOf?: string;
    reasonCode?: ClockEventCorrectionReason;
    approvedBy?: string; // userId
    createdAt: number;
  }

  type ClockEventCorrectionReason =
    | 'FORGOT_TO_CLOCK_IN'
    | 'FORGOT_TO_CLOCK_OUT'
    | 'DEVICE_UNAVAILABLE'
    | 'WRONG_TIME_RECORDED'
    | 'SUPERVISOR_ADJUSTMENT';

  /**
   * Ephemeral concurrency sentinel — one item per employee for as long as they
   * are clocked in. PK `STORE#{storeId}#EMP#{userId}`, SK `OPEN_SHIFT`.
   *
   * Written under `attribute_not_exists`, which is what makes a double clock-in
   * fail at the database rather than at a read-then-write the second tap can
   * race. Disposable state, not audit: it is DELETED on clock-out rather than
   * corrected — the ledger already holds what happened.
   */
  interface OpenShift {
    storeId: string;
    userId: string;
    shiftId: string; // links to the AttendanceShift this becomes once closed
    clockInAt: number;
  }

  type AttendanceShiftStatus = 'OPEN' | 'CLOSED' | 'FLAGGED' | 'APPROVED';

  // Soft anomaly markers surfaced for supervisor review. Never hard gates —
  // none of these may block a punch or withhold a shift.
  type AttendanceShiftFlag = 'LATE' | 'MISSED_CLOCK_OUT' | 'OUTSIDE_GEOFENCE' | 'OVERTIME';

  /**
   * The derived daily roll-up — one per employee per day. PK `STORE#{storeId}`,
   * SK `SHIFT#{date}#{userId}`, mirroring `CashShift`'s `${date}-${userId}`
   * composite id so the two shift concepts key the same way.
   *
   * ⚠️ Written ONLY by the projector reading the `ClockEvent` ledger — never
   * hand-written by a handler and never patched by a client. That is the
   * property that lets it be dropped and rebuilt; a direct write would make the
   * projection and the ledger able to disagree with nothing to reconcile them.
   * `totalMinutes`/`overtimeMinutes` are computed there for the same reason.
   */
  interface AttendanceShift {
    shiftId: string; // `${date}-${userId}` — URL-safe id
    storeId: string;
    userId: string;
    userFullName?: string;
    date: number; // YYYYMMDD (Buenos Aires TZ, via the api's getDated())
    status: AttendanceShiftStatus;
    clockInAt: number; // ms epoch
    clockOutAt?: number;
    // Computed by the projector from the ledger, net of BREAK_START/BREAK_END.
    totalMinutes?: number;
    breakMinutes?: number;
    overtimeMinutes?: number;
    flags?: AttendanceShiftFlag[];
    approvedAt?: number;
    approvedBy?: string;
    approvedByName?: string;
    createdAt: number;
    updatedAt?: number;
  }
}

export {}; // NOSONAR
