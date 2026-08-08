// Canonical notification taxonomy (#78). These are the exact attribute
// names the BE filter-reads on User rows (`notifications.<KEY> = true`
// DynamoDB FilterExpressions — new-order fanout, MP hook/poller/recover,
// Stripe hook, propagate-fx). Exported as a real enum so `api`
// (stacks/helpers/notificationType.ts) and `app`
// (src/domain/notificationType.ts) can drop their hand-mirrored copies
// in follow-ups. DOLARBNA / ERROR / AFIP_CERT_EXPIRY have no User-row
// read path — enum members only (AFIP_CERT_EXPIRY = the cert-expiry
// alert type, api#1382).
export var NotificationTypeEnum;
(function (NotificationTypeEnum) {
    NotificationTypeEnum["ORDER"] = "ORDER";
    NotificationTypeEnum["MERCADOPAGO"] = "MERCADOPAGO";
    NotificationTypeEnum["STRIPE"] = "STRIPE";
    NotificationTypeEnum["DOLAROFICIAL"] = "DOLAROFICIAL";
    NotificationTypeEnum["DOLARINFORMAL"] = "DOLARINFORMAL";
    NotificationTypeEnum["DOLARBNA"] = "DOLARBNA";
    NotificationTypeEnum["ERROR"] = "ERROR";
    NotificationTypeEnum["AFIP_CERT_EXPIRY"] = "AFIP_CERT_EXPIRY";
    // ML order-ingestion fanout (app#797 / api#1574) — User-row read path
    // added by the orders_v2 worker.
    NotificationTypeEnum["MERCADOLIBRE"] = "MERCADOLIBRE";
    // Stock alerts (api#1806) — fired when a sale crosses a product's stock
    // threshold. LOW_STOCK at stock <= `Product.minStock`; OUT_OF_STOCK at
    // stock <= 0. Both have User-row opt-in read paths.
    NotificationTypeEnum["LOW_STOCK"] = "LOW_STOCK";
    NotificationTypeEnum["OUT_OF_STOCK"] = "OUT_OF_STOCK";
    // Support ticket bell (api#1806) — fired on ticket create / status change.
    // User-row opt-in read path.
    NotificationTypeEnum["SUPPORT"] = "SUPPORT";
})(NotificationTypeEnum || (NotificationTypeEnum = {}));
