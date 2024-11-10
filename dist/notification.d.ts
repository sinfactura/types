declare global {
    enum NotificationTypeEnum {
        ORDER = "ORDER",
        MERCADOPAGO = "MERCADOPAGO",
        DOLAROFICIAL = "DOLAROFICIAL",
        DOLARINFORMAL = "DOLARINFORMAL",
        DOLARBNA = "DOLARBNA",
        ERROR = "ERROR"
    }
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
        details?: string;
        total?: number;
        TableName?: string;
    }
    interface Currency {
        currencyId: string;
        dated: string;
        value: number;
        name?: string;
    }
}
export {};
