/*
# Fase 2 del rediseño: nueva estructura de "Tramos" + tabla Casing

## Descripción
La pestaña "Tramos" cambia sus columnas de registro (Hta. desde, Agrega,
Total Hta., Fondo, Resta, Perf., Rec., Tipo de roca) y agrega una sección
"Casing" con su propio historial de filas. También se agregan "Barril" y
"Muerto" a la cabecera del turno (cálculo de herramienta).

No se eliminan las columnas antiguas de turno_trames (desde, hasta,
herramienta_activa) para no perder datos de pruebas anteriores; solo
quedan sin uso desde ahora. Segura de ejecutar varias veces.
*/

-- Nuevas columnas en turno_trames
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS hta_desde numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS agrega numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS total_hta numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS fondo numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS perf numeric;
ALTER TABLE turno_trames ADD COLUMN IF NOT EXISTS tipo_roca text;

-- Barril / Muerto en la cabecera del turno
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS barril numeric;
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS muerto numeric;

-- Tabla nueva: turno_casing
CREATE TABLE IF NOT EXISTS turno_casing (
  id text PRIMARY KEY,
  reporte_id uuid NOT NULL REFERENCES reportes_turno(id) ON DELETE CASCADE,
  diametro text NOT NULL DEFAULT '',
  desde numeric NOT NULL DEFAULT 0,
  agrega numeric,
  total numeric NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turno_casing_reporte ON turno_casing(reporte_id);

ALTER TABLE turno_casing ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT 'anon_select_turno_casing' AS name, 'SELECT' AS cmd
    UNION ALL SELECT 'anon_insert_turno_casing', 'INSERT'
    UNION ALL SELECT 'anon_update_turno_casing', 'UPDATE'
    UNION ALL SELECT 'anon_delete_turno_casing', 'DELETE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON turno_casing', pol.name);
    IF pol.cmd = 'SELECT' THEN
      EXECUTE format('CREATE POLICY %I ON turno_casing FOR SELECT TO anon, authenticated USING (true)', pol.name);
    ELSIF pol.cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON turno_casing FOR INSERT TO anon, authenticated WITH CHECK (true)', pol.name);
    ELSIF pol.cmd = 'UPDATE' THEN
      EXECUTE format('CREATE POLICY %I ON turno_casing FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', pol.name);
    ELSE
      EXECUTE format('CREATE POLICY %I ON turno_casing FOR DELETE TO anon, authenticated USING (true)', pol.name);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE turno_casing;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
