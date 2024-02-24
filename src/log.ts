
declare global {

	interface Log {
		storeId: string;
		logId: string;
		createdAt: number; // timestamp
		dated: number; // 20220924
		mode?: string;
		userId?: string;
		customerId?: string;
		customerName?: string;
		url: string;
		details?: string;
		moreDetails?: string;
		ip: string;
	}

}

export { };