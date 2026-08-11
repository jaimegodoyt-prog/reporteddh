/*
# Agregar columnas "Programado" y "Casing" a reportes_turno

## Descripción
Fase 1 del rediseño de interfaz: la pestaña "Datos" ahora captura un valor
"Programado" y muestra un bloque "Casing" (diámetro y profundidad) que se
alimenta desde la pestaña "Tramos". Esta migración agrega las columnas
correspondientes en reportes_turno. Segura de ejecutar varias veces.
*/

ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS programado numeric;
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS casing_diametro text;
ALTER TABLE reportes_turno ADD COLUMN IF NOT EXISTS casing_profundidad numeric;
