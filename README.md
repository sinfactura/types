# `sinfactura-types`

Shared TypeScript type definitions for the SINFACTURA platform. Published as the `sinfactura-types` npm package and consumed by the other SINFACTURA repositories (primarily `app` and `web`) to ensure the backend, admin UI, and storefront agree on the shape of every domain entity: users, stores, customers, products, orders, invoices, baskets, notifications, and more.

## About the SINFACTURA Platform

This repository is part of the SINFACTURA monorepo — an integrated e-commerce, electronic invoicing, and business management suite for the Argentine market.

| Repository                                               | Purpose                                                 | Stack                          |
| -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| [`api`](https://github.com/sinfactura/api)               | Serverless backend — REST + WebSocket APIs              | AWS CDK, Lambda, DynamoDB      |
| [`app`](https://github.com/sinfactura/app)               | B2B operations & admin platform (internal)              | React 19 + Vite + MUI v7       |
| [`web`](https://github.com/sinfactura/web)               | Customer-facing e-commerce storefront (TODOINSUMOS)     | React 19 + Vite + MUI v7       |
| [`landing`](https://github.com/sinfactura/landing)       | Marketing website (sinfactura.com)                      | React 19 + Vite + MUI v7       |
| [`cloudprint`](https://github.com/sinfactura/cloudprint) | Desktop print agent — receives print jobs via WebSocket | Electron 41 + Vite + SQLite    |
| **`types`** _(this repo)_                                | Shared TypeScript types                                 | `sinfactura-types` npm package |

## Purpose

`sinfactura-types` is the single source of truth for cross-repo TypeScript interfaces. Rather than duplicating domain shapes (e.g. `User`, `Order`, `Invoice`) in each client, every consumer imports them from this package so that a change to a server-side contract propagates to all clients at build time.

The package contains only TypeScript type declarations — no runtime code. Zod schemas for validation stay co-located in the repos that need them (e.g. `app/` keeps its Zod schemas local; see the root `CLAUDE.md`).

## Installation

Two distribution channels:

### Git (preferred — no NPM publish step)

Consumers reference the auto-built `dist` branch directly:

```jsonc
// app/package.json (and api, web, landing)
{
  "devDependencies": {
    "sinfactura-types": "github:sinfactura/types#dist"
  }
}
```

The [`build-dist`](.github/workflows/build-dist.yml) GitHub Actions workflow runs on every push to `main`, builds `dist/`, and force-pushes a clean orphan commit to the `dist` branch. Consumers fetch a ready-to-use package — no build step required at install time.

### npm (legacy — being phased out)

```bash
yarn add --dev sinfactura-types
```

## Usage

```typescript
import type { IUser, IOrder, IInvoice, IProduct } from "sinfactura-types";
```

## Updating Types

### Authoring side (this repo)

1. Edit types in `src/`.
2. Commit + push to `main`.
3. The `build-dist` workflow runs automatically, force-pushes the new build to `dist`.

No manual version bump, no NPM publish. (The `version` field in `package.json` still gets bumped for npm publishing if/when needed; consumers using the git URL ignore it — they pin commit hashes via their lockfiles.)

### Consumer side (app, api, web, landing)

After a new types build lands, consumers explicitly pull it:

```bash
yarn up "sinfactura-types@github:sinfactura/types#dist"
```

This re-resolves the git ref to the latest commit on `dist` and pins it in the lockfile. Commit the lockfile change.

> **Why explicit?** `yarn install` does NOT re-resolve git branch refs to their current HEAD — it reuses the cached resolution for reproducibility. Consumers that want auto-bump-on-pull can add a `post-merge` Husky hook that runs `yarn up sinfactura-types@github:sinfactura/types#dist` whenever `package.json`/`yarn.lock` changed in the merge.

## Legacy: Publishing a New NPM Version

Kept for reference / external consumers. New SINFACTURA repos should use the git URL instead.

1. Bump the `version` field in `package.json` (follow semver)
2. Publish to npm: `yarn publish`

## License

Proprietary — Copyright © 2025-2026 SINFACTURA LLC. All rights reserved.
