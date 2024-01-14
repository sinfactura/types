
declare global {

	interface Cash {
		storeId: string;
		cashId: string;
		createdAt: number; //timeStamp
		dated: number; // 20220123
		description: string;
		income?: number;
		outcome?: number;
		balance?: number;
		subject?: string;
	}

}

export { };