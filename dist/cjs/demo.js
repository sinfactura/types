"use strict";
/**
 * Demo environment types.
 *
 * Custom JWT claims minted for anonymous public demo sessions
 * (test.sinfactura.com) and in-app demo tenants. The `readOnly` flag is
 * enforced server-side via the `requireWritable` gate (ADR-0010);
 * see also `Store.type === 'demo'` in store.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
