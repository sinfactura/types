"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationTypeEnum = void 0;
// Canonical notification taxonomy. These are the exact attribute
// names the BE filter-reads on User rows (`notifications.<KEY> = true`
// DynamoDB FilterExpressions — new-order fanout, MP hook/poller/recover,
// Stripe hook, propagate-fx). Exported as a real enum so `api`
// (stacks/helpers/notificationType.ts) and `app`
// (src/domain/notificationType.ts) can drop their hand-mirrored copies
// in follow-ups. DOLARBNA / ERROR / AFIP_CERT_EXPIRY have no User-row
// read path — enum members only (AFIP_CERT_EXPIRY = the cert-expiry
// alert type).
var NotificationTypeEnum;
(function (NotificationTypeEnum) {
    NotificationTypeEnum["ORDER"] = "ORDER";
    NotificationTypeEnum["MERCADOPAGO"] = "MERCADOPAGO";
    NotificationTypeEnum["STRIPE"] = "STRIPE";
    NotificationTypeEnum["DOLAROFICIAL"] = "DOLAROFICIAL";
    NotificationTypeEnum["DOLARINFORMAL"] = "DOLARINFORMAL";
    NotificationTypeEnum["DOLARBNA"] = "DOLARBNA";
    NotificationTypeEnum["ERROR"] = "ERROR";
    NotificationTypeEnum["AFIP_CERT_EXPIRY"] = "AFIP_CERT_EXPIRY";
    // ML order-ingestion fanout — User-row read path
    // added by the orders_v2 worker.
    NotificationTypeEnum["MERCADOLIBRE"] = "MERCADOLIBRE";
    // Stock alerts — fired when a sale crosses a product's stock
    // threshold. LOW_STOCK at stock <= `Product.minStock`; OUT_OF_STOCK at
    // stock <= 0. Both have User-row opt-in read paths.
    NotificationTypeEnum["LOW_STOCK"] = "LOW_STOCK";
    NotificationTypeEnum["OUT_OF_STOCK"] = "OUT_OF_STOCK";
    // Support ticket bell — fired on ticket create / status change.
    // User-row opt-in read path.
    NotificationTypeEnum["SUPPORT"] = "SUPPORT";
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
    NotificationTypeEnum["ABANDONED_CART"] = "ABANDONED_CART";
})(NotificationTypeEnum || (exports.NotificationTypeEnum = NotificationTypeEnum = {}));
