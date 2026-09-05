"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Explicit `.js` specifiers are REQUIRED, not stylistic: this package is
// `"type": "module"`, so Node's ESM resolver does NOT do extensionless
// resolution — a bare `export * from "./account"` throws ERR_MODULE_NOT_FOUND
// at import time. TypeScript maps `./x.js` back to `./x.ts` at compile time,
// and the CJS build resolves it fine too, so one spelling works for both.
__exportStar(require("./account.js"), exports);
__exportStar(require("./afip.js"), exports);
__exportStar(require("./ai.js"), exports);
__exportStar(require("./api.js"), exports);
__exportStar(require("./appointment.js"), exports);
__exportStar(require("./audit.js"), exports);
__exportStar(require("./attendance.js"), exports);
__exportStar(require("./auth.js"), exports);
__exportStar(require("./basket.js"), exports);
__exportStar(require("./brands.js"), exports);
__exportStar(require("./caea.js"), exports);
__exportStar(require("./capacity.js"), exports);
__exportStar(require("./cart.js"), exports);
__exportStar(require("./cash.js"), exports);
__exportStar(require("./categories.js"), exports);
__exportStar(require("./currency.js"), exports);
__exportStar(require("./customer.js"), exports);
__exportStar(require("./cycleCount.js"), exports);
__exportStar(require("./delivery.js"), exports);
__exportStar(require("./demo.js"), exports);
__exportStar(require("./impersonation.js"), exports);
__exportStar(require("./imports.js"), exports);
__exportStar(require("./inventory.js"), exports);
__exportStar(require("./invitation.js"), exports);
__exportStar(require("./invoice.js"), exports);
__exportStar(require("./log.js"), exports);
__exportStar(require("./lot.js"), exports);
__exportStar(require("./literals.js"), exports);
__exportStar(require("./loyalty.js"), exports);
__exportStar(require("./maintenance.js"), exports);
__exportStar(require("./marketing.js"), exports);
__exportStar(require("./mercadolibre.js"), exports);
__exportStar(require("./mercadopago.js"), exports);
__exportStar(require("./notification.js"), exports);
__exportStar(require("./order.js"), exports);
__exportStar(require("./payment.js"), exports);
__exportStar(require("./platform.js"), exports);
__exportStar(require("./pricing.js"), exports);
__exportStar(require("./print.js"), exports);
__exportStar(require("./product.js"), exports);
__exportStar(require("./purchaseOrder.js"), exports);
__exportStar(require("./pushDevice.js"), exports);
__exportStar(require("./reminder.js"), exports);
__exportStar(require("./report.js"), exports);
__exportStar(require("./return.js"), exports);
__exportStar(require("./roles.js"), exports);
__exportStar(require("./sentry.js"), exports);
__exportStar(require("./serviceOrder.js"), exports);
__exportStar(require("./serviceTemplate.js"), exports);
__exportStar(require("./socket.js"), exports);
__exportStar(require("./stock.js"), exports);
__exportStar(require("./store.js"), exports);
__exportStar(require("./storefrontEvent.js"), exports);
__exportStar(require("./subscription.js"), exports);
__exportStar(require("./support.js"), exports);
__exportStar(require("./supplier.js"), exports);
__exportStar(require("./user.js"), exports);
__exportStar(require("./userActivity.js"), exports);
__exportStar(require("./valuation.js"), exports);
__exportStar(require("./webhook.js"), exports);
__exportStar(require("./whatsapp.js"), exports);
__exportStar(require("./provinces.js"), exports);
