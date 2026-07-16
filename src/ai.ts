// AI platform-spend contracts (api#1788; MANAGER dashboard app#1044).

declare global {
	// Wire shape of `GET /platform/ai-usage` (managerToken). Aggregated from the
	// AI cost-meter rows (api#1078) — every field is always present (the `by*`
	// arrays are empty, never absent, on no data).
	//
	// - `from` / `to` echo the queried range as `YYYYMMDD` (Buenos Aires dating),
	//   NOT ISO dates.
	// - `costUsd` / `totalUsd` are raw platform USD, server-rounded to 6 dp.
	// - `budget` echoes the configured daily ceilings; `utilizationPct` /
	//   `peakDailyUtilizationPct` are day-spend against the GLOBAL daily ceiling
	//   (1 dp; `0` when no days or no ceiling).
	interface AiUsageReport {
		from: string;
		to: string;
		totalUsd: number;
		budget: { globalDailyCeilingUsd: number; tenantDailyCeilingUsd: number };
		peakDailyUtilizationPct: number;
		byFeature: Array<{ featureKey: string; costUsd: number }>;
		byModel: Array<{ model: string; costUsd: number }>;
		byTenant: Array<{ storeId: string; costUsd: number }>;
		byFeatureModel: Array<{ featureKey: string; model: string; costUsd: number }>;
		byDay: Array<{ dated: string; costUsd: number; utilizationPct: number }>;
	}
}

export {}; // NOSONAR
