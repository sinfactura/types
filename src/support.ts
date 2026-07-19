
// Support helpdesk (platform→tenant) — ADR-0019 / app docs/SUPPORT.md (app#2150).
// api-owned entity. Grows the flat ticket row into a THREAD: a ticket header
// (this `Support` interface) plus ordered `SupportMessage` messages stored in a
// child partition. api#1816 (thread model + GET /support/:id) and api#1817
// (cross-tenant agent console) share this one shape — released together.

declare global {
	// Lifecycle status. Legacy flat rows already used these three strings.
	type SupportTicketStatus = 'pending' | 'resolved' | 'rejected';

	// Agent-set triage priority (api#1817). Absent on legacy rows.
	type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

	// IN = tenant → platform; OUT = platform agent → tenant.
	type SupportMessageDirection = 'IN' | 'OUT';

	// Ticket header — PK: SUPPORT#{storeId}, SK: SUPPORTxxxx (atomic counter).
	interface Support {
		storeId: string;
		supportId: string;
		subject: string;
		category?: string;
		priority: SupportTicketPriority;
		status: SupportTicketStatus;
		// Platform agent handling the case (userId / display name). api#1817.
		assignee?: string;
		// Tenant-side read state: `false` when the tenant has an unread agent (OUT)
		// reply, `true` once the tenant opens the thread or posts. The agent
		// "needs attention" signal is `status === 'pending'`, not this flag. api#1829.
		read: boolean;
		createdAt: number;
		// Always set (== createdAt on create, bumped on every message/patch) — the
		// last-activity key the inbox + "recent tickets" lists sort by. api#1829.
		updatedAt: number;
		// First OUT (agent) reply — drives launch SLA metrics later. api#1817.
		firstResponseAt?: number;
		closedAt?: number;
		disabled?: boolean;
		// Denormalized thread summary (api#1829) — maintained on every append so a
		// list/inbox row renders without an N+1 fetch of the message partition.
		lastMessageAt?: number;
		lastMessagePreview?: string;
		messageCount?: number;
		// Populated only on single-case reads (GET /support/:id and the platform
		// thread detail); omitted on list responses. Stored in a child partition,
		// never on the header row.
		messages?: SupportMessage[];
	}

	// One thread message — child partition PK: SUPPORT#{storeId}#{supportId},
	// SK: MSG#{createdAt}#{messageId} (api#1816).
	interface SupportMessage {
		messageId: string;
		direction: SupportMessageDirection;
		// Sender display name / userId (tenant user or platform agent).
		author: string;
		body: string;
		createdAt: number;
		// api#1806/ADR-0019 — links a "Reportar un problema" case to its Sentry event.
		sentryEventId?: string;
	}

	// Real-time thread broadcast (api#1832). Emitted over WSS when a message is
	// appended in EITHER direction, so an open thread/inbox updates without a
	// refetch. Distinct from the header-row broadcast `dynamoUpdate` already
	// emits (`action: 'support'`, the full header): this carries the NEW message
	// plus the refreshed header. Delivered via the existing `wsPost*` fanout —
	// tenant IN → platform agents; agent OUT → the tenant store.
	interface SupportMessageWsEvent {
		action: 'support-message';
		data: {
			// The tenant store the ticket belongs to (NOT the platform store), so an
			// agent viewing the cross-tenant console routes the update correctly.
			storeId: string;
			supportId: string;
			// The newly-appended thread message.
			message: SupportMessage;
			// The refreshed ticket header (denormalized summary — `messages` omitted),
			// so the inbox row re-sorts/updates on the same event.
			header: Support;
		};
	}
}

export {}; // NOSONAR
