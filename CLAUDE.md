# CLAUDE.md - Types (Shared TypeScript Interfaces)

This file provides types-specific guidance for the shared TypeScript types package. For universal code standards, see the shared [umbrella overview](../docs/architecture/UMBRELLA_OVERVIEW.md) (in the `sinfactura/docs` repo).

**Shared docs** live in the sibling **`sinfactura/docs`** repo, **not here**: research corpus + the `/research` command → `../docs/research/`, ARCA/AFIP catalog → `../docs/regulatory/`, cross-repo architecture/initiatives → `../docs/architecture/` and `../docs/initiatives/`. It takes **direct commits to `main`** (no PR) — add new cross-cutting docs there. Code-coupled docs (how this package works) stay in their repo.

## 🎯 Package Overview

**sinfactura-types** is the centralized TypeScript type definitions package that serves as the single source of truth for data contracts across all SINFACTURA services. Published as an npm package, it ensures type consistency between frontend applications (app, web, landing) and backend services (api).

### Package Information
- **Name**: `sinfactura-types`
- **Version**: 1.0.79+ (check package.json for current)
- **License**: MIT (⚠️ Different from proprietary services!)
- **Published**: npm registry as public package
- **Consumers**: app, web, api, landing services

## ⚠️ Critical Considerations

### License Difference
```typescript
// ⚠️ This package uses MIT license, NOT proprietary
// Headers should reflect MIT license:
/**
 * MIT License
 * Copyright (c) 2025 SINFACTURA LLC
 */
```

### Breaking Changes
**EXTREME CAUTION**: Breaking changes affect ALL services!
- Major version bumps require coordinated updates across all services
- Always maintain backwards compatibility when possible
- Use deprecation warnings before removing types
- Document migration paths for breaking changes

## 📁 Type Modules Structure

```
src/
├── account.ts       # User account interfaces
├── afip.ts         # Argentine tax authority types
├── api.ts          # API response/request types
├── auth.ts         # Authentication & authorization
├── basket.ts       # Shopping cart types
├── brands.ts       # Product brand interfaces
├── cash.ts         # Cash management types
├── categories.ts   # Category hierarchy types
├── customer.ts     # Customer data interfaces
├── imports.ts      # Import operation types
├── invoice.ts      # Invoice & billing types
├── log.ts          # System log interfaces
├── notification.ts # Notification types
├── order.ts        # Order processing types
├── product.ts      # Product catalog types
├── stock.ts        # Inventory types
├── store.ts        # Store configuration
├── supplier.ts     # Supplier interfaces
├── user.ts         # User management types
├── whatsapp.ts     # WhatsApp integration types
└── index.ts        # Main export file
```

### 💱 Currency taxonomy

Two currency encodings exist: **catalogId** (canonical, lowercase — e.g. `ars`, `usd-oficial`) vs raw **ISO** (legacy uppercase, e.g. `ARS`). `CatalogId` (`currency.ts`) is the canonical union. Money entities are self-describing via their own `currency` catalogId stamp; an **unstamped `ACCOUNT` row falls back to `store.config.displayCurrency`, never to `customer.currencyId`** (root cause of api#1333). The full ledger-denomination + self-describing rule lives in api `docs/CURRENCY.md` / `docs/ENTITIES.md` §ACCOUNT and app `docs/adr/0013-currency-self-describing-entities.md`.

## 📝 Type Definition Standards

### Interface vs Type Alias
```typescript
// ✅ Use interface for object shapes (extendable)
export interface User {
  id: string;
  email: string;
  role: UserRole;
}

// ✅ Use type for unions, intersections, or primitives
export type UserRole = 'admin' | 'manager' | 'supervisor' | 'customer';
export type UserId = string;
export type UserWithMetadata = User & { createdAt: Date };
```

### Naming Conventions
```typescript
// Interfaces: PascalCase, descriptive
export interface ProductDetails { }
export interface OrderSummary { }

// Type aliases: PascalCase
export type PaymentStatus = 'pending' | 'completed' | 'failed';

// Enums: PascalCase with UPPER_SNAKE members
export enum InvoiceType {
  TYPE_A = 'A',
  TYPE_B = 'B',
  TYPE_C = 'C'
}

// Generic types: Use T, K, V or descriptive names
export interface ApiResponse<TData = unknown> {
  data: TData;
  error?: ApiError;
}
```

### Required vs Optional Fields
```typescript
// Be explicit about optionality
export interface Product {
  id: string;                  // Always required
  name: string;                // Always required
  description?: string;        // Optional field
  price: number;              // Required
  discountPrice?: number;     // Optional
  metadata?: ProductMetadata; // Optional nested object
}

// Use Partial/Required utilities when needed
export type ProductUpdate = Partial<Product> & { id: string };
export type ProductCreation = Omit<Product, 'id'>;
```

## 🔄 Versioning Strategy

### Semantic Versioning
- **Major (X.0.0)**: Breaking changes
  - Removing fields
  - Changing field types
  - Renaming interfaces
- **Minor (0.X.0)**: Backwards-compatible additions
  - New interfaces
  - New optional fields
  - New type exports
- **Patch (0.0.X)**: Bug fixes
  - Documentation updates
  - Type corrections that don't break compatibility

### Version Bump Process
```bash
# 1. Make your changes
# 2. Build to verify
yarn build

# 3. Bump version (plain npm — `yarn version --patch` does NOT work under
#    Yarn Berry; project convention is patch for additive changes, see PUBLISHING.md)
npm version patch --no-git-tag-version   # or the `release` script

# 4. Update CHANGELOG.md, commit `chore(release): X.Y.Z`, push to main.
#    CI PUBLISHES AUTOMATICALLY — the publish-npm workflow (npm Trusted
#    Publishing/OIDC) fires on every main push and publishes whenever the
#    version isn't on the registry yet. Never run `npm publish` locally
#    (manual publish is a break-glass fallback only — see PUBLISHING.md).

# 5. Update in consuming services (api first — it owns this repo)
cd ../api && yarn add sinfactura-types@latest
```

## 🏗️ Adding New Types

### Step-by-Step Process
1. **Create new type file** (if new domain)
```typescript
// src/newdomain.ts
export interface NewDomainEntity {
  id: string;
  // ... fields
}

export type NewDomainStatus = 'active' | 'inactive';
```

2. **Export from index**
```typescript
// src/index.ts
export * from './newdomain';
```

3. **Document the types**
```typescript
/**
 * Represents a new domain entity in the system
 * @example
 * const entity: NewDomainEntity = {
 *   id: '123',
 *   status: 'active'
 * }
 */
export interface NewDomainEntity {
  /** Unique identifier */
  id: string;
  /** Current status of the entity */
  status: NewDomainStatus;
}
```

4. **Test build**
```bash
yarn build
```

5. **Version and release** (CI publishes on push — see PUBLISHING.md)
```bash
npm version patch --no-git-tag-version   # additive = patch by project convention
# update CHANGELOG.md, commit `chore(release): X.Y.Z`, push to main → CI publishes
```

## 🔗 Integration Patterns

### Importing in Services
```typescript
// In web/app/api services
import type { User, Product, Order } from 'sinfactura-types';

// Import specific types
import type { InvoiceType } from 'sinfactura-types/invoice';
```

### Extending Types Locally
```typescript
// Service-specific extensions
import type { User } from 'sinfactura-types';

// Extend for local use
interface UserWithPermissions extends User {
  permissions: string[];
  lastLogin: Date;
}

// Or use intersection types
type EnhancedUser = User & {
  analytics: UserAnalytics;
};
```

### Type Guards
```typescript
// Define type guards in consuming services
import type { User, Customer } from 'sinfactura-types';

function isCustomer(user: User | Customer): user is Customer {
  return 'companyName' in user;
}
```

## 🚫 Anti-Patterns to Avoid

### ❌ Don't Use `any`
```typescript
// ❌ BAD
export interface ApiResponse {
  data: any;
}

// ✅ GOOD
export interface ApiResponse<T = unknown> {
  data: T;
}
```

### ❌ Don't Create Circular Dependencies
```typescript
// ❌ BAD - user.ts imports from order.ts and vice versa
// user.ts
import { Order } from './order';
export interface User {
  orders: Order[];
}

// order.ts
import { User } from './user';
export interface Order {
  user: User;
}

// ✅ GOOD - Use type references or separate common types
export interface User {
  orders: OrderReference[];
}

export interface Order {
  userId: string;
}
```

### ❌ Don't Mix Business Logic
```typescript
// ❌ BAD - Types package should not contain logic
export class UserValidator {
  validate(user: User) { /* ... */ }
}

// ✅ GOOD - Only type definitions
export interface User {
  email: string;
  password: string;
}

// Validation logic belongs in service packages
```

## 📊 Common Patterns

### API Response Types
```typescript
// Standardized API responses
export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;
```

### Pagination Types
```typescript
export interface PaginatedRequest {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### Timestamp Types
```typescript
export interface Timestamps {
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt?: string; // Soft delete
}

// Commonly extended
export interface Product extends Timestamps {
  id: string;
  name: string;
}
```

### Status Enums
```typescript
// Use string enums for readability
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

// Or use type unions for simpler cases
export type SimpleStatus = 'active' | 'inactive';
```

## 🧪 Testing Type Changes

### Build Testing
```bash
# Always test build before publishing
yarn build

# Test in consuming service before publishing
cd ../web
yarn link sinfactura-types
yarn build  # Ensure no type errors
```

### Type Coverage
```typescript
// Ensure all exports are typed
// src/index.ts should export all public types
export * from './account';
export * from './auth';
// ... etc
```

## 📚 Documentation Requirements

### JSDoc Comments
```typescript
/**
 * Represents a customer in the B2B system
 * @remarks
 * Customers are different from regular users as they represent companies
 * @example
 * ```typescript
 * const customer: Customer = {
 *   id: '123',
 *   companyName: 'ACME Corp',
 *   cuit: '30-12345678-9'
 * };
 * ```
 */
export interface Customer {
  /** Unique customer identifier */
  id: string;

  /** Legal company name */
  companyName: string;

  /** Argentine tax ID (CUIT) */
  cuit: string;

  /**
   * Customer tier for pricing
   * @default 'standard'
   */
  tier?: 'standard' | 'premium' | 'enterprise';
}
```

## 🚀 Publishing Checklist

Before publishing a new version:
- [ ] All types are properly exported in index.ts
- [ ] No TypeScript errors (`yarn build` succeeds)
- [ ] Version bumped appropriately (major/minor/patch)
- [ ] Breaking changes documented (if major version)
- [ ] Tested in at least one consuming service
- [ ] README updated if needed
- [ ] Git tag created for version

## 🔐 Security Considerations

### Sensitive Data Types
```typescript
// Never include actual sensitive data in type definitions
export interface UserAuth {
  email: string;
  // ❌ Never include actual passwords or tokens as default values
  // password: string = "default123"; // WRONG!

  // ✅ Only define the shape
  passwordHash: string;
  refreshToken?: string;
}
```

### Type Validation
Types are compile-time only! Always validate at runtime:
```typescript
// Types don't provide runtime validation
// Services must implement actual validation
export interface EmailInput {
  email: string; // Type system can't validate email format
}

// Runtime validation belongs in services, not types package
```

## 🆘 Troubleshooting

### Common Issues

**Module not found after update:**
```bash
# Clear node_modules and reinstall
cd ../web
rm -rf node_modules
yarn install
```

**Type conflicts between versions:**
```bash
# Check installed version
yarn list sinfactura-types

# Force update to latest
yarn add sinfactura-types@latest
```

**Build fails after adding new types:**
- Ensure all new files are exported in index.ts
- Check for circular dependencies
- Verify no runtime code in type files

## 📋 Migration Guide

When introducing breaking changes:

1. **Deprecate first** (minor version)
```typescript
/** @deprecated Use NewInterface instead */
export interface OldInterface { }

export interface NewInterface { }
```

2. **Document migration** (in CHANGELOG)
```markdown
## Migration from 1.x to 2.0
- Replace `OldInterface` with `NewInterface`
- Update field `oldField` to `newField`
```

3. **Remove in major version**
```typescript
// Version 2.0.0 - OldInterface removed
export interface NewInterface { }
```

---

*For universal code standards and other shared conventions, refer to the [umbrella overview](../docs/architecture/UMBRELLA_OVERVIEW.md) in the shared `sinfactura/docs` repo.*