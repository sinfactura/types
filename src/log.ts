
declare global {

	interface Log {
		storeId: string;
		logId: string;
		createdAt: number; // timestamp
		dated: number; // 20220924
		mode?: string;
		userId?: string;
		customerId?: string;
		fullName?: string;
		url: string;
		details?: string;
		moreDetails?: string;
		ip: string;
		action?: string; // only to send the socket
	}

}

export { };