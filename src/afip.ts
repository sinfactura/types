declare global {
  interface AfipImpuesto {
    descripcionImpuesto: string;
    idImpuesto: number;
    periodo: number;
  }
  interface AfipActividad {
    descripcionActividad: string;
    idActividad: number;
    nomenclador: number;
    orden: number;
    periodo: number;
  }
  interface AfipErrorConstancia {
    apellido?: string;
    error: string[];
    idPersona: number;
    nombre?: string;
    razonSocial?: string;
  }
  interface AfipDomicilioFiscal {
    codPostal: string;
    datoAdicional?: string;
    descripcionProvincia: string;
    direccion: string;
    idProvincia: number;
    localidad?: string;
    tipoDatoAdicional?: string;
    tipoDomicilio: string; // FISCAL
  }
  interface AfipDatosGenerales {
    apellido?: string;
    domicilioFiscal: AfipDomicilioFiscal;
    esSucesion: string; // NO || SI
    estadoClave: string; // ACTIVO
    fechaContratoSocial?: string; // 2007-05-28T15:00:00.000Z
    idPersona: number;
    mesCierre: number;
    razonSocial?: string;
    nombre?: string;
    tipoClave: string; // CUIT || CUIL
    tipoPersona: "FISICA" | "JURIDICA";
  }
  interface AfipCategoria {
    descripcionCategoria: string;
    idCategoria: number;
    idImpuesto: number;
    perdiodo: number;
  }
  interface AfipRegimen {
    descripcionRegimen: string;
    idImpuesto: number;
    idRegimen: number;
    periodo: number;
    tipoRegimen?: string; // RETENCION ||
  }
  interface AfipDatosMonotributo {
    actividad?: AfipActividad[];
    actividadMonotributista: AfipActividad;
    categoriaMonotributo: AfipCategoria;
    impuestos?: AfipImpuesto[]; // this is not in the documentation
    impuesto: AfipImpuesto[];
  }
  interface AfipDatosRegimenGeneral {
    actividad: AfipActividad[];
    categoriaAutonomo?: AfipCategoria;
    impuesto: AfipImpuesto[];
    regimen?: AfipRegimen[];
  }
  interface AfipErrorRegimenGeneral {
    error: string[];
    mensaje: string;
  }

  interface CuitAfip {
    datosGenerales?: AfipDatosGenerales;
    datosMonotributo?: AfipDatosMonotributo;
    datosRegimenGeneral?: AfipDatosRegimenGeneral;
    errorConstancia?: AfipErrorConstancia;
    errorRegimenGeneral?: AfipErrorRegimenGeneral;
  }
}

export {};
