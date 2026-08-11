import { supabase, isSupabaseConfigured } from "@/supabaseClient";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Turno, Tramo, ActividadBitacora, Insumo, HerramientaTipo, CargoHora, UnidadInsumo } from "@/types";

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
  desde?: number;
  hasta?: number | null;
  herramienta_activa?: string;
  recuperacion_porcentaje?: number | null;
  resta?: number | null;
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

export type ActualizacionRealtime = {
  tipo: "reporte" | "tramos" | "bitacora" | "insumos";
  metricas: MetricasNube;
  parche?: Partial<Turno>;
};

type CallbackRealtime = (actualizacion: ActualizacionRealtime) => void;

function calcularProfundidadFinal(tramos: Tramo[], profundidadInicial: number | null): number | null {
  const ultimo = tramos[tramos.length - 1];
  if (ultimo?.hasta != null) return ultimo.hasta;
  return profundidadInicial;
}

function mapTramo(row: FilaTramo, idx: number): Tramo {
  return {
    id: (row.id as string) ?? `rt-${idx}`,
    desde: Number(row.desde ?? 0),
    hasta: row.hasta != null ? Number(row.hasta) : null,
    herramientaActiva: (row.herramienta_activa as HerramientaTipo) ?? "corona",
    recuperacion: row.recuperacion_porcentaje != null ? Number(row.recuperacion_porcentaje) : null,
    resta: row.resta != null ? Number(row.resta) : null,
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
    cargoHora: (row.cargo_hora as CargoHora) ?? "propia",
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

async function cargarDatosNube(
  cloudId: string,
  profundidadInicial: number | null,
): Promise<ActualizacionRealtime | null> {
  const [reporteRes, tramosRes, bitacoraRes, insumosRes] = await Promise.all([
    supabase.from("reportes_turno").select("profundidad_final, profundidad_inicial, updated_at").eq("id", cloudId).maybeSingle(),
    supabase.from("turno_trames").select("*").eq("reporte_id", cloudId).order("created_at"),
    supabase.from("turno_bitacora").select("*").eq("reporte_id", cloudId).order("created_at"),
    supabase.from("turno_insumos").select("*").eq("reporte_id", cloudId).order("created_at"),
  ]);

  const reporte = reporteRes.data as FilaReporte | null;
  const tramos = ((tramosRes.data ?? []) as FilaTramo[]).map(mapTramo);
  const bitacora = ((bitacoraRes.data ?? []) as FilaBitacora[]).map(mapBitacora);
  const insumos = ((insumosRes.data ?? []) as FilaInsumo[]).map(mapInsumo);

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
    parche: { tramos, bitacora, insumos },
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
      { event: "*", schema: "public", table: "turno_bitacora", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("bitacora"),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "turno_insumos", filter: `reporte_id=eq.${cloudId}` },
      () => void notificar("insumos"),
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
