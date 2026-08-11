export type HerramientaTipo = "tricono" | "escareador" | "corona";

export interface Herramienta {
  tipo: HerramientaTipo;
  diametro: string;
  marca: string;
  serie: string;
  actualizadaEn: string;
}

export interface Tramo {
  id: string;
  desde: number;
  hasta: number | null;
  herramientaActiva: HerramientaTipo;
  recuperacion: number | null;
  resta: number | null;
  creadoEn: string;
}

export interface CambioOperador {
  id: string;
  operador: string;
  ayudante1: string;
  ayudante2: string;
  ayudante3: string;
  registradoEn: string;
  motivo: string;
}

export interface CambioHerramientaLog {
  id: string;
  tipo: HerramientaTipo;
  diametro: string;
  marca: string;
  serie: string;
  operador: string;
  cambiadoEn: string;
}

export type CargoHora = "propia" | "cliente";

export interface ActividadBitacora {
  id: string;
  horaDesde: string; // HH:MM
  horaHasta: string | null;
  codigoOperacion: string;
  detalle: string;
  cargoHora: CargoHora;
  creadoEn: string;
}

export type UnidadInsumo = "Saco" | "Litro" | "Balde" | "Barra";

export interface Insumo {
  id: string;
  nombre: string;
  unidad: UnidadInsumo;
  cantidad: number | null;
  creadoEn: string;
}

export interface AuditEntry {
  timestamp: string;
  accion: string;
  detalle: string;
}

export interface Turno {
  id: string;
  fecha: string;
  estado: "borrador" | "iniciado" | "cerrado";

  // Campos fijos (admin) - no editables
  equipo: string;
  faena: string;

  // Campos de inicio de turno (se congelan tras primer guardado)
  sector: string;
  diametro: string;
  pozo: string;
  orientacion: string;
  profundidadInicial: number | null;
  programado: number | null;
  casingDiametro: string;
  casingProfundidad: number | null;
  inicializado: boolean;

  // Operadores (editables en cualquier momento)
  operador: string;
  ayudante1: string;
  ayudante2: string;
  ayudante3: string;

  // Relacional
  tramos: Tramo[];
  herramientas: Herramienta[];
  historialRelevos: CambioOperador[];
  historialHerramientas: CambioHerramientaLog[];
  bitacora: ActividadBitacora[];
  insumos: Insumo[];
  observaciones: string;
  firmaDataURL: string | null;

  // Audit
  audit: AuditEntry[];

  iniciadoEn: string | null;
  cerradoEn: string | null;
  cloudId: string | null;
}
