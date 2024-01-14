
declare global {

	interface CustomerAfip {
		cuit: number;
		razonSocial: string;
		condFiscal: number;
		condFiscalName: string;
		address: string;
		postalCode: string;
		city: string;
		province: string;
	}

	interface Customer {
		storeId: string;
		customerId: string;
		disabled: boolean;
		search: string;
		photoURL: string;
		fullName: string;
		cuit: string;
		phone: string;
		email: string;
		address: string;
		postalCode: string;
		city: string;
		province: string;
		discount: number;
		minBuy?: number;
		priceList: number;
		paymentMethod: number;
		deliveryMethod: number;
		afip: CustomerAfip[]
		createdAt: number;
		updatedAt?: number;
		lastBuy?: number;
		lastLog?: number;
		hash?: string;
		salt?: string;
		balance?: number;
		favorites?: Favorite[];
	}

	interface Favorite {
		productId: string;
		dated: number;
		name: string;
	}

}

export { };