import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Trash2, Clock, Search, BookOpen, Lock } from "lucide-react";
import type { ActividadBitacora } from "@/types";
import { CODIGOS_OPERACION, codigoCompleto, diffHoras, horaActualLocal } from "@/config";

interface Props {
  bitacora: ActividadBitacora[];
  turnoActivo: boolean;
  onAgregar: () => void;
  onChange: (id: string, patch: Partial<ActividadBitacora>) => void;
  onBlurActividad: (id: string) => void;
  onEliminar: (id: string) => void;
}

export function BitacoraTiempos({
  bitacora,
  turnoActivo,
  onAgregar,
  onChange,
  onBlurActividad,
  onEliminar,
}: Props) {
  const totalHoras = bitacora.reduce((acc, a) => {
    const h = diffHoras(a.horaDesde, a.horaHasta);
    return acc + (h ?? 0);
  }, 0);

  return (
    <div className="flex flex-col rounded-xl border border-slate-700/70 bg-slate-800/60">
      {/* Header con totales */}
      <div className="bg-gradient-to-r from-sky-700 to-sky-600 px-6 py-4 flex items-center justify-between shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <Clock className="w-7 h-7 text-white" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-50/90">
              Bitácora de Tiempos
            </p>
            <p className="text-3xl font-black text-white leading-none mt-0.5">
              {totalHoras.toFixed(2)} <span className="text-lg font-bold">h totales</span>
            </p>
          </div>
        </div>
      </div>

      <div>
        {bitacora.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-300 font-semibold text-lg">Bitácora vacía</p>
            <p className="text-slate-500 text-sm mt-1 max-w-sm">
              Presiona "Registrar Actividad" para comenzar a registrar los tiempos del turno.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80">
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3">Hora Desde</th>
                <th className="px-3 py-3">Hora Hasta</th>
                <th className="px-3 py-3">Total Horas</th>
                <th className="px-3 py-3 min-w-[200px]">Código de Operación</th>
                <th className="px-3 py-3">Detalle / Observación</th>
                <th className="px-3 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {bitacora.map((act, idx) => {
                const esUltimo = idx === bitacora.length - 1;
                const horas = diffHoras(act.horaDesde, act.horaHasta);
                return (
                  <tr
                    key={act.id}
                    className={`border-t border-slate-700/50 ${esUltimo ? "bg-sky-500/5" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 text-slate-400 font-bold w-24 px-2 py-2">
                        <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        {act.horaDesde}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={act.horaHasta ?? ""}
                        onChange={(e) =>
                          onChange(act.id, { horaHasta: e.target.value || null })
                        }
                        onBlur={() => onBlurActividad(act.id)}
                        disabled={!esUltimo}
                        className={`w-24 rounded-md border px-2 py-2 text-base font-bold outline-none transition ${
                          esUltimo
                            ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
                            : "border-slate-700/50 bg-slate-900/40 text-slate-400 cursor-not-allowed"
                        }`}
                      />
                    </td>

                    <td className="px-3 py-2">
                      <span
                        className={`font-black text-base ${
                          horas != null ? "text-sky-300" : "text-slate-600"
                        }`}
                      >
                        {horas != null ? `${horas.toFixed(2)} h` : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <CodigoAutocomplete
                        value={act.codigoOperacion}
                        disabled={!esUltimo}
                        onChange={(v) => onChange(act.id, { codigoOperacion: v })}
                        onBlur={() => onBlurActividad(act.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={act.detalle}
                        onChange={(e) => onChange(act.id, { detalle: e.target.value })}
                        onBlur={() => onBlurActividad(act.id)}
                        disabled={!esUltimo}
                        placeholder="Detalle..."
                        className={`w-full min-w-[140px] rounded-md border px-2 py-2 text-sm outline-none transition ${
                          esUltimo
                            ? "border-slate-600 bg-slate-900 text-slate-100 focus:border-sky-500"
                            : "border-slate-700/50 bg-slate-900/40 text-slate-400 cursor-not-allowed"
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {esUltimo && (
                        <button
                          onClick={() => onEliminar(act.id)}
                          className="p-2 rounded-md text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition"
                          title="Eliminar actividad"
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

      {turnoActivo && (
        <div className="border-t border-slate-700/60 p-4 bg-slate-900/40 shrink-0">
          <button
            onClick={onAgregar}
            className="btn-grande bg-sky-600 hover:bg-sky-500 text-white w-full text-lg"
          >
            <Plus className="w-6 h-6" />
            Registrar Actividad
          </button>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {bitacora.length === 0
              ? `Primera actividad inicia a las ${horaActualLocal()}`
              : `Próxima actividad inicia a las ${bitacora[bitacora.length - 1].horaHasta ?? bitacora[bitacora.length - 1].horaDesde}`}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Autocomplete predictivo de códigos ---------- */

function CodigoAutocomplete({
  value,
  disabled,
  onChange,
  onBlur,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  const [foco, setFoco] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();

  const sugerencias = useMemo(() => {
    if (!query) return CODIGOS_OPERACION;
    return CODIGOS_OPERACION.filter((c) => {
      const num = c.numero;
      const txt = c.texto.toLowerCase();
      return num.startsWith(query) || txt.includes(query);
    });
  }, [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFoco(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const elegir = (numero: string, texto: string) => {
    onChange(codigoCompleto(numero, texto));
    setFoco(false);
  };

  const teclado = (e: React.KeyboardEvent) => {
    if (!foco || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, sugerencias.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = sugerencias[highlight];
      if (s) elegir(s.numero, s.texto);
    } else if (e.key === "Escape") {
      setFoco(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFoco(true)}
          onKeyDown={teclado}
          onBlur={() => {
            // Delay para permitir click en sugerencia antes de cerrar
            setTimeout(() => setFoco(false), 150);
            onBlur?.();
          }}
          disabled={disabled}
          placeholder="Buscar código..."
          className={`w-full min-w-[200px] rounded-md border pl-8 pr-2 py-2 text-sm font-semibold outline-none transition ${
            disabled
              ? "border-slate-700/50 bg-slate-900/40 text-slate-400 cursor-not-allowed"
              : "border-slate-600 bg-slate-900 text-slate-100 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
          }`}
        />
      </div>
      {foco && !disabled && sugerencias.length > 0 && (
        <div className="absolute z-30 mt-1 w-full min-w-[280px] max-h-64 overflow-auto scrollbar-thin rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">
          {sugerencias.map((s, i) => (
            <button
              key={s.numero}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => elegir(s.numero, s.texto)}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 transition ${
                i === highlight ? "bg-sky-600/30 text-sky-100" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span className="shrink-0 w-7 h-7 rounded bg-slate-800 flex items-center justify-center text-xs font-black text-sky-400">
                {s.numero}
              </span>
              <span className="font-semibold">{s.texto}</span>
            </button>
          ))}
        </div>
      )}
      {foco && !disabled && sugerencias.length === 0 && (
        <div className="absolute z-30 mt-1 w-full min-w-[280px] rounded-lg border border-slate-700 bg-slate-950 shadow-2xl px-3 py-3 text-sm text-slate-500">
          Sin resultados para "{value}"
        </div>
      )}
    </div>
  );
}