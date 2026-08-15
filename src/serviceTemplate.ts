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
 * ⚠️ Nothing is applied automatically today. `ServiceOrder.templateId` is
 * PROVEN against a real, non-disabled template at write time and then stored —
 * no field on this interface is copied onto the order, and `commonParts` in
 * particular is not auto-populated on intake. An earlier version of this
 * comment promised that seeding; it described intent, never behaviour, and a
 * consumer building a pre-filled intake UI on it would have been wrong.
 * Auto-population reaches the stock-deducting parts path, so it is deliberately
 * its own change.
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

	/** A commonly-used part auto-populated onto orders created from the template. */
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
