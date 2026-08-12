import { useEffect, useState, useCallback, useRef } from "react";
import { Wifi, WifiOff, ClipboardList, Settings, Layers, Clock, Package, Cloud, CloudOff, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, X } from "lucide-react";
import type {
  Turno,
  Tramo,
  CasingRow,
  HerramientaTipo,
  ActividadBitacora,
  Insumo,
} from "@/types";
import { cargarTurnoActual, guardarTurno, cerrarTurno as cerrarEnDB, pushAudit, buscarUltimosTurnosPorPozo } from "@/db";
import {
  uid,
  ahoraISO,
  fechaHora,
  horaActualLocal,
} from "@/config";
import {
  insertReporteCloud,
  autoSyncTurno,
  syncTodo,
  cerrarTurnoCloud,
  testConexion,
  reintentarCola,
  colaPendiente,
  type SyncResult,
  type SyncScope,
} from "@/sync";
import { suscribirTurnoRealtime, type MetricasNube } from "@/realtime";
import { Inicializacion, type DiagnosticoNube } from "@/components/Inicializacion";
import { SUPABASE_PROJECT_URL } from "@/supabaseClient";
import { ControlTramos } from "@/components/ControlTramos";
import { BitacoraTiempos } from "@/components/BitacoraTiempos";
import { AditivosCierre } from "@/components/AditivosCierre";

type Pestaña = "inicializacion" | "tramos" | "bitacora" | "cierre";

const PESTANAS: { id: Pestaña; label: string; icon: React.ReactNode }[] = [
  { id: "inicializacion", label: "Datos", icon: <Settings className="w-4 h-4" /> },
  { id: "tramos", label: "Tramos", icon: <Layers className="w-4 h-4" /> },
  { id: "bitacora", label: "Bitácora", icon: <Clock className="w-4 h-4" /> },
  { id: "cierre", label: "Insumos", icon: <Package className="w-4 h-4" /> },
];

function idLocalFallback(): string {
  return "LOCAL-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function esUUIDValido(id: string | null | undefined): id is string {
  return !!id && UUID_RE.test(id);
}

export default function App() {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [cargando, setCargando] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [pestaña, setPestaña] = useState<Pestaña>("inicializacion");
  const [relevoFlash, setRelevoFlash] = useState(false);
  const [syncEstado, setSyncEstado] = useState<"idle" | "sincronizando" | "ok" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [iniciandoNube, setIniciandoNube] = useState(false);
  const [initNubeMsg, setInitNubeMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [diag, setDiag] = useState<DiagnosticoNube | null>(null);
  const [modoTerreno, setModoTerreno] = useState(false);
  const [colaSync, setColaSync] = useState(0);
  const [metricasNube, setMetricasNube] = useState<MetricasNube | null>(null);
  const [realtimeActivo, setRealtimeActivo] = useState(false);
  const [arrastrePozo, setArrastrePozo] = useState<{
    totalHta: number;
    resta: number | null;
    casingDesde: number;
    casingDiametro: string;
  }>({ totalHta: 0, resta: null, casingDesde: 0, casingDiametro: "" });

  const turnoRef = useRef<Turno | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncPendingRef = useRef<{ scope: SyncScope; entityId?: string } | null>(null);
  const ignorarRealtimeRef = useRef(false);
  const ultimaEscrituraRef = useRef(0);

  useEffect(() => {
    cargarTurnoActual()
      .then((t) => {
        turnoRef.current = t;
        setTurno(t);
        setCargando(false);
      })
      .catch((err) => {
        console.error("[App] Error al cargar turno:", err);
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    const onOffline = () => setOnline(false);
    const onOnline = async () => {
      setOnline(true);
      const res = await reintentarCola();
      setColaSync(colaPendiente());
      if (res.ok > 0) setModoTerreno(false);
      const t = turnoRef.current;
      if (t && esUUIDValido(t.cloudId)) {
        ignorarRealtimeRef.current = true;
        const r = await autoSyncTurno(t, "todo");
        setTimeout(() => {
          ignorarRealtimeRef.current = false;
        }, 2500);
        if (r.ok && !r.offline) setModoTerreno(false);
      }
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const procesarResultadoSync = useCallback((r: SyncResult, ctx: string) => {
    if (r.ok) {
      if (r.offline) {
        setModoTerreno(true);
      } else {
        setModoTerreno(false);
      }
      setSyncEstado("ok");
      setSyncError(null);
    } else {
      setSyncEstado("error");
      const msg = r.error ?? "Error desconocido";
      setSyncError(`${ctx}: ${msg}`);
      console.error(`[sync] ${ctx}:`, msg);
    }
  }, []);

  // Persistir en localStorage + IndexedDB al instante; sync a Supabase con debounce
  const ejecutarSyncCloud = useCallback(
    async (t: Turno, scope: SyncScope, entityId?: string) => {
      if (!esUUIDValido(t.cloudId) && scope !== "reporte") return;
      setSyncEstado("sincronizando");
      ignorarRealtimeRef.current = true;
      const r = await autoSyncTurno(t, scope, entityId);
      // La confirmación en tiempo real (websocket) puede llegar después de
      // que termine esta escritura HTTP — esperamos un poco antes de volver
      // a escuchar, para no dejarnos pisar el dato recién escrito.
      setTimeout(() => {
        ignorarRealtimeRef.current = false;
      }, 2500);
      procesarResultadoSync(r, `auto-sync ${scope}`);
      setColaSync(colaPendiente());
    },
    [procesarResultadoSync],
  );

  const programarSyncCloud = useCallback(
    (scope: SyncScope, entityId?: string, delayMs = 500) => {
      syncPendingRef.current = { scope, entityId };
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        const t = turnoRef.current;
        const pending = syncPendingRef.current;
        if (!t || !pending) return;
        void ejecutarSyncCloud(t, pending.scope, pending.entityId);
      }, delayMs);
    },
    [ejecutarSyncCloud],
  );

  const persistirYSync = useCallback(
    (nuevo: Turno, scope: SyncScope = "reporte", entityId?: string) => {
      ultimaEscrituraRef.current = Date.now();
      turnoRef.current = nuevo;
      setTurno(nuevo);
      void guardarTurno(nuevo);
      programarSyncCloud(scope, entityId);
    },
    [programarSyncCloud],
  );

  const flushSyncPendiente = useCallback(
    (scope: SyncScope, entityId?: string) => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncPendingRef.current = { scope, entityId };
      const t = turnoRef.current;
      if (t) void ejecutarSyncCloud(t, scope, entityId);
    },
    [ejecutarSyncCloud],
  );

  const patchTurno = useCallback(
    (patch: Partial<Turno>) => {
      if (!turno) return;
      persistirYSync({ ...turno, ...patch }, "reporte");
    },
    [turno, persistirYSync],
  );

  // Al escribir el número de pozo (antes de iniciar el turno), busca en el
  // historial guardado en esta tablet si ya se trabajó ese pozo antes, y
  // autocompleta Profundidad Inicial / Programado / Casing. No requiere
  // señal: el historial vive en el dispositivo.
  const buscarDatosPozo = useCallback(
    async (pozo: string) => {
      if (!turno || turno.inicializado || !pozo.trim()) return;
      const anteriores = await buscarUltimosTurnosPorPozo(pozo, 2);
      const ultimo = anteriores[0];
      if (!ultimo) return;
      const ultimoTramo = ultimo.tramos[ultimo.tramos.length - 1];
      const patch: Partial<Turno> = {};
      if (turno.profundidadInicial == null && ultimoTramo) {
        patch.profundidadInicial = ultimoTramo.fondo;
      }
      if (turno.programado == null && ultimo.programado != null) {
        patch.programado = ultimo.programado;
      }
      if (!turno.casingDiametro && ultimo.casingDiametro) {
        patch.casingDiametro = ultimo.casingDiametro;
      }
      if (turno.casingProfundidad == null && ultimo.casingProfundidad != null) {
        patch.casingProfundidad = ultimo.casingProfundidad;
      }
      if (turno.barril == null && ultimo.barril != null) {
        patch.barril = ultimo.barril;
      }
      if (turno.muerto == null && ultimo.muerto != null) {
        patch.muerto = ultimo.muerto;
      }
      if (Object.keys(patch).length > 0) patchTurno(patch);
    },
    [turno, patchTurno],
  );

  // Escucha en tiempo real: métricas y datos remotos en segundos
  useEffect(() => {
    const cloudId = turno?.cloudId;
    if (!cloudId || !esUUIDValido(cloudId)) {
      setRealtimeActivo(false);
      setMetricasNube(null);
      return;
    }

    setRealtimeActivo(true);
    const cancelar = suscribirTurnoRealtime(cloudId, turno.profundidadInicial, (act) => {
      setMetricasNube(act.metricas);
      if (ignorarRealtimeRef.current) return;
      if (Date.now() - ultimaEscrituraRef.current < 5000) return;
      if (!act.parche || !turnoRef.current) return;

      const merged = { ...turnoRef.current, ...act.parche };
      turnoRef.current = merged;
      setTurno(merged);
      void guardarTurno(merged);
    });

    return cancelar;
  }, [turno?.cloudId, turno?.profundidadInicial]);

  // ---- INICIAR TURNO EN LA NUBE (insert explícito) ----
  const iniciarTurnoEnNube = useCallback(async () => {
    if (!turno) return;
    setIniciandoNube(true);
    setInitNubeMsg(null);
    setDiag({ estado: "procesando", mensaje: "Enviando insert a reportes_turno...", payload: "", resultadoId: null, timestamp: ahoraISO() });
    try {
      const congelado = pushAudit(
        {
          ...turno,
          estado: "iniciado",
          inicializado: true,
          iniciadoEn: ahoraISO(),
        },
        "turno_iniciado_nube",
        "Turno iniciado e insertado en Supabase",
      );
      // Guardar localmente primero (localStorage + IndexedDB)
      ultimaEscrituraRef.current = Date.now();
      turnoRef.current = congelado;
      setTurno(congelado);
      void guardarTurno(congelado);

      // Construir el payload visible para diagnóstico
      const payloadObj = {
        table: "reportes_turno",
        fields: {
          equipo: congelado.equipo,
          faena: congelado.faena,
          sector: congelado.sector,
          diametro: congelado.diametro,
          pozo: congelado.pozo,
          orientacion: congelado.orientacion,
          profundidad_inicial: congelado.profundidadInicial,
          operador: congelado.operador,
          ayudante_1: congelado.ayudante1,
          ayudante_2: congelado.ayudante2,
          ayudante_3: congelado.ayudante3,
          estado: "en_proceso",
        },
      };

      // Insert explícito en Supabase (con fallback offline)
      const resultado = await insertReporteCloud(congelado);
      if (resultado.ok && resultado.id) {
        // Guardar el cloudId (real o local) en el estado y en IndexedDB
        const conCloudId = { ...congelado, cloudId: resultado.id };
        ultimaEscrituraRef.current = Date.now();
        turnoRef.current = conCloudId;
        setTurno(conCloudId);
        void guardarTurno(conCloudId);
        setSyncError(null);

        if (resultado.offline) {
          // Modo Terreno: red no disponible, dato guardado localmente
          setModoTerreno(true);
          setSyncEstado("ok");
          setInitNubeMsg({
            tipo: "ok",
            texto: `Modo Terreno Activo: Datos guardados localmente en la Tablet. ID local: ${resultado.id.slice(0, 12)}...`,
          });
          setDiag({ estado: "ok", mensaje: `Modo Terreno: insert local exitoso (sin red). Registro encolado para sincronización automática.`, payload: JSON.stringify(payloadObj, null, 2), resultadoId: resultado.id, timestamp: ahoraISO() });
        } else {
          // Inserción real en Supabase exitosa
          setModoTerreno(false);
          setSyncEstado("ok");
          setInitNubeMsg({
            tipo: "ok",
            texto: `Turno creado en la nube. ID: ${resultado.id.slice(0, 8)}...`,
          });
          setDiag({ estado: "ok", mensaje: `Insert exitoso en reportes_turno`, payload: JSON.stringify(payloadObj, null, 2), resultadoId: resultado.id, timestamp: ahoraISO() });
        }
        // Avanzar a tramos en ambos casos (nube o modo terreno)
        setPestaña("tramos");
      } else {
        const errMsg = resultado.error ?? "Error desconocido";
        // Si es un error de red puro (sin fallback), no bloquear al operador
        if (resultado.offline) {
          setModoTerreno(true);
          setSyncEstado("ok");
          setSyncError(null);
          const conCloudId = { ...congelado, cloudId: congelado.id };
          ultimaEscrituraRef.current = Date.now();
          turnoRef.current = conCloudId;
          setTurno(conCloudId);
          void guardarTurno(conCloudId);
          setInitNubeMsg({ tipo: "ok", texto: `Modo Terreno Activo: Datos guardados localmente en la Tablet.` });
          setDiag({ estado: "ok", mensaje: `Modo Terreno: sin red, dato guardado localmente.`, payload: JSON.stringify(payloadObj, null, 2), resultadoId: conCloudId.cloudId, timestamp: ahoraISO() });
          setPestaña("tramos");
        } else {
          setSyncEstado("error");
          setSyncError(errMsg);
          setInitNubeMsg({ tipo: "error", texto: `Error al insertar en Supabase: ${errMsg}` });
          setDiag({ estado: "error", mensaje: errMsg, payload: JSON.stringify(payloadObj, null, 2), resultadoId: null, timestamp: ahoraISO() });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Si es error de red, activar modo terreno sin bloquear
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        const conCloudId = { ...turno, estado: "iniciado" as const, inicializado: true, iniciadoEn: ahoraISO(), cloudId: turno.id };
        ultimaEscrituraRef.current = Date.now();
        turnoRef.current = conCloudId;
        setTurno(conCloudId);
        void guardarTurno(conCloudId);
        setModoTerreno(true);
        setSyncEstado("ok");
        setSyncError(null);
        setInitNubeMsg({ tipo: "ok", texto: `Modo Terreno Activo: Datos guardados localmente en la Tablet.` });
        setDiag({ estado: "ok", mensaje: `Modo Terreno: sin red (${msg}), dato guardado localmente.`, payload: "Excepción de red capturada", resultadoId: fallbackId, timestamp: ahoraISO() });
        setPestaña("tramos");
      } else {
        setSyncEstado("error");
        setSyncError(msg);
        setInitNubeMsg({ tipo: "error", texto: `Error de conexión: ${msg}` });
        setDiag({ estado: "error", mensaje: msg, payload: "Excepción antes de enviar", resultadoId: null, timestamp: ahoraISO() });
      }
    } finally {
      setIniciandoNube(false);
    }
  }, [turno]);

  // Iniciar solo local: guarda al instante y encola sync del reporte
  const autoSaveReporte = useCallback(
    (t: Turno) => {
      const iniciado = pushAudit(
        { ...t, estado: "iniciado", inicializado: true, iniciadoEn: ahoraISO() },
        "turno_iniciado_local",
        "Turno iniciado localmente en la tablet",
      );
      persistirYSync(iniciado, "reporte");
      setPestaña("tramos");
    },
    [persistirYSync],
  );

  // ---- Probar conexión con Supabase ----
  const probarConexion = useCallback(async () => {
    setIniciandoNube(true);
    setInitNubeMsg(null);
    setDiag({ estado: "procesando", mensaje: "HEAD request a reportes_turno...", payload: "SELECT * FROM reportes_turno (count, head: true)", resultadoId: null, timestamp: ahoraISO() });
    try {
      const r = await testConexion();
      if (r.ok) {
        setModoTerreno(false);
        setInitNubeMsg({ tipo: "ok", texto: `Conexión OK. Registros en la nube: ${r.id ?? 0}` });
        setDiag({ estado: "ok", mensaje: `Conexión exitosa. Registros existentes: ${r.id ?? 0}`, payload: "SELECT * FROM reportes_turno (count, head: true)", resultadoId: r.id ?? null, timestamp: ahoraISO() });
      } else if (r.offline) {
        setModoTerreno(true);
        setInitNubeMsg({ tipo: "ok", texto: `Sin conexión a Supabase. Modo Terreno disponible — los datos se guardan localmente.` });
        setDiag({ estado: "ok", mensaje: r.error ?? "Sin red — Modo Terreno disponible", payload: "SELECT * FROM reportes_turno (count, head: true)", resultadoId: null, timestamp: ahoraISO() });
      } else {
        const msg = r.error ?? "Error desconocido";
        setInitNubeMsg({ tipo: "error", texto: `Error de conexión: ${msg}` });
        setDiag({ estado: "error", mensaje: msg, payload: "SELECT * FROM reportes_turno (count, head: true)", resultadoId: null, timestamp: ahoraISO() });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setModoTerreno(true);
        setInitNubeMsg({ tipo: "ok", texto: `Sin conexión a Supabase. Modo Terreno disponible.` });
        setDiag({ estado: "ok", mensaje: `Sin red (${msg}) — Modo Terreno disponible`, payload: "Excepción de red", resultadoId: null, timestamp: ahoraISO() });
      } else {
        setInitNubeMsg({ tipo: "error", texto: `Error: ${msg}` });
        setDiag({ estado: "error", mensaje: msg, payload: "Excepción antes de enviar", resultadoId: null, timestamp: ahoraISO() });
      }
    } finally {
      setIniciandoNube(false);
    }
  }, []);

  const registrarRelevo = useCallback(() => {
    if (!turno) return;
    const snapshot = {
      id: uid(),
      operador: turno.operador,
      ayudante1: turno.ayudante1,
      ayudante2: turno.ayudante2,
      ayudante3: turno.ayudante3,
      registradoEn: ahoraISO(),
      motivo: "Relevo de personal",
    };
    const conAudit = pushAudit(
      { ...turno, historialRelevos: [...turno.historialRelevos, snapshot] },
      "relevo_registrado",
      `Operador: ${snapshot.operador || "—"}`,
    );
    persistirYSync(conAudit, "reporte");
    setRelevoFlash(true);
    setTimeout(() => setRelevoFlash(false), 2000);
  }, [turno, persistirYSync]);

  // Recalcula Hta.desde/Total Hta./Fondo/Perf. de todos los tramos en orden,
  // usando el arrastre del pozo (o 0) como punto de partida del primer tramo.
  const recalcularTramos = useCallback(
    (tramos: Tramo[], htaDesdeInicial: number, profundidadInicial: number): Tramo[] => {
      let prevTotalHta = htaDesdeInicial;
      let prevResta: number | null = null;
      let prevFondo = profundidadInicial;
      return tramos.map((t, idx) => {
        const htaDesde = prevTotalHta;
        const totalHta = htaDesde + (t.agrega ?? 0);
        const perf =
          idx === 0 ? null : t.resta != null && prevResta != null ? prevResta - t.resta : null;
        const fondo = perf != null ? prevFondo + perf : prevFondo;
        prevTotalHta = totalHta;
        prevResta = t.resta;
        prevFondo = fondo;
        return { ...t, htaDesde, totalHta, perf, fondo };
      });
    },
    [],
  );

  const agregarTramo = useCallback(() => {
    if (!turno) return;
    const nuevo: Tramo = {
      id: uid(),
      htaDesde: 0,
      agrega: null,
      totalHta: 0,
      fondo: 0,
      resta: turno.tramos.length === 0 ? arrastrePozo.resta : null,
      perf: null,
      recuperacion: null,
      tipoRoca: "",
      creadoEn: ahoraISO(),
    };
    const tramosRecalculados = recalcularTramos(
      [...turno.tramos, nuevo],
      arrastrePozo.totalHta,
      turno.profundidadInicial ?? 0,
    );
    const conAudit = pushAudit(
      { ...turno, tramos: tramosRecalculados },
      "tramo_agregado",
      `Tramo ${turno.tramos.length + 1} agregado`,
    );
    persistirYSync(conAudit, "tramo", nuevo.id);
  }, [turno, persistirYSync, arrastrePozo, recalcularTramos]);

  const cambiarTramo = useCallback(
    (id: string, patch: Partial<Tramo>) => {
      if (!turno) return;
      const tramosActualizados = turno.tramos.map((t) => (t.id === id ? { ...t, ...patch } : t));
      const tramosRecalculados = recalcularTramos(
        tramosActualizados,
        arrastrePozo.totalHta,
        turno.profundidadInicial ?? 0,
      );
      persistirYSync({ ...turno, tramos: tramosRecalculados }, "tramo", id);
    },
    [turno, persistirYSync, arrastrePozo, recalcularTramos],
  );

  const syncTramoOnBlur = useCallback(
    (id: string) => flushSyncPendiente("tramo", id),
    [flushSyncPendiente],
  );

  const eliminarTramo = useCallback(
    (id: string) => {
      if (!turno) return;
      const tramosRecalculados = recalcularTramos(
        turno.tramos.filter((t) => t.id !== id),
        arrastrePozo.totalHta,
        turno.profundidadInicial ?? 0,
      );
      persistirYSync({ ...turno, tramos: tramosRecalculados }, "todo");
    },
    [turno, persistirYSync, arrastrePozo, recalcularTramos],
  );

  const agregarCasing = useCallback(() => {
    if (!turno) return;
    const ultimaFila = turno.casing[turno.casing.length - 1];
    const desde = ultimaFila ? ultimaFila.total : arrastrePozo.casingDesde;
    const diametro = ultimaFila ? ultimaFila.diametro : arrastrePozo.casingDiametro;
    const nueva: CasingRow = {
      id: uid(),
      diametro,
      desde,
      agrega: null,
      total: desde,
      creadoEn: ahoraISO(),
    };
    const nuevoCasing = [...turno.casing, nueva];
    const conAudit = pushAudit(
      {
        ...turno,
        casing: nuevoCasing,
        casingDiametro: nueva.diametro,
        casingProfundidad: nueva.total,
      },
      "casing_agregado",
      `Fila de Casing agregada`,
    );
    persistirYSync(conAudit, "casing", nueva.id);
  }, [turno, persistirYSync, arrastrePozo]);

  const cambiarCasing = useCallback(
    (id: string, patch: Partial<CasingRow>) => {
      if (!turno) return;
      const nuevoCasing = turno.casing.map((c) => {
        if (c.id !== id) return c;
        const actualizado = { ...c, ...patch };
        return { ...actualizado, total: actualizado.desde + (actualizado.agrega ?? 0) };
      });
      const ultima = nuevoCasing[nuevoCasing.length - 1];
      persistirYSync(
        {
          ...turno,
          casing: nuevoCasing,
          casingDiametro: ultima?.diametro ?? turno.casingDiametro,
          casingProfundidad: ultima?.total ?? turno.casingProfundidad,
        },
        "casing",
        id,
      );
    },
    [turno, persistirYSync],
  );

  const syncCasingOnBlur = useCallback(
    (id: string) => flushSyncPendiente("casing", id),
    [flushSyncPendiente],
  );

  // Arrastre del pozo: mientras el turno todavía no tiene su primer tramo,
  // averigua (100% local, sin señal) qué dejó el último turno del mismo
  // pozo en esta tablet, para mostrar "Barras" y precargar el primer tramo.
  useEffect(() => {
    if (!turno || !turno.pozo.trim() || turno.tramos.length > 0) {
      if (!turno?.pozo.trim()) {
        setArrastrePozo({ totalHta: 0, resta: null, casingDesde: 0, casingDiametro: "" });
      }
      return;
    }
    buscarUltimosTurnosPorPozo(turno.pozo, 1).then((anteriores) => {
      const ultimo = anteriores[0];
      const ultimoTramo = ultimo?.tramos[ultimo.tramos.length - 1];
      const ultimaCasing = ultimo?.casing[ultimo.casing.length - 1];
      setArrastrePozo({
        totalHta: ultimoTramo?.totalHta ?? 0,
        resta: ultimoTramo?.resta ?? null,
        casingDesde: ultimaCasing?.total ?? 0,
        casingDiametro: ultimaCasing?.diametro ?? "",
      });
    });
  }, [turno?.pozo, turno?.tramos.length]);
  const agregarHerramienta = useCallback(
    async (tipo: HerramientaTipo) => {
      if (!turno) return;
      const anteriorMismoTipo = [...turno.herramientas].reverse().find((h) => h.tipo === tipo);
      const fondoActual =
        turno.tramos.length > 0 ? turno.tramos[turno.tramos.length - 1].fondo : turno.profundidadInicial ?? 0;
      const casingDesdeActual = turno.casing.length > 0 ? turno.casing[0].desde : 0;
      const casingTotalActual = turno.casing.length > 0 ? turno.casing[turno.casing.length - 1].total : 0;

      let base = anteriorMismoTipo ?? null;
      if (!base) base = await buscarUltimaHerramientaPorTipo(tipo);
      if (!base) base = HERRAMIENTAS_INICIALES.find((h) => h.tipo === tipo) ?? null;

      let desde = 0;
      let hasta = 0;
      if (tipo === "corona" || tipo === "escareador") {
        desde = fondoActual;
        hasta = fondoActual;
      } else if (tipo === "zapata") {
        desde = casingDesdeActual;
        hasta = casingTotalActual;
      } else {
        desde = base?.hasta ?? 0;
        hasta = desde;
      }

      const nueva: HerramientaFila = {
        id: uid(),
        tipo,
        diametro: base?.diametro ?? "",
        marca: base?.marca ?? "",
        serie: base?.serie ?? "",
        estado: "Usado",
        desde,
        hasta,
        creadoEn: ahoraISO(),
      };
      const conAudit = pushAudit(
        { ...turno, herramientas: [...turno.herramientas, nueva] },
        "herramienta_agregada",
        `${tipo} agregada`,
      );
      persistirYSync(conAudit, "herramientas", nueva.id);
    },
    [turno, persistirYSync],
  );

  const cambiarHerramienta = useCallback(
    (id: string, patch: Partial<HerramientaFila>) => {
      if (!turno) return;
      persistirYSync(
        {
          ...turno,
          herramientas: turno.herramientas.map((h) => (h.id === id ? { ...h, ...patch } : h)),
        },
        "herramientas",
        id,
      );
    },
    [turno, persistirYSync],
  );

  const syncHerramientaOnBlur = useCallback(
    (id: string) => flushSyncPendiente("herramientas", id),
    [flushSyncPendiente],
  );

  // Siembra inicial: si el turno todavía no tiene filas de herramientas,
  // hereda (100% local) la última fila conocida de cada tipo en esta
  // tablet, o los datos de ejemplo si es la primera vez que se usa la app.
  useEffect(() => {
    if (!turno || turno.herramientas.length > 0) return;
    const tId = turno.id;
    (async () => {
      const tipos: HerramientaTipo[] = ["corona", "escareador", "zapata", "tricono"];
      const filas: HerramientaFila[] = [];
      for (const tipo of tipos) {
        let base = await buscarUltimaHerramientaPorTipo(tipo);
        if (!base) base = HERRAMIENTAS_INICIALES.find((h) => h.tipo === tipo) ?? null;
        if (!base) continue;
        filas.push({ ...base, id: uid(), creadoEn: ahoraISO() });
      }
      if (filas.length > 0 && turnoRef.current?.id === tId && turnoRef.current.herramientas.length === 0) {
        persistirYSync({ ...turnoRef.current, herramientas: filas }, "herramientas");
      }
    })();
  }, [turno?.id]);

  // Actualización en vivo: mientras una fila de Corona/Escareador/Zapata es
  // la más reciente de su tipo, su "Hasta" (y el "Desde" de Zapata) sigue el
  // Fondo actual de Tramos o el estado actual de Casing.
  useEffect(() => {
    if (!turno) return;
    const fondoActual =
      turno.tramos.length > 0 ? turno.tramos[turno.tramos.length - 1].fondo : turno.profundidadInicial ?? 0;
    const casingDesdeActual = turno.casing.length > 0 ? turno.casing[0].desde : 0;
    const casingTotalActual = turno.casing.length > 0 ? turno.casing[turno.casing.length - 1].total : 0;

    let cambio = false;
    const nuevasHerramientas = turno.herramientas.map((h, idx, arr) => {
      const esUltimaDeSuTipo = !arr.slice(idx + 1).some((x) => x.tipo === h.tipo);
      if (!esUltimaDeSuTipo) return h;
      if (h.tipo === "corona" || h.tipo === "escareador") {
        if (h.hasta !== fondoActual) {
          cambio = true;
          return { ...h, hasta: fondoActual };
        }
      } else if (h.tipo === "zapata") {
        if (h.desde !== casingDesdeActual || h.hasta !== casingTotalActual) {
          cambio = true;
          return { ...h, desde: casingDesdeActual, hasta: casingTotalActual };
        }
      }
      return h;
    });

    if (cambio) {
      persistirYSync({ ...turno, herramientas: nuevasHerramientas }, "herramientas");
    }
  }, [turno?.tramos, turno?.casing, turno?.herramientas.length]);

  const cambiarHerramienta = useCallback(
    (
      tipo: HerramientaTipo,
      datos: { diametro: string; marca: string; serie: string },
    ) => {
      if (!turno) return;
      const herramientas = turno.herramientas.map((h) =>
        h.tipo === tipo ? { ...h, ...datos, actualizadaEn: ahoraISO() } : h,
      );
      const log = {
        id: uid(),
        tipo,
        ...datos,
        operador: turno.operador || "—",
        cambiadoEn: ahoraISO(),
      };
      const conAudit = pushAudit(
        { ...turno, herramientas, historialHerramientas: [...turno.historialHerramientas, log] },
        "herramienta_cambiada",
        `${tipo}: ${datos.marca} ${datos.serie}`,
      );
      persistirYSync(conAudit, "reporte");
    },
    [turno, persistirYSync],
  );

  const agregarActividad = useCallback(() => {
    if (!turno) return;
    const baseHora =
      turno.bitacora.length > 0
        ? turno.bitacora[turno.bitacora.length - 1].horaHasta ?? turno.bitacora[turno.bitacora.length - 1].horaDesde
        : horaActualLocal();
    const nueva: ActividadBitacora = {
      id: uid(),
      horaDesde: baseHora,
      horaHasta: null,
      codigoOperacion: "",
      detalle: "",
      cargoHora: "propia",
      creadoEn: ahoraISO(),
    };
    persistirYSync({ ...turno, bitacora: [...turno.bitacora, nueva] }, "bitacora", nueva.id);
  }, [turno, persistirYSync]);

  const cambiarActividad = useCallback(
    (id: string, patch: Partial<ActividadBitacora>) => {
      if (!turno) return;
      persistirYSync(
        {
          ...turno,
          bitacora: turno.bitacora.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        },
        "bitacora",
        id,
      );
    },
    [turno, persistirYSync],
  );

  const cerrarActividad = useCallback(
    (id: string) => {
      if (!turno) return;
      const ahora = horaActualLocal();
      persistirYSync(
        {
          ...turno,
          bitacora: turno.bitacora.map((a) => (a.id === id ? { ...a, horaHasta: ahora } : a)),
        },
        "bitacora",
        id,
      );
    },
    [turno, persistirYSync],
  );

  const syncActividadOnBlur = useCallback(
    (id: string) => flushSyncPendiente("bitacora", id),
    [flushSyncPendiente],
  );

  const eliminarActividad = useCallback(
    (id: string) => {
      if (!turno) return;
      persistirYSync({ ...turno, bitacora: turno.bitacora.filter((a) => a.id !== id) }, "todo");
    },
    [turno, persistirYSync],
  );

  const agregarInsumo = useCallback(() => {
    if (!turno) return;
    const nuevo: Insumo = {
      id: uid(),
      nombre: "",
      unidad: "Saco",
      cantidad: null,
      creadoEn: ahoraISO(),
    };
    persistirYSync({ ...turno, insumos: [...turno.insumos, nuevo] }, "insumos", nuevo.id);
  }, [turno, persistirYSync]);

  const cambiarInsumo = useCallback(
    (id: string, patch: Partial<Insumo>) => {
      if (!turno) return;
      persistirYSync(
        {
          ...turno,
          insumos: turno.insumos.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        },
        "insumos",
        id,
      );
    },
    [turno, persistirYSync],
  );

  const syncInsumosOnBlur = useCallback(
    () => flushSyncPendiente("insumos"),
    [flushSyncPendiente],
  );

  const eliminarInsumo = useCallback(
    (id: string) => {
      if (!turno) return;
      persistirYSync({ ...turno, insumos: turno.insumos.filter((i) => i.id !== id) }, "insumos", id);
    },
    [turno, persistirYSync],
  );

  const cerrarTurno = useCallback(async () => {
    if (!turno) return;
    const cerrado = await cerrarEnDB(turno);
    persistirYSync(cerrado, "todo");
    setSyncEstado("sincronizando");
    const rTodo = await syncTodo(cerrado);
    if (!rTodo.ok) {
      procesarResultadoSync(rTodo, "cierre de turno (datos)");
      return;
    }
    const rCierre = await cerrarTurnoCloud(cerrado);
    procesarResultadoSync(rCierre, "cierre de turno");
    setTimeout(() => {
      cargarTurnoActual().then((t) => {
        ultimaEscrituraRef.current = Date.now();
        turnoRef.current = t;
        setTurno(t);
        void guardarTurno(t);
      });
      setPestaña("inicializacion");
    }, 100);
  }, [turno, persistirYSync, procesarResultadoSync]);

  // Reintento de sincronización en segundo plano (cada 10s si hay cola pendiente)
  useEffect(() => {
    setColaSync(colaPendiente());
    const intervalo = setInterval(async () => {
      const pendiente = colaPendiente();
      if (pendiente > 0) {
        const res = await reintentarCola();
        if (res.ok > 0) {
          setModoTerreno(false);
          setSyncEstado("ok");
        }
        setColaSync(colaPendiente());
      }
    }, 10000);
    return () => clearInterval(intervalo);
  }, []);

  // Cálculos derivados (métricas locales + confirmación en tiempo real desde nube)
  const ultimoTramo = turno?.tramos[turno.tramos.length - 1];
  const profundidadFinalLocal = ultimoTramo?.fondo ?? turno?.profundidadInicial ?? 0;
  const profundidadFinal = metricasNube?.profundidadFinal ?? profundidadFinalLocal;
  const totalPerforadoPozo = profundidadFinal - (turno?.profundidadInicial ?? 0);
  const totalMetrosTurno = turno?.tramos.reduce((acc, t) => acc + (t.perf ?? 0), 0) ?? 0;

  if (cargando) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
          Cargando turno...
        </div>
      </div>
    );
  }

  if (!turno) {
    return (
      <div className="h-full flex items-center justify-center text-slate-300 px-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="font-semibold mb-2">No se pudo cargar el turno guardado.</p>
          <p className="text-sm text-slate-400 mb-4">
            Puede deberse a datos locales corruptos. Recarga la página; si persiste, limpia el almacenamiento del sitio en el navegador.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const turnoActivo = turno.estado === "iniciado";
  const turnoCerrado = turno.estado === "cerrado";

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-100">
      {/* Header fijo */}
      <header className="shrink-0 bg-slate-950/80 border-b border-slate-800 backdrop-blur">
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 leading-tight truncate">
                Reporte de Turno Diamantina
              </h1>
              <p className="text-xs text-slate-400 truncate">
                {turno.equipo} · {turno.faena}
                <span className="text-emerald-400 ml-1.5">· {SUPABASE_PROJECT_URL.replace("https://", "")}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                online
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                  : "bg-amber-500/15 text-amber-300 border border-amber-500/40"
              }`}
            >
              {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {online ? "En línea" : "Sin señal"}
            </div>
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                syncEstado === "ok"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                  : syncEstado === "sincronizando"
                    ? "bg-sky-500/15 text-sky-300 border border-sky-500/40 animate-pulse"
                    : syncEstado === "error"
                      ? "bg-red-500/15 text-red-300 border border-red-500/40"
                      : "bg-slate-700/40 text-slate-400 border border-slate-600/40"
              }`}
            >
              {syncEstado === "ok" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : syncEstado === "error" ? (
                <CloudOff className="w-3.5 h-3.5" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              {syncEstado === "sincronizando"
                ? "Sincronizando..."
                : syncEstado === "ok"
                  ? "Sincronizado"
                  : syncEstado === "error"
                    ? "Error de sync"
                    : "Auto-save"}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Total turno
              </p>
              <p className="text-lg font-black text-emerald-400 leading-none tabular-nums">
                {totalMetrosTurno.toFixed(1)}m
              </p>
            </div>
          </div>
        </div>

        {/* Pestañas permanentes */}
        <nav className="flex border-t border-slate-800 overflow-x-auto scrollbar-thin">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestaña(p.id)}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 text-sm font-bold transition whitespace-nowrap ${
                pestaña === p.id
                  ? "text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5"
                  : "text-slate-400 border-b-2 border-transparent hover:text-slate-200"
              }`}
            >
              {p.icon}
              <span className="hidden sm:inline">{p.label}</span>
              <span className="sm:hidden">{p.label.split(" ")[0]}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Banner de error de sincronización */}
      {syncError && (
        <div className="shrink-0 bg-red-600/20 border-b border-red-600/50 px-4 py-2.5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-200 font-semibold flex-1 break-all">{syncError}</p>
          <button
            onClick={() => setSyncError(null)}
            className="p-1 rounded text-red-300 hover:text-white hover:bg-red-600/30 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner Modo Terreno Activo */}
      {modoTerreno && (
        <div className="shrink-0 bg-amber-500/20 border-b border-amber-500/50 px-4 py-2.5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200 font-semibold flex-1">
            Modo Terreno Activo: Datos guardados localmente en la Tablet{colaSync > 0 ? ` · ${colaSync} registro(s) en cola de sincronización` : ""}
          </p>
          <button
            onClick={async () => {
              const res = await reintentarCola();
              setColaSync(colaPendiente());
              if (res.ok > 0 && res.fallidos === 0) setModoTerreno(false);
            }}
            className="px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold transition shrink-0"
          >
            Reintentar sync
          </button>
        </div>
      )}

      {/* Notificación de relevo */}
      {relevoFlash && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-sky-600 text-white px-5 py-3 rounded-lg shadow-2xl font-bold flex items-center gap-2 animate-pulse">
          Relevo registrado correctamente
        </div>
      )}

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto scrollbar-thin">
        <div className="p-4 max-w-7xl mx-auto">
          {pestaña === "inicializacion" && (
            <Inicializacion
              turno={turno}
              profundidadFinal={profundidadFinal}
              totalPerforadoPozo={totalPerforadoPozo}
              metricasNube={metricasNube}
              realtimeActivo={realtimeActivo}
              onChange={patchTurno}
              onBuscarPozo={buscarDatosPozo}
              onIniciar={() => autoSaveReporte(turnoRef.current ?? turno)}
              onIniciarEnNube={iniciarTurnoEnNube}
              iniciandoNube={iniciandoNube}
              initNubeMsg={initNubeMsg}
              onProbarConexion={probarConexion}
              onRegistrarRelevo={registrarRelevo}
              diag={diag}
              modoTerreno={modoTerreno}
              colaSync={colaSync}
            />
          )}
          {pestaña === "tramos" && (
            <div className="h-[calc(100vh-140px)]">
              {esUUIDValido(turno.cloudId) ? (
                <ControlTramos
                  tramos={turno.tramos}
                  profundidadInicial={turno.profundidadInicial}
                  turnoActivo={turnoActivo}
                  herramientas={turno.herramientas}
                  historialHerramientas={turno.historialHerramientas}
                  operador={turno.operador}
                  turnoCerrado={turnoCerrado}
                  onAgregar={agregarTramo}
                  onChangeTramo={cambiarTramo}
                  onBlurTramo={syncTramoOnBlur}
                  onEliminarTramo={eliminarTramo}
                  onCambiarHerramienta={cambiarHerramienta}
                  barril={turno.barril}
                  muerto={turno.muerto}
                  onChangeBarrilMuerto={(patch) => patchTurno(patch)}
                  barrasArrastre={arrastrePozo.totalHta}
                  casingDiametroArrastre={arrastrePozo.casingDiametro}
                  casing={turno.casing}
                  onAgregarCasing={agregarCasing}
                  onChangeCasing={cambiarCasing}
                  onBlurCasing={syncCasingOnBlur}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-xl p-8 max-w-md">
                    <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <p className="text-lg font-bold text-amber-300">Por favor, inicie el turno en la Pestana 1 primero</p>
                    <p className="text-sm text-slate-400 mt-2">Los tramos se habilitaran una vez que el turno sea registrado exitosamente en la nube y se reciba el ID real de Supabase.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {pestaña === "bitacora" && (
            <div className="h-[calc(100vh-140px)]">
              {esUUIDValido(turno.cloudId) ? (
                <BitacoraTiempos
                  bitacora={turno.bitacora}
                  turnoActivo={turnoActivo}
                  onAgregar={agregarActividad}
                  onChange={cambiarActividad}
                  onCerrarActividad={cerrarActividad}
                  onBlurActividad={syncActividadOnBlur}
                  onEliminar={eliminarActividad}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-xl p-8 max-w-md">
                    <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <p className="text-lg font-bold text-amber-300">Por favor, inicie el turno en la Pestana 1 primero</p>
                    <p className="text-sm text-slate-400 mt-2">La bitacora se habilitara una vez que el turno sea registrado exitosamente en la nube.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {pestaña === "cierre" && (
            esUUIDValido(turno.cloudId) ? (
              <AditivosCierre
                turno={turno}
                onAgregarInsumo={agregarInsumo}
                onChangeInsumo={cambiarInsumo}
                onBlurInsumos={syncInsumosOnBlur}
                onEliminarInsumo={eliminarInsumo}
                onChangeObservaciones={(v) => patchTurno({ observaciones: v })}
                onFirmaChange={(v) => patchTurno({ firmaDataURL: v })}
                onCerrarTurno={cerrarTurno}
              />
            ) : (
              <div className="flex items-center justify-center h-[calc(100vh-140px)]">
                <div className="text-center bg-amber-500/10 border border-amber-500/30 rounded-xl p-8 max-w-md">
                  <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                  <p className="text-lg font-bold text-amber-300">Por favor, inicie el turno en la Pestana 1 primero</p>
                  <p className="text-sm text-slate-400 mt-2">Los insumos y el cierre se habilitaran una vez que el turno sea registrado en la nube.</p>
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* Footer de estado */}
      <footer className="shrink-0 bg-slate-950/80 border-t border-slate-800 px-4 py-1.5 text-[10px] text-slate-500 flex items-center justify-between">
        <span>
          Turno: {turno.id.slice(0, 8)} · {turno.estado}
          {realtimeActivo && (
            <span className="text-sky-400"> · Tiempo real activo</span>
          )}
          <span className="text-emerald-500"> · {SUPABASE_PROJECT_URL.replace("https://", "")}</span>
        </span>
        <span>
          {turno.audit.length} eventos · {fechaHora(turno.fecha)}
        </span>
      </footer>
    </div>
  );
}
