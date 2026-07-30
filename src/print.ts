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
   * `GET /print?mode=agent-status` response payload (api#612).
   *
   * Agent-LEVEL connectivity — "is a Cloud Print agent reachable for this store
   * right now" — as distinct from the job-level `PrintJobTransition` timeline
   * above ("was this specific job printed"). Derived read-only from the
   * heartbeat fields the WSS `heartbeat` action already writes onto the store's
   * SOCKET connection row; there is no stored `PrintAgentStatus` entity.
   */
  interface PrintAgentStatus {
    /**
     * Derived, never stored: a printer connection exists for the store and its
     * heartbeat is not stale. Independent of the SOCKET row's own 3h reaper
     * TTL, which governs row cleanup rather than agent responsiveness.
     */
    online: boolean;
    /**
     * Freshest connection's `lastHeartbeatAt`, ms epoch. Absent when a printer
     * is connected but has never reported (pre-heartbeat agent builds).
     */
    lastSeen?: number;
    /** Absent unless the agent reported it on its last heartbeat. */
    agentVersion?: string;
    /** Jobs waiting in the agent's local queue, as of the last heartbeat. */
    queueDepth?: number;
  }
}

export {}; // NOSONAR
