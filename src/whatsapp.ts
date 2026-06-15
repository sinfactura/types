
declare global {

	interface WhatsAppMessage {
		object: 'whatsapp_business_account' | string;
		entry: Entry[];
	}

	interface Entry {
		id: string;
		changes: Change[];
	}

	interface Change {
		value: Value;
		field: 'messages' | string;
	}

	interface Value {
		messaging_product: 'whatsapp' | string;
		metadata: {
			display_phone_number: string;
			phone_number_id: string;
		};
		contacts?: Contact[];
		messages?: Message[];
		statuses?: Status[];
	}

	interface Contact {
		profile?: {
			name: string;
		};
		input?: string;
		wa_id: string;
	}

	interface Message {
		from?: string;
		id: string;
		timestamp?: string;
		text?: {
			body: string;
		};
		type?: string;
		document?: Document;
		context?: {
			from: string,
			id: string
		}
		audio?: Audio,
		image?: Image
	}

	interface Document {
		caption: string;
		filename: string;
		mime_type: string;
		sha256: string;
		id: string;
	}
	interface Audio {
		mime_type: string;
		sha256: string;
		id: string;
		voice: boolean;
	}
	interface Image {
		mime_type: string;
		sha256: string;
		id: string;
	}


	interface Status {
		id: string;
		status: 'sent' | 'delivered' | 'read' | 'failed' | string;
		timestamp: string;
		recipient_id: string;
		conversation?: Conversation;
		pricing?: Pricing;
		errors?: Error[]
	}

	interface Error {
		code: 131047 | number;
		title: string;
		href: string;
	}
	// 131047 Message failed to send because more than 24 hours have passed since
	// the customer last replied to this number, sent a message using template.

	interface Conversation {
		id: string;
		expiration_timestamp?: string;
		origin: {
			type: 'user_initiated' | string;
		};
	}

	interface Pricing {
		billable: boolean;
		pricing_model: 'CBP' | string;
		category: 'user_initiated' | string;
	}

	// ─────────────────────────────────────────────────────────────────
	// WhatsApp Commerce (sinfactura/types#34, sinfactura/app#1072)
	// Tenant-facing config, conversations, messaging, usage metering, and
	// message templates. Distinct from the Meta webhook payload shapes
	// above (Message / Status / etc.) — these are SINFACTURA-side entities.
	// ─────────────────────────────────────────────────────────────────

	/** Per-tenant WhatsApp Business connection + plan tier. */
	interface WhatsAppConfig {
		wabaId: string;
		phoneNumberId: string;
		/** Meta access token — encrypted at rest. */
		accessToken: string;
		verifiedName: string;
		qualityRating: 'GREEN' | 'YELLOW' | 'RED';
		status: 'connected' | 'disconnected' | 'suspended';
		tier: 'free' | 'pro' | 'enterprise';
		/** ISO timestamp. */
		connectedAt: string;
		/** ISO timestamp. */
		disconnectedAt?: string;
	}

	/** A customer conversation thread. */
	interface WhatsAppConversation {
		conversationId: string;
		storeId: string;
		customerId: string;
		customerPhone: string;
		customerName: string;
		lastMessage: WhatsAppChatMessage;
		unreadCount: number;
		status: 'active' | 'resolved';
		/** userId of the assigned agent (Enterprise tier). */
		assignedTo?: string;
		/** ISO timestamp. */
		createdAt: string;
		/** ISO timestamp. */
		updatedAt: string;
	}

	/** A single message within a conversation. */
	interface WhatsAppChatMessage {
		messageId: string;
		conversationId: string;
		direction: 'inbound' | 'outbound';
		type: 'text' | 'template' | 'image' | 'document' | 'interactive';
		content: string;
		templateName?: string;
		mediaUrl?: string;
		status: 'sent' | 'delivered' | 'read' | 'failed';
		/** ISO timestamp. */
		timestamp: string;
		/** userId for outbound messages. */
		sentBy?: string;
	}

	/** Per-tenant, per-period message usage for metered billing (Model C). */
	interface WhatsAppUsage {
		storeId: string;
		/** Billing period, YYYY-MM. */
		billingPeriod: string;
		messageCount: number;
		allowance: number;
		overage: number;
		tier: 'free' | 'pro' | 'enterprise';
	}

	/** A reusable message template registered with Meta. */
	interface WhatsAppTemplate {
		templateId: string;
		name: string;
		category: 'marketing' | 'utility' | 'authentication';
		language: string;
		status: 'APPROVED' | 'PENDING' | 'REJECTED';
		components: WhatsAppTemplateComponent[];
		/** ISO timestamp. */
		createdAt: string;
		/** ISO timestamp. */
		updatedAt: string;
	}

	interface WhatsAppTemplateComponent {
		type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
		format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
		text?: string;
		buttons?: WhatsAppTemplateButton[];
	}

	interface WhatsAppTemplateButton {
		type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
		text: string;
		url?: string;
		phoneNumber?: string;
	}

}

export {}; // NOSONAR