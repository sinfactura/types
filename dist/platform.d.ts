export interface PlatformConfigEntry {
    key: string;
    valueType: 'boolean' | 'string' | 'number';
    kind: 'setting' | 'flag';
    value: string | number | boolean;
    defaultValue: string | number | boolean;
    scope: 'app' | 'web' | 'landing' | 'storefront';
    description?: string;
    min?: number;
    max?: number;
    updatedBy?: string;
    updatedAt?: number;
    previousValue?: string | number | boolean;
    source: 'default' | 'override';
}
export interface PlatformGlobalsPostBody {
    globals: Record<string, {
        value: string | number | boolean | null;
        valueType: 'boolean' | 'string' | 'number';
        kind: 'setting' | 'flag';
        scope: 'app' | 'web' | 'landing' | 'storefront';
    }>;
}
export interface PlatformProviderHealth {
    tenantsConnected: number;
    /** 24h success ratio in [0, 1] (a fraction, NOT a percentage). */
    syncSuccessRate24h?: number;
    /** Integer milliseconds. */
    p95LatencyMs?: number;
    /** Shared platform DLQ depth — the same value is repeated on every provider row. */
    dlqDepth: number;
    /** Epoch ms of the most recent error datapoint in the 24h window. */
    lastIncidentAt?: number;
    refreshFailures24h: number;
    killSwitchEnabled?: boolean;
}
export type PlatformIntegrationsAggregate = Record<string, PlatformProviderHealth>;
