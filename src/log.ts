
declare global {

	interface Log {
		storeId: string;
		logId: string;
		createdAt: number; // timestamp
		dated: number; // 20220924
		userId: string;
		customerId?: string;
		customerName?: string;
		url: string;
		details?: string;
		moreDetails?: string;
	}

}

export { };