"use strict";
// Outbound integrator webhooks for print-state changes: the `WEBHOOK#${storeId}`
// subscription row plus the event-type vocabulary a store can subscribe to.
//
// Deliberately NOT `declare global`, for the same reason as `socket.ts`:
// consumers need the event names as VALUES, not just as a type. The api's CRUD
// handler builds its Zod enum from `WEBHOOK_EVENT_TYPES` rather than restating
// the strings, so there is exactly one source of truth — a hand-restated enum
// is how a newly added event silently becomes unsubscribable.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINT_JOB_SETTLED_OUTCOMES = exports.WEBHOOK_EVENT_TYPES = void 0;
/**
 * Every print-state transition an integrator can subscribe to.
 *
 * `readonly` tuple, so no consumer-side `declare module` can extend it: a new
 * event must be published here before any repo can emit or accept it.
 */
exports.WEBHOOK_EVENT_TYPES = [
    'print.queued',
    'print.received',
    'print.printed',
    'print.failed',
    'print.agent.connected',
    'print.agent.disconnected',
    'print.printer.online',
    'print.printer.offline',
    'print.job.settled',
];
/** Terminal outcomes for a print job. Closed union — a job printed, or it failed. */
exports.PRINT_JOB_SETTLED_OUTCOMES = ['printed', 'failed'];
