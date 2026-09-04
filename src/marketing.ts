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
    createdAt: number;
    updatedAt?: number;
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
