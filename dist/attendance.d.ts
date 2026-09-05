declare global {
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
        ts: number;
        source: ClockEventSource;
        geohash?: string;
        deviceId?: string;
        correctionOf?: string;
        reasonCode?: ClockEventCorrectionReason;
        approvedBy?: string;
        createdAt: number;
    }
    type ClockEventCorrectionReason = 'FORGOT_TO_CLOCK_IN' | 'FORGOT_TO_CLOCK_OUT' | 'DEVICE_UNAVAILABLE' | 'WRONG_TIME_RECORDED' | 'SUPERVISOR_ADJUSTMENT';
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
        shiftId: string;
        clockInAt: number;
    }
    type AttendanceShiftStatus = 'OPEN' | 'CLOSED' | 'FLAGGED' | 'APPROVED';
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
        shiftId: string;
        storeId: string;
        userId: string;
        userFullName?: string;
        date: number;
        status: AttendanceShiftStatus;
        clockInAt: number;
        clockOutAt?: number;
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
export {};
