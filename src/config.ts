import type { HerramientaFila, HerramientaTipo } from "@/types";

// Datos fijos de administrador - preconfigurados, no editables por el operador.
export const ADMIN_CONFIG = {
  equipo: "DIAMANTINA-04",
  faena: "Mina Los Pelambres",
} as const;

export const HERRAMIENTA_LABELS: Record<HerramientaTipo, string> = {
  corona: "Corona",
  escareador: "Escareador",
  zapata: "Zapata",
  tricono: "Tricono",
};

export const HERRAMIENTA_ORDEN: HerramientaTipo[] = ["corona", "escareador", "zapata", "tricono"];

// Datos de herramientas heredados del turno anterior (simulado, solo para la
// primera vez que se usa la app en esta tablet).
export const HERRAMIENTAS_INICIALES: HerramientaFila[] = [
  {
    id: "seed-corona",
    tipo: "corona",
    diametro: "HQ3",
    marca: "Sandvik",
    serie: "CR-12",
    estado: "Usado",
    desde: 0,
    hasta: 0,
    creadoEn: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-escareador",
    tipo: "escareador",
    diametro: "HQ",
    marca: "Fordia",
    serie: "ESC-02",
    estado: "Usado",
    desde: 0,
    hasta: 0,
    creadoEn: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-zapata",
    tipo: "zapata",
    diametro: "HWT",
    marca: "Boart Longyear",
    serie: "ZP-01",
    estado: "Usado",
    desde: 0,
    hasta: 0,
    creadoEn: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "seed-tricono",
    tipo: "tricono",
    diametro: '5 7/8"',
    marca: "Baker Hughes",
    serie: "TR-04",
    estado: "Usado",
    desde: 0,
    hasta: 0,
    creadoEn: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
];

// 48 códigos oficiales de operación
export const CODIGOS_OPERACION: { numero: string; texto: string }[] = [
  { numero: "1", texto: "Reunión HSE/Charla/inspección" },
  { numero: "2", texto: "Housekeeping plataforma" },
  { numero: "3", texto: "Acondicionado/Estabilizando" },
  { numero: "4", texto: "Perforando" },
  { numero: "5", texto: "Movimiento Herramienta" },
  { numero: "6", texto: "Instalación/Rescate Casing" },
  { numero: "7", texto: "Reperforación-Reaming/Matriz" },
  { numero: "8", texto: "Preparación Lodo" },
  { numero: "9", texto: "Rescatando Herramienta" },
  { numero: "10", texto: "Medición" },
  { numero: "11", texto: "Colación" },
  { numero: "12", texto: "Traslado Colación" },
  { numero: "13", texto: "Espera Traslado Personal" },
  { numero: "14", texto: "Ensanche" },
  { numero: "15", texto: "Instalación/Traslado/Desarme" },
  { numero: "16", texto: "Detención por Tronadura" },
  { numero: "17", texto: "Detención por Clima" },
  { numero: "18", texto: "Espera Petróleo" },
  { numero: "19", texto: "Espera de Insumos" },
  { numero: "20", texto: "Espera de Agua" },
  { numero: "21", texto: "Espera Instrucciones Cliente" },
  { numero: "22", texto: "Espera Instrucciones PD" },
  { numero: "23", texto: "Espera Medición" },
  { numero: "24", texto: "Espera Plataforma" },
  { numero: "25", texto: "Espera Personal" },
  { numero: "26", texto: "Espera Camión de Apoyo" },
  { numero: "27", texto: "Carga de Petróleo" },
  { numero: "28", texto: "Instalación Cuña/Desviando" },
  { numero: "29", texto: "Descongelando/Desagüe" },
  { numero: "30", texto: "OTRO OPERACIONAL" },
  { numero: "31", texto: "Espera Mecánico" },
  { numero: "32", texto: "Espera de Repuesto" },
  { numero: "33", texto: "Falla Motor Diesel" },
  { numero: "34", texto: "Falla Sistema Hidráulico" },
  { numero: "35", texto: "Falla Sistema Eléctrico" },
  { numero: "36", texto: "Falla Unidad Rotación" },
  { numero: "37", texto: "Falla Prensa Barra" },
  { numero: "38", texto: "Falla Rod Spinner" },
  { numero: "39", texto: "Falla Bomba de Lodo" },
  { numero: "40", texto: "Falla Winche Wireline" },
  { numero: "41", texto: "Falla Winche Principal Arrastre" },
  { numero: "42", texto: "Falla Implementación" },
  { numero: "43", texto: "Falla Estructura" },
  { numero: "44", texto: "Mantenimiento Preventivo" },
  { numero: "45", texto: "Falla llave de Corte" },
  { numero: "46", texto: "Falla sistema de Avance Mesa" },
  { numero: "47", texto: "Falla Bomba inyección" },
  { numero: "48", texto: "OTRO MANTENCION" },
];

export function codigoCompleto(numero: string, texto: string): string {
  return `${numero} - ${texto}`;
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Respaldo si el navegador de la tablet no soporta crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function ahoraISO(): string {
  return new Date().toISOString();
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function horaActualLocal(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function horaDeISO(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Calcula horas decimales entre dos horas HH:MM
export function diffHoras(desde: string, hasta: string | null): number | null {
  if (!desde || !hasta) return null;
  const [h1, m1] = desde.split(":").map(Number);
  const [h2, m2] = hasta.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return null;
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60; // cruzó medianoche
  return Math.round((mins / 60) * 100) / 100;
}