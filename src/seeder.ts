// AI Tenant Seeder types (sinfactura/app#1054; sinfactura/api#1073-#1082, #1758, #1759).
//
// `SeedProfile` / `SeedJobHandle` / `SeedSampleCard` / `SeedProgressEvent` / `SeedPhase`
// mirror the ALREADY-SHIPPED FE contract verbatim — `app/src/features/seeder/validation/
// seederSchema.ts`, `app/src/app/slices/seederProgress.ts`, `app/src/features/seeder/
// constants.ts`. FE shipped first (scaffold PRs #1940/#1942/#1952/#1943), so these are the
// frozen ground truth; the original research blueprint's shapes are superseded where they
// differ. See the 2026-07-14 audit decision recorded on app#1054.
//
// Two distinct HTTP entry points share the pipeline (api#1079 start-job lib, imported by
// both, not Lambda-to-Lambda invoke):
//   - `POST /seeder/run` (api#1758, tenant wizard, adminToken) sends `SeedJobStartRequest`.
//   - `POST /platform/operations` mode `seed-ai-tenant` (api#1079, MANAGER SuperOp,
//     app#1464) sends `SeedAiTenantOpRequest` — coarser params; the handler expands
//     `scale` into `SeedProfile.targetCounts` and constructs the rest of the profile
//     server-side (the SuperOp caller doesn't know the tenant's brands/categories/etc).

declare global {
	// Closed vertical enum — the 10-vertical launch set (product decision RESOLVED
	// 2026-07-14, superseding the earlier "pending" note here). It is the UNION of two
	// previously-disjoint sets: the 4 the FE shipped (`VERTICAL_KEYS` in `constants.ts` —
	// ferreteria/kiosco/libreria/farmacia) and the 8 the research corpus wrote full prompt
	// packs for (`ai-seeder/verticals.md` + `verticals-2.md`), which overlapped on only 2.
	// `kiosco`/`libreria` have no research entry (packs authored in `verticals-3.md`); the
	// other 6 were sitting fully-researched but unused.
	//
	// SERVICE verticals (servicio técnico, etc.) are deliberately NOT here — they'd seed a
	// different SHAPE (isService products + ServiceTemplate + ServiceOrder + AFIP concept=2
	// invoicing), and the Services feature itself is types-only today (app#758 open; no api
	// routes, no FE screens). Deferred to a second round gated on that feature shipping.
	//
	// Extending stays additive/non-breaking. api's `RATES_BY_VERTICAL` is a
	// `Record<SeedVertical, …>`, so the compiler forces its IVA tables to stay exhaustive
	// with this union. FE's local `VERTICAL_KEYS` should import from here rather than
	// redeclaring.
	type SeedVertical =
		| 'ferreteria'
		| 'kiosco'
		| 'libreria'
		| 'farmacia'
		| 'gastronomia'
		| 'textil'
		| 'tecnologia'
		| 'panaderia'
		| 'agropecuario'
		| 'repuestos';

	// SuperOp-only coarse sizing selector (app#1464's `scale` param). The wizard path
	// skips this entirely and sends explicit `targetCounts` on `SeedProfile` instead.
	// 'small' dropped — the research proposed it but never gave it concrete counts.
	type SeedScale = 'demo' | 'full';

	// What to generate. Mirrors the shipped FE Zod schema
	// (`seederSchema.ts::seedProfileSchema`) field-for-field. Deliberately does NOT carry
	// `storeId`/`overwrite` — those travel as sibling fields on the request shapes below,
	// since the wizard resolves storeId from the JWT while the SuperOp path takes it
	// explicitly (cross-tenant).
	interface SeedProfile {
		vertical: SeedVertical;
		storeName: string;
		brands: string[];
		categories: string[];
		suppliers: string[];
		productHints: string[];
		targetCounts: {
			products: number;
			customers: number;
			orders: number;
			invoices: number;
		};
		locale: string;
	}

	// `POST /seeder/run` body — mirrors the shipped FE `RunSeederArgs`
	// (`app/src/app/services/seeder.ts`) exactly.
	interface SeedJobStartRequest {
		profile: SeedProfile;
	}

	// `POST /platform/operations` `{ mode: 'seed-ai-tenant' }` body — mirrors app#1464's
	// SuperOp catalog param spec (`storeId`/`vertical`/`scale`/`overwrite`).
	interface SeedAiTenantOpRequest {
		storeId: string;
		vertical: SeedVertical;
		scale: SeedScale;
		overwrite?: boolean;
	}

	// Wire response for `run` and `GET /seeder/jobs/{id}` — mirrors the shipped FE shape
	// exactly (`seederSchema.ts::seedJobHandleSchema`). Deliberately thin: rich progress
	// travels over WS (`SeedProgressEvent`), not this polling shape — `GET jobs/{id}` is a
	// status check / reconnect-resume anchor, not a full-state fetch.
	interface SeedJobHandle {
		jobId: string;
		createdAt: string;
		status: 'queued' | 'running' | 'done' | 'cancelled' | 'error';
	}

	// The `SEED_JOB` DDB row — BE-internal entity (not the wire shape FE consumes; see
	// `SeedJobHandle` for that). Persisted by the shared start-job lib (api#1079/#1758),
	// updated by the stage workers and read by the finalize/commit path + cost meter.
	interface SeederJob {
		storeId: string;
		jobId: string;
		profile: SeedProfile;
		status: SeedJobHandle['status'];
		executionArn?: string;
		phase?: SeedPhase;
		completed?: number;
		total?: number;
		costUsd?: number;
		createdAt: number;
		updatedAt: number;
		ttl: number;
	}

	// The 7-phase progress enum — FROZEN by the shipped FE
	// (`constants.ts::SEED_PROGRESS_PHASES`). BE Step Functions stages (planning / brand /
	// product / customer / orderInvoice / image / finalize) map onto these via
	// `currentLabel`; they do not each get their own phase value. Do not add an 8th phase.
	type SeedPhase = 'extracting' | 'planning' | 'generating' | 'streaming' | 'committing' | 'done' | 'error';

	// A single streamed preview item — mirrors the shipped FE shape exactly
	// (`seederSchema.ts::seedSampleCardSchema`).
	interface SeedSampleCard {
		kind: 'product' | 'customer' | 'order' | 'invoice' | 'brand' | 'category' | 'supplier';
		id: string;
		title: string;
		subtitle?: string;
		imageUrl?: string;
		priceArs?: number;
	}

	// WSS payload — mirrors the shipped FE shape exactly
	// (`seederSchema.ts::seedProgressEventSchema`). Delivered as
	// `{ action: 'seed_progress', data: SeedProgressEvent }` over the existing
	// `ws-message` pipeline (api#1082) — no direct ApiGatewayManagementApi calls.
	interface SeedProgressEvent {
		jobId: string;
		phase: SeedPhase;
		currentLabel?: string;
		completed: number;
		total: number;
		etaMs?: number;
		sample?: SeedSampleCard;
		error?: string;
	}
}

export {}; // NOSONAR
