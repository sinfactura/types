export declare enum NotificationTypeEnum {
    ORDER = "ORDER",
    MERCADOPAGO = "MERCADOPAGO",
    STRIPE = "STRIPE",
    DOLAROFICIAL = "DOLAROFICIAL",
    DOLARINFORMAL = "DOLARINFORMAL",
    DOLARBNA = "DOLARBNA",
    ERROR = "ERROR",
    AFIP_CERT_EXPIRY = "AFIP_CERT_EXPIRY",
    MERCADOLIBRE = "MERCADOLIBRE",
    LOW_STOCK = "LOW_STOCK",
    OUT_OF_STOCK = "OUT_OF_STOCK",
    SUPPORT = "SUPPORT",
    /**
     * A cart the abandonment sweep flipped to `abandoned`.
     *
     * ⚠️ Additive: `UserNotifications` is
     * `Partial<Record<NotificationTypeEnum, boolean>>`, so every existing
     * preferences row stays valid and an absent key already reads as
     * "not opted in". No consumer migration is owed.
     *
     * ⚠️ A cart with no `customerId` has nobody to notify — a walk-in POS
     * ticket has no customer attribute at all, and the legacy partition
     * flips wholesale on the sweep's first night. The producer must gate on
     * a customer being present as well as on the cart having lines, or it
     * writes a notification row that validates, broadcasts to nobody, and
     * fails silently.
     */
    ABANDONED_CART = "ABANDONED_CART"
}
declare global {
    interface NotificationInterface {
        storeId: string;
        notificationId: string;
        createdAt: number;
        type: NotificationTypeEnum;
        title: string;
        orderId?: string;
        productId?: string;
        supportId?: string;
        ticketStoreId?: string;
        userId?: string;
        customerId?: string;
        read?: boolean;
        description?: string;
        severity?: 'info' | 'warning' | 'critical';
        details?: string;
        total?: number;
        /** @deprecated SQS routing input, destructured out before persistence — it never exists on stored rows or reads. Belongs on `NotificationQueueInput`. */
        TableName?: string;
    }
    /**
     * What a producer enqueues on the notification SQS queue. The consumer
     * destructures `TableName` for routing (it is never persisted), derives the
     * row key, and stamps `createdAt` plus BE bookkeeping (`dated` YYYYMMDD and
     * a DynamoDB `ttl`); `notificationId` is synthesized from the SK on reads —
     * producers never send either.
     */
    type NotificationQueueInput = Omit<NotificationInterface, 'notificationId' | 'createdAt' | 'TableName'> & {
        TableName: string;
    };
}
export {};
