import { supabase, getSupabaseConfigError } from "@/supabaseClient";
import type { Turno, Tramo, CasingRow, ActividadBitacora, Insumo } from "@/types";

export type SyncResult = {
  ok: boolean;
  error: string | null;
  id?: string;
  offline?: boolean;
};

// Cola de registros pendientes de sincronización (offline-first).
const COLA_KEY = "diamantina_cola_sync";

type ItemCola = {
  id: string;
  tipo: "reporte" | "tramo" | "bitacora" | "insumos" | "casing";
  turnoId: string;
  payload: unknown;
  orden?: number;
  intentos: number;
  creadoEn: string;
};

function cargarCola(): ItemCola[] {
  try {
    const raw = localStorage.getItem(COLA_KEY);
    return raw ? (JSON.parse(raw) as ItemCola[]) : [];
  } catch {
    return [];
  }
}

function guardarCola(cola: ItemCola[]): void {
  try {
    localStorage.setItem(COLA_KEY, JSON.stringify(cola));
  } catch {
    // localStorage lleno o no disponible
  }
}

function encolar(item: Omit<ItemCola, "id" | "intentos" | "creadoEn">): void {
  const cola = cargarCola();
  cola.push({
    ...item,
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    intentos: 0,
    creadoEn: new Date().toISOString(),
  });
  guardarCola(cola);
}

export function colaPendiente(): number {
  return cargarCola().length;
}

export async function reintentarCola(): Promise<{ ok: number; fallidos: number }> {
  const cola = cargarCola();
  if (cola.length === 0) return { ok: 0, fallidos: 0 };

  let okCount = 0;
  let fallidos = 0;
  const restantes: ItemCola[] = [];

  for (const item of cola) {
    item.intentos++;
    let r: SyncResult;
    if (item.tipo === "reporte") {
      r = await syncReporteDirecto(item.payload as Turno);
    } else if (item.tipo === "tramo") {
      r = await syncTramoDirecto(item.payload as Tramo, item.turnoId);
    } else if (item.tipo === "bitacora") {
      r = await syncActividadDirecto(item.payload as ActividadBitacora, item.turnoId);
    } else if (item.tipo === "insumos") {
      const payload = item.payload;
      if (payload && typeof payload === "object" && "_delete" in (payload as object)) {
        r = await deleteInsumoDirecto((payload as { id: string }).id);
      } else if (payload && typeof payload === "object" && "insumos" in (payload as Turno)) {
        r = await syncInsumosDirecto(payload as Turno);
      } else {
        r = await syncInsumoDirecto(payload as Insumo, item.turnoId);
      }
    } else if (item.tipo === "casing") {
      r = await syncCasingDirecto(item.payload as CasingRow, item.turnoId);
    } else {
      r = { ok: false, error: "tipo de cola desconocido" };
    }

    if (r.ok) {
      okCount++;
    } else {
      restantes.push(item);
      fallidos++;
    }
  }

  guardarCola(restantes);
  return { ok: okCount, fallidos };
}

function esErrorDeRed(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    msg.includes("ERR_NETWORK") ||
    msg.includes("Load failed") ||
    msg.includes("timeout")
  );
}

function idLocal(): string {
  return "LOCAL-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function formatSupabaseError(error: any, ctx: string): SyncResult {
  const parts: string[] = [ctx];
  if (error.message) parts.push(`message: ${error.message}`);
  if (error.details && error.details !== error.message) parts.push(`details: ${error.details}`);
  if (error.hint) parts.push(`hint: ${error.hint}`);
  if (error.code) parts.push(`code: ${error.code}`);
  return { ok: false, error: parts.join(" | ") };
}

// -------- Mappers locales -> Supabase (esquema estricto) --------

// TABLA 1: reportes_turno — solo campos permitidos en insert inicial
function reporteRowInicial(t: Turno) {
  return {
    equipo: t.equipo,
    faena: t.faena,
    sector: t.sector,
    diametro: t.diametro,
    pozo: t.pozo,
    orientacion: t.orientacion,
    profundidad_inicial: t.profundidadInicial,
    programado: t.programado,
    casing_diametro: t.casingDiametro,
    casing_profundidad: t.casingProfundidad,
    operador: t.operador,
    ayudante_1: t.ayudante1,
    ayudante_2: t.ayudante2,
    ayudante_3: t.ayudante3,
    estado: "en_proceso",
  };
}

function profundidadFinalTurno(t: Turno): number | null {
  const ultimo = t.tramos[t.tramos.length - 1];
  return ultimo?.hasta ?? t.profundidadInicial;
}

// Para upsert/update posterior (mismos campos base, puede incluir estado y cerrado_el)
function reporteRowUpdate(t: Turno) {
  return {
    equipo: t.equipo,
    faena: t.faena,
    sector: t.sector,
    diametro: t.diametro,
    pozo: t.pozo,
    orientacion: t.orientacion,
    profundidad_inicial: t.profundidadInicial,
    profundidad_final: profundidadFinalTurno(t),
    programado: t.programado,
    casing_diametro: t.casingDiametro,
    casing_profundidad: t.casingProfundidad,
    operador: t.operador,
    ayudante_1: t.ayudante1,
    ayudante_2: t.ayudante2,
    ayudante_3: t.ayudante3,
    observaciones: t.observaciones,
    estado: t.estado === "cerrado" ? "cerrado" : "en_proceso",
  };
}

export type SyncScope = "reporte" | "tramo" | "casing" | "bitacora" | "insumos" | "otrosinsumos" | "herramientas" | "todo";

// TABLA 2: turno_trames
function tramoRow(t: Tramo, reporteId: string) {
  return {
    reporte_id: reporteId,
    hta_desde: t.htaDesde,
    agrega: t.agrega,
    total_hta: t.totalHta,
    fondo: t.fondo,
    resta: t.resta,
    perf: t.perf,
    recuperacion_porcentaje: t.recuperacion,
    tipo_roca: t.tipoRoca || null,
  };
}

// TABLA 2b: turno_casing
function casingRow(c: CasingRow, reporteId: string) {
  return {
    reporte_id: reporteId,
    diametro: c.diametro,
    desde: c.desde,
    agrega: c.agrega,
    total: c.total,
  };
}

// TABLA 3: turno_bitacora
function bitacoraRow(a: ActividadBitacora, reporteId: string) {
  return {
    reporte_id: reporteId,
    hora_desde: a.horaDesde,
    hora_hasta: a.horaHasta,
    codigo_operacion: a.codigoOperacion,
    detalle: a.detalle,
  };
}

// TABLA 4: turno_insumos
function insumoRow(i: Insumo, reporteId: string) {
  return {
    reporte_id: reporteId,
    nombre_insumo: i.nombre,
    unidad: i.unidad,
    cantidad: i.cantidad,
  };
}

function errResult(error: unknown, ctx: string): SyncResult {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false, error: `${ctx}: ${msg}` };
}

// -------- Funciones internas directas (sin fallback) --------

async function syncReporteDirecto(turno: Turno): Promise<SyncResult> {
  try {
    const row = { ...reporteRowUpdate(turno), id: turno.cloudId ?? turno.id };
    const { error } = await supabase.from("reportes_turno").upsert(row);
    if (error) return { ok: false, error: `upsert reportes_turno: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "upsert reportes_turno");
  }
}

async function syncTramoDirecto(tramo: Tramo, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_trames")
      .upsert({ ...tramoRow(tramo, reporteId), id: tramo.id });
    if (error) return { ok: false, error: `upsert turno_trames: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "upsert turno_trames");
  }
}

async function syncCasingDirecto(fila: CasingRow, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_casing")
      .upsert({ ...casingRow(fila, reporteId), id: fila.id });
    if (error) return { ok: false, error: `upsert turno_casing: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "upsert turno_casing");
  }
}

async function syncActividadDirecto(act: ActividadBitacora, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_bitacora")
      .upsert({ ...bitacoraRow(act, reporteId), id: act.id });
    if (error) return { ok: false, error: `upsert turno_bitacora: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "upsert turno_bitacora");
  }
}

async function syncInsumoDirecto(insumo: Insumo, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_insumos")
      .upsert({ ...insumoRow(insumo, reporteId), id: insumo.id });
    if (error) return { ok: false, error: `upsert turno_insumos: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "upsert turno_insumos");
  }
}

async function deleteInsumoDirecto(insumoId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase.from("turno_insumos").delete().eq("id", insumoId);
    if (error) return { ok: false, error: `delete turno_insumos: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "delete turno_insumos");
  }
}

async function syncInsumosDirecto(turno: Turno): Promise<SyncResult> {
  try {
    const rid = turno.cloudId ?? turno.id;
    const { error: delErr } = await supabase.from("turno_insumos").delete().eq("reporte_id", rid);
    if (delErr) return { ok: false, error: `delete turno_insumos: ${delErr.message}` };
    if (turno.insumos.length === 0) return { ok: true, error: null };
    const rows = turno.insumos.map((i) => ({ ...insumoRow(i, rid), id: i.id }));
    const { error } = await supabase.from("turno_insumos").upsert(rows);
    if (error) return { ok: false, error: `upsert turno_insumos: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    return errResult(e, "upsert turno_insumos");
  }
}

// -------- API pública --------

// INSERT inicial de la cabecera (solo 12 campos permitidos)
export async function insertReporteCloud(turno: Turno): Promise<SyncResult> {
  try {
    const row = { ...reporteRowInicial(turno), id: turno.id };
    const { data, error } = await supabase
      .from("reportes_turno")
      .upsert(row)
      .select("id")
      .single();
    if (error) return formatSupabaseError(error, "insert reportes_turno");
    if (!data?.id) return { ok: false, error: "insert reportes_turno: no se devolvio ID" };
    return { ok: true, error: null, id: data.id as string };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "reporte", turnoId: turno.id, payload: turno });
      // Usamos el mismo ID del turno (ya es un UUID real): al reconectar,
      // el reintento sube el registro con este mismo ID, sin duplicar filas.
      return { ok: true, error: null, id: turno.id, offline: true };
    }
    return errResult(e, "insert reportes_turno");
  }
}

// UPSERT de la cabecera (auto-save)
export async function syncReporte(turno: Turno): Promise<SyncResult> {
  try {
    const rid = turno.cloudId ?? turno.id;
    const row = { ...reporteRowUpdate(turno), id: rid };
    const { error } = await supabase.from("reportes_turno").upsert(row);
    if (error) return { ok: false, error: `upsert reportes_turno: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "reporte", turnoId: turno.id, payload: turno });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert reportes_turno");
  }
}

// Sync individual de un tramo
export async function syncTramo(tramo: Tramo, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_trames")
      .upsert({ ...tramoRow(tramo, reporteId), id: tramo.id });
    if (error) return { ok: false, error: `upsert turno_trames: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "tramo", turnoId: reporteId, payload: tramo });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_trames");
  }
}

// Sync batch de todos los tramos
export async function syncTramos(turno: Turno): Promise<SyncResult> {
  try {
    const rid = turno.cloudId ?? turno.id;
    if (turno.tramos.length === 0) {
      const { error: delErr } = await supabase.from("turno_trames").delete().eq("reporte_id", rid);
      if (delErr) return { ok: false, error: `delete turno_trames: ${delErr.message}` };
      return { ok: true, error: null };
    }
    const rows = turno.tramos.map((t) => ({ ...tramoRow(t, rid), id: t.id }));
    const { error } = await supabase.from("turno_trames").upsert(rows);
    if (error) return { ok: false, error: `upsert turno_trames: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "reporte", turnoId: turno.id, payload: turno });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_trames");
  }
}

// Sync individual de una fila de Casing
export async function syncCasing(fila: CasingRow, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_casing")
      .upsert({ ...casingRow(fila, reporteId), id: fila.id });
    if (error) return { ok: false, error: `upsert turno_casing: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "casing", turnoId: reporteId, payload: fila });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_casing");
  }
}

// Sync batch de todo el Casing
export async function syncCasingRows(turno: Turno): Promise<SyncResult> {
  try {
    const rid = turno.cloudId ?? turno.id;
    if (turno.casing.length === 0) {
      const { error: delErr } = await supabase.from("turno_casing").delete().eq("reporte_id", rid);
      if (delErr) return { ok: false, error: `delete turno_casing: ${delErr.message}` };
      return { ok: true, error: null };
    }
    const rows = turno.casing.map((c) => ({ ...casingRow(c, rid), id: c.id }));
    const { error } = await supabase.from("turno_casing").upsert(rows);
    if (error) return { ok: false, error: `upsert turno_casing: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "reporte", turnoId: turno.id, payload: turno });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_casing");
  }
}

// Sync individual de una actividad de bitacora
export async function syncActividad(act: ActividadBitacora, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_bitacora")
      .upsert({ ...bitacoraRow(act, reporteId), id: act.id });
    if (error) return { ok: false, error: `upsert turno_bitacora: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "bitacora", turnoId: reporteId, payload: act });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_bitacora");
  }
}

// Sync batch de toda la bitacora
export async function syncBitacora(turno: Turno): Promise<SyncResult> {
  try {
    const rid = turno.cloudId ?? turno.id;
    if (turno.bitacora.length === 0) {
      const { error: delErr } = await supabase.from("turno_bitacora").delete().eq("reporte_id", rid);
      if (delErr) return { ok: false, error: `delete turno_bitacora: ${delErr.message}` };
      return { ok: true, error: null };
    }
    const rows = turno.bitacora.map((a) => ({ ...bitacoraRow(a, rid), id: a.id }));
    const { error } = await supabase.from("turno_bitacora").upsert(rows);
    if (error) return { ok: false, error: `upsert turno_bitacora: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "reporte", turnoId: turno.id, payload: turno });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_bitacora");
  }
}

// Sync individual de un insumo
export async function syncInsumo(insumo: Insumo, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase
      .from("turno_insumos")
      .upsert({ ...insumoRow(insumo, reporteId), id: insumo.id });
    if (error) return { ok: false, error: `upsert turno_insumos: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "insumos", turnoId: reporteId, payload: insumo });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_insumos");
  }
}

export async function deleteInsumoCloud(insumoId: string, reporteId: string): Promise<SyncResult> {
  try {
    const { error } = await supabase.from("turno_insumos").delete().eq("id", insumoId);
    if (error) return { ok: false, error: `delete turno_insumos: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "insumos", turnoId: reporteId, payload: { id: insumoId, _delete: true } });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "delete turno_insumos");
  }
}

// Sync batch de insumos
export async function syncInsumos(turno: Turno): Promise<SyncResult> {
  try {
    const rid = turno.cloudId ?? turno.id;
    const { error: delErr } = await supabase.from("turno_insumos").delete().eq("reporte_id", rid);
    if (delErr) return { ok: false, error: `delete turno_insumos: ${delErr.message}` };
    if (turno.insumos.length === 0) return { ok: true, error: null };
    const rows = turno.insumos.map((i) => ({ ...insumoRow(i, rid), id: i.id }));
    const { error } = await supabase.from("turno_insumos").upsert(rows);
    if (error) return { ok: false, error: `upsert turno_insumos: ${error.message}` };
    return { ok: true, error: null };
  } catch (e) {
    if (esErrorDeRed(e)) {
      encolar({ tipo: "insumos", turnoId: turno.id, payload: turno });
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "upsert turno_insumos");
  }
}

// TABLA 5: Cierre — UPDATE reportes_turno + INSERT turno_documentos_legales
export async function cerrarTurnoCloud(turno: Turno): Promise<SyncResult> {
  const rid = turno.cloudId ?? turno.id;
  try {
    // A) Actualizar estado a 'cerrado' y fijar cerrado_el con hora de Chile
    const { error: updErr } = await supabase
      .from("reportes_turno")
      .update({ estado: "cerrado", cerrado_el: turno.cerradoEn })
      .eq("id", rid);
    if (updErr) return formatSupabaseError(updErr, "update reportes_turno (cierre)");

    // B) Insertar documento legal con firma
    const docRow: Record<string, unknown> = {
      reporte_id: rid,
      firma_base64: turno.firmaDataURL ?? "",
      url_pdf_inmutable: `https://reportes.diamantina.cl/pdf/${rid}`,
    };
    const { error: docErr } = await supabase
      .from("turno_documentos_legales")
      .insert(docRow);
    if (docErr) return formatSupabaseError(docErr, "insert turno_documentos_legales");

    return { ok: true, error: null, id: rid };
  } catch (e) {
    if (esErrorDeRed(e)) {
      return { ok: true, error: null, offline: true };
    }
    return errResult(e, "cierre turno cloud");
  }
}

/** Sincroniza automáticamente según el tipo de dato modificado. */
export async function autoSyncTurno(
  turno: Turno,
  scope: SyncScope,
  entityId?: string,
): Promise<SyncResult> {
  const rid = turno.cloudId ?? turno.id;

  if (scope === "reporte") {
    return syncReporte(turno);
  }

  if (!rid) return { ok: false, error: "Turno sin ID de nube" };

  if (scope === "tramo") {
    const tramo = entityId ? turno.tramos.find((t) => t.id === entityId) : turno.tramos.at(-1);
    if (!tramo) return { ok: true, error: null };
    const rTramo = await syncTramo(tramo, rid);
    const rReporte = await syncReporte(turno);
    if (!rTramo.ok && !rTramo.offline) return rTramo;
    if (!rReporte.ok && !rReporte.offline) return rReporte;
    return { ok: true, error: null, offline: !!(rTramo.offline || rReporte.offline) };
  }

  if (scope === "casing") {
    const fila = entityId ? turno.casing.find((c) => c.id === entityId) : turno.casing.at(-1);
    if (!fila) return { ok: true, error: null };
    const rCasing = await syncCasing(fila, rid);
    const rReporte = await syncReporte(turno);
    if (!rCasing.ok && !rCasing.offline) return rCasing;
    if (!rReporte.ok && !rReporte.offline) return rReporte;
    return { ok: true, error: null, offline: !!(rCasing.offline || rReporte.offline) };
  }

  if (scope === "bitacora") {
    const act = entityId ? turno.bitacora.find((a) => a.id === entityId) : turno.bitacora.at(-1);
    if (!act) return { ok: true, error: null };
    return syncActividad(act, rid);
  }

  if (scope === "insumos") {
    if (entityId) {
      const ins = turno.insumos.find((i) => i.id === entityId);
      if (ins) return syncInsumo(ins, rid);
      return deleteInsumoCloud(entityId, rid);
    }
    return syncInsumos(turno);
  }

  return syncTodo(turno);
}

// Sync completo (tramos + bitacora + insumos + reporte)
export async function syncTodo(turno: Turno): Promise<SyncResult> {
  const [r, t, c, b, i] = await Promise.all([
    syncReporte(turno),
    syncTramos(turno),
    syncCasingRows(turno),
    syncBitacora(turno),
    syncInsumos(turno),
  ]);
  const allOffline = [r, t, c, b, i].every((x) => x.offline);
  if (allOffline) return { ok: true, error: null, offline: true };
  const failed = [r, t, c, b, i].find((x) => !x.ok && !x.offline);
  if (failed) return failed;
  return { ok: true, error: null };
}

// -------- Test de conectividad --------

export async function testConexion(): Promise<SyncResult> {
  const configError = getSupabaseConfigError();
  if (configError) {
    return { ok: false, error: configError };
  }

  try {
    const { error, count } = await supabase
      .from("reportes_turno")
      .select("*", { count: "exact", head: true });
    if (error) return formatSupabaseError(error, "test conexion");
    return { ok: true, error: null, id: String(count ?? 0) };
  } catch (e) {
    if (esErrorDeRed(e)) {
      return { ok: false, error: "Sin conexion a Supabase (Failed to fetch) — Modo Terreno disponible", offline: true };
    }
    return errResult(e, "test conexion");
  }
}
