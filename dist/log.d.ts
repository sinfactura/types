declare global {
    interface Log {
        storeId: string;
        logId: string;
        createdAt: number;
        updatedAt: number;
        dated: number;
        mode?: string;
        userId?: string;
        customerId?: string;
        fullName?: string;
        url: string;
        details?: string;
        moreDetails?: string;
        ip: string;
        action?: string;
        screenType?: 'mobile' | 'tablet' | 'desktop';
        screenSize?: number;
        appVersion?: number;
        /**
         * How many times this condition was seen, on rows the BE writes under a
         * dedupe key (one row per store per kind per day). `1` on the first
         * sighting; every repeat within the same day increments it instead of
         * writing another row.
         *
         * ⚠️ Absent on every other row, and on deduped rows written before this
         * field existed — writes are forward-only and never migrated. Treat
         * absent as "not counted", never as zero occurrences.
         */
        occurrences?: number;
        /**
         * When this condition was last seen, epoch ms. Moves on every repeat;
         * `createdAt` keeps the FIRST sighting, whose details the row carries.
         *
         * The pair is what makes a standing condition legible without a row per
         * occurrence: `createdAt` says when it started, this says whether it is
         * still happening, and `occurrences` says how hard. A reader that shows
         * only `createdAt` on a deduped row is reporting the morning's failure
         * at midnight.
         *
         * ⚠️ Same absence rule as `occurrences`.
         */
        lastSeenAt?: number;
    }
}
export {};
