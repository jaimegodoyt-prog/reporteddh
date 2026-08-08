import { Plus, Lock, TrendingUp, AlertTriangle, Trash2, Wrench, Repeat, X, Check, Drill, History } from "lucide-react";
import { useState } from "react";
import type { Tramo, HerramientaTipo, Herramienta, CambioHerramientaLog } from "@/types";
import { HERRAMIENTA_LABELS, hora } from "@/config";

interface Props {
  tramos: Tramo[];
  profundidadInicial: number | null;
  turnoActivo: boolean;
  herramientas: Herramienta[];
  historialHerramientas: CambioHerramientaLog[];
  operador: string;
  turnoCerrado: boolean;
  onAgregar: () => void;
  onChangeTramo: (id: string, patch: Partial<Tramo>) => void;
  onBlurTramo: (id: string) => void;
  onEliminarTramo: (id: string) => void;
  onCambiarHerramienta: (
    tipo: HerramientaTipo,
    datos: { diametro: string; marca: string; serie: string },
  ) => void;
}

export function ControlTramos({
  tramos,
  profundidadInicial,
  turnoActivo,
  herramientas,
  historialHerramientas,
  operador,
  turnoCerrado,
  onAgregar,
  onChangeTramo,
  onBlurTramo,
  onEliminarTramo,
  onCambiarHerramienta,
}: Props) {
  const totalMetros = tramos.reduce((acc, t) => {
    if (t.hasta != null && t.hasta > t.desde) return acc + (t.hasta - t.desde);
    return acc;
  }, 0);

  const primerTramoDesde = tramos.length > 0 ? tramos[0].desde : profundidadInicial ?? 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Tabla de tramos - protagonista */}
      <section className="flex-1 flex flex-col min-w-0 rounded-xl border border-slate-700/70 bg-slate-800/60 overflow-hidden">
        {/* Banner verde gigante */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-4 flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-white" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-50/90">
                Total Metros Perforados en el Turno
              </p>
              <p className="text-4xl font-black text-white leading-none mt-0.5">
                {totalMetros.toFixed(2)} <span className="text-xl font-bold">m</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-50/90">Tramos</p>
            <p className="text-3xl font-black text-white leading-none mt-0.5">{tramos.length}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          {tramos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-300 font-semibold text-lg">No hay tramos registrados</p>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">
                Presiona "Agregar Siguiente Tramo" para comenzar a registrar el avance del pozo.
                {profundidadInicial != null && (
                  <> El primer tramo iniciará en {profundidadInicial} m.</>
                )}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80 sticky top-0 z-10">
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-3 w-10">N°</th>
                  <th className="px-3 py-3">Desde (m)</th>
                  <th className="px-3 py-3">Hasta (m)</th>
                  <th className="px-3 py-3">Metros Perforados</th>
                  <th className="px-3 py-3">Herramienta Activa</th>
                  <th className="px-3 py-3">Recuperación %</th>
                  <th className="px-3 py-3">Resta (m)</th>
                  <th className="px-3 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {tramos.map((tramo, idx) => {
                  const esUltimo = idx === tramos.length - 1;
                  const metros =
                    tramo.hasta != null && tramo.hasta > tramo.desde
                      ? tramo.hasta - tramo.desde
                      : null;
                  const hastaError = tramo.hasta != null && tramo.hasta <= tramo.desde;
                  return (
                    <tr
                      key={tramo.id}
                      className={`border-t border-slate-700/50 ${esUltimo ? "bg-emerald-500/5" : ""}`}
                    >
                      <td className="px-3 py-2 text-slate-400 font-bold">{idx + 1}</td>
                      {/* Desde - bloqueado */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                          <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          {tramo.desde.toFixed(2)}
                        </div>
                      </td>
                      {/* Hasta */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={tramo.hasta ?? ""}
                          onChange={(e) =>
                            onChangeTramo(tramo.id, {
                              hasta: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          onBlur={() => onBlurTramo(tramo.id)}
                          disabled={!esUltimo}
                          step="0.01"
                          min={tramo.desde}
                          className={`w-24 rounded-md border px-2 py-2 text-base font-bold outline-none transition ${
                            hastaError
                              ? "border-red-500 bg-red-500/10 text-red-200"
                              : esUltimo
                                ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                                : "border-slate-700/50 bg-slate-900/40 text-slate-300 cursor-not-allowed"
                          }`}
                          placeholder="—"
                        />
                      </td>
                      {/* Metros perforados - auto */}
                      <td className="px-3 py-2">
                        <span
                          className={`font-black text-base ${
                            metros != null ? "text-emerald-300" : "text-slate-600"
                          }`}
                        >
                          {metros != null ? `${metros.toFixed(2)}` : "—"}
                        </span>
                      </td>
                      {/* Herramienta activa */}
                      <td className="px-3 py-2">
                        <select
                          value={tramo.herramientaActiva}
                          onChange={(e) =>
                            onChangeTramo(tramo.id, {
                              herramientaActiva: e.target.value as HerramientaTipo,
                            })
                          }
                          disabled={!esUltimo}
                          className={`rounded-md border px-2 py-2 text-sm font-semibold outline-none transition ${
                            esUltimo
                              ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-500"
                              : "border-slate-700/50 bg-slate-900/40 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          {herramientas.map((h) => (
                            <option key={h.tipo} value={h.tipo}>
                              {HERRAMIENTA_LABELS[h.tipo]} ({h.diametro})
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* Recuperación */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={tramo.recuperacion ?? ""}
                          onChange={(e) =>
                            onChangeTramo(tramo.id, {
                              recuperacion:
                                e.target.value === ""
                                  ? null
                                  : Math.min(100, Math.max(0, Number(e.target.value))),
                            })
                          }
                          onBlur={() => onBlurTramo(tramo.id)}
                          disabled={!esUltimo}
                          min={0}
                          max={100}
                          step="0.1"
                          className={`w-20 rounded-md border px-2 py-2 text-base font-semibold outline-none transition ${
                            esUltimo
                              ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                              : "border-slate-700/50 bg-slate-900/40 text-slate-400 cursor-not-allowed"
                          }`}
                          placeholder="—"
                        />
                      </td>
                      {/* Resta */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={tramo.resta ?? ""}
                          onChange={(e) =>
                            onChangeTramo(tramo.id, {
                              resta: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          onBlur={() => onBlurTramo(tramo.id)}
                          disabled={!esUltimo}
                          step="0.01"
                          className={`w-20 rounded-md border px-2 py-2 text-base font-semibold outline-none transition ${
                            esUltimo
                              ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                              : "border-slate-700/50 bg-slate-900/40 text-slate-400 cursor-not-allowed"
                          }`}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {esUltimo && (
                          <button
                            onClick={() => onEliminarTramo(tramo.id)}
                            className="p-2 rounded-md text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition"
                            title="Eliminar tramo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {hastaErrorUltimo(tramos) && (
          <div className="px-4 py-2 bg-red-500/15 border-t border-red-500/40 flex items-center gap-2 text-red-200 text-sm font-semibold shrink-0">
            <AlertTriangle className="w-4 h-4" />
            "Hasta" debe ser mayor que "Desde" en el tramo actual.
          </div>
        )}

        {turnoActivo && (
          <div className="border-t border-slate-700/60 p-4 bg-slate-900/40 shrink-0">
            <button
              onClick={onAgregar}
              className="btn-grande bg-emerald-600 hover:bg-emerald-500 text-white w-full text-lg"
            >
              <Plus className="w-6 h-6" />
              Agregar Siguiente Tramo
            </button>
            <p className="text-xs text-slate-500 mt-2 text-center">
              {tramos.length === 0
                ? `El primer tramo iniciará en ${primerTramoDesde.toFixed(2)} m`
                : `Próximo tramo iniciará en ${(
                    tramos[tramos.length - 1].hasta ?? tramos[tramos.length - 1].desde
                  ).toFixed(2)} m`}
            </p>
          </div>
        )}
      </section>

      {/* Panel lateral de herramientas */}
      <aside className="lg:w-[340px] shrink-0 rounded-xl border border-slate-700/70 bg-slate-800/60 p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            Herramientas en Pozo
          </h2>
        </div>
        <span className="text-xs text-slate-500 mb-3 block">Heredadas del turno anterior</span>

        <div className="space-y-3">
          {herramientas.map((h) => (
            <TarjetaHerramienta
              key={h.tipo}
              herramienta={h}
              turnoCerrado={turnoCerrado}
              onCambiar={onCambiarHerramienta}
            />
          ))}
        </div>

        {historialHerramientas.length > 0 && (
          <div className="mt-5 border-t border-slate-700/60 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Historial de cambios
            </p>
            <div className="space-y-1.5 max-h-40 overflow-auto scrollbar-thin">
              {historialHerramientas
                .slice()
                .reverse()
                .map((c) => (
                  <div
                    key={c.id}
                    className="text-xs text-slate-400 flex items-center justify-between gap-2 bg-slate-900/40 rounded-md px-2 py-1.5"
                  >
                    <span>
                      <span className="text-slate-200 font-semibold">
                        {HERRAMIENTA_LABELS[c.tipo]}
                      </span>{" "}
                      — {c.diametro} · {c.marca} · {c.serie}
                    </span>
                    <span className="text-slate-500 shrink-0">{hora(c.cambiadoEn)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function hastaErrorUltimo(tramos: Tramo[]): boolean {
  if (tramos.length === 0) return false;
  const u = tramos[tramos.length - 1];
  return u.hasta != null && u.hasta <= u.desde;
}

function TarjetaHerramienta({
  herramienta,
  turnoCerrado,
  onCambiar,
}: {
  herramienta: Herramienta;
  turnoCerrado: boolean;
  onCambiar: (
    tipo: HerramientaTipo,
    datos: { diametro: string; marca: string; serie: string },
  ) => void;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Drill className="w-5 h-5 text-sky-400" />
          <span className="font-bold text-slate-100">{HERRAMIENTA_LABELS[herramienta.tipo]}</span>
        </div>
        {!turnoCerrado && (
          <button
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-2 text-xs font-bold text-slate-100 transition active:scale-95"
          >
            <Repeat className="w-3.5 h-3.5" />
            Cambiar
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Dato label="Diámetro" valor={herramienta.diametro} />
        <Dato label="Marca" valor={herramienta.marca} />
        <Dato label="Serie" valor={herramienta.serie} />
      </div>

      {editando && (
        <ModalCambiar
          herramienta={herramienta}
          onConfirm={(datos) => {
            onCambiar(herramienta.tipo, datos);
            setEditando(false);
          }}
          onCancel={() => setEditando(false)}
        />
      )}
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-slate-200 font-semibold truncate">{valor || "—"}</p>
    </div>
  );
}

function ModalCambiar({
  herramienta,
  onConfirm,
  onCancel,
}: {
  herramienta: Herramienta;
  onConfirm: (datos: { diametro: string; marca: string; serie: string }) => void;
  onCancel: () => void;
}) {
  const [diametro, setDiametro] = useState(herramienta.diametro);
  const [marca, setMarca] = useState(herramienta.marca);
  const [serie, setSerie] = useState(herramienta.serie);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Repeat className="w-5 h-5 text-emerald-400" />
            Cambiar {HERRAMIENTA_LABELS[herramienta.tipo]}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <span className="campo-label">Nuevo Diámetro</span>
            <input
              className="campo-input"
              value={diametro}
              onChange={(e) => setDiametro(e.target.value)}
              placeholder="Ej. 6 1/2 in"
              autoFocus
            />
          </div>
          <div>
            <span className="campo-label">Nueva Marca</span>
            <input
              className="campo-input"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Ej. Sandvik"
            />
          </div>
          <div>
            <span className="campo-label">Nueva Serie</span>
            <input
              className="campo-input"
              value={serie}
              onChange={(e) => setSerie(e.target.value)}
              placeholder="Ej. COR-88512-C"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={onCancel}
            className="btn-grande bg-slate-700 hover:bg-slate-600 text-slate-100 flex-1"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ diametro, marca, serie })}
            disabled={!diametro.trim() || !marca.trim() || !serie.trim()}
            className="btn-grande bg-emerald-600 hover:bg-emerald-500 text-white flex-1"
          >
            <Check className="w-5 h-5" />
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
