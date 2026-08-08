/*
# Permitir columnas vacías mientras el operador aún no las completa

## Descripción
La app guarda un tramo apenas se crea (con "hasta" vacío, porque se llena
recién cuando el operador termina ese tramo). Lo mismo pasa con otros
campos que se completan más tarde en el turno. Esta migración relaja
esas columnas para que puedan quedar en NULL mientras tanto.
Es la misma migración que se aplicó manualmente en el SQL Editor de
Supabase el 07-08-2026; se deja aquí documentada para que el esquema
completo de la base de datos quede reproducible desde el código.

Segura de ejecutar varias veces.
*/

ALTER TABLE turno_trames ALTER COLUMN hasta DROP NOT NULL;
ALTER TABLE turno_trames ALTER COLUMN recuperacion_porcentaje DROP NOT NULL;
ALTER TABLE turno_trames ALTER COLUMN resta DROP NOT NULL;

ALTER TABLE reportes_turno ALTER COLUMN profundidad_inicial DROP NOT NULL;
ALTER TABLE reportes_turno ALTER COLUMN profundidad_final DROP NOT NULL;
ALTER TABLE reportes_turno ALTER COLUMN cerrado_el DROP NOT NULL;

ALTER TABLE turno_bitacora ALTER COLUMN hora_hasta DROP NOT NULL;

ALTER TABLE turno_insumos ALTER COLUMN cantidad DROP NOT NULL;
