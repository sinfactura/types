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
})(NotificationTypeEnum || (NotificationTypeEnum = {}));
