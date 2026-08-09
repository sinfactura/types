// Flat ESLint config for sinfactura-types.
//
// This package is a pure TypeScript contracts library with no runtime code, so
// ESLint here exists for ONE invariant: issue references in comments must sit
// inside a `TODO(<repo>#<n>)` marker (see CLAUDE.md § "Comments & issue references").
// Comments are not AST nodes, so this cannot be a `no-restricted-syntax` selector —
// it ships as a local rule module in `eslint-rules/`.
import tseslint from 'typescript-eslint';
import { noIssueRefsInComments } from './eslint-rules/no-issue-refs-in-comments.js';

export default tseslint.config(
	{
		ignores: ['dist/**', 'node_modules/**'],
	},
	{
		name: 'sinfactura/no-issue-refs-in-comments',
		files: ['src/**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { projectService: false },
		},
		plugins: { sinfactura: { rules: { 'no-issue-refs-in-comments': noIssueRefsInComments } } },
		rules: { 'sinfactura/no-issue-refs-in-comments': 'error' },
	},
	{
		// Files outside src/ that still carry comments: this config, the tsconfig
		// helpers, any scripts. `eslint-rules/**` is exempt — the rule's own doc
		// comment legitimately quotes example refs while explaining what it matches.
		name: 'sinfactura/no-issue-refs-in-comments-nonsrc',
		files: ['**/*.{ts,js,mjs,cjs}'],
		ignores: ['src/**', 'eslint-rules/**', 'dist/**'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { projectService: false },
		},
		plugins: { sinfactura: { rules: { 'no-issue-refs-in-comments': noIssueRefsInComments } } },
		rules: { 'sinfactura/no-issue-refs-in-comments': 'error' },
	},
);
