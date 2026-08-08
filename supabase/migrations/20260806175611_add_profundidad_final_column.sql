/*
# Agregar columna profundidad_final a reportes_turno

## Descripción
La app envía el campo `profundidad_final` pero la tabla no lo tenía, lo que
causaba un error silencioso al insertar. Esta migración agrega la columna
como nullable para no romper inserts existentes.

## Cambios
- `reportes_turno`: nueva columna `profundidad_final` (numeric, nullable).
*/

ALTER TABLE reportes_turno
  ADD COLUMN IF NOT EXISTS profundidad_final numeric;
