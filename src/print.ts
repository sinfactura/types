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
}

export {}; // NOSONAR
