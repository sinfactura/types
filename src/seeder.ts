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

	// `POST /seeder/extract-profile` body — the free-text business description the LLM
	// turns into a `SeedProfile` (api#1758, consuming the platform AI module api#1076).
	// Mirrors the shipped FE Zod schema (`seederSchema.ts::businessDescriptionSchema`)
	// field-for-field, INCLUDING its bounds: `rawText` 10–2000 chars, `location` ≤120.
	//
	// `vertical` is NULLABLE on purpose — the wizard lets the user skip the picker and
	// have the model infer it from `rawText`. A non-null value is a HINT, not a
	// constraint: the extractor may still return a different `SeedProfile.vertical` if
	// the prose plainly contradicts it.
	//
	// Omitted from types#103 (the one shape of the frozen FE contract that never made it
	// across); added by api#1758's preflight.
	interface BusinessDescription {
		vertical: SeedVertical | null;
		rawText: string;
		location?: string;
	}

	// `POST /seeder/run` body — mirrors the shipped FE `RunSeederArgs`
	// (`app/src/app/services/seeder.ts`) exactly.
	interface SeedJobStartRequest {
		profile: SeedProfile;
	}

	// What a finished job actually produced. Carried on the terminal `seed_progress`
	// frame (`phase: 'done'`) and returned by `POST /seeder/jobs/{id}/commit` as
	// `committed`. Counts are ACTUALS — they can fall short of `SeedProfile.targetCounts`
	// when a stage degrades (e.g. image failures stamp no-image and continue).
	interface SeedSummary {
		products: number;
		customers: number;
		orders: number;
		invoices: number;
	}

	// `POST /seeder/jobs/{id}/commit` response — mirrors the shipped FE
	// `commitSeedDraft` return (`{ committed: number }`). `committed` is the TOTAL row
	// count copied from the `SEED_DRAFT#` namespace into the live partitions.
	interface SeedCommitResult {
		committed: number;
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

	// `GET /seeder/jobs/{jobId}` response — the RECONNECT-RESUME payload (api#1758,
	// research §8.3). Deliberately RICHER than `SeedJobHandle`: a client whose socket
	// drops mid-run has to restore the progress bar and the current phase, and a bare
	// `{ jobId, createdAt, status }` cannot do that — it would snap the wizard back to
	// 0% on every reconnect.
	//
	// Projected from the `SeederJob` DDB row, MINUS two things it must never carry:
	//   - `profile`   — the tenant's own input; echoing it back is pointless and widens
	//                   the PII surface of a response that gets cached client-side.
	//   - `executionArn` — an internal infrastructure id. Never hand a tenant an ARN.
	interface SeedJobState extends SeedJobHandle {
		phase: SeedPhase;
		completed: number;
		total: number;
		costUsd?: number;
		/**
		 * `true` once the drafts have actually been copied into the live partitions.
		 *
		 * `status: 'done'` alone CANNOT tell you this — it means "generation finished",
		 * and it keeps saying that after the commit too. Without this flag the FE can't
		 * tell a job that is READY to commit from one already committed, so the wizard
		 * offers "Confirmar" a second time and the tenant earns a 409.
		 *
		 * Derived server-side from an internal marker; the timestamp itself never ships.
		 */
		committed?: boolean;
		/** Preview cards streamed so far. EMPTY until the stage workers write `SEED_DRAFT#` rows (api#1080). */
		samples?: SeedSampleCard[];
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

	// WSS payload — mirrors the shipped FE shape
	// (`seederSchema.ts::seedProgressEventSchema`). Delivered as
	// `{ action: 'seed_progress', data: SeedProgressEvent }` over the existing
	// `ws-message` pipeline (api#1082) — no direct ApiGatewayManagementApi calls.
	//
	// ⚠️ THIS IS THE SEEDER'S *ONLY* WS ACTION (resolved 2026-07-14, api#1079 preflight).
	// There is no `seed.started` and no `seed_complete` — earlier AC on api#1079/#1081/
	// #1082 named them, but no such wire type ever existed here and no FE handler ever
	// listened for them. The job's whole lifecycle rides `phase`:
	//   start    → `phase: 'planning'`, `completed: 0`
	//   progress → `phase: 'generating' | 'streaming' | …` + `sample`
	//   done     → `phase: 'done'`   + `summary`
	//   failure  → `phase: 'error'`  + `error`
	// This maps 1:1 onto the shipped FE reducer (`seederProgress.ts`) with zero new types.
	interface SeedProgressEvent {
		jobId: string;
		phase: SeedPhase;
		currentLabel?: string;
		completed: number;
		total: number;
		etaMs?: number;
		sample?: SeedSampleCard;
		error?: string;
		// Set on the TERMINAL `phase: 'done'` frame only. Additive and safe against the
		// shipped FE: `seedProgressEventSchema` is a plain `z.object`, which STRIPS
		// unknown keys rather than rejecting — so an old FE `safeParse`s this fine and
		// simply ignores the field until app#1470 reads it.
		summary?: SeedSummary;
	}
}

export {}; // NOSONAR
