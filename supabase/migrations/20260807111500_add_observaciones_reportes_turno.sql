/*
# Alinear reportes_turno con la app de sincronización

La app envía `observaciones` (y otras columnas) en upsert/update.
Esta migración agrega las columnas que puedan faltar sin romper datos existentes.
*/

ALTER TABLE reportes_turno
  ADD COLUMN IF NOT EXISTS observaciones text NOT NULL DEFAULT '';

ALTER TABLE reportes_turno
  ADD COLUMN IF NOT EXISTS profundidad_final numeric;

ALTER TABLE reportes_turno
  ADD COLUMN IF NOT EXISTS cerrado_el timestamptz;

ALTER TABLE reportes_turno
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
