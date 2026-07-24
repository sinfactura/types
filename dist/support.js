// Support helpdesk (platform→tenant) — ADR-0019 / app docs/SUPPORT.md (app#2150).
// api-owned entity. Grows the flat ticket row into a THREAD: a ticket header
// (this `Support` interface) plus ordered `SupportMessage` messages stored in a
// child partition. api#1816 (thread model + GET /support/:id) and api#1817
// (cross-tenant agent console) share this one shape — released together.
export {};
