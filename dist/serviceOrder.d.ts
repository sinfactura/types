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
declare global {
    /** Kind of service. Drives which workflow stages apply (see ServiceTemplate). */
    type ServiceType = 'repair' | 'installation' | 'maintenance' | 'diagnosis';
    /**
     * Workflow stage of a service order. The canonical full repair pipeline is
     * received → diagnosing → quoted → approved → in_progress → ready →
     * delivered. Simpler service types skip stages — the transition table is a
     * single global adjacency map that permits it, NOT something
     * `ServiceTemplate.requiredStages` configures; nothing reads that field at
     * transition time.
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
    type ServiceStatus = 'received' | 'diagnosing' | 'quoted' | 'approved' | 'in_progress' | 'ready' | 'delivered' | 'cancelled' | 'returned_unrepaired' | 'abandoned_disposed';
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
     * - `warranty`    — a warranty job. A LABEL recording WHY the work exists;
     *                  it prices nothing. `billable: false` is the only thing
     *                  that makes a job free — see `ServiceOrder.billable`.
     */
    type PricingModel = 'flat' | 'hourly' | 'parts_labor' | 'diagnostic' | 'warranty';
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
     * One material a quote version PROPOSES to use.
     *
     * Deliberately **not** {@link PartUsed}. That is the fitted-parts ledger and
     * carries `unitCost` (merchant cost, operator-only) and `total` (the charged
     * line amount). A quote line is disclosed to the customer on the presupuesto
     * and rides a customer-visible entity, so it carries **no money at all** —
     * `wsPostStore` delivers a payload to that payload's own customer, so a
     * merchant cost on a quote version would sit one broadcast from a customer
     * socket. The priced figure stays the version's own `partsCost`.
     *
     * PROSPECTIVE, not derived. A presupuesto is an offer: at quote time the
     * parts have usually not been fitted, so `ServiceOrder.partsUsed` is empty or
     * partial. These are supplied on the create request instead.
     *
     * `sku` and `name` are SNAPSHOTS taken when the version is stamped and are
     * never re-resolved — the document's job is to show what the customer was
     * actually shown, so a later product rename must not rewrite a historical
     * presupuesto.
     */
    interface ServiceQuotePart {
        /** FK to Product. Never printed; this is what a future hold reserves against. */
        productId: string;
        /** Snapshot at stamp time, never re-resolved. */
        sku: string;
        /** Snapshot at stamp time — the name the customer was actually shown. */
        name: string;
        quantity: number;
        /** Ley 24.240 art. 20 — a non-new material must be declared in writing. */
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
     *
     * ⚠️ `ServiceOrder.workLogs` is itself a SIGNED, append-only ledger, the same
     * shape as `partsUsed`: a mistaken entry is corrected by APPENDING a negated
     * one, never by mutating or deleting the original. Sum the array — do not
     * assume every entry adds, and do not read `length` as a count of sessions
     * actually worked.
     */
    interface WorkLog {
        workLogId: string;
        technicianId: string;
        /** Unix ms of the work session. */
        date: number;
        /**
         * Hours worked in this session.
         *
         * ⚠️ SIGNED. Negative on a reversal entry — see {@link WorkLog.reverses}.
         * `ServiceOrder.laborCost` is derived from `laborRate` × the SUM of this
         * field across the whole array, so a reader that assumes positive
         * over-reports labour on any ticket whose entry has been corrected. The
         * shape did not change when reversals landed, so nothing in a consumer
         * fails to compile on this — it has to be checked by reading.
         */
        hours: number;
        description: string;
        /**
         * Set only on a reversal entry: the `workLogId` of the entry this one
         * negates.
         *
         * Absent on every ordinary log, and on every entry written before
         * reversals existed — forward-only, nothing backfills it, so a reader
         * must tolerate both shapes.
         *
         * ⚠️ A reversal carries its OWN fresh `workLogId` and deliberately does
         * not reuse the target's. Consumers key list rows by `workLogId`, so a
         * duplicate id breaks rendering; this pointer is what lets the ledger be
         * netted per entry without that collision. An entry carrying it IS a
         * reversal; an entry whose id appears here on another entry HAS BEEN
         * reversed, and must not be reversed twice.
         */
        reverses?: string;
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
     * Why the customer turned a presupuesto down.
     *
     * Recorded so a shop can compute WHY it loses work, not merely how often —
     * the two commonest answers point at opposite fixes. A high `price` rate is
     * a signal about the shop's own pricing; a high `not_worth_it` rate is a
     * signal about what it accepts at intake. Collapsing them makes both
     * uncomputable, exactly as collapsing the four terminal statuses would make
     * quote-rejection rate uncomputable.
     *
     * ⚠️ Deliberately NOT a widening of `ServiceQuoteApproval`. A rejection
     * creates no approval, so a field about an approval that never happened has
     * nowhere honest to live.
     *
     * Two members were considered and rejected. `declined_repair` shadows
     * `ServiceOutcome.declined`, which is a different axis — that one ends the
     * TICKET, this one refuses ONE VERSION and the expected next step is a
     * re-quote. `no_response` duplicates the `expired` status, giving an
     * operator two legal ways to record silence and polluting the very split
     * this enum exists for; it is also something a shop infers rather than
     * knows.
     */
    type ServiceQuoteRejectionReason = 'price' | 'not_worth_it' | 'timeline' | 'other';
    /**
     * A customer's REFUSAL of a quote version — the mirror of
     * `ServiceQuoteApproval`, and recorded for the same reason: who and when
     * must survive a re-quote.
     *
     * ⚠️ `by` and `at` are the load-bearing half, not `reason`. Before this
     * existed a rejection wrote a bare status flip — no actor, no timestamp —
     * while an approval recorded all three, so a quote history could show who
     * approved a version and nothing at all for a rejected one.
     *
     * No `channel`: a channel describes how an APPROVAL reached the shop, and
     * there is no approval here.
     */
    interface ServiceQuoteRejection {
        /** userId of the operator who recorded it. Server-stamped, never from the body. */
        by: string;
        /** Unix ms. Server-stamped. */
        at: number;
        reason: ServiceQuoteRejectionReason;
        /**
         * Free text the operator adds. The enum is required BECAUSE this cannot
         * be rendered in a stable language on the printed presupuesto and
         * constancia — those are statutory documents that go to a customer.
         */
        note?: string;
    }
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
        /**
         * Set when `status` is `rejected`. ⚠️ NOT set on `expired`: a lapse is
         * not a customer decision, so there is no reason to classify — even
         * though nothing auto-expires and an operator records `expired` by the
         * same manual act as `rejected`.
         */
        rejection?: ServiceQuoteRejection;
        /** `quoteId` of the version that replaced this one. */
        supersededBy?: string;
        /**
         * The materials THIS version proposes, so a reprint of a superseded
         * version discloses the set that version offered rather than the order's
         * current parts.
         *
         * Optional forever: versions stored before this field existed have none,
         * and nothing backfills them. A backfilled list would be a fabricated
         * record of what was offered, which is worse than the gap it closes.
         *
         * ⚠️ **Absent and empty mean different things, and conflating them
         * reproduces the exact defect this field fixes.**
         *
         * - `undefined` → a legacy version. Fall back to the order's netted
         *   `partsUsed`, which is the behaviour that shipped before this field.
         * - `[]` → this version proposes **no** materials (labour-only).
         *   Disclose nothing. Falling back here would print materials onto the
         *   one quote that was honest about having none.
         */
        parts?: ServiceQuotePart[];
    }
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
        /**
         * Payment-method code — a bare FK into the tenant's OWN
         * `Store.paymentMethods[]`, not a platform-wide enum.
         *
         * It draws on the same catalog as `Order.paymentMethod`, but do not read
         * that as "both ends are checked": `Order.paymentMethod` is accepted
         * unvalidated and only resolved at invoice issuance, where an unknown id
         * freezes onto `Invoice.paymentCondition` as `''`. A deposit proves the
         * referent before it writes.
         */
        method: number;
        freezesPrice: boolean;
        /**
         * The `userId` who accepted the money.
         *
         * Optional only because of the forward-only rule — deposits written before
         * this field existed cannot have it, and nothing backfills them. New
         * writes always stamp it: a seña is the one place in the service-order
         * domain where CASH changes hands, and a drawer that does not reconcile at
         * close is unattributable without it. `statusHistory` and
         * `ServiceQuoteApproval` already record `by` for decisions that move no
         * money at all.
         */
        by?: string;
        /** Set once the deposit is applied against the final invoice. */
        appliedToInvoiceId?: string;
    }
    /**
     * Why a balance cannot be stated. Exactly one is set whenever `balanceDue` is
     * `undefined`, so a screen or a document can say WHICH silence this is instead
     * of leaving a gap the operator fills in wrongly.
     *
     * Deliberately the same three cases, the same names and the same precedence as
     * the app's own `DepositsBalanceWithheld` — this contract exists to REPLACE
     * that hand-rolled computation, so a server figure that disagreed with it
     * would be worse than none.
     */
    type ServiceDepositBalanceWithheld = 'mixed_currency' | 'not_billable' | 'unpriced';
    /**
     * READ-TIME-SYNTHESIZED settlement view of `deposits[]` — what the customer
     * has already handed over, and what is still to collect at handover. Same
     * class of field as `ServiceOrder.customer`: resolved on the way out, NEVER
     * stored, and never accepted from a request body.
     *
     * It exists because the subtraction was previously the client's to do, and a
     * client that forgot it asked the customer to pay the whole job a second time
     * at the counter — with the seña recorded only inside `deposits[]`, where no
     * document read it.
     *
     * ⚠️ **Presentation only. Nothing here moves money or touches a comprobante.**
     * `balanceDue` is what to collect at the counter; it is NOT a figure any
     * invoice may be reduced by. Reducing a `FAC`'s `ImpTotal` by a seña that
     * carried no comprobante of its own understates the operation to ARCA, and
     * nothing can emit a `REC` today. `deposits[].appliedToInvoiceId` stays
     * unwritten for the same reason — the fiscal treatment of applying a seña to
     * a final invoice is unsettled and needs an accountant, not a default.
     *
     * ⚠️ **Attached by the POINT READ only** (`GET /services/{id}`). List reads do
     * not compute it, and — this is the part that bites — neither the 200 nor the
     * WebSocket frame of ANY write mode carries it, `mode: "deposit"` included.
     * That is uniform on purpose: `worklog`, `parts` and `edit` all move `total`
     * and therefore the balance, so a field present on one write surface and
     * absent on three would be worse than one that is never on a write at all.
     * **A client must refetch the ticket after any mutation** rather than merging
     * a write response over a previously-read balance — spreading keeps a stale
     * figure and OVERSTATES what is owed, which is the very defect this exists to
     * fix, arriving through the write path.
     */
    interface ServiceDepositBalance {
        /**
         * The currency every figure below is denominated in — the ORDER's own
         * `currency`, which `mode: "deposit"` stamps onto each entry it writes.
         */
        currency: string;
        /**
         * Σ `deposits[].amount` over the entries stamped in the order's OWN
         * currency — every seña taken against the job, regardless of
         * `freezesPrice`. Money received is money received; the flag changes what
         * may be DONE with it, never how much of it there is.
         */
        deposited: number;
        /**
         * The same sum split by `ServiceDeposit.freezesPrice`.
         *
         * Published as a split rather than left to the consumer to re-derive
         * precisely because re-deriving it means reading `freezesPrice` per row,
         * which is the step a consumer unaware of Ley de IVA art. 5 gets wrong. A
         * `frozen` seña has ALREADY perfected the hecho imponible for its amount;
         * an `unfrozen` one has not perfected anything. They are interchangeable
         * for "how much cash came in" and interchangeable for nothing else, so the
         * breakdown travels with the total rather than behind it.
         *
         * ⚠️ The two reconstitute `deposited` **to the centavo, not to the bit**:
         * `unfrozen` is derived as `round2(deposited - frozen)`, so
         * `round2(frozen + unfrozen) === deposited` holds, while a bare
         * `frozen + unfrozen === deposited` fails on roughly one ticket in six —
         * IEEE-754 re-introduces the error on re-addition (`54456.69 + 2215.30`
         * gives `56671.990000000005`). Do not write that strict check.
         */
        frozen: number;
        unfrozen: number;
        /**
         * `ServiceOrder.total` where the row carries one, `0` where it does not —
         * the shop's own final price for the job, never the approved presupuesto,
         * which is only what was offered before the work was done.
         *
         * Meaningless when `withheld` is `'unpriced'`: creation stamps no `total`,
         * so a ticket with nothing logged, nothing fitted and no edit genuinely has
         * none, and intake — where a seña is taken — is exactly that ticket.
         */
        jobTotal: number;
        /**
         * What the customer still owes: `jobTotal - deposited`.
         *
         * ⚠️ **`undefined` in exactly the three cases `withheld` names — an absent
         * balance is honest, a wrong one is not.** Check `withheld` first; do not
         * substitute `0` for the absence.
         *
         * NOT floored at 0. A negative figure means the customer is in credit —
         * they left more than the job came to — and refunds are not modelled here.
         * Flooring would silently discard that, and the unpriced case that would
         * otherwise dominate it is refused outright rather than clamped.
         *
         * ⚠️ `jobTotal` is not reliably what gets billed at delivery and must not
         * be described as if it were: goods bought in the same visit bill more. A
         * discount does not diverge — the delivery mint nets it across the two
         * service lines so they sum to `total`. This stays on `total` regardless:
         * it is the number the shop agreed with the customer, which is what a
         * counter needs to see.
         */
        balanceDue?: number;
        /** Set exactly when `balanceDue` is `undefined`. */
        withheld?: ServiceDepositBalanceWithheld;
        /**
         * Deposits stamped in some OTHER currency — **counted rather than summed**,
         * because adding them into `deposited` would make the balance a
         * cross-currency subtraction.
         *
         * Zero on any row the api wrote: `mode: "deposit"` stamps `order.currency`
         * on every entry, and `ServiceOrder.currency` is written once at creation
         * with no mode editing it. It is not zero by construction, though — an
         * imported or restored row could carry another — and any non-zero value
         * withholds the balance entirely (`'mixed_currency'`) rather than reporting
         * an incomplete one.
         */
        otherCurrency: number;
    }
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
        serviceType: ServiceType;
        /**
         * FK to the `ServiceTemplate` this order was created from, if any.
         *
         * PROVENANCE, not a live pointer. The four scalars it seeded at intake
         * (`serviceType`, `pricingModel`, `laborRate?`, `warrantyDays?`) are stored
         * on this row and are never re-read through this id — do not dereference it
         * to render them, or an edited template will silently rewrite closed
         * tickets. The template may since have been edited or disabled.
         */
        templateId?: string;
        priority: ServicePriority;
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
        /**
         * When `custody` last changed — the moment the customer's property
         * physically moved, not the moment a status did.
         *
         * ⚠️ NOT the same fact as `deliveredAt`, which records the status
         * reaching `delivered`. The two coincide on that transition and DIVERGE
         * on the operator-set path: `returned_unrepaired` records the decision
         * not to repair, and the equipment can sit on the shelf for weeks
         * afterwards. Printing `deliveredAt`, or the `statusHistory` entry, as
         * the handback date puts a wrong date on a statutory document — worse
         * than printing none.
         *
         * One field rather than `returnedAt` + `disposedAt`, because
         * `custodyImpliedBy` moves custody on TWO terminals (`delivered` →
         * `returned`, `abandoned_disposed` → `disposed`) and disposing of
         * someone else's property is the event most likely to be disputed.
         * Paired with `custody` it answers both halves: which state the
         * property is in, and when it entered it.
         *
         * Server-written at all three custody writers — intake, the implied
         * terminals, and the operator-set edit. Absent on rows written before
         * this shipped; forward-only, nothing backfills them, and a reader must
         * tolerate absence by printing no date. A backfill would be a fabricated
         * record of when someone's property changed hands.
         */
        custodyAt?: number;
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
        removePictures?: {
            url: string;
        }[];
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
        quote?: ServiceQuote[];
        deposits?: ServiceDeposit[];
        /**
         * Derived settlement view of `deposits[]`, resolved on the way out by the
         * point read and never persisted — see `ServiceDepositBalance`. Absent when
         * the order carries no deposits, and absent on list reads, which do not
         * compute it.
         */
        depositBalance?: ServiceDepositBalance;
        technicianId?: string;
        /** Unix ms the order was assigned. */
        assignedAt?: number;
        workLogs: WorkLog[];
        partsUsed: PartUsed[];
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
         * other. Independent of `pricingModel: 'warranty'` too, which is only a
         * LABEL recording why the job exists and prices nothing — it is not a
         * parameter of `computeServiceFinancials` and nothing branches on it.
         *
         * ⚠️ Up to 1.10.47 this docblock claimed `pricingModel: 'warranty'` was
         * "the PRICING intent (it drives the total to zero)". That was never true
         * at any point. A client trusting it would set `pricingModel: 'warranty'`,
         * leave this unset, and charge a customer in full for a statutory-warranty
         * repair on a ticket that says *warranty* on its face. This is the gate.
         */
        billable?: boolean;
        /**
         * Who last changed `billable`, and when. Written server-side from the
         * authorizer's `userId` and the server clock — never read from the body.
         *
         * This is the one field that zeroes a job's entire revenue, it is
         * correctable at plain `USER` role, and an edit is NOT journalled in
         * `statusHistory` — so without this the change leaves no trace of who made
         * it. Absent on rows written before this shipped, and on rows whose
         * `billable` was only ever set at intake.
         */
        billableSetBy?: {
            by: string;
            at: number;
        };
        disabled: boolean;
    }
}
export {};
