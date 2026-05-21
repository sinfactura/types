
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

}

export {}; // NOSONAR