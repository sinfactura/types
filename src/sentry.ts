/**
 * The projected Sentry issue the api's `GET /platform/sentry/issues` proxy
 * returns, and the query it accepts.
 *
 * ⚠️ **This is a PROJECTION, never Sentry's own issue object.** The upstream
 * shape is large, carries fields no operator panel uses, and — critically —
 * can reach into event bodies. Everything here is issue-level METADATA:
 * counts, timestamps, a title and a permalink. Nothing that a user typed and
 * nothing from an event payload crosses this boundary, which is what keeps the
 * app's Session Replay masking from being quietly re-opened by a proxy.
 *
 * ⚠️ **`title` and `culprit` are upstream strings and the api does not
 * synthesize them.** They are Sentry's own summaries (an exception type, a
 * transaction name), not free text a shopper or operator wrote — but they are
 * still the one place a stray identifier could ride along, so treat them as
 * display-only and never key on them.
 *
 * Deliberately NOT `declare global`: the app imports these as types next to a
 * value-level RTK endpoint, so a named import is what the consumer wants.
 *
 * ```ts
 * import type { SentryIssue, SentryIssuesQuery } from 'sinfactura-types';
 * ```
 */
export interface SentryIssue {
	/** Sentry's issue id — the only field the deep link needs. */
	id: string;
	/** Human-readable short id, e.g. `SINFACTURA-APP-1A2`. */
	shortId: string;
	/** Sentry's summary of the error. Display-only. */
	title: string;
	/** Where it fired — a transaction or function name. Display-only. */
	culprit: string;
	level: SentryIssueLevel;
	/** Events in the requested window, not lifetime. */
	count: number;
	/** Distinct users affected in the requested window. */
	userCount: number;
	/** Epoch milliseconds. ⚠️ Sentry answers ISO-8601; the api converts. */
	firstSeen: number;
	/** Epoch milliseconds. ⚠️ Sentry answers ISO-8601; the api converts. */
	lastSeen: number;
	/** Fully-qualified sentry.io URL for the issue. */
	permalink: string;
}

/**
 * The levels the panel renders.
 *
 * ⚠️ Sentry can emit levels outside this set (`info`, `debug`, `sample`). The
 * api maps anything it does not recognise to `'error'` rather than widening
 * this union, so a consumer's exhaustive switch cannot be broken by an
 * upstream vocabulary change it has no say in.
 */
export type SentryIssueLevel = "error" | "warning" | "fatal";

/** The windows the proxy accepts. Anything else is a 400. */
export type SentryStatsPeriod = "24h" | "7d" | "14d" | "30d";

/**
 * `GET /platform/sentry/issues` query parameters.
 *
 * ⚠️ `cursor` is OPAQUE — it is Sentry's own pagination token, echoed back
 * verbatim. Do not parse it, construct it, or persist it across windows: a
 * cursor is only meaningful against the exact `statsPeriod`/`query` pair that
 * produced it.
 */
export interface SentryIssuesQuery {
	/** Default `24h` when omitted. */
	statsPeriod?: SentryStatsPeriod;
	/** A Sentry search string. Default `is:unresolved` when omitted. */
	query?: string;
	cursor?: string;
}

/**
 * `GET /platform/sentry/issues` success body.
 *
 * ⚠️ `truncated` follows the repo's list convention: present and `true` only
 * when more pages exist, ABSENT when the page is complete. `nextCursor` is
 * present exactly when `truncated` is.
 */
export interface SentryIssuesResponse {
	message: string;
	data: SentryIssue[];
	truncated?: true;
	nextCursor?: string;
}
