declare global {
  // Agent-agnostic print-protocol wire types (api#1004 / api#1290): the POST
  // /print contract + the append-only PRINT_JOB# state timeline.
  type PrintJobState = 'queued' | 'sent' | 'printed' | 'error';

  type PrintContentType = 'pdf_uri' | 'pdf_base64' | 'raw_uri' | 'raw_base64';

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
   * One Cloud Print agent connection in `PrintAgentStatus.agents` (api#612).
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
     * Machine hostname (api#2005). Requires a cloudprint heartbeat change
     * (sinfactura/print#180) — absent until then, so a UI still needs the
     * `agentId`/`platform` fallback label.
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
   * `GET /print?mode=agent-status` response payload (api#612).
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

  /* ------------------------------------------------------------------ */
  /*  Printer registry + routing rules (api#2005 / types#112)            */
  /*  Moves useCase → printer routing out of the agent into the web app. */
  /* ------------------------------------------------------------------ */

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
     * Operator-controlled pause. BE-owned — NOT agent-reported, and must
     * survive a re-registration that omits it. `false` = do not route jobs here.
     */
    active: boolean;
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
  type PrintPrinterReport = Omit<PrintPrinter, 'agentId' | 'active' | 'reportedAt' | 'online'>;

  /**
   * agent → BE WSS payload: `{ action: 'register_printers', data: RegisterPrintersData }`.
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
    /** userId that last changed it — feeds the audit trail. */
    updatedBy?: string;
  }

  /**
   * The routing field the BE resolves from `PrintRule` and injects into the
   * BE → agent print-job dispatch payload (api#2005).
   *
   * ⚠️ The full dispatch payload is NOT yet canonicalized in this package — the
   * de-facto shape is `cloudprint/src/shared/schemas/print-job.schemas.ts`
   * (`PrintJobPayloadSchema`), whose `documentType` vocabulary
   * (`invoice | shipping_tag | delivery_label`) does not match `PrintUseCase`
   * above. Canonicalizing it, and reconciling those two vocabularies, needs its
   * own ticket; this interface exists so the api and agent lanes can type the
   * one field #156 adds without minting a competing full payload here.
   */
  interface PrintJobRouting {
    /**
     * Resolved from `PrintRule` at dispatch time. Absent = the agent falls back
     * to its own local config (the pre-#156 behaviour), which keeps already
     * deployed agents working against a BE that already routes.
     */
    printerId?: string;
  }
}

export {}; // NOSONAR
