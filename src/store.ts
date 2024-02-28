
declare global {

	interface Config {
		appVersion: number;
		fiscalConditions: FiscalCondition[];
		ivaTypes: Method[];
		minWithDni: number;
		notificationOptions: Method[];
		stats: {
			store: number;
		};
	}

	interface Ecommerce {
		isActive?: boolean;
		prices: {
			requireLogin?: boolean;
		};
		sideBar?: {
			show?: boolean;
			showCategories?: boolean;
			showBrands?: boolean;
			showIncomes?: boolean;
			showFavorites?: boolean;
			showBasket?: boolean;
			showOrders?: boolean;
			showInvoices?: boolean;
		};
		footerBar?: {
			show?: boolean;
			showOrders?: boolean;
			showInvoices?: boolean;
			showBasket?: boolean;
			showFavorites?: boolean;
		}
		themeColors?: {
			main?: string;
			navbar?: string;
		};
		appVersion?: number;
		stats?: Record<string, string>;
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
		// ECOMMERCE
		ecommerce?: Ecommerce;
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
		afip: Afip;
		// FROM CONFIG
		appVersion: number;
		ivaTypes: Method[];
		fiscalConditions: FiscalCondition[];
		minWithDni: number;
		notificationOptions?: {
			id: string;
			name: string;
		}[];
	}

	interface Afip {
		production: boolean;
		// ADDRESS
		address?: string;
		city?: string;
		condFiscal?: number;
		cuit?: number;
		condFiscalName?: string;
		postalCode?: string;
		province?: string;
		razonSocial?: string;
		// NEW
		pointOfSale?: number; // PTO_VTA
		activitiesStartedAt?: number; // INICIO_ACTIVIDADES
		invoiceNote?: string; // NOTA EN FACTURA
		showInvoiceLogo?: string; // logo en factura
		currency: 1 | 2; // 1 PESOS, 2 DOLARES
		// ACCESS
		cert?: string;
		csr?: string;
		key?: string;
		accessTicket_EB?: string;
		accessTicket_RSF?: string;
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