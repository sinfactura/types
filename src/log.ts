
declare global {

	interface Log {
		storeId: string;
		logId: string;
		createdAt: number;
		updatedAt: number;
		dated: number; // YYYYMMDD
		mode?: string;
		userId?: string;
		customerId?: string;
		fullName?: string;
		url: string;
		details?: string;
		moreDetails?: string;
		ip: string;
		action?: string; // socket-only field
		screenType?: 'mobile' | 'tablet' | 'desktop'; // mobile < smDown > tablet < mdDown > desktop
		screenSize?: number; // screen width in px
		appVersion?: number; // e.g. 1.10
	}

}

export {}; // NOSONAR
