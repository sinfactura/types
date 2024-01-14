
declare global {

	interface CuitAfip {
		errorConstancia?: {
			apellido: string,
			error: string,
			idPersona: string,
			nombre: string
		},
		datosGenerales?: {
			apellido?: string,
			domicilioFiscal: {
				codPostal: string,
				datoAdicional?: string,
				descripcionProvincia: string,
				direccion: string,
				idProvincia: number,
				localidad?: string,
				tipoDatoAdicional?: string,
				tipoDomicilio: string
			},
			estadoClave: string,
			fechaContratoSocial?: string
			idPersona: string,
			mesCierre: number,
			razonSocial?: string,
			nombre?: string,
			tipoClave: string,
			tipoPersona: 'FISICA' | 'JURIDICA'
		},
		datosMonotributo?: {
			actividad?: {
				descripcionActividad: string,
				idActividad: number,
				nomenclador: number,
				orden: number,
				periodo: number
			}[],
			actividadMonotributista: {
				descripcionActividad: string,
				idActividad: number,
				nomenclador: number,
				orden: number,
				periodo: number
			},
			categoriaMonotributo: {
				descripcionCategoria: string,
				idCategoria: number,
				idImpuesto: number,
				perdiodo: number
			},
			impuestos: {
				descripcionImpuesto: string,
				idImpuesto: number,
				periodo: number
			}[],
			impuesto: {
				descripcionImpuesto: string,
				idImpuesto: number,
				periodo: number
			}[]
		},
		datosRegimenGeneral?: {
			actividad: {
				descripcionActividad: string,
				idActividad: number,
				nomenclador: number,
				orden: number,
				periodo: number
			}[],
			impuesto: {
				descripcionImpuesto: string,
				idImpuesto: number,
				periodo: number
			}[],
			regimen?: {
				descripcionRegimen: string,
				idImpuesto: number,
				idRegimen: number,
				periodo: number
			}[]
		},
	}
}

export { };