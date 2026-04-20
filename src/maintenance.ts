declare global {
  type MaintenanceLevel = 'platform' | 'store' | null;

  interface MaintenanceInfo {
    level: MaintenanceLevel;
    message?: string;
    startedAt?: number;
    startedBy?: { userId: string; fullName: string };
  }
}

export {};
