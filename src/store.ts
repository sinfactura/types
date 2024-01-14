
declare global {

	interface Config {
		storeId: number;
		appVersion: number;
		fiscalConditions: FiscalCondition[];
		ivaTypes: Method[];
		notificationOptions: Method[];
		stats: {
			store: number;
		};
	}

	interface Store {
		storeId: string;
		createdAt: number;
		name: string;
		address: {
			street: string;
			postalCode: string;
			city: string;
			province: string;
		};
		cuit: number;
		phone: number;
		email: string;
		// CONFIG
		config: {
			priceDecimals: 0 | 1 | 2 | 3;
			stock: boolean;
			changePrice: boolean;
			currency: number;
		};
		// HANDLE IMAGES
		photoURL: string;
		photoData?: string;
		newPhotoURL?: string;
		removePhotoURL?: string;
		// GENERAL
		currencies: Method[];
		cashInMethods: Method[];
		cashOutMethods: Method[];
		debitMethods: Method[];
		// CUSTOMERS
		priceLists: Method[];
		accountMethods: Method[];
		deliveryMethods: Method[];
		paymentMethods: Method[];
		// PRODUCTS
		brands: Brand[];
		categories: Category[];
		// COLORS
		themeColors?: {
			main?: string;
			navbar?: string;
		};
		stats: {
			customers?: number;
			invoices?: number;
			orders?: number;
			products?: number;
			users?: number;
		};
		mercadopago?: {
			accessToken?: string;
			code?: string;
			refreshToken?: string;
		};
		// AFIP
		afip: {
			// ADDRESS
			address?: string;
			city?: string;
			condFiscal?: number;
			cuit?: number;
			condFiscalName?: string;
			postalCode?: string;
			province?: string;
			razonSocial?: string;
			// new
			pointOfSale?: number; // PTO_VTA
			activitiesStartedAt?: number; // INICIO_ACTIVIDADES
			invoiceNote?: string; // NOTA EN FACTURA
			showInvoiceLogo?: string; // logo en factura
			// ACCESS
			cert?: string;
			csr?: string;
			key?: string;
			accessTicket_EB?: string;
			accessTicket_RSF?: string;
		};
		// FROM CONFIG
		appVersion: number;
		ivaTypes: Method[];
		fiscalConditions: FiscalCondition[];
		notificationOptions?: {
			id: string;
			name: string;
		}[];
		minWithDni: number;
	}

	type StoreAttributeNames = keyof Store;

	interface Method {
		id: number;
		name: string;
		value?: number;
		removable?: boolean;
		editable?: boolean;
	}

	interface Category {
		categoryId: number;
		name: string;
		photoURL?: string;
		photoData?: string;
		removePhotoURL?: string;
		isFather?: boolean;
		father?: number;
		disabled?: boolean;
		isNew?: boolean;
	}
	interface Brand {
		brandId: number;
		name: string;
		photoURL?: string;
		photoData?: string;
		removePhotoURL?: string;
		isFather?: boolean;
		father?: number;
		disabled?: boolean;
		isNew?: boolean;
	}

	interface FiscalCondition {
		CbteTipo: {
			FAC: number;
			NC: number,
			ND: number;
			NVC: number;
			REC: number;
		};
		DocTipo: number;
		condFiscal: number;
		id: number;
		name: string;
	}

}

export { };