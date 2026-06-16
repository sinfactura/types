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
}

export {}; // NOSONAR
