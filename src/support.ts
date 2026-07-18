
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
		read: boolean;
		createdAt: number;
		updatedAt?: number;
		// First OUT (agent) reply — drives launch SLA metrics later. api#1817.
		firstResponseAt?: number;
		closedAt?: number;
		disabled?: boolean;
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
}

export {}; // NOSONAR
