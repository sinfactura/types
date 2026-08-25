declare global {
  // Agent-agnostic print-protocol wire types: the POST /print contract
  // + the append-only PRINT_JOB# state timeline.
  type PrintJobState = 'queued' | 'sent' | 'printed' | 'error';

  type PrintContentType = 'pdf_uri' | 'pdf_base64' | 'raw_uri' | 'raw_base64';

  /**
   * A raw (non-PDF) control language a printer can be sent.
   *
   * Deliberately NOT encoded into `PrintContentType`: that field says how the
   * bytes ARRIVE (`raw_uri` vs `raw_base64`), not what dialect they are, and the
   * two axes are independent — every format is transportable both ways. Widening
   * `PrintContentType` to `raw_zpl_base64`-style members would multiply out to a
   * member per (format × transport) pair and break every existing consumer that
   * switches on it.
   */
  type PrintRawFormat = 'zpl' | 'escpos';

  interface PrintOptions {
    bin?: string;
    collate?: boolean;
    color?: boolean;
    copies?: number;
    dpi?: string;
    duplex?: 'long-edge' | 'short-edge' | 'one-sided';
    fit_to_page?: boolean;
    media?: string;
    nup?: number;
    pages?: string;
    paper?: string;
    rotate?: 0 | 90 | 180 | 270;
  }

  interface PrintJobTransition {
    jobId: string;
    state: PrintJobState;
    ts: number;
    source: 'be' | 'agent';
    detail?: string;
    errorCode?: string;
  }

  /**
   * One Cloud Print agent connection in `PrintAgentStatus.agents`.
   *
   * Every field except `online` comes from the agent's own last heartbeat, so
   * all of them are absent on a connection that has never reported — a
   * pre-heartbeat agent build holds a live socket and still receives jobs.
   * Distinguish "absent because never reported" from "reported as empty".
   */
  interface PrintAgentSummary {
    /**
     * Stable per-install id the agent mints on first run and reuses. The right
     * handle for list keys and future per-agent actions. Absent on
     * pre-heartbeat builds, so a UI needs a fallback label.
     */
    agentId?: string;
    /** This connection's own liveness — NOT the store-wide aggregate. */
    online: boolean;
    /** `lastHeartbeatAt`, ms epoch. */
    lastSeen?: number;
    agentVersion?: string;
    /** `process.platform` — `'win32' | 'darwin' | 'linux'`. NOT a hostname. */
    platform?: string;
    /** Jobs waiting in this agent's local queue at its last heartbeat. */
    queueDepth?: number;
    memoryMB?: number;
    /** Agent process uptime in seconds. */
    uptime?: number;
    /**
     * Machine hostname. **Live** — the agent sends it as of v2.1.6
     * and the api persists and exposes it.
     *
     * Still optional, and a UI still needs the `agentId` + `platform` fallback
     * label: mixed fleets are real, so a pre-v2.1.6 agent reports none and the
     * field is simply absent. Not a flag day.
     *
     * ⚠️ Mild PII — machine names routinely embed a person's (`MacBook-de-Juan`,
     * `PC-MARIA`). The agent keeps it out of its own logs and the api redacts it
     * by key in both the Powertools logger and Sentry. Don't log it, and never
     * put it in a Sentry tag.
     */
    hostname?: string;
    /**
     * Printers this agent has reported. Absent until it has sent
     * `register_printers` at least once — distinguish that from an agent that
     * reported an empty list (a machine with no printers installed).
     */
    printers?: PrintPrinter[];
  }

  /**
   * `GET /print?mode=agent-status` response payload.
   *
   * Agent-LEVEL connectivity — "is a Cloud Print agent reachable for this store
   * right now" — as distinct from the job-level `PrintJobTransition` timeline
   * above ("was this specific job printed"). Derived read-only from the
   * heartbeat fields the WSS `heartbeat` action already writes onto the store's
   * SOCKET connection row; there is no stored `PrintAgentStatus` entity.
   *
   * The top-level `online`/`lastSeen`/`agentVersion`/`queueDepth` fields
   * describe the freshest LIVE agent and exist so a simple status badge doesn't
   * have to walk `agents`. Anything per-agent (a fleet list, an "N of M
   * connected" indicator) reads `agents`.
   */
  interface PrintAgentStatus {
    /**
     * Derived, never stored: at least one printer connection for the store is
     * live. Independent of the SOCKET row's own 3h reaper TTL, which governs
     * row cleanup rather than agent responsiveness.
     */
    online: boolean;
    /**
     * Freshest LIVE connection's `lastHeartbeatAt`, ms epoch. Absent when a
     * printer is connected but has never reported (pre-heartbeat agent builds).
     */
    lastSeen?: number;
    /** Absent unless the agent reported it on its last heartbeat. */
    agentVersion?: string;
    /** Jobs waiting in the agent's local queue, as of the last heartbeat. */
    queueDepth?: number;
    /** Count of entries in `agents` with `online: true`. */
    onlineCount: number;
    /**
     * Every printer connection currently registered for the store, live or
     * stale. ⚠️ This is CONNECTED agents, not INSTALLED ones: an agent that was
     * never started, or whose socket row has been reaped (3h TTL), is invisible
     * here. So `onlineCount` of `agents.length` answers "of the agents we can
     * see, how many are live" — it cannot answer "are all my configured agents
     * running".
     */
    agents: PrintAgentSummary[];
  }

  // Printer registry + routing rules — moves useCase → printer routing out of the agent into the web app.

  /** OS spooler state for a printer as of the agent's last report. */
  type PrintPrinterState = 'idle' | 'printing' | 'paused' | 'offline' | 'error' | 'unknown';

  /**
   * What the OS driver advertises. All optional — driver support varies wildly,
   * and an absent field means "not reported", never "not supported".
   * Value vocabularies deliberately mirror the matching `PrintOptions` fields so
   * a rule's options can be validated against the target printer.
   */
  interface PrintPrinterCapabilities {
    /** Mirrors `PrintOptions.paper`, e.g. `['A4', 'Letter', '4x6']`. */
    paper?: string[];
    /** Mirrors `PrintOptions.media`. */
    media?: string[];
    /** Mirrors `PrintOptions.bin`. */
    bins?: string[];
    /** Mirrors `PrintOptions.dpi` — string, matching that field's type. */
    dpis?: string[];
    color?: boolean;
    duplex?: boolean;
  }

  /**
   * One printer under `PRINTER#${storeId}`.
   *
   * Printers are only meaningful inside their owning agent: two machines can
   * both expose "Microsoft Print to PDF", so `printerId` is unique per AGENT,
   * and the addressable key is the (`agentId`, `printerId`) pair — never
   * `printerId` alone.
   */
  interface PrintPrinter {
    agentId: string;
    /** Stable per-agent id the agent derives from the OS printer. */
    printerId: string;
    /** OS display name — shown to the operator, not used as a key. */
    name: string;
    driver?: string;
    /** The OS default on that machine. Informational; routing uses `PrintRule`. */
    isDefault?: boolean;
    state?: PrintPrinterState;
    capabilities?: PrintPrinterCapabilities;
    /**
     * IPP keyword behind a non-usable `state`, e.g. `media-empty-error`.
     * Agent-reported and FREE-FORM, never an enum — the vocabulary is
     * driver-supplied and vendor-extensible (`media-jam`, `toner-empty`,
     * `door-open`, `marker-supply-low`, …), so an enum would drop exactly the
     * unusual reason worth surfacing. Bounded to 128 chars at the api schema.
     *
     * ⚠️ CLEARED when the printer returns to a usable state. A stale reason is
     * worse than none, because it sends someone to a machine that is fine.
     */
    reason?: string;
    /**
     * Operator-controlled pause. BE-owned — NOT agent-reported, and must
     * survive a re-registration that omits it. `false` = do not route jobs here.
     */
    active: boolean;
    /**
     * Raw control languages the OPERATOR declares this device understands.
     * BE-owned and operator-set, exactly like `active` — never agent-reported.
     *
     * ⚠️ **Absent or empty means REFUSE all raw content.** This is the one field
     * in the printer registry where absence is a "no" rather than a "not
     * reported", and it inverts `PrintPrinterCapabilities`' core rule on purpose
     * (`api/stacks/services/printRules.ts`: "Absent capabilities = not reported —
     * accept everything"). That default is right for `paper`/`bins`/`dpis`, where
     * guessing wrong wastes one job. Here, guessing wrong sends a ZPL stream to a
     * laser printer, which does not error — it renders every command as text and
     * puts a ream through the machine until someone physically cancels it. The
     * spooler accepts the bytes, the agent ACKs `printed`, and the BE records
     * success. So it cannot live in `capabilities`, or the next person to "fix
     * the inconsistency" reopens the hole.
     *
     * It is also not something the agent could report honestly: it can read a
     * driver string (`ZDesigner ZD420`), but a generic driver, a renamed queue or
     * a shared network printer defeats that heuristic. And an agent-reported
     * field is overwritten on every re-registration — the same bug `active` is
     * shaped to avoid, with a worse outcome than an un-paused printer.
     */
    rawFormats?: PrintRawFormat[];
    /** ms epoch of the last `register_printers` report that included this printer. */
    reportedAt: number;
    /**
     * Derived, never stored: the owning agent is live AND this printer was
     * present in its most recent report. A printer unplugged between reports
     * stays LISTED with `online: false` rather than disappearing, so the
     * operator can see that it went dark — same principle as
     * `PrintAgentSummary.online`.
     */
    online: boolean;
  }

  /**
   * Exactly what the agent sends. The BE-owned fields are structurally excluded
   * so an agent build physically cannot claim to set them.
   *
   * ⚠️ Derived via `Omit` on purpose — if this were hand-written the two shapes
   * would drift, and a `register_printers` upsert that overwrote the row
   * wholesale would silently reset the operator's per-printer pause toggle on
   * every agent restart.
   */
  type PrintPrinterReport = Omit<PrintPrinter, 'agentId' | 'active' | 'reportedAt' | 'online' | 'rawFormats'>;

  /**
   * Payload of the agent → BE `register_printers` WSS frame. ⚠️ That frame is
   * **FLAT** — `{ action, printers }`, NOT `{ action, data }`; this type
   * describes the fields, not a nested envelope. `agentId` here is advisory: the
   * api derives it from the authenticated SOCKET row and is not declared on the frame.
   */
  interface RegisterPrintersData {
    agentId: string;
    /**
     * The COMPLETE current printer set for this agent, not a delta. The BE
     * reconciles: printers missing from the list are marked offline, never
     * deleted — deleting would orphan any `PrintRule` pointing at them and give
     * the operator a use case that silently stops printing with no visible cause.
     */
    printers: PrintPrinterReport[];
  }

  /** Print use cases that can be routed independently. */
  type PrintUseCase = 'order' | 'invoice' | 'label' | 'tag' | 'receipt' | 'report';

  /**
   * One row of `PRINT_RULE#${storeId}` — at most one rule per
   * (`storeId`, `useCase`, `agentId`).
   */
  interface PrintRule {
    useCase: PrintUseCase;
    agentId: string;
    printerId: string;
    /** Applied to every job on this route; merged under any per-job options. */
    options?: PrintOptions;
    updatedAt: number;
    /** Unix ms — `if_not_exists`-stamped on first upsert, then stable. Optional: rows written before the stamp existed lack it. */
    createdAt?: number;
    /** userId that last changed it — feeds the audit trail. */
    updatedBy?: string;
    /**
     * Derived, NEVER stored — computed by `GET /print?mode=rules` at read time
     * against the resolved printer's LIVE reported capabilities. Lists every
     * key in this rule's `options` that currently contradicts them.
     *
     * ⚠️ Empty or absent means EITHER "none contradict" OR "the printer has
     * reported no capabilities at all" — disambiguate with
     * `capabilitiesReported` before treating it as a clean bill of health.
     * Reading empty as "verified clean" inverts the registry's core rule
     * (absent capabilities = not reported, never not supported) and would
     * mark every Windows rule falsely clean, since Windows agents report
     * `paper` only.
     *
     * Purely informational. The dispatch-time strip is the actual enforcement
     * point and does not read this field.
     */
    unsupportedOptionKeys?: Array<keyof PrintOptions>;
    /**
     * Derived, NEVER stored — `true` only when the resolved printer has
     * reported ANY capabilities. Exists so `unsupportedOptionKeys` can be
     * read unambiguously; see the warning on it.
     */
    capabilitiesReported?: boolean;
  }

  /**
   * The routing field the BE resolves from `PrintRule` and injects into the
   * BE → agent print-job dispatch payload.
   *
   * ⚠️ The full dispatch payload is NOT yet canonicalized in this package — the
   * de-facto shape is `cloudprint/src/shared/schemas/print-job.schemas.ts`
   * (`PrintJobPayloadSchema`), whose `documentType` vocabulary
   * (`invoice | shipping_tag | delivery_label`) does not match `PrintUseCase`
   * above. Canonicalizing it, and reconciling those two vocabularies, needs its
   * own ticket; this interface exists so the api and agent lanes can type the
   * one field this adds without minting a competing full payload here.
   */
  interface PrintJobRouting {
    /**
     * Resolved from `PrintRule` at dispatch time. Absent = the agent falls back
     * to its own local config (the earlier behaviour), which keeps already
     * deployed agents working against a BE that already routes.
     */
    printerId?: string;
  }

  /**
   * One mapping in the agent's `export_local_rules` frame — the migration of
   * agent-local routing into `PRINT_RULE#${storeId}`.
   *
   * The agent resolves its own slot setting to a `printerId`, by matching the
   * stored OS printer name against its **current enumerated set**. The BE never
   * matches on name: `PrintPrinter.name` is a display label, not unique across
   * agents, and explicitly not a key.
   */
  interface PrintLocalRuleExport {
    useCase: PrintUseCase;
    printerId: string;
  }

  /**
   * A local slot the agent could NOT resolve to a registered printer, reported
   * rather than dropped — a store's mapping must never vanish silently.
   *
   * Keyed by `useCase` so it shares units with `PrintLocalRuleExport`: one
   * unresolvable `tags` slot is TWO unrouted use cases (`tag` + `label`), so
   * slot-keyed entries would make the seeded/skipped counts incomparable.
   * `slot` is retained anyway, because an operator configures slots, not use
   * cases, and it is what tells them which printer to fix.
   */
  interface PrintLocalRuleSkip {
    useCase: PrintUseCase;
    /** Agent-local slot name — `orders` | `invoices` | `tags`. */
    slot: string;
    /** The OS printer name the slot still points at. */
    printerName: string;
    /** Free text from the agent; recorded for support, never parsed. */
    reason: string;
  }

  /**
   * One row of `PRINT_JOB_STATE#${storeId}` — a per-job SUMMARY, one
   * row per `jobId`, upserted alongside every `PRINT_JOB#${storeId}#${jobId}`
   * timeline write. The timeline partition is per-JOB, so it cannot answer
   * "list this store's print jobs" — this row exists so that listing can, via
   * the `PK-updatedAt` GSI, with no server-side collapse.
   *
   * `state`/`source`/`useCase`/`agentId`/`printerId`/`orderId`/`invoiceId`/
   * `detail`/`errorCode` reflect the LATEST transition only — this is a pointer,
   * not a history. Read the per-job state timeline for the full ordered set.
   */
  interface PrintJobSummary {
    jobId: string;
    storeId: string;
    state: PrintJobState;
    source: 'be' | 'agent';
    /**
     * ms epoch of the FIRST transition — pinned via `if_not_exists`, never
     * overwritten. Doubles as the `PK-updatedAt` GSI sort key, so the listing is
     * newest-CREATED-first and pagination is stable.
     *
     * ⚠️ Despite the name this is NOT a last-updated stamp — the one place in
     * the codebase where `updatedAt` means created. A MUTABLE sort key cannot be
     * paginated: a job that transitioned between a caller's page 1 and page 2
     * would move above the resume cursor and be returned on NEITHER page.
     * Recency lives in `lastTransitionAt`. The GSI attribute name is fixed,
     * which is why the field is not simply renamed.
     */
    updatedAt: number;
    /** ms epoch of the FIRST transition — set once via `if_not_exists`, never overwritten. */
    createdAt: number;
    /** ms epoch of the LATEST transition. Plain assignment, moves every write — the recency value to display. */
    lastTransitionAt: number;
    useCase?: PrintUseCase;
    agentId?: string;
    printerId?: string;
    orderId?: string;
    invoiceId?: string;
    detail?: string;
    /**
     * Machine-readable failure classification, when one is recognised. BE-side
     * dispatch skips write `PRINTER_INACTIVE` / `AGENT_OFFLINE` (or both joined
     * by `+`); an agent `ACK_FAILED` can classify to `PRINTER_PAUSED` /
     * `NO_PRINTER_ASSIGNED` / `PRINTER_NOT_FOUND`. Unrecognised agent
     * text stays in `detail` only, so absence of a code does NOT mean success.
     */
    errorCode?: string;
  }

  /**
   * `data` payload of the server → agent `printers_active` WSS frame,
   * envelope `{ action: 'printers_active', data: PrintersActiveData }` — nested,
   * like every server→client frame (`SocketMessage<T>`), and the opposite of the
   * FLAT client→server convention `RegisterPrintersData` documents above.
   *
   * Exists because the BE enforces `active` only when a `PrintRule` resolves. On
   * an unrouted job the agent picks its own local default printer, which the BE
   * cannot know — so the flag is pushed to the agent and its local fallback
   * applies it. Two triggers emit the same frame: after a successful
   * `register_printers` reconcile (repairs an agent that was offline when a
   * toggle landed) and on the operator's toggle itself (low-latency path).
   *
   * `printers` is the RECEIVING agent's COMPLETE registered set, never a delta —
   * same full-replacement contract as `register_printers`, so a dropped frame is
   * repaired by the next one rather than left half-applied.
   *
   * Each entry is identity plus the one BE-owned field the agent must enforce —
   * deliberately NOT `PrintPrinterReport`'s shape (no `name` / `capabilities` /
   * `state`, which the agent already has from its own enumeration).
   *
   * ⚠️ Agent-side semantics this type cannot encode but a consumer MUST apply,
   * both fail-OPEN by design: a `printerId` the agent knows locally but this
   * frame omits ⇒ NOT paused; no frame received yet (fresh connect) ⇒ NOT
   * paused. A dispatch decision must never block on the backend's view arriving.
   */
  interface PrintersActiveData {
    storeId: string;
    /** The receiving agent's own id — every frame is scoped to one agent. */
    agentId: string;
    printers: Pick<PrintPrinter, 'printerId' | 'active'>[];
  }
}

export {}; // NOSONAR
