declare global {
  /**
   * Delivery channel for a campaign or template.
   *
   * ⚠️ `'email'` ONLY, deliberately. WhatsApp marketing lives in a separate,
   * currently PARKED epic, and SMS marketing is explicitly future research —
   * publishing either here would ship a contract implying capability nobody is
   * building. Both arrive as patch bumps when their epics unpark; widening is
   * cheap, and having shipped a promise is not.
   */
  type CampaignChannel = 'email';

  type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';

  interface Campaign {
    storeId: string;
    campaignId: string;
    name: string;
    channel: CampaignChannel;
    status: CampaignStatus;
    templateId?: string;
    segmentId?: string;
    promotionId?: string;
    scheduledAt?: number;
    sentAt?: number;
    /**
     * Aggregate send counters, maintained by an atomic DynamoDB `ADD` as the
     * send worker drains the recipient list — so they are eventually consistent
     * with, and can lag, the per-recipient `CampaignRecipient` rows.
     *
     * ⚠️ ABSENCE MEANS NO SEND HAS BEEN ATTEMPTED, and is never the same as
     * zero: a campaign that has not left `'draft'` carries no counters at all.
     * Render an absent counter as "not sent yet", never as `0`.
     *
     * ⚠️ NOT a substitute for the per-recipient rows. They carry no recipient
     * identity, no failure reason and no `'skipped'` tally, and an `ADD` that
     * lands twice on a retry cannot be reconciled from the counter alone —
     * audit a send against `CampaignRecipient`, never against these three.
     */
    queuedCount?: number;
    sentCount?: number;
    failedCount?: number;
    createdAt: number;
    updatedAt?: number;
  }

  /**
   * Send state of ONE recipient within a campaign.
   *
   * `'queued'` — accepted for delivery, not yet handed to the transport.
   * `'sent'` — the transport ACCEPTED it; acceptance is never proof of inbox
   * placement. `'failed'` — the transport refused or errored. `'skipped'` — the
   * segment matched the recipient but the recipient was not eligible at send
   * time (no marketing consent for the channel, or a suppressed address).
   *
   * ⚠️ `'skipped'` is a REFUSAL that was honoured, not a delivery problem:
   * never retry it, and never roll it into a failure rate.
   */
  type CampaignRecipientStatus = 'queued' | 'sent' | 'failed' | 'skipped';

  /**
   * One row per recipient per campaign, written by the campaign send worker.
   *
   * ⚠️ The row lives in a DEDICATED PER-CAMPAIGN PARTITION, not the shared
   * store partition. Recipients-per-campaign is the high-cardinality case here
   * — a single send can write more rows than a store's entire campaign history
   * — so co-locating them would make every campaign list read page through a
   * send log. Query these by campaign; there is no store-wide listing.
   *
   * ⚠️ Consent is re-checked LIVE at send time and is never inherited from
   * segment membership: a segment is a targeting filter, not a permission (see
   * `Segment`). A recipient the segment matched but the consent check refused
   * is recorded as `'skipped'` rather than dropped, so the refusal is auditable.
   *
   * ⚠️ An ABSENT marketing channel on the customer is NOT consent. Every reader
   * defaults a missing `marketing.*` channel to `false`; nothing in this
   * pipeline may read absence as permission to send.
   */
  interface CampaignRecipient {
    storeId: string;
    campaignId: string;
    customerId: string;
    status: CampaignRecipientStatus;
    /** The destination the send was addressed to, as resolved at send time. */
    email: string;
    /** Unix MILLISECONDS. Present on `'sent'` rows only. */
    sentAt?: number;
    /** Unix MILLISECONDS. Present on `'failed'` rows only. */
    failedAt?: number;
    /**
     * Machine-readable cause for the `'failed'` and `'skipped'` cases — a bare
     * SCREAMING_SNAKE code, never a human sentence, so a report can group on
     * it. Absent on `'queued'` and `'sent'`.
     */
    reason?: string;
    /** Unix MILLISECONDS. */
    createdAt: number;
    updatedAt?: number;
    /**
     * Unix SECONDS — a DynamoDB TTL attribute, not a millisecond timestamp like
     * `createdAt` on the same row. These rows are high-volume and are reaped, so
     * a campaign's durable record is its aggregate counters, not this log.
     */
    ttl?: number;
  }

  interface Template {
    storeId: string;
    templateId: string;
    name: string;
    channel: CampaignChannel;
    /** Email only — absent on any channel that has no subject line. */
    subject?: string;
    body: string;
    status: 'active' | 'archived';
    createdAt: number;
    updatedAt?: number;
  }

  /**
   * `within` / `olderThan` take a POSITIVE INTEGER NUMBER OF DAYS measured from
   * the evaluation instant (`lastBuy within 90` = bought in the last 90 days);
   * a stored `90` has always meant days. `includes` is RESERVED — every
   * `SegmentField` is a number or a boolean today, the handler refuses it on
   * write, and a string/array field lands together with it or not at all.
   * Absent fields: two DEFAULTS, seven NO-MATCH. An absent `marketing.*`
   * channel and an absent `disabled` read as `false` (absence is never consent,
   * and a missing `disabled` is a live customer) — so `eq false` matches them
   * and `eq true` never can. `balance`, `creditLimit` and `lastBuy` absent match
   * NO comparison at all, `ne` included (no `creditLimit` is "no ceiling", not
   * zero).
   */
  type SegmentOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'within' | 'olderThan' | 'includes';

  /**
   * What a segment rule may target. Closed deliberately: an open `string`
   * would be the same unversioned escape hatch as an untyped criteria object,
   * just spread across three fields — a typo'd field name would compile, store,
   * and silently match zero customers forever.
   *
   * ⚠️ Limited to what is queryable on `Customer` TODAY. No product or order
   * predicates ("bought category X"), because no domain logic exists to
   * evaluate them — a v1 boundary, not an oversight.
   *
   * ⚠️ RFM (`recency` / `frequency` / `monetary`) is deliberately ABSENT. It
   * has no evaluator, and reserving a word costs nothing to defer while
   * shipping it costs a stored segment whose meaning is undefined until
   * somebody picks semantics — at which point every stored row silently
   * changes meaning. Adding a member is a patch bump; un-defining one is not.
   */
  type SegmentField =
    | 'balance'
    | 'creditLimit'
    | 'lastBuy'
    | 'disabled'
    | 'marketing.adds'
    | 'marketing.email'
    | 'marketing.phone'
    | 'marketing.sms'
    | 'marketing.whatsapp';

  /**
   * ⚠️ The type cannot express which operators suit which field — `disabled`
   * with `gt` compiles. The handler validates the pairing; the type only bounds
   * the vocabulary.
   */
  interface SegmentRule {
    field: SegmentField;
    operator: SegmentOperator;
    value: string | number | boolean;
  }

  interface SegmentCriteria {
    matchMode: 'all' | 'any';
    rules: SegmentRule[];
  }

  /**
   * A saved, dynamic customer set a campaign targets.
   *
   * ⚠️ **A segment is a TARGETING filter, never a consent decision.** The rule
   * vocabulary can express `marketing.email eq false`, so a segment CAN name
   * customers who have refused a channel. The send pipeline must filter on live
   * consent independently of the segment, and must never treat segment
   * membership as permission to send. A campaign that mails a segment because
   * the segment said so is how a refusal becomes a delivered email.
   */
  interface Segment {
    storeId: string;
    segmentId: string;
    name: string;
    criteria: SegmentCriteria;
    status: 'active' | 'archived';
    createdAt: number;
    updatedAt?: number;
  }

  /**
   * A marketing wrapper around a coupon that already exists.
   *
   * ⚠️ It carries NO discount mechanics of its own. `couponCode` is the only
   * link, and every money field — type, value, minimum subtotal, cap, currency
   * — stays owned by `Coupon`. A second place that can disagree with the
   * coupon on terms is a second answer to "what did the customer actually get".
   */
  interface Promotion {
    storeId: string;
    promotionId: string;
    name: string;
    /** FK into the existing `Coupon` entity. */
    couponCode?: string;
    status: 'draft' | 'active' | 'ended';
    startsAt?: number;
    endsAt?: number;
    createdAt: number;
    updatedAt?: number;
  }
}

export {}; // NOSONAR
