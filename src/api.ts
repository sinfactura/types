
declare global {

	interface ResponseApi<T = Record<string, string>> {
		status: boolean;
		error: string | null;
		message: string | null;
		data: T;
		ConsumedCapacity?: Record<string, string | number>;
		LastEvaluatedKey?: Record<string, string>;
	}

}

export {}; // NOSONAR