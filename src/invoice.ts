
declare global {

	interface Invoice {
		storeId: string;
		invoiceId: string;
		customerId: string;
		createdAt: number;
		dated: number;
		invoiceType: number; // CBTE_TIPO / 1 FAC A  / 6 FAC B
		pointOfSale: number; // PTO_VTA
		invoiceNumber: number; // CBTE_NUMERO
		razonSocial: string;
		address: string; // address and postalCode
		location: string; // city and province
		concept: number; // CONCEPTO / 1 productos 2 servicios
		cuitType: number; // CUIT_TIPO / 80 cuit
		cuit: number; // CUIT or undefined when is consumidor final
		currency: 'PES' | 'DOL';
		currencyValue?: number;
		fiscalCondition: string; // COND_FISCAL / RESPONSABLE INSCRIPTO
		paymentCondition: string; // COND_VENTA
		deliveryContition: string; // COND_ENTREGA
		items: InvoiceItem[];
		neto: number;
		neto10: number;
		neto21: number;
		iva10: number;
		iva21: number;
		iva: number;
		total: number;
		dolar: number;
		cae: string; // CAE
		caeExpiration: string; // CAE_VENCIMIENTO
	}

	interface InvoiceItem {
		code: string;
		description: string;
		quantity: number;
		iva: number;
		neto: number;
	}

}

export { };