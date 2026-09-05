"use strict";
// Operational record of a document-directed email actually leaving the building,
// written by the send path in `sinfactura/api/stacks/sqs/lambdas/email/*`.
//
// ⚠️ Distinct from the `user-activity` trail (`UserActivityEventBase`), which is
// actor-centric, lives on its own `user-activity-{stage}` table, and carries a
// 90-day TTL. Aging has a 90-plus bucket, so a record that answers "have we
// already chased this" cannot expire at 90 days — that is why this is a durable
// entity on the main table rather than another activity event.
Object.defineProperty(exports, "__esModule", { value: true });
