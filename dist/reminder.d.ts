declare global {
    /** Which dispatcher actually delivered. Only the send helper knows this. */
    type ReminderChannel = 'gmail' | 'ses';
    /**
     * The document the email was ABOUT, so the queue can say what was chased
     * without a second lookup.
     */
    type ReminderDocumentType = 'invoice' | 'order' | 'payment' | 'return' | 'serviceOrder';
    /**
     * Why the email went out.
     *
     * ⚠️ `'transactional'` is today's entire population — an invoice copy, an
     * order confirmation, a receipt. `'reminder'` is a deliberate collections
     * chase and does not exist until the dunning mode ships.
     *
     * ⚠️ This discriminant is the whole reason `Customer.lastReminderAt` can be
     * trusted. Feeding that field from transactional sends would tell a
     * collections operator "chased two days ago" when the customer was sent an
     * order confirmation, and they would skip a debtor on the strength of it.
     */
    type ReminderKind = 'transactional' | 'reminder';
    /**
     * One append-only row per email that WAS delivered.
     *
     * ⚠️ A row exists only for a send that actually dispatched. A suppressed
     * recipient, a demo store, or a failed send writes NOTHING here — a phantom
     * row would both suppress a genuine future chase and tell the operator the
     * customer was contacted. Failures keep going to `registerLog` as they do now.
     *
     * Stored at `PK: REMINDER#{storeId}#{customerId}`, `SK: String(sentAt).padStart(13, '0')`,
     * allocated through the monotonic timestamp + `attribute_not_exists(SK)` path,
     * so the partition reads chronologically for one customer with no GSI. The
     * main table is at 19 of DynamoDB's 20 indexes, so a shape needing a new one
     * is not available.
     */
    interface ReminderRecord {
        storeId: string;
        customerId: string;
        /**
         * ms epoch from the monotonic allocator; also the row's SK, 13-padded.
         * ⚠️ Not `Date.now()` at the call site — two sends in one invocation would
         * collide on the SK.
         */
        sentAt: number;
        kind: ReminderKind;
        documentType: ReminderDocumentType;
        /** The document's own id, as the operator sees it. */
        documentId: string;
        channel: ReminderChannel;
        /**
         * The address actually mailed, which is evidence rather than duplication:
         * `Customer.email` can change afterwards, and then only this row says where
         * the chase went.
         *
         * ⚠️ PII under Ley 25.326, stored deliberately — the same call
         * `ChannelConsentStamp.ip` makes. It must never reach a log line, a Sentry
         * event, the DDB `ERROR` partition, an export, or any projection served to
         * a party other than the data subject.
         */
        to: string;
        /**
         * The staff member who caused the send, when there was one. ABSENT for a
         * queue-triggered transactional send, which has no acting user — do not
         * read absence as a system identity.
         */
        userId?: string;
        /** Denormalized at write time so the row survives a rename, as the activity trail does. */
        actorFullName?: string;
        createdAt: number;
    }
}
export {};
