declare global {
    /**
     * What a booking is FOR. A fixed vocabulary the tenant does not configure —
     * `AppointmentTypeConfig` configures each type's slotting, not the set.
     *
     * ⚠️ Which linked-entity field is meaningful depends on this: `ORDER_PICKUP`
     * and `DELIVERY_WINDOW` carry `orderId`, `SUPPLIER_MEETING` carries
     * `supplierId`, the rest carry `customerId`. Nothing enforces that at the
     * type level — a booking with the wrong link still compiles.
     */
    type AppointmentType = 'ORDER_PICKUP' | 'DELIVERY_WINDOW' | 'SALES_VISIT' | 'CUSTOMER_CONSULTATION' | 'SUPPLIER_MEETING' | 'RECURRING_VISIT';
    /**
     * The lifecycle of a booking.
     *
     * ⚠️ There is deliberately NO `AVAILABLE` member. An open slot is a
     * COMPUTATION over `AppointmentTypeConfig` plus the availability/override
     * rows — it has no `customerId`, no `orderId` and nobody has booked it. A
     * status for it would require rows to exist before anyone books, which
     * defeats the conditional-write that makes double-booking impossible.
     *
     * ⚠️ Nor a `REMINDED` member. A single status cannot say WHICH reminder
     * fired, so any real implementation needs a per-reminder record and the
     * status is redundant the moment that exists.
     *
     * Terminal: `COMPLETED`, `CANCELLED`, `NO_SHOW`, and `RESCHEDULED` — the
     * last marking a superseded row, whose replacement is a NEW row rather than
     * a mutation of this one, so the original booking's history survives.
     */
    type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED';
    /**
     * A scheduled booking. Phase 1 is an INTERNAL operations tool: every frame
     * is operator-audience, and no customer-facing booking surface consumes
     * this yet.
     */
    interface Appointment {
        appointmentId: string;
        storeId: string;
        type: AppointmentType;
        status: AppointmentStatus;
        /** The customer this booking is with, where the type implies one. */
        customerId?: string;
        /** The order being collected or delivered, for the two order-bound types. */
        orderId?: string;
        /** The supplier being met. Set only on `SUPPLIER_MEETING`. */
        supplierId?: string;
        /**
         * The user this appointment is assigned to — a sales rep for
         * `SALES_VISIT`, otherwise whoever is expected to handle it. Optional:
         * `ORDER_PICKUP` and `DELIVERY_WINDOW` may have no single owner.
         *
         * Backs the employee filter on the appointment list and the
         * employee-schedule index, so it is a GSI key attribute — it must be a
         * string or absent, never an empty string.
         */
        assignedTo?: string;
        /**
         * `YYYYMMDD` in the store's local time. Display convenience — see the
         * authority note on `startTimestamp`.
         */
        date: number;
        /** `HHmm` local. Display convenience — see `startTimestamp`. */
        startTime: string;
        /** `HHmm` local. Display convenience — see `startTimestamp`. */
        endTime: string;
        /**
         * Unix ms, UTC. **Authoritative** for ordering, every query, and all
         * arithmetic.
         *
         * ⚠️ `date` / `startTime` / `endTime` are display-convenience strings
         * DERIVED from this pair at write time. Never derive in the other
         * direction, and never let a write update one pair without the other —
         * two representations of one instant drift silently, and the local strings
         * are the half that looks right while being wrong.
         */
        startTimestamp: number;
        /** Unix ms, UTC. Authoritative — see `startTimestamp`. */
        endTimestamp: number;
        /** RRULE string for a repeating booking. Absent means a one-off. */
        recurrenceRule?: string;
        /** The parent row a generated occurrence was expanded from. */
        recurrenceId?: string;
        /**
         * On a `RESCHEDULED` row: the appointment that replaced it.
         * On the replacement: {@link Appointment.rescheduledFrom}.
         *
         * ⚠️ NOT `recurrenceId`, which is a different relationship entirely — that
         * links a generated occurrence to its recurring series. A reschedule chain
         * is a supersession, not a repetition, and conflating them would make a
         * moved booking look like a recurring one.
         *
         * ⚠️ These two fields are written in the SAME `transactWrite` that creates
         * the replacement, so neither is a cache of the other and they cannot
         * drift. A `RESCHEDULED` row without this field is a supersession whose
         * replacement was never recorded — treat it as a defect, not as an
         * appointment that was simply cancelled.
         */
        rescheduledTo?: string;
        /** On a replacement row: the `RESCHEDULED` appointment it superseded. */
        rescheduledFrom?: string;
        cancelledAt?: number;
        cancelledBy?: string;
        checkedInAt?: number;
        completedAt?: number;
        createdAt: number;
        updatedAt?: number;
        /**
         * Optimistic-concurrency counter, bumped on every write and asserted by a
         * conditional update. Two operators editing the same slot is the ordinary
         * case here, not the rare one.
         */
        version: number;
    }
    /**
     * Per-store slotting rules for ONE `AppointmentType`. Stored as an array on
     * `Store.config.appointmentTypes`, alongside the other per-store feature
     * config, rather than as its own partition.
     */
    interface AppointmentTypeConfig {
        storeId: string;
        typeId: AppointmentType;
        /** Slot granularity in minutes. */
        slotMinutes: number;
        /** How many bookings may occupy one slot. */
        capacity: number;
        /** Minimum notice, in minutes, before the next bookable slot. */
        leadTimeMinutes: number;
        /**
         * Whether this type is bookable. Absent means enabled.
         *
         * A disabled type is filtered out of availability rather than deleted, so
         * its slotting settings survive being switched off and back on.
         */
        enabled?: boolean;
    }
}
export {};
