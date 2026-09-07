"use strict";
// Support helpdesk (platform→tenant) — ADR-0019 / app docs/SUPPORT.md.
// api-owned entity. Grows the flat ticket row into a THREAD: a ticket header
// (this `Support` interface) plus ordered `SupportMessage` messages stored in a
// child partition. The thread model (GET /support/:id) and the cross-tenant
// agent console share this one shape — released together.
Object.defineProperty(exports, "__esModule", { value: true });
