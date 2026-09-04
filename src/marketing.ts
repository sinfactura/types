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
