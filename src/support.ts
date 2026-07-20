
// Support helpdesk (platform→tenant) — ADR-0019 / app docs/SUPPORT.md (app#2150).
// api-owned entity. Grows the flat ticket row into a THREAD: a ticket header
// (this `Support` interface) plus ordered `SupportMessage` messages stored in a
// child partition. api#1816 (thread model + GET /support/:id) and api#1817
// (cross-tenant agent console) share this one shape — released together.

declare global {
	// Lifecycle status. Legacy flat rows already used the first three strings.
	// `waiting_on_customer` (api#1833): agent-set — the ball is in the tenant's
	// court; the resolution SLA clock pauses while set, and a tenant reply
	// auto-flips the ticket back to `pending`.
	type SupportTicketStatus = 'pending' | 'waiting_on_customer' | 'resolved' | 'rejected';

	// Agent-set triage priority (api#1817). Absent on legacy rows.
	type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

	// IN = tenant → platform; OUT = platform agent → tenant.
	type SupportMessageDirection = 'IN' | 'OUT';

	// api#1834 — an attachment on a thread message. Discriminated on `kind`:
	//  • image / document — a file in the private support-attachments S3 area. The
	//    persisted ref carries the bare object `key` (NEVER a public URL); read
	//    paths mint a short-lived presigned GET into `downloadUrl` (ephemeral —
	//    never written to DynamoDB).
	//  • link — an external URL the sender pasted (stored verbatim, no S3/fetch).
	//  • entity_ref — a pointer to an in-app record ("this is about order #123"),
	//    which the FE deep-links. No S3.
	type SupportAttachmentKind = 'image' | 'document' | 'link' | 'entity_ref';

	// In-app records a support attachment can point at (entity_ref). Closed union
	// so the FE maps each to a deep-link route; extend as new targets are added.
	// (api#1834 scope amendment.)
	type SupportAttachmentEntityType = 'invoice' | 'order' | 'creditNote' | 'supportTicket';

	interface SupportAttachmentBase {
		// Server-minted UUID; for file kinds it's also the last S3 key segment.
		attachmentId: string;
		kind: SupportAttachmentKind;
	}

	// A file (image or document) stored in S3 under the support prefix. `key` is
	// the bare object key; `downloadUrl` is present ONLY on read responses (a
	// short-lived presigned GET) and is never persisted.
	interface SupportFileAttachment extends SupportAttachmentBase {
		kind: 'image' | 'document';
		key: string;
		filename: string;
		contentType: string;
		size: number;
		downloadUrl?: string;
	}

	/**
	 * Inbound file attachment on support create/reply bodies — tenant
	 * `POST /support` and agent `PATCH /platform/support/{storeId}/{supportId}`.
	 * The file travels as base64 in the request body; the server uploads it to
	 * storage and persists the resolved `SupportFileAttachment` (api#1853).
	 */
	interface SupportFileAttachmentUpload {
		kind: Extract<SupportAttachmentKind, 'image' | 'document'>;
		/** Display name only — never part of the storage key. */
		filename: string;
		/** Declared MIME type; must match the server allowlist AND the actual bytes. */
		contentType: string;
		/** Bare base64 (no `data:` URI prefix). Decoded max 4 MiB per file and 4 MiB aggregate per request. */
		data: string;
	}

	// An external URL the sender pasted. Unlike a file's ephemeral `downloadUrl`,
	// this `url` IS persisted verbatim.
	interface SupportLinkAttachment extends SupportAttachmentBase {
		kind: 'link';
		url: string;
		label?: string;
	}

	// A deep-link to an in-app record (api#1834 scope amendment). `entityStoreId`
	// is the owning store — the cross-tenant guard rejects an attachment whose
	// `entityStoreId` differs from the ticket's store (tenant: own storeId; agent:
	// the ticket's target storeId), so an agent can't leak a cross-store reference
	// into a tenant's thread. Not existence-validated at write time (sentryEventId
	// trust level) — a stale reference surfaces at render, not on write.
	interface SupportEntityRefAttachment extends SupportAttachmentBase {
		kind: 'entity_ref';
		entityType: SupportAttachmentEntityType;
		entityId: string;
		entityStoreId: string;
		label?: string;
	}

	type SupportAttachment = SupportFileAttachment | SupportLinkAttachment | SupportEntityRefAttachment;

	// SLA health of an open ticket (api#1833). Recomputed by a scheduled sweep:
	// `at_risk` once ≥80% of a timer's window has elapsed unmet, `breached` once
	// a due time passes unmet. Live (can return to `ok` after a late first
	// response); frozen at whatever it was when the ticket closes.
	type SupportSlaStatus = 'ok' | 'at_risk' | 'breached';

	// Per-priority SLA windows, in hours (api#1833).
	interface SupportSlaTargets {
		firstResponseHours: number;
		resolutionHours: number;
	}

	// Operator-tunable SLA configuration (api#1833) — one target pair per
	// priority. Read/written via GET/PUT /platform/support/config.
	interface SupportSlaConfig {
		targets: Record<SupportTicketPriority, SupportSlaTargets>;
		updatedAt?: number;
	}

	// Point-in-time client context captured when the tenant opened the case
	// (api#1840) — the app version / route the tenant was on, for the agent
	// console's context panel. Store-derived context is read live instead.
	interface SupportClientContext {
		appVersion?: string;
		route?: string;
	}

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
		// SLA deadlines (api#1833) — epoch ms, stamped at create from the
		// priority's configured window, recomputed on priority change. Both are
		// the CURRENT effective deadline: `resolutionDueAt` is extended by the
		// accumulated pause time whenever a `waiting_on_customer` pause ends.
		// `firstResponseDueAt` stays for audit after `firstResponseAt` is set.
		firstResponseDueAt?: number;
		resolutionDueAt?: number;
		// SLA health — see SupportSlaStatus. Absent on pre-SLA rows until the
		// sweep lazily stamps them.
		slaStatus?: SupportSlaStatus;
		// Pause bookkeeping (api#1833). `slaPausedAt` is present only while the
		// ticket is `waiting_on_customer` (the open pause's start); `slaPausedMs`
		// accumulates the total of all CLOSED pauses.
		slaPausedAt?: number;
		slaPausedMs?: number;
		// Client context captured at create (api#1840); absent on older rows.
		context?: SupportClientContext;
		disabled?: boolean;
		// api#1835 — GitHub issue back-link. Set once the ticket is filed as a GitHub
		// issue from the agent console (POST /platform/support/{storeId}/{supportId}/convert);
		// also the idempotency key for the convert action (a re-convert returns the existing issue).
		githubIssueUrl?: string;
		githubIssueNumber?: number;
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
		// api#1834 — files (image/document in S3), pasted links, and in-app entity
		// refs attached to this message. Absent when the message carries none.
		attachments?: SupportAttachment[];
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
