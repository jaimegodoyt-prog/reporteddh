import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(root, "align-supabase-schema.sql");
const sql = readFileSync(sqlPath, "utf8");

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

function resolveDbUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.SUPABASE_DB_URL) return env.SUPABASE_DB_URL;

  const password = env.SUPABASE_DB_PASSWORD;
  const ref =
    env.SUPABASE_PROJECT_REF ||
    env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (password && ref) {
    const host = env.SUPABASE_DB_HOST || `db.${ref}.supabase.co`;
    const port = env.SUPABASE_DB_PORT || "5432";
    const user = env.SUPABASE_DB_USER || "postgres";
    const db = env.SUPABASE_DB_NAME || "postgres";
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${db}`;
  }

  return null;
}

async function applyWithPg(dbUrl) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    throw new Error(
      "Falta el paquete pg. Instala con: npm install --save-dev pg\n" +
        "Luego agrega SUPABASE_DB_PASSWORD en .env (Dashboard → Project Settings → Database)."
    );
  }

  const client = new pg.default.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("✓ Esquema aplicado correctamente en Supabase.");
  } finally {
    await client.end();
  }
}

async function main() {
  const env = loadEnv();
  const argPass = process.argv.find((a) => a.startsWith("--password="))?.split("=")[1];
  if (argPass) env.SUPABASE_DB_PASSWORD = argPass;

  const dbUrl = resolveDbUrl(env);

  if (dbUrl) {
    console.log("Aplicando esquema vía conexión PostgreSQL...\n");
    try {
      await applyWithPg(dbUrl);
      return;
    } catch (err) {
      console.error("Error al aplicar vía PostgreSQL:", err.message);
      console.log("\nMostrando SQL para ejecución manual...\n");
    }
  }

  console.log(`
=== Alinear esquema Supabase (reportes de turno Diamantina) ===

Estado detectado en el proyecto:
  - Tablas usadas por la app: reportes_turno, turno_trames, turno_bitacora,
    turno_insumos, turno_documentos_legales
  - Campos clave: reporte_id, ayudante_1/2/3, nombre_insumo, recuperacion_porcentaje, etc.

Opción A — Automática (recomendada):
  1. Supabase Dashboard → Project Settings → Database → copia la contraseña
  2. Agrega a .env:  SUPABASE_DB_PASSWORD=tu_password
  3. Ejecuta:        npm run db:align

Opción B — SQL Editor (sin instalar nada):
  1. Abre https://supabase.com/dashboard → tu proyecto
  2. SQL Editor → New query
  3. Pega el contenido de: scripts/align-supabase-schema.sql
  4. Pulsa Run

Opción C — Supabase CLI:
  supabase link --project-ref <tu-ref>
  supabase db push

--- SQL a ejecutar (${sqlPath}) ---
`);
  console.log(sql.trim());
  console.log("\n--- Fin del SQL ---\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
