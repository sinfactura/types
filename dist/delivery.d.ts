declare global {
    /**
     * Where a delivery has got to. Also the vocabulary of
     * {@link DeliveryEvent.type} — a status IS an event, because the status is
     * never set directly: it is whatever the newest event says.
     */
    type DeliveryStatus = 'assigned' | 'pickedUp' | 'inTransit' | 'delivered' | 'failed';
    /**
     * ⚠️ Deliberately an alias, not a second list. Two parallel unions would
     * drift, and the first symptom would be a status no event can produce.
     */
    type DeliveryEventType = DeliveryStatus;
    /**
     * Why a delivery attempt failed. Set only on a `'failed'` event; the free-text
     * `note` carries the detail this cannot.
     *
     * `'could-not-pay'` is a cash-on-delivery attempt the customer could not
     * settle, and `'closed'` a business shut at the delivery hour — both common
     * enough locally to be worth counting rather than losing inside `'other'`.
     */
    type DeliveryFailureReason = 'no-one-home' | 'refused' | 'address-not-found' | 'could-not-pay' | 'closed' | 'other';
    /**
     * The header row for one delivery — a cheap read for a list view.
     *
     * ⚠️ `status` is a CACHE of the newest event and is never authoritative. The
     * append-only `DeliveryEvent` log is the record; this row is refreshed by
     * appending an event and must never be mutated independently. A reader
     * settling a dispute reads the events, not this.
     */
    interface Delivery {
        deliveryId: string;
        storeId: string;
        orderId: string;
        invoiceId?: string;
        /** Cached from the newest event — see the note above. */
        status: DeliveryStatus;
        courier: {
            /** Set when the courier is a platform user; absent for an outside carrier. */
            userId?: string;
            name: string;
            /**
             * ⚠️ PII (Ley 25.326) — typically a phone number, and a courier's personal
             * data is protected exactly as a customer's is. Never log it, never put it
             * on a customer-facing projection.
             */
            contact?: string;
            vehicle?: string;
        };
        estimatedArrivalAt?: number;
        createdAt: number;
        updatedAt?: number;
    }
    /**
     * Proof captured at the door. Stored in S3 under a SERVER-DERIVED key and
     * read back through a short-lived presigned GET — the client never chooses
     * the key and never uploads directly, so it cannot forge a path or bypass the
     * size/content sniff.
     */
    interface DeliveryProofAsset {
        assetId: string;
        kind: 'photo' | 'signature';
        /** ⚠️ Server-derived. Carries no original filename and no PII. */
        key: string;
        contentType: string;
        size: number;
    }
    /**
     * A location fix taken at a delivery event.
     *
     * ⚠️ PII (Ley 25.326): a coordinate tied to a named customer at a timestamp is
     * personal data about BOTH that customer and the courier. It must never reach
     * a log line, a Sentry event or the `ERROR` partition, and never a
     * customer-facing projection.
     */
    interface DeliveryGpsFix {
        lat: number;
        lng: number;
        /** Metres, as reported by the device. */
        accuracy?: number;
        /** Client-claimed capture time — informational, never trusted for ordering. */
        capturedAt: number;
        /** Server-stamped arrival time. Authoritative. */
        receivedAt: number;
    }
    /**
     * One append-only entry in a delivery's timeline. Never overwritten and never
     * deleted: a correction is a NEW event, so a `'delivered'` later contradicted
     * by a `'failed'` leaves both on the record.
     *
     * PK `DELIVERY#{storeId}#{deliveryId}`, SK `EVENT#{createdAt}#{eventId}` —
     * the storeId segment is load-bearing, exactly as it is for `CashEvent`:
     * without it two tenants' timelines share a partition.
     */
    interface DeliveryEvent {
        eventId: string;
        storeId: string;
        deliveryId: string;
        type: DeliveryEventType;
        /** ms epoch, server-stamped and monotonic — also the `EVENT#` sort component. */
        createdAt: number;
        /**
         * The platform user who recorded it. Absent on an event appended by an
         * outside carrier's integration rather than by a person.
         */
        actorUserId?: string;
        note?: string;
        gps?: DeliveryGpsFix;
        proof?: DeliveryProofAsset[];
        /** Set only on a `'failed'` event. */
        failureReason?: DeliveryFailureReason;
    }
}
export {};
