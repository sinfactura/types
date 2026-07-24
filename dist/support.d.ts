declare global {
    type SupportTicketStatus = 'pending' | 'waiting_on_customer' | 'resolved' | 'rejected';
    type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
    type SupportMessageDirection = 'IN' | 'OUT';
    type SupportAttachmentKind = 'image' | 'document' | 'link' | 'entity_ref';
    type SupportAttachmentEntityType = 'invoice' | 'order' | 'creditNote' | 'supportTicket';
    interface SupportAttachmentBase {
        attachmentId: string;
        kind: SupportAttachmentKind;
    }
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
    interface SupportLinkAttachment extends SupportAttachmentBase {
        kind: 'link';
        url: string;
        label?: string;
    }
    interface SupportEntityRefAttachment extends SupportAttachmentBase {
        kind: 'entity_ref';
        entityType: SupportAttachmentEntityType;
        entityId: string;
        entityStoreId: string;
        label?: string;
    }
    type SupportAttachment = SupportFileAttachment | SupportLinkAttachment | SupportEntityRefAttachment;
    type SupportSlaStatus = 'ok' | 'at_risk' | 'breached';
    interface SupportSlaTargets {
        firstResponseHours: number;
        resolutionHours: number;
    }
    interface SupportSlaConfig {
        targets: Record<SupportTicketPriority, SupportSlaTargets>;
        updatedAt?: number;
    }
    interface SupportClientContext {
        appVersion?: string;
        route?: string;
    }
    interface Support {
        storeId: string;
        supportId: string;
        subject: string;
        category?: string;
        priority: SupportTicketPriority;
        status: SupportTicketStatus;
        assignee?: string;
        read: boolean;
        createdAt: number;
        updatedAt: number;
        firstResponseAt?: number;
        closedAt?: number;
        firstResponseDueAt?: number;
        resolutionDueAt?: number;
        slaStatus?: SupportSlaStatus;
        slaPausedAt?: number;
        slaPausedMs?: number;
        context?: SupportClientContext;
        disabled?: boolean;
        githubIssueUrl?: string;
        githubIssueNumber?: number;
        lastMessageAt?: number;
        lastMessagePreview?: string;
        messageCount?: number;
        messages?: SupportMessage[];
    }
    interface SupportMessage {
        messageId: string;
        direction: SupportMessageDirection;
        author: string;
        body: string;
        createdAt: number;
        sentryEventId?: string;
        attachments?: SupportAttachment[];
    }
    interface SupportMessageWsEvent {
        action: 'support-message';
        data: {
            storeId: string;
            supportId: string;
            message: SupportMessage;
            header: Support;
        };
    }
}
export {};
