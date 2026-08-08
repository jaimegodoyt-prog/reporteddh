/*
# Crear tablas para Reporte de Turno Diamantina

## Descripción
Crea el esquema completo para persistir reportes de turno de perforación
diamantina en terreno. La app es offline-first (IndexedDB) y sincroniza
con estas tablas en Supabase cuando hay conexión. No requiere login
(operador único por tablet en modo kiosko), por lo que es single-tenant
con acceso anon + authenticated.

## Tablas nuevas
1. `reportes_turno` — Registro principal del turno (cabecera, estado, firma).
2. `turno_tramos` — Tramos de perforación enlazados a un reporte.
3. `turno_bitacora` — Actividades/códigos de operación del turno.
4. `turno_insumos` — Insumos consumidos durante el turno.

## Enlace entre tablas
Todas las tablas hijas se enlazan al reporte mediante `reporte_local_id`
(texto), que es el ID local generado en la tablet. Esto permite guardar
hijas incluso antes de conocer el UUID del padre (robustez offline-first).

## Seguridad
- RLS habilitado en todas las tablas.
- Políticas CRUD para `anon, authenticated` (app sin login, modo kiosko).
- `USING (true)` es intencional: datos compartidos de operación minera
  en una tablet de un solo operador.
*/

-- ============================================================
-- 1. reportes_turno
-- ============================================================
CREATE TABLE IF NOT EXISTS reportes_turno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id text UNIQUE NOT NULL,
  equipo text NOT NULL DEFAULT '',
  faena text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  diametro text NOT NULL DEFAULT '',
  pozo text NOT NULL DEFAULT '',
  orientacion text NOT NULL DEFAULT '',
  profundidad_inicial numeric,
  operador text NOT NULL DEFAULT '',
  ayudante1 text NOT NULL DEFAULT '',
  ayudante2 text NOT NULL DEFAULT '',
  ayudante3 text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'borrador',
  observaciones text NOT NULL DEFAULT '',
  firma_dataurl text,
  iniciado_en timestamptz,
  cerrado_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reportes_turno ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reportes" ON reportes_turno;
CREATE POLICY "anon_select_reportes" ON reportes_turno FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reportes" ON reportes_turno;
CREATE POLICY "anon_insert_reportes" ON reportes_turno FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reportes" ON reportes_turno;
CREATE POLICY "anon_update_reportes" ON reportes_turno FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reportes" ON reportes_turno;
CREATE POLICY "anon_delete_reportes" ON reportes_turno FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 2. turno_tramos
-- ============================================================
CREATE TABLE IF NOT EXISTS turno_tramos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id text UNIQUE NOT NULL,
  reporte_local_id text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  desde numeric NOT NULL DEFAULT 0,
  hasta numeric,
  herramienta_activa text NOT NULL DEFAULT 'corona',
  recuperacion numeric,
  resta numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turno_tramos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tramos" ON turno_tramos;
CREATE POLICY "anon_select_tramos" ON turno_tramos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tramos" ON turno_tramos;
CREATE POLICY "anon_insert_tramos" ON turno_tramos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tramos" ON turno_tramos;
CREATE POLICY "anon_update_tramos" ON turno_tramos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tramos" ON turno_tramos;
CREATE POLICY "anon_delete_tramos" ON turno_tramos FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. turno_bitacora
-- ============================================================
CREATE TABLE IF NOT EXISTS turno_bitacora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id text UNIQUE NOT NULL,
  reporte_local_id text NOT NULL,
  hora_desde text NOT NULL DEFAULT '',
  hora_hasta text,
  codigo_operacion text NOT NULL DEFAULT '',
  detalle text NOT NULL DEFAULT '',
  cargo_hora text NOT NULL DEFAULT 'propia',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turno_bitacora ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_bitacora" ON turno_bitacora;
CREATE POLICY "anon_select_bitacora" ON turno_bitacora FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_bitacora" ON turno_bitacora;
CREATE POLICY "anon_insert_bitacora" ON turno_bitacora FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_bitacora" ON turno_bitacora;
CREATE POLICY "anon_update_bitacora" ON turno_bitacora FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_bitacora" ON turno_bitacora;
CREATE POLICY "anon_delete_bitacora" ON turno_bitacora FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 4. turno_insumos
-- ============================================================
CREATE TABLE IF NOT EXISTS turno_insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id text UNIQUE NOT NULL,
  reporte_local_id text NOT NULL,
  nombre text NOT NULL DEFAULT '',
  unidad text NOT NULL DEFAULT 'Saco',
  cantidad numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turno_insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_insumos" ON turno_insumos;
CREATE POLICY "anon_select_insumos" ON turno_insumos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_insumos" ON turno_insumos;
CREATE POLICY "anon_insert_insumos" ON turno_insumos FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_insumos" ON turno_insumos;
CREATE POLICY "anon_update_insumos" ON turno_insumos FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_insumos" ON turno_insumos;
CREATE POLICY "anon_delete_insumos" ON turno_insumos FOR DELETE
  TO anon, authenticated USING (true);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_tramos_reporte ON turno_tramos(reporte_local_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_reporte ON turno_bitacora(reporte_local_id);
CREATE INDEX IF NOT EXISTS idx_insumos_reporte ON turno_insumos(reporte_local_id);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes_turno(estado);
