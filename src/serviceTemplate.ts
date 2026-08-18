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

declare global {
	/** A single QA checklist item on a service template. */
	interface ServiceChecklistItem {
		step: string;
		description?: string;
		required: boolean;
	}

	/**
	 * A part this kind of job commonly consumes.
	 *
	 * Declarative — nothing copies it onto an order. The intake seed is limited
	 * to four scalars (see the file header) and deliberately excludes this one:
	 * `PartUsed` requires `sku`, `unitCost`, `total` and `condition`, none of
	 * which this shape carries, and auto-consuming would move `Product.stock`
	 * before diagnosis, quote or customer approval.
	 */
	interface ServiceCommonPart {
		productId: string;
		name: string;
		quantity: number;
	}

	/**
	 * Pre-defined configuration for a service type. Defines the default workflow,
	 * pricing, checklists, and common parts for orders created from it. One per
	 * (storeId, templateId).
	 */
	interface ServiceTemplate {
		storeId: string;
		templateId: string;
		/** Display name, e.g. "Reparación de motor eléctrico". */
		name: string;
		description: string;
		serviceType: ServiceType;
		categoryId?: string;

		// Workflow configuration
		/**
		 * Which workflow stages are mandatory for orders using this template.
		 *
		 * `ServiceStageStatus`, not `ServiceStatus`: the terminal statuses are
		 * outcomes, not stages, and a template declaring `cancelled` mandatory is
		 * nonsense the old type admitted.
		 */
		requiredStages: ServiceStageStatus[];
		/**
		 * Auto-proceed without quote approval.
		 *
		 * Overlaps `requiredStages` — omitting `'quoted'` there says the same
		 * thing. `skipQuote` wins where they disagree, because it is the explicit
		 * statement of intent; a template that sets `skipQuote` while listing
		 * `'quoted'` in `requiredStages` should be rejected at write time rather
		 * than silently resolved.
		 */
		skipQuote: boolean;
		/** Whether equipment intake is needed. */
		requiresEquipment: boolean;

		// Defaults
		estimatedHours: number;
		basePrice: number;
		pricingModel: PricingModel;
		laborRate?: number;
		warrantyDays?: number;

		// Checklists
		checklist: ServiceChecklistItem[];

		// Common parts
		commonParts: ServiceCommonPart[];

		// Dates (Unix ms)
		/**
		 * Stamped by the api on insert and never rewritten. Declared rather than
		 * left implicit because the list read filters on `createdAt > 0`, so a
		 * row that somehow reached storage without it would be permanently
		 * invisible to search — the field is load-bearing, not bookkeeping.
		 */
		createdAt: number;
		/** Stamped on every write. */
		updatedAt: number;

		disabled: boolean;
	}
}

export {}; // NOSONAR
