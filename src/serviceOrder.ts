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

declare global {
	// ───────────────────────────── Classification ─────────────────────────────

	/** Kind of service. Drives which workflow stages apply (see ServiceTemplate). */
	type ServiceType = 'repair' | 'installation' | 'maintenance' | 'diagnosis';

	/**
	 * Workflow stage of a service order. The canonical full repair pipeline is
	 * received → diagnosing → quoted → approved → in_progress → testing → ready →
	 * delivered, plus the terminal `cancelled`. Simpler service types skip stages
	 * (configured per `ServiceTemplate.requiredStages`).
	 */
	type ServiceStatus =
		| 'received'
		| 'diagnosing'
		| 'quoted'
		| 'approved'
		| 'in_progress'
		| 'testing'
		| 'ready'
		| 'delivered'
		| 'cancelled';

	/** Operator-set urgency, used for Kanban ordering and SLA hints. */
	type ServicePriority = 'low' | 'normal' | 'high' | 'urgent';

	/**
	 * How the service is priced.
	 * - `flat`        — single fixed price.
	 * - `hourly`      — labor billed by the hour (`laborRate` × hours).
	 * - `parts_labor` — parts at cost/markup + labor.
	 * - `diagnostic`  — fixed diagnostic fee.
	 * - `warranty`    — no charge (covered under warranty).
	 */
	type PricingModel = 'flat' | 'hourly' | 'parts_labor' | 'diagnostic' | 'warranty';

	// ───────────────────────────── Sub-entities ─────────────────────────────

	/** A single inventory part consumed on a service order. */
	interface PartUsed {
		productId: string;
		sku: string;
		name: string;
		quantity: number;
		unitCost: number;
		total: number;
	}

	/** A technician work session logged against a service order (manual hours at V1). */
	interface WorkLog {
		workLogId: string;
		technicianId: string;
		/** Unix ms of the work session. */
		date: number;
		/** Hours worked in this session. */
		hours: number;
		description: string;
		partsUsed?: PartUsed[];
	}

	/** One entry in a service order's status history (append-only audit trail). */
	interface ServiceStatusEntry {
		status: ServiceStatus;
		/** Unix ms when the transition happened. */
		timestamp: number;
		/** User who triggered the transition. */
		userId: string;
		notes?: string;
	}

	// ───────────────────────────── Service order ─────────────────────────────

	/**
	 * Core service-order entity. Parallel to `Order` but with a multi-stage
	 * workflow, equipment intake, technician assignment, and service-specific
	 * pricing. Stored in its own DynamoDB partition (sinfactura/api#637).
	 */
	interface ServiceOrder {
		// Identity
		storeId: string;
		serviceOrderId: string;
		/** Human-facing sequential ticket number shown to the customer. */
		ticketNumber: string;
		customerId: string;

		// Classification
		serviceType: ServiceType;
		/** FK to the `ServiceTemplate` this order was created from, if any. */
		templateId?: string;
		priority: ServicePriority;

		// Status & workflow
		status: ServiceStatus;
		statusHistory: ServiceStatusEntry[];
		/** When true the order is paused (waiting on parts, customer, etc.). */
		onHold: boolean;

		// Equipment intake
		equipment?: {
			type?: string;
			brand?: string;
			model?: string;
			serialNumber?: string;
			/** Accessories received with the equipment (charger, case, …). */
			accessories?: string[];
			/** Cosmetic / functional condition noted at intake. */
			condition?: string;
			/** Customer-reported fault. */
			reportedIssue?: string;
		};

		// Diagnosis
		diagnosis?: {
			notes: string;
			diagnosedBy?: string;
			/** Unix ms. */
			diagnosedAt?: number;
		};

		// Quote
		quote?: {
			pricingModel: PricingModel;
			laborCost?: number;
			partsCost?: number;
			amount: number;
			/** Unix ms when the quote was presented to the customer. */
			quotedAt?: number;
			/** Set once the customer approves / rejects. */
			approved?: boolean;
			approvedBy?: string;
			approvedAt?: number;
		};

		// Technician assignment
		technicianId?: string;
		/** Unix ms the order was assigned. */
		assignedAt?: number;

		// Work & parts
		workLogs: WorkLog[];
		partsUsed: PartUsed[];

		// Financials
		pricingModel: PricingModel;
		laborRate?: number;
		laborCost?: number;
		partsCost?: number;
		discount?: number;
		total?: number;
		/**
		 * Self-describing currency catalogId stamp (see the currency taxonomy in
		 * `currency.ts`). Absent rows fall back to `store.config.displayCurrency`.
		 */
		currency?: string;

		// Dates (Unix ms)
		createdAt: number;
		updatedAt: number;
		/** Promised completion / pickup date shown to the customer. */
		promisedAt?: number;
		deliveredAt?: number;

		// Invoice integration
		invoiceId?: string;

		// Warranty
		warrantyDays?: number;
		/** Unix ms the warranty expires (stamped at delivery). */
		warrantyExpiresAt?: number;
	}
}

export {}; // NOSONAR
