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