import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Turno, AuditEntry, Tramo, CasingRow, HerramientaFila, HerramientaTipo } from "@/types";
import { ADMIN_CONFIG, HERRAMIENTAS_INICIALES, uid, ahoraISO } from "@/config";

interface DiamantinaDB extends DBSchema {
  turnos: {
    key: string;
    value: Turno;
  };
}

const DB_NAME = "diamantina-db";
const DB_VERSION = 1;

/** Respaldo instantáneo en localStorage (sobrevive desconexión de la tablet). */
export const LOCAL_TURNO_KEY = "diamantina_turno_actual";

export function guardarTurnoLocalStorage(turno: Turno): void {
  try {
    localStorage.setItem(LOCAL_TURNO_KEY, JSON.stringify(turno));
  } catch {
    // Cuota llena o almacenamiento no disponible
  }
}

function normalizarTramo(raw: any): Tramo {
  // Compatibilidad con tramos guardados antes del rediseño (columnas
  // desde/hasta/herramientaActiva) — se traducen a la nueva estructura.
  const htaDesde = raw.htaDesde ?? raw.desde ?? 0;
  const agrega = raw.agrega ?? null;
  const totalHta = raw.totalHta ?? htaDesde + (agrega ?? 0);
  const fondo = raw.fondo ?? raw.hasta ?? htaDesde;
  return {
    id: raw.id,
    htaDesde,
    agrega,
    totalHta,
    fondo,
    resta: raw.resta ?? null,
    perf: raw.perf ?? null,
    recuperacion: raw.recuperacion ?? null,
    tipoRoca: raw.tipoRoca ?? "",
    creadoEn: raw.creadoEn ?? ahoraISO(),
  };
}

function normalizarCasingRow(raw: any): CasingRow {
  return {
    id: raw.id,
    diametro: raw.diametro ?? "",
    desde: raw.desde ?? 0,
    agrega: raw.agrega ?? null,
    total: raw.total ?? (raw.desde ?? 0) + (raw.agrega ?? 0),
    creadoEn: raw.creadoEn ?? ahoraISO(),
  };
}

function normalizarHerramienta(raw: any): HerramientaFila {
  // Compatibilidad con herramientas guardadas antes del rediseño (sin id,
  // sin estado/desde/hasta, tipo "tricono/escareador/corona" solamente).
  return {
    id: raw.id ?? uid(),
    tipo: (raw.tipo as HerramientaTipo) ?? "corona",
    diametro: raw.diametro ?? "",
    marca: raw.marca ?? "",
    serie: raw.serie ?? "",
    estado: raw.estado ?? "Usado",
    desde: raw.desde ?? 0,
    hasta: raw.hasta ?? 0,
    creadoEn: raw.creadoEn ?? raw.actualizadaEn ?? ahoraISO(),
  };
}

function normalizarTurno(raw: Turno): Turno {
  const insumosRaw = Array.isArray(raw.insumos) ? raw.insumos : [];
  const insumosVistos = new Set<string>();
  const insumos = insumosRaw.filter((i) => {
    if (!i?.id || insumosVistos.has(i.id)) return false;
    insumosVistos.add(i.id);
    return true;
  });

  return {
    ...raw,
    tramos: Array.isArray(raw.tramos) ? raw.tramos.map(normalizarTramo) : [],
    bitacora: Array.isArray(raw.bitacora) ? raw.bitacora : [],
    insumos,
    herramientas: Array.isArray(raw.herramientas) ? raw.herramientas.map(normalizarHerramienta) : [],
    historialRelevos: Array.isArray(raw.historialRelevos) ? raw.historialRelevos : [],
    audit: Array.isArray(raw.audit) ? raw.audit : [],
    observaciones: raw.observaciones ?? "",
    firmaDataURL: raw.firmaDataURL ?? null,
    programado: raw.programado ?? null,
    casingDiametro: raw.casingDiametro ?? "",
    casingProfundidad: raw.casingProfundidad ?? null,
    barril: raw.barril ?? null,
    muerto: raw.muerto ?? null,
    casing: Array.isArray(raw.casing) ? raw.casing.map(normalizarCasingRow) : [],
    dieselLitros: raw.dieselLitros ?? null,
    otrosInsumos: Array.isArray(raw.otrosInsumos) ? raw.otrosInsumos : [],
  };
}

export function cargarTurnoLocalStorage(): Turno | null {
  try {
    const raw = localStorage.getItem(LOCAL_TURNO_KEY);
    if (!raw) return null;
    return normalizarTurno(JSON.parse(raw) as Turno);
  } catch {
    try {
      localStorage.removeItem(LOCAL_TURNO_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}

let dbPromise: Promise<IDBPDatabase<DiamantinaDB>> | null = null;

function getDB(): Promise<IDBPDatabase<DiamantinaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DiamantinaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("turnos")) {
          db.createObjectStore("turnos", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

function crearTurnoNuevo(profundidadInicial: number | null = null): Turno {
  const ahora = ahoraISO();
  const id = uid();
  return {
    id,
    fecha: ahora,
    estado: "borrador",
    equipo: ADMIN_CONFIG.equipo,
    faena: ADMIN_CONFIG.faena,
    sector: "",
    diametro: "",
    pozo: "",
    orientacion: "",
    profundidadInicial,
    programado: