"use strict";
// Typed storefront events pipeline (types#69, api#1239/#1240,
// storefront#425/#429, app#1638). Schema-validated discriminated union
// emitted by `sinfactura/storefront` (via the `track()` wrapper in
// `src/utils/track.ts`), validated and persisted by `sinfactura/api`
// (Zod mirror in `stacks/helpers/storefrontEvents/schema.ts`), rendered
// by `sinfactura/app` (typed activity feed in `<ActivityFeed>`).
//
// Naming follows Segment Spec: Title Case Object + Past-Tense Action
// for event names; snake_case for properties so the GA4 / Segment
// vocabulary on the wire maps without translation.
//
// 14 variants — the 4 storefront-only events (`Page Viewed`,
// `Favorite Toggled`, `Whatsapp Clicked`, `Error Captured`) currently
// emitted by storefront are NOT in this taxonomy yet; they ride the
// legacy `Log` path and are tracked for a follow-up types release.
Object.defineProperty(exports, "__esModule", { value: true });
