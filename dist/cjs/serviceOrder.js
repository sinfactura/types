"use strict";
/**
 * Service order types — repair / installation / maintenance / diagnosis
 * workflows ("Órdenes de Servicio").
 *
 * A ServiceOrder is a parallel entity to the product-sales Order pipeline:
 * multi-stage workflow, technician assignment, equipment intake, parts
 * consumption, and AFIP concept=2 service invoicing.
 *
 * Companion: ServiceTemplate (serviceTemplate.ts) declares per-type default
 * configuration. At INTAKE (`mode: "create"`) exactly four of its scalars are
 * SNAPSHOTTED onto the order — `serviceType`, `pricingModel`, `laborRate?`,
 * `warrantyDays?` — with `templateId` kept alongside as provenance. An explicit
 * request value always wins over the template's. Nothing else is copied, and
 * `mode: "edit"` still seeds nothing: it can attach or change `templateId` on an
 * order that already carries a quote, parts and work logs.
 *
 * The copy never moves. Editing a template afterwards changes NEW orders only —
 * a template is fully mutable, can be disabled, and has no version field, no
 * history and no audit surface, so a reference would let a ticket taken in March
 * silently re-describe itself.
 *
 * Consumed by the api's `/services` endpoints (Services feature, Wave 1),
 * stored at `PK: SERVICE#{storeId}` / `SK: {serviceOrderId}`. The previous
 * FORWARD-ONLY marker is gone deliberately: these declarations are no longer
 * free to reshape, because handlers and stored rows now depend on them.
 *
 * A service order tracks THREE lifecycles that do not end together, and each
 * has its own field — conflating them is the modelling mistake this shape
 * exists to prevent:
 *   - the work           → `status`
 *   - custody of the customer's property → `custody`
 *   - the commercial agreement            → `quote[]`
 * A cancelled order can still have the device on the shelf.
 */
Object.defineProperty(exports, "__esModule", { value: true });
