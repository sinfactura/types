/**
 * Service order types — repair / installation / maintenance / diagnosis
 * workflows ("Órdenes de Servicio").
 *
 * A ServiceOrder is a parallel entity to the product-sales Order pipeline:
 * multi-stage workflow, technician assignment, equipment intake, parts
 * consumption, and AFIP concept=2 service invoicing.
 *
 * Companion: ServiceTemplate (serviceTemplate.ts) defines
 * per-type default configuration that seeds new orders.
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

declare global {
	// Classification

	/** Kind of service. Drives which workflow stages apply (see ServiceTemplate). */
	type ServiceType = 'repair' | 'installation' | 'maintenance' | 'diagnosis';

	/**
	 * Workflow stage of a service order. The canonical full repair pipeline is
	 * received → diagnosing → quoted → approved → in_progress → ready →
	 * delivered. Simpler service types skip stages (configured per
	 * `ServiceTemplate.requiredStages`).
	 *
	 * There is no `testing` stage: it is a substate of `in_progress` that nobody
	 * outside the workshop distinguishes, and is expressed through
	 * `ServiceTemplate.checklist` instead. Stage inflation is the documented
	 * failure mode of these boards.
	 *
	 * There is no `on_hold` stage either — being blocked is orthogonal to the
	 * stage, so it is the `hold` field below, settable and clearable at any
	 * non-terminal status without changing it.
	 */
	type ServiceStatus =
		| 'received'
		| 'diagnosing'
		| 'quoted'
		| 'approved'
		| 'in_progress'
		| 'ready'
		| 'delivered'
		| 'cancelled'
		| 'returned_unrepaired'
		| 'abandoned_disposed';

	/**
	 * The statuses a service order can end in. Four rather than two, because
	 * "we declined the quote", "it could not be repaired" and "the customer
	 * never came back" are commercially distinct outcomes that a single
	 * `cancelled` collapses — which is what makes quote-rejection rate
	 * uncomputable.
	 */
	type ServiceTerminalStatus = 'delivered' | 'cancelled' | 'returned_unrepaired' | 'abandoned_disposed';

	/**
	 * The non-terminal stages — the ones a board shows as columns and a template
	 * can legitimately mark mandatory. Derived so it can never drift from
	 * `ServiceStatus`.
	 */
	type ServiceStageStatus = Exclude<ServiceStatus, ServiceTerminalStatus>;

	/**
	 * Why a `returned_unrepaired` order ended that way. Required on that status
	 * and meaningless on any other.
	 */
	type ServiceOutcome = 'declined' | 'unrepairable' | 'no_fault_found';

	/** Where the customer's property physically is, independent of `status`. */
	type ServiceCustody = 'in_shop' | 'returned' | 'disposed';

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

	// Hold

	/**
	 * Why work stopped. Blocked-on-parts and blocked-on-customer are
	 * operationally unrelated — a bare boolean conflates them, and promoting
	 * each to its own status causes stage inflation.
	 */
	type ServiceHoldReason = 'parts' | 'customer' | 'supplier' | 'other';

	/** An active block on a service order. Absent means work is not blocked. */
	interface ServiceHold {
		reason: ServiceHoldReason;
		/** Unix ms the hold started. */
		since: number;
		/** Unix ms the block is expected to clear, when known. */
		expectedUntil?: number;
		note?: string;
	}

	// Sub-entities

	/**
	 * Condition of a part fitted to a service order. Ley 24.240 art. 20 presumes
	 * **new** materials unless agreed otherwise **in writing**, so a non-new part
	 * has to be declarable here and printable on the presupuesto.
	 */
	type PartCondition = 'nuevo' | 'usado' | 'reacondicionado';

	/** A single inventory part consumed on a service order. */
	interface PartUsed {
		productId: string;
		sku: string;
		name: string;
		quantity: number;
		/** Merchant cost. Operator-only — never broadcast to a customer socket. */
		unitCost: number;
		/**
		 * The extended line amount CHARGED to the customer — `quantity` × the sell
		 * price, not `quantity` × {@link PartUsed.unitCost}.
		 *
		 * Stated because the two are easy to conflate and the line carries no
		 * explicit sell price: `unitCost` is what the part cost the shop, `total`
		 * is what the customer pays for it. The api sums `total` into
		 * `ServiceOrder.partsCost`, so reading it as a cost makes every service
		 * order bill parts at zero markup and reports 0% margin on them.
		 */
		total: number;
		condition: PartCondition;
	}

	/**
	 * A technician work session logged against a service order (manual hours at V1).
	 *
	 * Deliberately carries NO parts. Parts live exclusively on the top-level
	 * `ServiceOrder.partsUsed` signed ledger, which is what stock movement is
	 * derived from; a per-work-log copy would be a second source of truth for
	 * the same movement and the two would drift. Log the hours here, post the
	 * parts to the ledger.
	 */
	interface WorkLog {
		workLogId: string;
		technicianId: string;
		/** Unix ms of the work session. */
		date: number;
		/** Hours worked in this session. */
		hours: number;
		description: string;
	}

	/** One entry in a service order's status history (append-only audit trail). */
	interface ServiceStatusEntry {
		status: ServiceStatus;
		/** Unix ms when the transition happened. */
		timestamp: number;
		/** User who triggered the transition. */
		userId: string;
		/** Operator free text. Operator-only — never broadcast to a customer socket. */
		notes?: string;
	}

	// Quote

	/**
	 * Lifecycle of one quote version.
	 *
	 * `superseded` is what a re-quote sets on the version it replaces — Ley
	 * 24.240 art. 22 requires extra work found mid-repair to be communicated
	 * **before** it is performed, so re-quoting is a legal obligation rather
	 * than an edge case, and it must not move the order backwards through its
	 * stages (which would corrupt duration metrics).
	 */
	type ServiceQuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'superseded';

	/**
	 * How the customer's decision on a quote reached the shop.
	 *
	 * ⚠️ `'portal'` is RESERVED and must not be offered to an operator. The other
	 * four are things an operator records second-hand; `'portal'` means the
	 * customer approved it themselves, and no customer-facing service endpoint
	 * exists on any gateway yet — so an operator selecting it would be recording
	 * an event that did not happen. The api rejects it: it is excluded from the
	 * `POST /services` quote-resolve enum and returns 400. It stays in the union
	 * so rows already carrying it still read back, and so the value is ready the
	 * day a customer portal ships. Filter it out of any channel picker.
	 */
	type ServiceQuoteChannel = 'in_person' | 'phone' | 'whatsapp' | 'email' | 'portal';

	/**
	 * A customer decision on a quote version, recorded as an event rather than a
	 * boolean so that who/when/how survives a re-quote.
	 */
	interface ServiceQuoteApproval {
		/** userId of the operator who recorded it, or the customerId who self-served. */
		by: string;
		/** Unix ms. */
		at: number;
		channel: ServiceQuoteChannel;
	}

	/**
	 * One version of the presupuesto. `ServiceOrder.quote` is the full ordered
	 * history; the current one is the last entry not `superseded`.
	 *
	 * Ley 24.240 art. 21 requires the written presupuesto to price parts and
	 * labour **separately** — a blended total is non-compliant — so keep
	 * `laborCost`/`partsCost` populated for any model that distinguishes them.
	 * Art. 21(g) separately requires an acceptance deadline, which is
	 * `expiresAt`.
	 */
	interface ServiceQuote {
		quoteId: string;
		/** 1-based, monotonic within the order. */
		version: number;
		status: ServiceQuoteStatus;
		pricingModel: PricingModel;
		laborCost?: number;
		partsCost?: number;
		amount: number;
		/**
		 * Self-describing currency stamp for THIS version (ADR-0013, app repo).
		 * Absent falls back to the order header's stamp — which is why a
		 * long-running order that re-quotes after a devaluation should stamp per
		 * version rather than rely on the header.
		 */
		currency?: string;
		currencyValue?: number;
		currencyValueAt?: number;
		/** Unix ms when the quote was presented to the customer. */
		quotedAt?: number;
		/** Unix ms the offer lapses (Ley 24.240 art. 21(g)). */
		expiresAt?: number;
		approval?: ServiceQuoteApproval;
		/** `quoteId` of the version that replaced this one. */
		supersededBy?: string;
	}

	// Deposits

	/**
	 * A seña taken against a service order.
	 *
	 * `freezesPrice` is not a convenience flag: under Ley de IVA art. 5 a deposit
	 * that **freezes the price** perfects the hecho imponible for the amount
	 * received, and one that does not, is not subject to IVA. Software cannot
	 * infer which was agreed, so it has to be recorded explicitly per deposit.
	 */
	interface ServiceDeposit {
		depositId: string;
		amount: number;
		/** catalogId — FK to PlatformCurrency. */
		currency: string;
		currencyValue?: number;
		currencyValueAt?: number;
		/** Unix ms the deposit was taken. */
		at: number;
		/** Payment-method code, same vocabulary as `Order.paymentMethod`. */
		method: number;
		freezesPrice: boolean;
		/** Set once the deposit is applied against the final invoice. */
		appliedToInvoiceId?: string;
	}

	// Service order

	/**
	 * Which end of the job a photo was taken at.
	 *
	 * Present from the first release even though only intake has a UI: the
	 * discriminator is cheap to declare now and expensive to retrofit onto
	 * stored rows later, and a before/after comparison is unbuildable without
	 * it. `intake` is the evidentiary one — the state of someone else's
	 * property at the moment the shop took custody of it.
	 */
	type ServiceOrderPictureStage = 'intake' | 'delivery';

	/**
	 * One photo on a service order. Same mechanism as `Product.pictures`: an
	 * entry carrying `base64` is an UPLOAD and gets a server-minted key, so a
	 * client-supplied `url` never reaches storage; an entry resent without
	 * bytes is a pointer and triggers no storage call, which is what lets a
	 * client echo the whole array back on every save.
	 */
	interface ServiceOrderPicture {
		url: string;
		base64?: string;
		/**
		 * Which photo leads its stage's gallery — a CLIENT affordance, exactly as
		 * on `Product.pictures`. The server accepts, stores and returns it and
		 * deliberately never branches on it, so finding no server-side reader is
		 * the expected result and not grounds to retire the field.
		 */
		primary?: boolean;
		stage: ServiceOrderPictureStage;
	}

	/**
	 * The customer fields a service-order consumer needs to render a ticket,
	 * RESOLVED AT READ TIME and never stored on the row.
	 *
	 * Deliberately a named minimal shape rather than `Partial<Customer>` (which
	 * `Order.customer` is): a partial invites the whole row onto the wire and
	 * tells a consumer nothing about which keys are actually present. Every
	 * field here except `disabled` is guaranteed.
	 *
	 * Read-time resolution, not a stored snapshot, is the point — a service
	 * order can sit open for months, so a customer who corrects their name or
	 * phone is correct on every ticket immediately, including last March's.
	 * That also means there is nothing to migrate, nothing to keep in sync, and
	 * the `search` index is untouched.
	 */
	interface ServiceOrderCustomer {
		customerId: string;
		fullName: string;
		phone: string;
		email: string;
		/** Present when the customer has since been deactivated, so a UI can flag the ticket. */
		disabled?: boolean;
	}

	/**
	 * Core service-order entity. Parallel to `Order` but with a multi-stage
	 * workflow, equipment intake, technician assignment, and service-specific
	 * pricing. Stored in its own DynamoDB partition.
	 */
	interface ServiceOrder {
		// Identity
		storeId: string;
		serviceOrderId: string;
		/** Human-facing sequential ticket number shown to the customer. */
		ticketNumber: string;
		customerId: string;
		/**
		 * Resolved from the CUSTOMER row on every read — **never an attribute of
		 * the stored row**, so a writer must not send it and a mock built from a
		 * table scan will not carry it.
		 *
		 * Absent only when the referenced customer could not be read (a deleted
		 * row, a throttled batch). Consumers render the id alone in that case
		 * rather than treating it as a load failure.
		 */
		customer?: ServiceOrderCustomer;

		// Classification
		serviceType: ServiceType;
		/** FK to the `ServiceTemplate` this order was created from, if any. */
		templateId?: string;
		priority: ServicePriority;

		// Status & workflow
		status: ServiceStatus;
		statusHistory: ServiceStatusEntry[];
		/** Why the terminal status was reached. Only meaningful on `returned_unrepaired`. */
		outcome?: ServiceOutcome;
		/**
		 * Present only while work is blocked. Orthogonal to `status` — setting or
		 * clearing it never changes the stage.
		 */
		hold?: ServiceHold;
		/**
		 * Custody of the customer's property, independent of `status`. Stamped
		 * `in_shop` at intake. This is what answers "which cancelled orders still
		 * have equipment here?".
		 */
		custody: ServiceCustody;

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
			/** Customer-reported fault, in the customer's own words at intake. */
			reportedIssue?: string;
		};

		/**
		 * Equipment photos — **deliberately top-level rather than a member of
		 * `equipment`**, and that placement is load-bearing.
		 *
		 * `equipment` is written as a WHOLE-OBJECT replacement (an absent
		 * sub-field means "cleared", so that editing a ticket to drop a wrong
		 * serial number cannot leave the old one in the `search` index). Photos
		 * need the opposite convention — the `Product.pictures` one, where an
		 * absent array means "don't touch" and `[]` means "clear" — because a
		 * client that edits the model name must not silently destroy the intake
		 * photos, which are the shop's only evidence in a dispute over
		 * pre-existing damage. Two opposite rules cannot live inside one object,
		 * so the photos live beside it.
		 *
		 * `[]` and absent are NOT interchangeable. Collapsing them was a real
		 * regression on the product side.
		 */
		pictures?: ServiceOrderPicture[];
		/**
		 * @deprecated Request-only control, never persisted or returned — the
		 * transient removal list, mirroring `ProductUpsertInput.removePictures`.
		 */
		removePictures?: { url: string }[];

		// Diagnosis
		diagnosis?: {
			/** Internal technician notes. Operator-only — never broadcast to a customer socket. */
			notes: string;
			/**
			 * What was actually wrong, as told to the customer. Deliberately distinct
			 * from `notes` and from `equipment.reportedIssue`: the delta between
			 * reported and found is the entire justification for the quote, and for
			 * explaining a price increase to a customer or to Defensa del Consumidor.
			 */
			faultFound?: string;
			diagnosedBy?: string;
			/** Unix ms. */
			diagnosedAt?: number;
		};

		// Quote — full version history, oldest first
		quote?: ServiceQuote[];

		// Deposits (señas)
		deposits?: ServiceDeposit[];

		// Technician assignment
		technicianId?: string;
		/** Unix ms the order was assigned. */
		assignedAt?: number;

		// Work & parts
		workLogs: WorkLog[];
		partsUsed: PartUsed[];

		// Financials
		/**
		 * The FINAL ACTUAL pricing.
		 *
		 * Precedence against `quote[]`: a quote version is what the customer
		 * AGREED to; these header fields are what the job actually came to. They
		 * are expected to differ — that gap is the thing a shop needs to see.
		 *
		 * Ownership is split, and the split is the part worth reading. The three
		 * DERIVED fields — `laborCost`, `partsCost`, `total` — are server-recomputed
		 * on every write that touches work logs, parts, `laborRate` or `discount`,
		 * and are never accepted from a request body. The three INPUTS they are
		 * derived from — `pricingModel`, `laborRate`, `discount` — ARE operator-set
		 * and do arrive from the request body; there is nothing to recompute them
		 * from. Treating an input as server-owned is how a consumer ends up
		 * believing an operator cannot correct a wrong hourly rate.
		 */
		pricingModel: PricingModel;
		laborRate?: number;
		laborCost?: number;
		partsCost?: number;
		/**
		 * An absolute AMOUNT subtracted from the job, in `currency` — **not** a
		 * percentage.
		 *
		 * This is the opposite of `Order.discount`, which is a percentage the api
		 * applies as `1 - discount / 100`. Same field name, sibling entities,
		 * opposite units: reusing an order-discount control here turns a 10% intent
		 * into 10 pesos off a 50,000 job.
		 */
		discount?: number;
		total?: number;
		/**
		 * Self-describing currency catalogId stamp (see the currency taxonomy in
		 * `currency.ts`). Required rather than optional: without a stamped rate a
		 * months-old service order silently reconverts at today's rate, which in
		 * this FX environment is a margin bug rather than a cosmetic one.
		 */
		currency: string;
		/** FX rate and the Unix ms at which it was effective (ADR-0013, app repo). */
		currencyValue?: number;
		currencyValueAt?: number;

		// Dates (Unix ms)
		createdAt: number;
		updatedAt: number;
		/**
		 * `YYYYMMDD` in Buenos Aires time (e.g. `20260810`), stamped at creation
		 * and never rewritten — the sort key of the `PK-dated` index the per-day
		 * and date-range service queries run on. Required, and a NUMBER: the index
		 * is sparse, so a row without it silently never appears in a date query,
		 * and a string value makes DynamoDB reject the write outright.
		 */
		dated: number;
		/** Promised completion / pickup date shown to the customer. */
		promisedAt?: number;
		/** Unix ms the order reached `ready`. The unclaimed-equipment clock starts here. */
		readyAt?: number;
		/**
		 * Unix ms of each "your equipment is ready" notification. A list because
		 * you notify more than once before an unclaimed device is disposed of.
		 */
		notifiedAt?: number[];
		deliveredAt?: number;

		// Invoice integration
		/**
		 * The `Order` minted for this service order, set on the
		 * `ready` → `delivered` transition. An invoice is built from an order and
		 * never from a service order, so this is the join that makes the work
		 * billable at all.
		 *
		 * Absent while the job is still open, and absent forever on a ticket that
		 * ends `cancelled`, `returned_unrepaired` or `abandoned_disposed` — none of
		 * those deliver anything to bill.
		 *
		 * ⚠️ Deliberately has NO reader inside the api, and that is correct — see
		 * `invoiceId` below. Do not retire it for want of one.
		 */
		orderId?: string;
		/**
		 * The fiscal document issued for this service order, stamped when
		 * `POST /invoices` actually draws the voucher — in the same transaction as
		 * the `Invoice` put, so the join can never commit half-formed.
		 *
		 * ⚠️ Like `orderId`, NOTHING server-side branches on this, by design. Both
		 * exist so the row is self-describing on `GET`: their consumer is the
		 * client's linked-order card, where `invoiceId` alone answers "was this
		 * invoiced?" with no second fetch and `orderId` is the navigation target.
		 * An audit that finds no reader has found the intended state, not dead
		 * fields — do not remove them on that basis.
		 */
		invoiceId?: string;

		// Warranty & rework
		warrantyDays?: number;
		/** Unix ms the warranty expires (stamped at delivery). */
		warrantyExpiresAt?: number;
		/**
		 * Set on a rework ticket, pointing at the order being reworked. Ley 24.240
		 * art. 23 sets a 30-day statutory repair warranty, and a rework has to
		 * consume parts and technician time while billing nothing — without
		 * reopening the parent, which would destroy its cycle time and invoice
		 * linkage.
		 */
		parentServiceOrderId?: string;
		isWarrantyRework?: boolean;
		/**
		 * False on a warranty rework. Absent is treated as billable.
		 *
		 * This is the INVOICING gate, and it is the only one: a non-billable order
		 * still mints its `Order` at delivery — at zero — so the parts consumed,
		 * the technician hours and the `parentServiceOrderId` link all survive and
		 * the free redo stays visible in reporting. What it refuses is the fiscal
		 * document: `POST /invoices` rejects an order whose service order is not
		 * billable, so no voucher is issued and no metered quota is burnt.
		 *
		 * Independent of `isWarrantyRework`, deliberately — a rework can be
		 * goodwill-billed and a non-rework can be free, so neither implies the
		 * other. Independent of `pricingModel: 'warranty'` too, which is the
		 * PRICING intent (it drives the total to zero); this is the gate.
		 */
		billable?: boolean;

		// Soft delete
		disabled: boolean;
	}
}

export {}; // NOSONAR
