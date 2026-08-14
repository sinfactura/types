/**
 * Service template types — pre-defined per-service-type configuration for the
 * Services Feature.
 *
 * A ServiceTemplate seeds defaults onto a new ServiceOrder: which workflow
 * stages are mandatory, default pricing model / rates, QA checklists, and
 * common parts auto-populated on intake. Shares the ServiceType /
 * ServiceStageStatus / PricingModel unions defined in serviceOrder.ts.
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
		 * left implicit because it is the field an existence probe reads: a
		 * point-read of a template that was never written returns an empty object,
		 * so `createdAt` is what separates "no such template" from "a template with
		 * every field defaulted".
		 */
		createdAt: number;
		/** Stamped on every write. */
		updatedAt: number;

		disabled: boolean;
	}
}

export {}; // NOSONAR
