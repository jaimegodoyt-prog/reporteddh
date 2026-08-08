import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(root, "..", ".env");
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const CHECKS = [
  {
    table: "reportes_turno",
    cols: "id,equipo,faena,sector,diametro,pozo,orientacion,profundidad_inicial,profundidad_final,operador,ayudante_1,ayudante_2,ayudante_3,observaciones,estado,cerrado_el,updated_at",
  },
  {
    table: "turno_trames",
    cols: "id,reporte_id,desde,hasta,herramienta_activa,recuperacion_porcentaje,resta,created_at",
  },
  {
    table: "turno_bitacora",
    cols: "id,reporte_id,hora_desde,hora_hasta,codigo_operacion,detalle,cargo_hora,created_at",
  },
  {
    table: "turno_insumos",
    cols: "id,reporte_id,nombre_insumo,unidad,cantidad,created_at",
  },
  {
    table: "turno_documentos_legales",
    cols: "reporte_id,firma_base64,url_pdf_inmutable",
  },
];

let ok = 0;
let fail = 0;

for (const { table, cols } of CHECKS) {
  const { error } = await sb.from(table).select(cols).limit(1);
  if (error) {
    console.log(`✗ ${table}: ${error.message}`);
    fail++;
  } else {
    console.log(`✓ ${table}: OK`);
    ok++;
  }
}

console.log(`\n${ok}/${CHECKS.length} tablas alineadas.`);
process.exit(fail > 0 ? 1 : 0);
