
declare global {
	interface Login {
		email: string;
		password: string;
	}

	interface Social {
		accessToken?: string;
	}

	interface Register {
		email: string;
		password: string;
		cuit: string;
		fullName: string;
		phone?: string;
	}

	interface Recover {
		email: string;
	}

}

export {}; // NOSONAR