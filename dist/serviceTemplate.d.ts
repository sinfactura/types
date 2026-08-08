/**
 * Service template types — pre-defined per-service-type configuration for the
 * Services Feature (sinfactura/app#758, sinfactura/types#31).
 *
 * A ServiceTemplate seeds defaults onto a new ServiceOrder: which workflow
 * stages are mandatory, default pricing model / rates, QA checklists, and
 * common parts auto-populated on intake. Shares the ServiceType / ServiceStatus
 * / PricingModel unions defined in serviceOrder.ts.
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
        /** Which workflow stages are mandatory for orders using this template. */
        requiredStages: ServiceStatus[];
        /** Auto-proceed without quote approval. */
        skipQuote: boolean;
        /** Whether equipment intake is needed. */
        requiresEquipment: boolean;
        estimatedHours: number;
        basePrice: number;
        pricingModel: PricingModel;
        laborRate?: number;
        warrantyDays?: number;
        checklist: ServiceChecklistItem[];
        commonParts: ServiceCommonPart[];
        disabled: boolean;
    }
}
export {};
