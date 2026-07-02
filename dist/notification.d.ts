export declare enum NotificationTypeEnum {
    ORDER = "ORDER",
    MERCADOPAGO = "MERCADOPAGO",
    STRIPE = "STRIPE",
    DOLAROFICIAL = "DOLAROFICIAL",
    DOLARINFORMAL = "DOLARINFORMAL",
    DOLARBNA = "DOLARBNA",
    ERROR = "ERROR",
    AFIP_CERT_EXPIRY = "AFIP_CERT_EXPIRY"
}
declare global {
    interface NotificationInterface {
        storeId: string;
        notificationId: string;
        createdAt: number;
        type: NotificationTypeEnum;
        title: string;
        orderId?: string;
        userId?: string;
        customerId?: string;
        read?: boolean;
        description?: string;
        severity?: 'info' | 'warning' | 'critical';
        details?: string;
        total?: number;
        TableName?: string;
    }
}
export {};
