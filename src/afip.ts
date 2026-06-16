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

  /**
   * Cached AFIP/ARCA platform-wide health snapshot (api#1213). One DDB row
   * (PK 'AFIP_HEALTH', SK 'current') overwritten every ~5 min by the
   * afipHealthPoller cron; served by anonymous GET /afip/health behind the
   * public /estado page. Each *Server is 'OK' when healthy, else an AFIP-side
   * status code. BE-internal name: AfipHealthSnapshot.
   */
  interface AfipHealth {
    appServer: string;
    authServer: string;
    dbServer: string;
    // Epoch ms of the last poll where all three servers returned 'OK';
    // preserved across failed polls. Absent until the first all-green poll.
    lastSuccessAt?: number;
    // Epoch ms of this snapshot's write. Always present (0 in the UNKNOWN
    // cold-start fallback before the poller has written a row).
    fetchedAt: number;
  }
}

export {}; // NOSONAR