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
    SUPPORT = "SUPPORT"
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
