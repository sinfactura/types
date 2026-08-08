/**
 * Service order types — repair / installation / maintenance / diagnosis
 * workflows ("Órdenes de Servicio").
 *
 * Phase 1 Foundation for the Services Feature (sinfactura/app#758,
 * sinfactura/types#30). A ServiceOrder is a parallel entity to the
 * product-sales Order pipeline: multi-stage workflow, technician assignment,
 * equipment intake, parts consumption, and AFIP concept=2 service invoicing.
 *
 * Companion: ServiceTemplate (serviceTemplate.ts, sinfactura/types#31) defines
 * per-type default configuration that seeds new orders.
 */
export {};
