import {
  Lock,
  HardHat,
  Users,
  Play,
  Wrench,
  TrendingUp,
  Gauge,
  Flag,
  Cloud,
  CloudOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import type { Turno, CasingRow } from "@/types";
import type { MetricasNube } from "@/realtime";
import { fechaHora } from "@/config";

// Agrupa las filas de Casing por diámetro consecutivo, mostrando la
// profundidad alcanzada por cada diámetro (el último Total de ese grupo).
function resumenCasing(casing: CasingRow[] | undefined): { diametro: string; profundidad: number }[] {
  const grupos: { diametro: string; profundidad: number }[] = [];
  for (const c of casing ?? []) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.diametro === c.diametro) {
      ultimo.profundidad = c.total;
    } else {
      grupos.push({ diametro: c.diametro, profundidad: c.total });
    }
  }
  return grupos;
}

interface Props {
  turno: Turno;
  profundidadFinal: number;
  totalPerforadoPozo: number;
  metricasNube: MetricasNube | null;
  realtimeActivo: boolean;
  onChange: (patch: Partial<Turno>) => void;
  onBuscarPozo: (pozo: string) => void;
  onIniciar: () => void;
  onIniciarEnNube: () => void;
  iniciandoNube: boolean;
  initNubeMsg: { tipo: "ok" | "error"; texto: string } | null;
  onProbarConexion: () => void;
  onRegistrarRelevo: () => void;
  diag: DiagnosticoNube | null;
  modoTerreno: boolean;
  colaSync: number;
}

export interface DiagnosticoNube {
  estado: "idle" | "procesando" | "ok" | "error";
  mensaje: string;
  payload: string;
  resultadoId: string | null;
  timestamp: string;
}

export function Inicializacion({
  turno,
  profundidadFinal,
  totalPerforadoPozo,
  metricasNube,
  realtimeActivo,
  onChange,
  onBuscarPozo,
  onIniciar,
  onIniciarEnNube,
  iniciandoNube,
  initNubeMsg,
  onProbarConexion,
  onRegistrarRelevo,
  diag,
  modoTerreno,
  colaSync,
}: Props) {
  const camposIncompletos =
    !turno.sector ||
    !turno.diametro ||
    !turno.pozo ||
    !turno.orientacion ||
    turno.profundidadInicial == null ||
    turno.profundidadInicial < 0;

  const operadorIncompleto = !turno.operador.trim();
  const puedeIniciar =
    turno.estado === "borrador" && !camposIncompletos && !operadorIncompleto;
  const turnoIniciado = turno.estado !== "borrador";
  const congelado = turno.inicializado;

  return (
    <div className="space-y-4">
      {/* Métricas del Pozo - panel destacado arriba */}
      <section className="rounded-xl border border-emerald-600/40 bg-gradient-to-br from-emerald-600/10 to-slate-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-400" />
            Métricas del Pozo
          </h2>
          {realtimeActivo && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-300 border border-sky-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              En vivo
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Metrica
            label="Profundidad Inicial"
            valor={`${(turno.profundidadInicial ?? 0).toFixed(2)} m`}
            icon={<TrendingUp className="w-4 h-4 text-sky-400" />}
          />
          <Metrica
            label="Profundidad Final"
            valor={`${profundidadFinal.toFixed(2)} m`}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
            destacado
          />
          <Metrica
            label="Total Perforado del Pozo"
            valor={`${totalPerforadoPozo.toFixed(2)} m`}
            icon={<Gauge className="w-4 h-4 text-amber-400" />}
          />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Profundidad Final se actualiza al instante en la tablet y se confirma en la nube en segundos.
          {metricasNube && (
            <span className="block mt-1 text-sky-400/80">
              Nube: {metricasNube.totalTramos} tramo(s) · {metricasNube.totalActividades} actividad(es) ·{" "}
              {metricasNube.totalInsumos} insumo(s)
              {metricasNube.actualizadoEn && (
                <> · sync {fechaHora(metricasNube.actualizadoEn)}</>
              )}
            </span>
          )}
        </p>
      </section>

      {/* Cabecera del turno */}
      <section className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <HardHat className="w-5 h-5 text-emerald-400" />
            Inicialización del Turno
          </h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              turno.estado === "cerrado"
                ? "bg-slate-700 text-slate-300"
                : turnoIniciado
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/40"
            }`}
          >
            {turno.estado === "cerrado" ? "Cerrado" : turnoIniciado ? "Iniciado" : "Borrador"}
          </span>
        </div>

        {/* Campos fijos - no editables */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <span className="campo-label">Equipo (protegido)</span>
            <div className="campo-bloqueado">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-200">{turno.equipo}</span>
            </div>
          </div>
          <div>
            <span className="campo-label">Faena (protegido)</span>
            <div className="campo-bloqueado">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-200">{turno.faena}</span>
            </div>
          </div>
        </div>

        {/* Datos de inicio de turno - se congelan tras primer guardado */}
        <div className="border-t border-slate-700/60 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Datos de inicio de turno {congelado && "(congelados)"}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Campo
              label="Sector"
              value={turno.sector}
              disabled={congelado}
              placeholder="Ej. Sector Norte"
              onChange={(v) => onChange({ sector: v })}
            />
            <Campo
              label="Diámetro"
              value={turno.diametro}
              disabled={congelado}
              placeholder="Ej. HQ, NQ"
              onChange={(v) => onChange({ diametro: v })}
            />
            <Campo
              label="Pozo"
              value={turno.pozo}
              disabled={congelado}
              placeholder="Ej. DDH-01"
              onChange={(v) => onChange({ pozo: v })}
              onBlurExtra={onBuscarPozo}
            />
            <Campo
              label="Orientación"
              value={turno.orientacion}
              disabled={congelado}
              placeholder="Ej. -80°"
              onChange={(v) => onChange({ orientacion: v })}
            />
            <CampoNumero
              label="Profundidad Inicial (m)"
              value={turno.profundidadInicial}
              disabled={congelado}
              placeholder="0"
              onChange={(v) => onChange({ profundidadInicial: v })}
            />
            <CampoNumero
              label="Programado (m)"
              value={turno.programado}
              disabled={congelado}
              placeholder="0"
              onChange={(v) => onChange({ programado: v })}
            />
          </div>

          {/* Casing - se autocompleta desde la pestaña Tramos, agrupado por diámetro */}
          <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Casing
            </p>
            {resumenCasing(turno.casing).length === 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="campo-label">Diámetro</span>
                  <div className="campo-bloqueado">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-200">—</span>
                  </div>
                </div>
                <div>
                  <span className="campo-label">Profundidad</span>
                  <div className="campo-bloqueado">
                    <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-200">—</span>
                  </div>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-1">Diámetro</th>
                    <th className="pb-1">Profundidad</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenCasing(turno.casing).map((g, i) => (
                    <tr key={i}>
                      <td className="py-0.5 font-bold text-slate-200 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {g.diametro || "—"}
                      </td>
                      <td className="py-0.5 font-bold text-slate-200">{g.profundidad} m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Horómetro Inicial - se arrastra del último Horómetro Final registrado */}
          <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/40 p-3">
            <span className="campo-label">Horómetro Inicial</span>
            <div className="campo-bloqueado">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-bold text-slate-200">
                {turno.horometroInicial != null ? turno.horometroInicial : "—"}
              </span>
            </div>
          </div>
        </div>

          {/* Operadores - editables siempre */}
        <div className="border-t border-slate-700/60 pt-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Personal de turno {turnoIniciado && "(editable ante relevos)"}
            </p>
            {turno.historialRelevos.length > 0 && (
              <span className="text-xs text-slate-500">
                {turno.historialRelevos.length} relevo
                {turno.historialRelevos.length !== 1 ? "s" : ""} registrados
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Campo
              label="Operador Principal"
              value={turno.operador}
              disabled={turno.estado === "cerrado"}
              placeholder="Nombre operador"
              onChange={(v) => onChange({ operador: v })}
            />
            <Campo
              label="Ayudante 1"
              value={turno.ayudante1}
              disabled={turno.estado === "cerrado"}
              placeholder="Nombre"
              onChange={(v) => onChange({ ayudante1: v })}
            />
            <Campo
              label="Ayudante 2"
              value={turno.ayudante2}
              disabled={turno.estado === "cerrado"}
              placeholder="Nombre"
              onChange={(v) => onChange({ ayudante2: v })}
            />
            <Campo
              label="Ayudante 3"
              value={turno.ayudante3}
              disabled={turno.estado === "cerrado"}
              placeholder="Nombre"
              onChange={(v) => onChange({ ayudante3: v })}
            />
          </div>
          {turnoIniciado && turno.estado !== "cerrado" && (
            <button
              onClick={onRegistrarRelevo}
              className="btn-grande bg-sky-600 hover:bg-sky-500 text-white mt-3 w-full"
            >
              <Wrench className="w-5 h-5" />
              Registrar Relevo de Personal
            </button>
          )}
        </div>

        {/* Botón iniciar en la nube + iniciar local */}
        {turno.estado === "borrador" && (
          <div className="border-t border-slate-700/60 pt-4 mt-4 space-y-3">
            {camposIncompletos && (
              <p className="text-sm text-amber-300 mb-1">
                Completa todos los datos de inicio de turno y el operador para comenzar.
              </p>
            )}
            {operadorIncompleto && !camposIncompletos && (
              <p className="text-sm text-amber-300 mb-1">Ingresa el nombre del operador principal.</p>
            )}

            {/* Mensaje de resultado de la inicialización en la nube */}
            {initNubeMsg && (
              <div
                className={`rounded-lg px-4 py-3 text-sm font-semibold flex items-center gap-2 ${
                  initNubeMsg.tipo === "ok"
                    ? initNubeMsg.texto.includes("Modo Terreno")
                      ? "bg-amber-500/15 border border-amber-500/40 text-amber-200"
                      : "bg-emerald-500/15 border border-emerald-500/40 text-emerald-200"
                    : "bg-red-500/15 border border-red-500/40 text-red-200"
                }`}
              >
                {initNubeMsg.tipo === "ok" ? (
                  initNubeMsg.texto.includes("Modo Terreno") ? (
                    <WifiOff className="w-5 h-5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  )
                ) : (
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                )}
                <span className="break-all">{initNubeMsg.texto}</span>
              </div>
            )}

            {/* Banner Modo Terreno Activo dentro de Inicialización */}
            {modoTerreno && (
              <div className="rounded-lg px-4 py-3 bg-amber-500/10 border border-amber-500/40 flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-200">Modo Terreno Activo</p>
                  <p className="text-xs text-amber-300/70">
                    Datos guardados localmente en la Tablet{colaSync > 0 ? ` · ${colaSync} registro(s) en cola de sincronización automática` : ""}. Se enviarán a Supabase cuando la conexión se restablezca.
                  </p>
                </div>
              </div>
            )}

            {/* Botón de prueba de conexión */}
            <button
              onClick={onProbarConexion}
              disabled={iniciandoNube}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold border border-slate-600 bg-slate-800/60 hover:bg-slate-700 text-slate-300 transition disabled:opacity-50"
            >
              <CloudOff className="w-4 h-4" />
              Probar conexión con Supabase
            </button>

            {/* Botón grande: INICIAR TURNO EN LA NUBE */}
            <button
              onClick={onIniciarEnNube}
              disabled={!puedeIniciar || iniciandoNube}
              className="btn-grande bg-sky-600 hover:bg-sky-500 text-white w-full text-lg"
            >
              {iniciandoNube ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Cloud className="w-6 h-6" />
              )}
              {iniciandoNube ? "Insertando en Supabase..." : "Iniciar turno"}
            </button>

            {/* Botón secundario: iniciar solo local */}
            <button
              onClick={onIniciar}
              disabled={!puedeIniciar || iniciandoNube}
              className="btn-grande bg-slate-700 hover:bg-slate-600 text-slate-100 w-full"
            >
              <Play className="w-5 h-5" />
              Iniciar solo local (sin nube)
            </button>

            <p className="text-xs text-slate-500 text-center">
              Al iniciar, los datos de cabecera se congelan y se inserta el registro en Supabase.
            </p>
          </div>
        )}

        {turno.iniciadoEn && (
          <p className="text-xs text-slate-500 mt-3">
            Turno iniciado el {fechaHora(turno.iniciadoEn)}
            {turno.cloudId && (
              <span className="text-emerald-400 block mt-0.5">
                <Cloud className="w-3 h-3 inline mr-1" />
                Registro en la nube: {turno.cloudId.slice(0, 8)}...
              </span>
            )}
            {turno.iniciadoEn && !turno.cloudId && (
              <span className="text-amber-400 block mt-0.5">
                <CloudOff className="w-3 h-3 inline mr-1" />
                Turno local sin sincronizar a la nube
              </span>
            )}
          </p>
        )}
      </section>

      {turno.historialRelevos.length > 0 && (
        <section className="rounded-xl border border-slate-700/70 bg-slate-800/60 p-5">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-sky-400" />
            Historial de relevos
          </h3>
          <div className="space-y-1.5">
            {turno.historialRelevos
              .slice()
              .reverse()
              .map((r) => (
                <div
                  key={r.id}
                  className="text-xs text-slate-400 flex items-center justify-between gap-2 bg-slate-900/40 rounded-md px-3 py-2"
                >
                  <span>
                    Operador: <span className="text-slate-200 font-semibold">{r.operador || "—"}</span>
                    {r.ayudante1 && <> · A1: {r.ayudante1}</>}
                    {r.ayudante2 && <> · A2: {r.ayudante2}</>}
                    {r.ayudante3 && <> · A3: {r.ayudante3}</>}
                  </span>
                  <span className="text-slate-500 shrink-0">{fechaHora(r.registradoEn)}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ===== DIAGNÓSTICO DE NUBE ===== */}
      <div className="mt-6 p-4 rounded-xl border-2 border-slate-700 bg-slate-950/80">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Cloud className="w-4 h-4" />
          Diagnóstico de conexión Supabase
        </h3>

        {diag && diag.estado === "idle" && (
          <p className="text-sm text-slate-500">
            Sin peticiones realizadas aún. Presiona "Probar conexión" o "Iniciar turno".
          </p>
        )}

        {diag && diag.estado === "procesando" && (
          <div className="text-lg font-bold text-sky-300 flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Procesando petición a Supabase...
          </div>
        )}

        {diag && diag.estado === "ok" && (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border-2 border-emerald-500 rounded-xl p-4 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <div className="text-3xl font-black text-emerald-400 leading-tight">
                Sincronizacion Exitosa con Supabase Real!
              </div>
              {diag.resultadoId && (
                <div className="mt-2 text-lg font-bold text-emerald-300/90 break-all">
                  ID: {diag.resultadoId}
                </div>
              )}
            </div>
            <div className="text-sm text-emerald-300/80 break-all">
              {diag.mensaje}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              <p className="font-semibold mb-1">Payload enviado:</p>
              <pre className="bg-slate-900 rounded p-2 overflow-auto max-h-40 text-emerald-300/70 whitespace-pre-wrap break-all">{diag.payload}</pre>
            </div>
            <p className="text-xs text-slate-600">Timestamp: {diag.timestamp}</p>
          </div>
        )}

        {diag && diag.estado === "error" && (
          <div className="space-y-2">
            <div className="text-2xl font-black text-red-400 leading-tight break-all">
              Error capturado en Supabase: {diag.mensaje}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              <p className="font-semibold mb-1 text-red-400">Payload que se intentó enviar:</p>
              <pre className="bg-slate-900 rounded p-2 overflow-auto max-h-40 text-red-300/70 whitespace-pre-wrap break-all">{diag.payload}</pre>
            </div>
            <p className="text-xs text-slate-600">Timestamp: {diag.timestamp}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Metrica({
  label,
  valor,
  icon,
  destacado,
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 text-center ${
        destacado
          ? "bg-emerald-500/15 border border-emerald-500/40"
          : "bg-slate-900/50 border border-slate-700/50"
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
      </div>
      <p
        className={`text-2xl font-black leading-none ${
          destacado ? "text-emerald-200" : "text-slate-100"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  onBlurExtra,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onBlurExtra?: (value: string) => void;
}) {
  return (
    <div>
      <span className="campo-label">{label}</span>
      <input
        className="campo-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(ev) => {
          const v = ev.target.value.trim();
          onChange(v);
          onBlurExtra?.(v);
        }}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
    </div>
  );
}

function CampoNumero({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <span className="campo-label">{label}</span>
      <input
        type="number"
        className="campo-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        min={0}
        step="0.01"
        autoComplete="off"
      />
    </div>
  );
}
