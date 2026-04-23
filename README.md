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

```bash
# In a SINFACTURA consumer repo (app, web, etc.)
yarn add --dev sinfactura-types
```

## Usage

```typescript
import type { IUser, IOrder, IInvoice, IProduct } from "sinfactura-types";
```

## Publishing a New Version

1. Bump the `version` field in `package.json` (follow semver)
2. Publish to npm:

```bash
yarn publish
```

3. In each consumer repo, bump the `sinfactura-types` dependency (e.g. `app` currently uses `^1.0.90`)

## License

Proprietary — Copyright © 2025-2026 SINFACTURA LLC. All rights reserved.
