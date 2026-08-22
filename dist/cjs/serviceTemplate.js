"use strict";
/**
 * Service template types — pre-defined per-service-type configuration for the
 * Services Feature.
 *
 * A ServiceTemplate describes the intended defaults for a service type: which
 * workflow stages are mandatory, the default pricing model / rates, QA
 * checklists, and the parts such a job commonly consumes. Shares the
 * ServiceType / ServiceStageStatus / PricingModel unions defined in
 * serviceOrder.ts.
 *
 * ⚠️ Only FOUR fields are applied, and only at intake. `POST /services
 * {mode:"create"}` proves `ServiceOrder.templateId` against a real, non-disabled
 * template and then SNAPSHOTS `serviceType`, `pricingModel`, `laborRate?` and
 * `warrantyDays?` onto the order — the only four with a same-shaped landing
 * field on `ServiceOrder`. An explicit request value always wins.
 *
 * Everything else on this interface is declarative and copied by nothing:
 * `requiredStages` and `skipQuote` would seed into a vacuum (the transition
 * table is a single global adjacency map that reads neither), and
 * `requiresEquipment` / `estimatedHours` / `basePrice` / `checklist` have no
 * field on `ServiceOrder` to land in. `commonParts` in particular is NOT
 * auto-populated on intake: it is a shape mismatch against `PartUsed`, and
 * auto-consuming it reaches the stock-deducting parts path, which would move
 * `Product.stock` before diagnosis, quote or customer approval. Deliberately its
 * own change.
 *
 * The seeded values are a SNAPSHOT — editing a template moves NEW orders only.
 * This interface carries no version field, no history and no audit surface, so
 * its prior values are unrecoverable once edited; that is precisely why the api
 * copies rather than dereferencing.
 *
 * Consumed by the api's `/service-templates` endpoints, and read by
 * `/services` when it validates a service order's `templateId`. The previous
 * FORWARD-ONLY marker is gone deliberately: these declarations are no longer
 * free to reshape.
 */
Object.defineProperty(exports, "__esModule", { value: true });
