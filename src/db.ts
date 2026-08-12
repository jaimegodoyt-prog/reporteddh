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
    horometroInicial: raw.horometroInicial ?? null,
    horometroFinal: raw.horometroFinal ?? null,
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
    programado: null,
    casingDiametro: "",
    casingProfundidad: null,
    barril: null,
    muerto: null,
    casing: [],
    horometroInicial: null,
    horometroFinal: null,
    inicializado: false,
    operador: "",
    ayudante1: "",
    ayudante2: "",
    ayudante3: "",
    tramos: [],
    herramientas: [],
    historialRelevos: [],
    bitacora: [],
    insumos: [],
    dieselLitros: null,
    otrosInsumos: [],
    observaciones: "",
    firmaDataURL: null,
    audit: [
      { timestamp: ahora, accion: "turno_creado", detalle: "Turno creado localmente" },
    ],
    iniciadoEn: null,
    cerradoEn: null,
    cloudId: id,
  };
}

export async function cargarTurnoActual(): Promise<Turno> {
  // 1) localStorage primero — recuperación instantánea en la tablet
  const desdeLS = cargarTurnoLocalStorage();
  if (desdeLS && desdeLS.estado !== "cerrado") {
    const turno = normalizarTurno(desdeLS);
    getDB()
      .then((db) => db.put("turnos", turno))
      .catch(() => {});
    return turno;
  }

  const db = await getDB();
  const todos = await db.getAll("turnos");
  const abiertos = todos.filter((t) => t.estado !== "cerrado");
  if (abiertos.length > 0) {
    const turno = normalizarTurno(abiertos.sort((a, b) => (b.fecha > a.fecha ? 1 : -1))[0]);
    guardarTurnoLocalStorage(turno);
    return turno;
  }
  // Crear nuevo heredando profundidad inicial del último cerrado
  const cerrados = todos.filter((t) => t.estado === "cerrado");
  let profundidadInicial: number | null = null;
  if (cerrados.length > 0) {
    const ultimo = cerrados.sort((a, b) => (b.fecha > a.fecha ? 1 : -1))[0];
    const ultimoTramo = ultimo.tramos[ultimo.tramos.length - 1];
    if (ultimoTramo) {
      profundidadInicial = ultimoTramo.fondo;
    }
  }
  const nuevo = crearTurnoNuevo(profundidadInicial);
  guardarTurnoLocalStorage(nuevo);
  await db.put("turnos", nuevo);
  return nuevo;
}

export async function guardarTurno(turno: Turno): Promise<void> {
  guardarTurnoLocalStorage(turno);
  const db = await getDB();
  await db.put("turnos", turno);
}

export function pushAudit(turno: Turno, accion: string, detalle: string): Turno {
  const entry: AuditEntry = { timestamp: ahoraISO(), accion, detalle };
  return { ...turno, audit: [...turno.audit, entry] };
}

export async function cerrarTurno(turno: Turno): Promise<Turno> {
  const conAudit = pushAudit(turno, "turno_cerrado", "Reporte inmutable generado");
  const cerrado: Turno = {
    ...conAudit,
    estado: "cerrado",
    cerradoEn: ahoraISO(),
  };
  await guardarTurno(cerrado);
  return cerrado;
}

export async function contarTurnosCerrados(): Promise<number> {
  const db = await getDB();
  const todos = await db.getAll("turnos");
  return todos.filter((t) => t.estado === "cerrado").length;
}

/**
 * Busca en el historial local de la tablet (todos los turnos ya guardados en
 * este dispositivo, sin necesidad de señal) los últimos turnos que
 * trabajaron el mismo número de pozo. Se usa para autocompletar datos al
 * iniciar un turno nuevo sobre un pozo ya conocido por esta tablet.
 */
export async function buscarUltimosTurnosPorPozo(
  pozo: string,
  cantidad: number = 2,
): Promise<Turno[]> {
  const pozoNorm = pozo.trim().toLowerCase();
  if (!pozoNorm) return [];
  const db = await getDB();
  const todos = await db.getAll("turnos");
  return todos
    .filter((t) => t.pozo.trim().toLowerCase() === pozoNorm && t.estado !== "borrador")
    .sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0))
    .slice(0, cantidad)
    .map(normalizarTurno);
}

/**
 * Busca en el historial local de la tablet el último "Horómetro Final"
 * registrado, sin importar el pozo — el horómetro es correlativo del
 * equipo completo, no de un pozo en particular.
 */
export async function buscarUltimoHorometroFinal(): Promise<number | null> {
  const db = await getDB();
  const todos = await db.getAll("turnos");
  let ultimoValor: number | null = null;
  let ultimaFecha = "";
  for (const t of todos) {
    if (t.horometroFinal == null) continue;
    if (t.fecha > ultimaFecha) {
      ultimaFecha = t.fecha;
      ultimoValor = t.horometroFinal;
    }
  }
  return ultimoValor;
}
export async function buscarUltimaHerramientaPorTipo(
  tipo: HerramientaTipo,
): Promise<HerramientaFila | null> {
  const db = await getDB();
  const todos = await db.getAll("turnos");
  let ultima: HerramientaFila | null = null;
  for (const t of todos) {
    for (const h of t.herramientas ?? []) {
      if (h.tipo !== tipo) continue;
      if (!ultima || h.creadoEn > ultima.creadoEn) ultima = h;
    }
  }
  return ultima;
}