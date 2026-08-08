import { useRef, useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Package, MessageSquare, PenLine, Eraser, Lock, CheckCircle2, Cloud } from "lucide-react";
import type { Insumo, UnidadInsumo, Turno } from "@/types";
import { fechaHora } from "@/config";

interface Props {
  turno: Turno;
  onAgregarInsumo: () => void;
  onChangeInsumo: (id: string, patch: Partial<Insumo>) => void;
  onBlurInsumos: () => void;
  onEliminarInsumo: (id: string) => void;
  onChangeObservaciones: (v: string) => void;
  onFirmaChange: (dataUrl: string | null) => void;
  onCerrarTurno: () => void;
}

const UNIDADES: UnidadInsumo[] = ["Saco", "Litro", "Balde", "Barra"];

export function AditivosCierre({
  turno,
  onAgregarInsumo,
  onChangeInsumo,
  onBlurInsumos,
  onEliminarInsumo,
  onChangeObservaciones,
  onFirmaChange,
  onCerrarTurno,
}: Props) {
  const turnoCerrado = turno.estado === "cerrado";
  const turnoActivo = turno.estado === "iniciado";
  const firmado = !!turno.firmaDataURL;
  const hayInsumos = turno.insumos.length > 0;

  const puedeCerrar =
    turnoActivo && firmado && turno.operador.trim() !== "";

  return (
    <div className="space-y-4">
      {/* Insumos consumidos */}
      <section className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Insumos Consumidos
          </h2>
          {turnoActivo && (
            <button
              onClick={onAgregarInsumo}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Agregar Insumo
            </button>
          )}
        </div>

        {hayInsumos ? (
          <div className="max-h-[300px] overflow-y-auto overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700/60">
                  <th className="px-3 py-2">Nombre del Insumo</th>
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2">Cantidad</th>
                  <th className="px-3 py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {turno.insumos.map((ins) => (
                  <tr key={ins.id} className="border-b border-slate-700/40">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={ins.nombre}
                        onChange={(e) => onChangeInsumo(ins.id, { nombre: e.target.value })}
                        onBlur={onBlurInsumos}
                        disabled={turnoCerrado}
                        placeholder="Ej. Bentonita"
                        className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-900/40 disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={ins.unidad}
                        onChange={(e) =>
                          onChangeInsumo(ins.id, { unidad: e.target.value as UnidadInsumo })
                        }
                        disabled={turnoCerrado}
                        className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-base text-slate-100 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-900/40 disabled:text-slate-400"
                      >
                        {UNIDADES.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={ins.cantidad ?? ""}
                        onChange={(e) =>
                          onChangeInsumo(ins.id, {
                            cantidad: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        onBlur={onBlurInsumos}
                        disabled={turnoCerrado}
                        min={0}
                        step="0.01"
                        placeholder="0"
                        className="w-24 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-base font-bold text-slate-100 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-900/40 disabled:text-slate-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {!turnoCerrado && (
                        <button
                          onClick={() => onEliminarInsumo(ins.id)}
                          className="p-2 rounded-md text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-4 text-center">
            No se han registrado insumos. Disponible durante todo el turno.
          </p>
        )}
      </section>

      {/* Observaciones */}
      <section className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-5">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-3">
          <MessageSquare className="w-5 h-5 text-emerald-400" />
          Observaciones del Turno
        </h2>
        <textarea
          value={turno.observaciones}
          onChange={(e) => onChangeObservaciones(e.target.value)}
          disabled={turnoCerrado}
          placeholder="Comentarios generales del estado del turno, incidencias, novedades..."
          rows={4}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-base text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 resize-y disabled:cursor-not-allowed disabled:bg-slate-900/40 disabled:text-slate-400"
        />
      </section>

      {/* Firma digital */}
      <section className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-emerald-400" />
              Firma del Operador
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Válida conforme a la Ley N° 19.799 sobre Documentos Electrónicos (Chile)
            </p>
          </div>
          {firmado && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
              Firmado
            </span>
          )}
        </div>

        {turnoCerrado && turno.firmaDataURL ? (
          <div className="rounded-lg border border-slate-600 bg-white p-2">
            <img src={turno.firmaDataURL} alt="Firma del operador" className="w-full h-32 object-contain" />
          </div>
        ) : (
          <FirmaCanvas
            initialDataURL={turno.firmaDataURL}
            disabled={turnoCerrado}
            onChange={onFirmaChange}
          />
        )}
      </section>

      {/* Cierre del turno */}
      {turnoActivo && (
        <section className="rounded-xl border border-red-600/40 bg-red-600/5 p-5">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-3">
            <Lock className="w-5 h-5 text-red-400" />
            Cierre Definitivo del Turno
          </h2>
          {!firmado && (
            <p className="text-sm text-amber-300 mb-3">
              Debes firmar en el recuadro anterior antes de cerrar el turno.
            </p>
          )}
          {!turno.operador.trim() && (
            <p className="text-sm text-amber-300 mb-3">
              Debes ingresar el nombre del operador en la Pestaña 1.
            </p>
          )}
          <button
            onClick={onCerrarTurno}
            disabled={!puedeCerrar}
            className="btn-grande bg-red-600 hover:bg-red-500 text-white w-full text-lg"
          >
            <CheckCircle2 className="w-6 h-6" />
            Cerrar Turno y Generar Reporte Inmutable
          </button>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Al cerrar, todos los datos se congelan en IndexedDB con marcas de tiempo del dispositivo,
            creando un registro inalterable listo para sincronizar.
          </p>
        </section>
      )}

      {/* Estado post-cierre */}
      {turnoCerrado && (
        <section className="rounded-xl border border-emerald-600/40 bg-emerald-600/10 p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-emerald-200">Turno Cerrado y Sellado</h2>
          <p className="text-sm text-slate-300 mt-1">
            Reporte inmutable generado {turno.cerradoEn && <>el {fechaHora(turno.cerradoEn)}</>}.
          </p>
          <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-sky-600/15 border border-sky-500/40 text-sky-200 text-sm font-semibold">
            <Cloud className="w-4 h-4" />
            Listo para sincronizar con Supabase al detectar red
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Un nuevo turno en blanco está disponible. Registra a la Pestaña 1 para comenzar.
          </p>
        </section>
      )}
    </div>
  );
}

/* ---------- Canvas de firma ---------- */

function FirmaCanvas({
  initialDataURL,
  disabled,
  onChange,
}: {
  initialDataURL: string | null;
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!initialDataURL);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  // Configurar canvas de alta resolución
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;

    if (initialDataURL) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialDataURL;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const start = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = pos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx || !lastRef.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (!hasInk) setHasInk(true);
  };

  const end = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = false;
    lastRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        onChange(canvas.toDataURL("image/png"));
      } catch {
        // ignore
      }
    }
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-lg border-2 border-dashed border-slate-600 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className={`w-full h-40 touch-none ${disabled ? "pointer-events-none opacity-70" : "cursor-crosshair"}`}
        />
        {!hasInk && (
          <p className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none">
            Firme aquí con el dedo
          </p>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-500">
          Dibuje su firma con el dedo sobre la pantalla táctil.
        </p>
        <button
          onClick={limpiar}
          disabled={disabled || !hasInk}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-2 text-xs font-bold text-slate-100 transition active:scale-95 disabled:opacity-40"
        >
          <Eraser className="w-3.5 h-3.5" />
          Limpiar Firma
        </button>
      </div>
    </div>
  );
}
