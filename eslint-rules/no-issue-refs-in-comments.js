/**
 * Issue references in comments are legal only inside a `TODO(<repo>#<n>)` marker.
 *
 * Unlike every other invariant in `eslint.config.js`, this one cannot be a
 * `no-restricted-syntax` selector: comments are not AST nodes, so the only way to
 * reach them is `sourceCode.getAllComments()`.
 *
 * The marker requirement is the point, not the ban. A bare `#2127` in this repo
 * usually means `api#2127`, so the reader pays a lookup to reach the wrong tracker;
 * forcing the prefix removes the ambiguity by construction, and `TODO(...)` marks
 * the reference as a live pointer rather than archaeology.
 */

const REPOS = ['app', 'api', 'types', 'storefront', 'cloudprint', 'landing', 'qa', 'print', 'docs'];

// `sinfactura/api#123`, `api#123`, or a bare `#123`. Two digits minimum so a
// markdown-ish `#1` and an ordinal like `#2` stay out of it. The trailing lookahead
// rejects a longer hex literal — `#3483FA` (a brand colour) must not read as `#3483`.
const REF = new RegExp(
	String.raw`(?:sinfactura\/)?(?:${REPOS.join('|')})?#\d{2,5}(?![0-9a-fA-F])`,
	'g',
);

// `TODO(api#2130)` / `FIXME(app#900)` — the only sanctioned home for a reference.
const MARKED = new RegExp(String.raw`(?:TODO|FIXME)\((?:sinfactura\/)?(?:${REPOS.join('|')})#\d{2,5}\)`, 'g');

/**
 * `#547` (an issue) and `#333` (a colour) are indistinguishable in isolation, so the
 * discriminator is how this codebase writes them: numeric literals quoted in prose are
 * code-spanned — a colour (`` `#333` ``), an ARCA error code (`` `cód. #10048` ``) — and
 * issue references never are. Applies only to unprefixed tokens: `` `api#1964` `` is a
 * reference whether or not someone code-spanned it.
 */
const isCodeSpannedLiteral = (text, match) => {
	if (!match[0].startsWith('#')) return false;
	return [...text.matchAll(/`[^`]*`/g)].some(
		(span) => match.index > span.index && match.index < span.index + span[0].length,
	);
};

export const noIssueRefsInComments = {
	meta: {
		type: 'suggestion',
		docs: { description: 'Issue references in comments must sit inside a TODO(<repo>#<n>) marker' },
		schema: [],
		messages: {
			bareRef:
				"Issue reference '{{ref}}' in a comment. A closed issue is archaeology — strip the reference and keep the constraint. A live one belongs in a marker: TODO({{suggestion}}). See AGENTS.md 'Comments'.",
		},
	},
	create(context) {
		const { sourceCode } = context;

		const offending = (text) => {
			// Spans consumed by a sanctioned marker are exempt.
			const marked = [...text.matchAll(MARKED)].map((m) => [m.index, m.index + m[0].length]);
			const isMarked = (at) => marked.some(([from, to]) => at >= from && at < to);

			return [...text.matchAll(REF)].filter((m) => !isMarked(m.index) && !isCodeSpannedLiteral(text, m));
		};

		return {
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					// `//` and `/*` are both two characters, so the reference's offset within
					// the comment value is a fixed +2 from the node's start.
					const base = comment.range[0] + 2;

					for (const match of offending(comment.value)) {
						const ref = match[0];
						context.report({
							loc: sourceCode.getLocFromIndex(base + match.index),
							messageId: 'bareRef',
							data: { ref, suggestion: ref.startsWith('#') ? `api${ref}` : ref },
						});
					}
				}
			},
		};
	},
};
