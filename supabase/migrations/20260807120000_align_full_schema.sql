-- =============================================================================
-- Alinear esquema Supabase con src/sync.ts y src/realtime.ts
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- Idempotente: seguro ejecutar varias veces.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. reportes_turno (cabecera del turno)
-- Campos enviados por sync.ts: reporteRowInicial / reporteRowUpdate / cierre
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reportes_turno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo text NOT NULL DEFAULT '',
  faena text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  diametro text NOT NULL DEFAULT '',
  pozo text NOT NULL DEFAULT '',
  orientacion text NOT NULL DEFAULT '',
  profundidad_inicial numeric,
  profundidad_final numeric,
  operador text NOT NULL DEFAULT '',
  ayudante_1 text NOT NULL DEFAULT '',
  ayudante_2 text NOT NULL DEFAULT '',
  ayudante_3 text NOT NULL DEFAULT '',
  observaciones text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'en_proceso',
  cerrado_el timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Renombrar columnas legacy (migración antigua ayudante1 → ayudante_1, etc.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'ayudante1'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'ayudante_1'
  ) THEN
    ALTER TABLE reportes_turno RENAME COLUMN ayudante1 TO ayudante_1;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'ayudante2'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'ayudante_2'
  ) THEN
    ALTER TABLE reportes_turno RENAME COLUMN ayudante2 TO ayudante_2;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'ayudante3'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'ayudante_3'
  ) THEN
    ALTER TABLE reportes_turno RENAME COLUMN ayudante3 TO ayudante_3;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'cerrado_en'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reportes_turno' AND column_name = 'cerrado_el'
  ) THEN
    ALTER TABLE reportes_turno RENAME COLUMN cerrado_en TO cerrado_el;
  END IF;
END $$;

ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS equipo text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS faena text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS sector text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS diametro text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS pozo text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS orientacion text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS profundidad_inicial numeric;
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS profundidad_final numeric;
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS operador text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS ayudante_1 text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS ayudante_2 text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS ayudante_3 text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS observaciones text NOT NULL DEFAULT '';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'en_proceso';
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS cerrado_el timestamptz;
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2. turno_trames (tramos de perforación)
-- Nota: la app usa el nombre "turno_trames" (typo intencional en sync.ts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turno_trames (
  id text PRIMARY KEY,
  reporte_id uuid NOT NULL REFERENCES reportes_turno(id) ON DELETE CASCADE,
  desde numeric NOT NULL DEFAULT 0,
  hasta numeric,
  herramienta_activa text NOT NULL DEFAULT 'corona',
  recuperacion_porcentaje numeric,
  resta numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Si turno_trames existía sin reporte_id, agregarla
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS reporte_id uuid;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS desde numeric NOT NULL DEFAULT 0;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS hasta numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS herramienta_activa text NOT NULL DEFAULT 'corona';
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS recuperacion_porcentaje numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS resta numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Migrar reporte_local_id → reporte_id si existe tabla legacy turno_tramos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'turno_tramos'
  ) AND NOT EXISTS (SELECT 1 FROM turno_trames LIMIT 1) THEN
    INSERT INTO turno_trames (id, reporte_id, desde, hasta, herramienta_activa, recuperacion_porcentaje, resta, created_at)
    SELECT
      t.local_id,
      r.id,
      t.desde,
      t.hasta,
      t.herramienta_activa,
      t.recuperacion,
      t.resta,
      t.created_at
    FROM turno_tramos t
    JOIN reportes_turno r ON r.local_id = t.reporte_local_id
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Si turno_trames tenía id uuid, convertir a text para IDs locales cortos de la app
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'turno_trames'
      AND column_name = 'id' AND udt_name = 'uuid'
  ) THEN
    ALTER TABLE turno_trames ALTER COLUMN id TYPE text USING id::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_turno_trames_reporte ON turno_trames(reporte_id);

-- ---------------------------------------------------------------------------
-- 3. turno_bitacora (actividades / códigos de operación)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turno_bitacora (
  id text PRIMARY KEY,
  reporte_id uuid NOT NULL REFERENCES reportes_turno(id) ON DELETE CASCADE,
  hora_desde text NOT NULL DEFAULT '',
  hora_hasta text,
  codigo_operacion text NOT NULL DEFAULT '',
  detalle text NOT NULL DEFAULT '',
  cargo_hora text NOT NULL DEFAULT 'propia',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS reporte_id uuid;
ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS hora_desde text NOT NULL DEFAULT '';
ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS hora_hasta text;
ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS codigo_operacion text NOT NULL DEFAULT '';
ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS detalle text NOT NULL DEFAULT '';
ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS cargo_hora text NOT NULL DEFAULT 'propia';
ALTER TABLE turno_bitacora ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_turno_bitacora_reporte ON turno_bitacora(reporte_id);

-- ---------------------------------------------------------------------------
-- 4. turno_insumos (aditivos / consumibles)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turno_insumos (
  id text PRIMARY KEY,
  reporte_id uuid NOT NULL REFERENCES reportes_turno(id) ON DELETE CASCADE,
  nombre_insumo text NOT NULL DEFAULT '',
  unidad text NOT NULL DEFAULT 'Saco',
  cantidad numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turno_insumos ADD COLUMN IF NOT EXISTS reporte_id uuid;
ALTER TABLE turno_insumos ADD COLUMN IF NOT EXISTS nombre_insumo text NOT NULL DEFAULT '';
ALTER TABLE turno_insumos ADD COLUMN IF NOT EXISTS unidad text NOT NULL DEFAULT 'Saco';
ALTER TABLE turno_insumos ADD COLUMN IF NOT EXISTS cantidad numeric;
ALTER TABLE turno_insumos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Renombrar nombre → nombre_insumo si existe columna legacy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'turno_insumos' AND column_name = 'nombre'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'turno_insumos' AND column_name = 'nombre_insumo'
  ) THEN
    ALTER TABLE turno_insumos RENAME COLUMN nombre TO nombre_insumo;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_turno_insumos_reporte ON turno_insumos(reporte_id);

-- ---------------------------------------------------------------------------
-- 5. turno_documentos_legales (firma y PDF al cerrar turno)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turno_documentos_legales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporte_id uuid NOT NULL REFERENCES reportes_turno(id) ON DELETE CASCADE,
  firma_base64 text NOT NULL DEFAULT '',
  url_pdf_inmutable text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE turno_documentos_legales ADD COLUMN IF NOT EXISTS reporte_id uuid;
ALTER TABLE turno_documentos_legales ADD COLUMN IF NOT EXISTS firma_base64 text NOT NULL DEFAULT '';
ALTER TABLE turno_documentos_legales ADD COLUMN IF NOT EXISTS url_pdf_inmutable text NOT NULL DEFAULT '';
ALTER TABLE turno_documentos_legales ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_turno_documentos_reporte ON turno_documentos_legales(reporte_id);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security (app kiosko sin login — anon + authenticated)
-- ---------------------------------------------------------------------------
ALTER TABLE reportes_turno ENABLE ROW LEVEL SECURITY;
ALTER TABLE turno_trames ENABLE ROW LEVEL SECURITY;
ALTER TABLE turno_bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE turno_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE turno_documentos_legales ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['reportes_turno', 'turno_trames', 'turno_bitacora', 'turno_insumos', 'turno_documentos_legales']
  LOOP
    FOR pol IN
      SELECT format('anon_select_%s', t) AS name, 'SELECT' AS cmd
      UNION ALL SELECT format('anon_insert_%s', t), 'INSERT'
      UNION ALL SELECT format('anon_update_%s', t), 'UPDATE'
      UNION ALL SELECT format('anon_delete_%s', t), 'DELETE'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.name, t);
      IF pol.cmd = 'SELECT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)',
          pol.name, t
        );
      ELSIF pol.cmd = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)',
          pol.name, t
        );
      ELSIF pol.cmd = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)',
          pol.name, t
        );
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR DELETE TO anon, authenticated USING (true)',
          pol.name, t
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Realtime (postgres_changes en src/realtime.ts)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reportes_turno;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE turno_trames;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE turno_bitacora;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE turno_insumos;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Verificación (opcional — descomentar para inspeccionar)
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('reportes_turno','turno_trames','turno_bitacora','turno_insumos','turno_documentos_legales')
-- ORDER BY table_name, ordinal_position;
