import { supabase, isSupabaseConfigured } from "@/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Turno, Tramo, CasingRow, ActividadBitacora, Insumo, OtroInsumo, HerramientaFila, HerramientaTipo, UnidadInsumo } from "@/types";

export type MetricasNube = {
  profundidadFinal: number | null;
  totalTramos: number;
  totalActividades: number;
  totalInsumos: number;
  actualizadoEn: string;
};

type FilaReporte = {
  profundidad_final?: number | null;
  profundidad_inicial?: number | null;
  updated_at?: string;
};

type FilaTramo = {
  id?: string;
  hta_desde?: number;
  agrega?: number | null;
  total_hta?: number;
  fondo?: number;
  resta?: number | null;
  perf?: number | null;
  recuperacion_porcentaje?: number | null;
  tipo_roca?: string | null;
  created_at?: string;
};

type FilaCasing = {
  id?: string;
  diametro?: string;
  desde?: number;
  agrega?: number | null;
  total?: number;
  created_at?: string;
};

type FilaBitacora = {
  id?: string;
  hora_desde?: string;
  hora_hasta?: string | null;
  codigo_operacion?: string;
  detalle?: string;
  cargo_hora?: string;
  created_at?: string;
};

type FilaInsumo = {
  id?: string;
  nombre_insumo?: string;
  unidad?: string;
  cantidad?: number | null;
  created_at?: string;
};

type FilaOtroInsumo = {
  id?: string;
  cantidad?: number | null;
  descripcion?: string;
  created_at?: string;
};

type FilaHerramienta = {
  id?: string;
  tipo?: string;
  diametro?: string;
  marca?: string;
  serie?: string;
  estado?: string | null;
  desde?: number;
  hasta?: number;
  created_at?: string;
};

export type ActualizacionRealtime = {
  tipo: "reporte" | "tramos" | "bitacora" | "insumos";
  metricas: MetricasNube;
  parche?: Partial<Turno>;
};

type CallbackRealtime = (actualizacion: ActualizacionRealtime) => void;

function calcularProfundidadFinal(tramos: Tramo[], profundidadInicial: number | null): number | null {
  const ultimo = tramos[tramos.length - 1];
  if (ultimo) return ultimo.fondo;
  return profundidadInicial;
}

function mapTramo(row: FilaTramo, idx: number): Tramo {
  const htaDesde = Number(row.hta_desde ?? 0);
  const agrega = row.agrega != null ? Number(row.agrega) : null;
  return {
    id: (row.id as string) ?? `rt-${idx}`,
    htaDesde,
    agrega,
    totalHta: row.total_hta != null ? Number(row.total_hta) : htaDesde + (agrega ?? 0),
    fondo: Number(row.fondo ?? 0),
    resta: row.resta != null ? Number(row.resta) : null,
    perf: row.perf != null ? Number(row.perf) : null,
    recuperacion: row.recuperacion_porcentaje != null ? Number(row.recuperacion_porcentaje) : null,
    tipoRoca: (row.tipo_roca as Tramo["tipoRoca"]) ?? "",
    creadoEn: row.created_at ?? new Date().toISOString(),
  };
}

function mapCasing(row: FilaCasing, idx: number): CasingRow {
  const desde = Number(row.desde ?? 0);
  const agrega = row.agrega != null ? Number(row.agrega) : null;
  return {
    id: (row.id as string) ?? `rt-c-${idx}`,
    diametro: row.diametro ?? "",
    desde,
    agrega,
    total: row.total != null ? Number(row.total) : desde + (agrega ?? 0),
    creadoEn: row.created_at ?? new Date().toISOString(),
  };
}

function mapBitacora(row: FilaBitacora, idx: number): ActividadBitacora {
  return {
    id: (row.id as string) ?? `rt-b-${idx}`,
    horaDesde: row.hora_desde ?? "",
    horaHasta: row.hora_hasta ?? null,
    codigoOperacion: row.codigo_operacion ?? "",
    detalle: row.detalle ?? "",
    creadoEn: row.created_at ?? new Date().toISOString(),
  };
}

function mapInsumo(row: FilaInsumo, idx: number): Insumo {
  return {
    id: (row.id as string) ?? `rt-i-${idx}`,
    nombre: row.nombre_insumo ?? "",
    unidad: (row.unidad as UnidadInsumo) ?? "Saco",
    cantidad: row.cantidad != null ? Number(row.cantidad) : null,
    creadoEn: row.created_at ?? new Date().toISOString(),
  };
}

function mapOtroInsumo(row: FilaOtroInsumo, idx: number): OtroInsumo {
  return {
    id: (row.id as string) ?? `rt-oi-${idx}`,
    cantidad: row.cantidad != null ? Number(row.cantidad) : null,
    descripcion: row.descripcion ?? "",
    creadoEn: row.created_at ?? new Date().toISOString(),
  };
}

function mapHerramienta(row: FilaHerramienta, idx: number): HerramientaFila {
  return {
    id: (row.id as string) ?? `rt-h-${idx}`,
    tipo: (row.tipo as HerramientaTipo) ?? "corona",
    diametro: row.diametro ?? "",
    marca: row.marca ?? "",
    serie: row.serie ?? "",
    estado: (row.estado as HerramientaFila["estado"]) ?? "",
    desde: Number(row.desde ?? 0),
    hasta: Number(row.hasta ?? 0),
    creadoEn: row.created_at ?? new Date().toISOString(),
  };
}

async function cargarDatosNube(
  cloudId: string,
  profundidadInicial: number | null,
): Promise<ActualizacionRealtime | null> {
  const [reporteRes, tramosRes, casingRes, bitacoraRes, insumosRes, otrosInsumosRes, herramientasRes] =
    await Promise.all([
      supabase.from("reportes_turno").select("profundidad_final, profundidad_inicial, updated_at").eq("id", cloudId).maybeSingle(),
      supabase.from("turno_trames").select("*").eq("reporte_id", cloudId).order("created_at"),
      supabase.from("turno_casing").select("*").eq("reporte_id", cloudId).order("creado_en"),
      supabase.from("turno_bitacora").select("*").eq("reporte_id", cloudId).order("created_at"),
      supabase.from("turno_insumos").select("*").eq("reporte_id", cloudId).order("created_at"),
      supabase.from("turno_otros_insumos").select("*").eq("reporte_id", cloudId).order("creado_en"),
      supabase.from("turno_herramientas").select("*").eq("reporte_id", cloudId).order("creado_en"),
    ]);

  const reporte = reporteRes.data as FilaReporte | null;
  const tramos = ((tramosRes.data ?? []) as FilaTramo[]).map(mapTramo);
  const casing = ((casingRes.data ?? []) as FilaCasing[]).map(mapCasing);
  const bitacora = ((bitacoraRes.data ?? []) as FilaBitacora[]).map(mapBitacora);
  const insumos = ((insumosRes.data ?? []) as FilaInsumo[]).map(mapInsumo);
  const otrosInsumos = ((otrosInsumosRes.data ?? []) as FilaOtroInsumo[]).map(mapOtroInsumo);
  const herramientas = ((herramientasRes.data ?? []) as FilaHerramienta[]).map(mapHerramienta);

  const profundidadFinal =
    reporte?.profundidad_final ??
    calcularProfundidadFinal(tramos, reporte?.profundidad_inicial ?? profundidadInicial);

  return {
    tipo: "reporte",
    metricas: {
      profundidadFinal,
      totalTramos: tramos.length,
      totalActividades: bitacora.length,
      totalInsumos: insumos.length,
      actualizadoEn: reporte?.updated_at ?? new Date().toISOString(),
    },
    parche: { tramos, casing, bitacora, insumos, otrosInsumos, herramientas },
  };
}

export function suscribirTurnoRealtime(
  cloudId: string,
  profundidadInicial: number | null,
  onActualizacion: CallbackRealtime,
): () => void {
  if (!isSupabaseConfigured() || !cloudId) return () => {};

  let canal: RealtimeChannel | null = null;
  let activo = true;

  const notificar = async (tipo: ActualizacionRealtime["tipo"]) => {
    if (!activo) return;
    const datos = await cargarDatosNube(cloudId, profundidadInicial);
    if (datos && activo) onActualizacion({ ...datos, tipo });
  };

  canal = supabase
    .channel(`turno-${cloudId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "reportes_turno", filter: `id=eq.${cloudId}` },
      () => void notificar("reporte"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_trames", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("tramos"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_casing", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("tramos"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_bitacora", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("bitacora"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_insumos", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("insumos"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_otros_insumos", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("insumos"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_herramientas", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("reporte"),
    )
    .subscribe();

  // Carga inicial para métricas al conectar
  void notificar("reporte");

  return () => {
    activo = false;
    if (canal) supabase.removeChannel(canal);
  };
}

export async function obtenerMetricasNube(
  cloudId: string,
  profundidadInicial: number | null,
): Promise<MetricasNube | null> {
  const datos = await cargarDatosNube(cloudId, profundidadInicial);
  return datos?.metricas ?? null;
}