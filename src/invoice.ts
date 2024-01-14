
declare global {

	interface Invoice {
		storeId: string;
		invoiceId: string; // ID
		customerId: string; // CLIENTE_ID
		orderId: string; // PEDIDO_ID
		createdAt: number; // FECHA
		dated: number;

		invoiceType: number; // CBTE_TIPO / 1 FAC A  / 6 FAC B
		pointOfSale: number; // PTO_VTA
		invoiceNumber: number; // CBTE_NUMERO
		razonSocial: string; // RAZON_SOCIAL
		address: string; // address and postalCode
		location: string; // city and province
		concept: number; // CONCEPTO 1 productos 2 servicios
		cuitType: number; // CUIT_TIPO
		cuit: number; // CUIT CF?
		currency?: 'PES' | 'DOL';
		currencyValue?: number;
		fiscalCondition: string; // COND_FISCAL / RESPONSABLE INSCRIPTO
		paymentCondition: string; // COND_VENTA
		deliveryCondition: string; // COND_ENTREGA

		items: InvoiceItem[];
		neto10: number; // NETO10
		neto21: number; // NETO21
		iva10: number;
		iva21: number;
		total: number; // IMP_TOTAL

		cae: string; // CAE
		caeExpiration: string; // CAE_VENCIMIENTO
		observations?: string; // afip observations
	}

	interface InvoiceItem {
		code: string;
		description: string;
		quantity: number;
		iva: number;
		neto: number;
	}

	interface InvoiceWithCustomer extends Invoice { customer: Customer }

	interface ResponseMakeAfip {
		cae: string;
		caeExpiration: string;
		invoiceNumber: number;
		fiscalCondition: FiscalCondition;
		netos: Neto;
		ivaTypes: Method[];
		currency: 'PES' | 'DOL';
		currencyValue: number;
		total: number;
		observations?: string;
		invoiceType: number;
	}

	type Neto = Record<string, { Id: number, BaseImp: number, Importe: number }>;

}

export { };