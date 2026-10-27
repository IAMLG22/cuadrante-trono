import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ConfigOptimizador, ConfigTrono, HdT } from '../geometria/tipos';
import { clavesEfectivas, construirTrono, validarConfig } from '../geometria/trono';
import { cargarEstado, estadoEjemplo, guardarEstado, type Estado } from '../io/almacenamiento';
import { cuadrillaEjemplo, tronoEjemplo } from '../io/ejemplo';
import { exportarCsv, exportarCsvPorVaral, exportarXlsx } from '../io/exportar';
import { mover, type Destino, type Origen } from '../io/mover';
import { asignacionDesdeResultado, asignacionPorIndice, construirVista, type Asignacion } from '../io/tablas';
import type { Resultado } from '../optimizador/optimizar';
import { revisar } from '../optimizador/revision';
import type { MensajeEntrada, MensajeSalida } from '../optimizador/worker';
import { Cuadrante, type ModoCuadrante } from './Cuadrante';
import { Configuracion, type PestanaConfig } from './Configuracion';
import { Impresion } from './Impresion';
import { Planta, type ModoPlanta } from './Planta';
import { Indicadores, Resumen } from './Resumen';
import { Revision } from './Revision';
import { Lista } from './Tablas';

type Seccion = 'cuadrante' | 'configuracion';
type PestanaRes = 'cuadrante' | 'planta' | 'resumen' | 'lista';

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const nuevoWorker = () => new Worker(new URL('../optimizador/worker.ts', import.meta.url), { type: 'module' });

export function App() {
  const [estado, setEstado] = useState<Estado>(cargarEstado);
  const [seccion, setSeccion] = useState<Seccion>('cuadrante');
  const [pConfig, setPConfig] = useState<PestanaConfig>('trono');
  const [pRes, setPRes] = useState<PestanaRes>('cuadrante');
  const [modoCuadrante, setModoCuadrante] = useState<ModoCuadrante>('colocar');
  const [modoPlanta, setModoPlanta] = useState<ModoPlanta>('mover');
  const [progreso, setProgreso] = useState<{ fraccion: number; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluacion, setEvaluacion] = useState<{ resultado: Resultado | null; error: string | null }>({ resultado: null, error: null });
  const [recalculando, setRecalculando] = useState(false);
  const [previa, setPrevia] = useState<{ asig: Asignacion; resultado: Resultado } | null>(null);
  const [historial, setHistorial] = useState<Asignacion[]>([]);
  const [revisionAbierta, setRevisionAbierta] = useState(true);
  const [problemaActivo, setProblemaActivo] = useState<number | null>(null);
  const rellenador = useRef<Worker | null>(null);
  const evaluador = useRef<Worker | null>(null);
  const peticiones = useRef(new Map<number, { tipo: 'previa' | 'confirmar'; asig: Asignacion }>());
  const ultimaPeticion = useRef(0);
  const ultimaConfirmacion = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => guardarEstado(estado), 300);
    return () => clearTimeout(t);
  }, [estado]);

  const cambiarConfig = (f: (c: ConfigTrono) => void) =>
    setEstado((e) => { const config = clonar(e.config); f(config); return { ...e, config, ejemploTrono: false }; });
  const cambiarOpt = (f: (o: ConfigOptimizador) => void) =>
    setEstado((e) => { const opt = clonar(e.opt); f(opt); return { ...e, opt }; });
  const cambiarCuadrilla = (cuadrilla: HdT[]) => setEstado((e) => ({ ...e, cuadrilla, ejemploCuadrilla: false }));

  const errores = useMemo(() => validarConfig(estado.config), [estado.config]);
  const trono = useMemo(() => (errores.length ? null : construirTrono(estado.config, estado.opt.confianza)), [estado.config, estado.opt.confianza, errores]);
  const nPuestos = trono?.puestos.length ?? 0;

  // Quitar de lo colocado los puestos que ya no existen y a quien ya no está en la cuadrilla
  useEffect(() => {
    if (!trono) return;
    const refs = new Set(trono.puestos.map((p) => p.ref));
    const ids = new Set(estado.cuadrilla.map((h) => h.id));
    const sobran = Object.entries(estado.asignacion).filter(([k, id]) => !refs.has(k) || !ids.has(id));
    if (sobran.length) {
      setEstado((e) => {
        const a = { ...e.asignacion };
        for (const [k] of sobran) delete a[k];
        return { ...e, asignacion: a };
      });
    }
  }, [trono, estado.cuadrilla]);
  // Deshacer solo tiene sentido con el mismo trono y la misma cuadrilla
  useEffect(() => setHistorial([]), [estado.config, estado.cuadrilla]);

  // ---- Comprobación con el modelo exacto (en un worker, al momento) ----
  const evaluar = (asig: Asignacion, tipo: 'previa' | 'confirmar') => {
    if (!trono) return;
    if (!evaluador.current) {
      const w = nuevoWorker();
      w.onmessage = (e: MessageEvent<MensajeSalida>) => {
        const m = e.data;
        if (m.tipo !== 'evaluado' && !(m.tipo === 'error' && m.id !== undefined)) return;
        const pet = peticiones.current.get(m.id!);
        peticiones.current.delete(m.id!);
        if (!pet) return;
        if (pet.tipo === 'confirmar') {
          if (m.id !== ultimaConfirmacion.current) return;
          setRecalculando(false);
          if (m.tipo === 'error') setEvaluacion({ resultado: null, error: m.mensaje });
          else setEvaluacion({ resultado: m.resultado, error: null });
          setPrevia((p) => (ultimaPeticion.current === m.id ? null : p));
        } else if (m.tipo === 'evaluado' && m.id === ultimaPeticion.current) {
          setPrevia({ asig: pet.asig, resultado: m.resultado });
        }
      };
      evaluador.current = w;
    }
    const id = ++ultimaPeticion.current;
    if (tipo === 'confirmar') { ultimaConfirmacion.current = id; setRecalculando(true); }
    peticiones.current.set(id, { tipo, asig });
    evaluador.current.postMessage({
      tipo: 'evaluar', id, config: estado.config, cuadrilla: estado.cuadrilla, opt: estado.opt,
      asignacion: asignacionPorIndice(trono, asig),
    } satisfies MensajeEntrada);
  };

  useEffect(() => {
    if (estado.comprobado && trono) evaluar(estado.asignacion, 'confirmar');
  }, [estado.comprobado, trono, estado.asignacion, estado.cuadrilla, estado.opt]);

  // ---- Colocar a la gente ----
  const fijarAsignacion = (asignacion: Asignacion) => {
    setHistorial((h) => [...h.slice(-99), estado.asignacion]);
    setEstado((e) => ({ ...e, asignacion }));
  };
  const onMover = (o: Origen, d: Destino) => {
    const n = mover(estado.asignacion, o, d);
    if (n) fijarAsignacion(n);
    else setPrevia(null);
  };
  const onPrevisualizar = (o: Origen, d: Destino | null) => {
    if (!estado.comprobado) return;
    const n = d && mover(estado.asignacion, o, d);
    if (!n) { ultimaPeticion.current++; setPrevia(null); return; }
    evaluar(n, 'previa');
  };
  const deshacer = () => {
    const ultimo = historial[historial.length - 1];
    if (!ultimo) return;
    setHistorial((h) => h.slice(0, -1));
    setEstado((e) => ({ ...e, asignacion: ultimo }));
  };
  const vaciar = () => {
    if (Object.keys(estado.asignacion).length && confirm('¿Quitar a todos de sus puestos?')) fijarAsignacion({});
  };

  // ---- Puestos clave ----
  const alternarClave = (codigo: string) =>
    cambiarOpt((o) => {
      const s = new Set(clavesEfectivas(estado.config, o.confianza));
      if (s.has(codigo)) s.delete(codigo); else s.add(codigo);
      o.confianza.puestosClave = [...s];
    });

  // ---- Comprobar y rellenar huecos ----
  const comprobar = () => {
    setError(null);
    setRevisionAbierta(true);
    setProblemaActivo(null);
    setSeccion('cuadrante');
    if (pRes !== 'cuadrante' && pRes !== 'planta') setPRes('cuadrante');
    if (estado.comprobado && trono) evaluar(estado.asignacion, 'confirmar');
    else setEstado((e) => ({ ...e, comprobado: true }));
  };

  const colocados = Object.keys(estado.asignacion).length;
  const huecosRellenables = trono ? trono.puestos.filter((p) => estado.asignacion[p.ref] === undefined).length : 0;
  const rellenar = () => {
    setError(null);
    if (!trono) return;
    const libres = huecosRellenables;
    const disponibles = estado.cuadrilla.length - colocados;
    if (libres === 0) { setError('No hay huecos: todos los puestos están cubiertos.'); return; }
    if (disponibles < libres) {
      setError(`Faltan ${libres - disponibles} HdT para cubrir los ${libres} huecos (quedan ${disponibles} sin colocar).`);
      return;
    }
    rellenador.current?.terminate();
    const w = nuevoWorker();
    rellenador.current = w;
    setProgreso({ fraccion: 0, texto: 'Empezando…' });
    const t = trono;
    w.onmessage = (e: MessageEvent<MensajeSalida>) => {
      const m = e.data;
      if (m.tipo === 'progreso') { setProgreso({ fraccion: m.fraccion, texto: m.texto }); return; }
      w.terminate();
      rellenador.current = null;
      setProgreso(null);
      if (m.tipo === 'error') setError(m.mensaje);
      else if (m.tipo === 'resultado') {
        fijarAsignacion(asignacionDesdeResultado(t, m.resultado.asignacion));
        setEstado((e) => ({ ...e, comprobado: true }));
        setRevisionAbierta(true);
      }
    };
    w.onerror = (ev) => { setProgreso(null); setError(`Error al rellenar: ${ev.message}`); };
    w.postMessage({
      tipo: 'rellenar', config: estado.config, cuadrilla: estado.cuadrilla, opt: estado.opt,
      colocados: asignacionPorIndice(trono, estado.asignacion),
    } satisfies MensajeEntrada);
  };
  const cancelarRelleno = () => {
    rellenador.current?.terminate();
    rellenador.current = null;
    setProgreso(null);
  };

  const restablecer = () => {
    if (confirm('¿Borrar todos los datos y volver al trono y la cuadrilla de ejemplo?')) {
      cancelarRelleno();
      setHistorial([]);
      setPrevia(null);
      setEvaluacion({ resultado: null, error: null });
      setEstado(estadoEjemplo());
    }
  };

  const elegirClaves = () => {
    setSeccion('cuadrante');
    setPRes('cuadrante');
    setModoCuadrante('claves');
  };

  // ---- Vista ----
  const datos = { config: estado.config, cuadrilla: estado.cuadrilla, opt: estado.opt };
  const resultado = estado.comprobado ? evaluacion.resultado : null;
  const vista = useMemo(
    () => (trono ? construirVista(datos, previa?.asig ?? estado.asignacion, previa?.resultado ?? resultado, trono) : null),
    [trono, estado.cuadrilla, estado.asignacion, previa, resultado],
  );
  const problemas = useMemo(
    () => (trono && resultado ? revisar(trono, resultado, estado.cuadrilla, estado.opt) : []),
    [trono, resultado, estado.cuadrilla, estado.opt],
  );
  useEffect(() => setProblemaActivo(null), [problemas.length]);
  const resaltados = useMemo(() => new Set(problemaActivo !== null ? problemas[problemaActivo]?.puestos ?? [] : []), [problemaActivo, problemas]);

  const esEjemplo = estado.ejemploTrono || estado.ejemploCuadrilla;
  const cerrarMenu = (e: Event) => ((e.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
  const enTrabajo = pRes === 'cuadrante' || pRes === 'planta';
  const verRevision = estado.comprobado && revisionAbierta && enTrabajo;
  const nErrores = problemas.filter((p) => p.nivel === 'error').length;
  const nAvisos = problemas.filter((p) => p.nivel === 'aviso').length;

  const herramientas = (
    <>
      <button type="button" class="icono" title="Deshacer" aria-label="Deshacer" disabled={historial.length === 0} onClick={deshacer}>↶</button>
      <button type="button" class="icono" title="Quitar a todos" aria-label="Quitar a todos de sus puestos" disabled={colocados === 0} onClick={vaciar}>⌫</button>
      {progreso ? (
        <button type="button" class="secundario" onClick={cancelarRelleno} title={progreso.texto}>Cancelar · {Math.round(progreso.fraccion * 100)} %</button>
      ) : (
        <button type="button" class="secundario" onClick={rellenar} disabled={!trono || huecosRellenables === 0}
          title="El programa coloca al resto sin tocar a los que ya has puesto">Rellenar huecos</button>
      )}
    </>
  );

  return (
    <>
      <header class="cabecera no-imprimir">
        <div class="marca">
          <h1>Cuadrante de trono</h1>
          {esEjemplo && <span class="etiqueta-ejemplo" title="El trono o la cuadrilla son de ejemplo">Ejemplo</span>}
        </div>
        <nav class="secciones" aria-label="Apartados">
          <button type="button" class={seccion === 'cuadrante' ? 'activa' : ''} aria-current={seccion === 'cuadrante' ? 'page' : undefined}
            onClick={() => setSeccion('cuadrante')}>Cuadrante</button>
          <button type="button" class={seccion === 'configuracion' ? 'activa' : ''} aria-current={seccion === 'configuracion' ? 'page' : undefined}
            onClick={() => setSeccion('configuracion')}>Configuración</button>
        </nav>
        <div class="cabecera-derecha">
          <span class="contador-colocados" title="Puestos cubiertos">{colocados}/{nPuestos}</span>
          <button type="button" class="primario" onClick={comprobar} disabled={!trono}>Comprobar</button>
        </div>
        {progreso && (
          <div class="progreso" role="progressbar" aria-label={progreso.texto} aria-valuenow={Math.round(progreso.fraccion * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div class="barra" style={{ width: `${Math.round(progreso.fraccion * 100)}%` }} />
          </div>
        )}
      </header>

      {seccion === 'configuracion' ? (
        <main class="contenido no-imprimir">
          <Configuracion
            pestana={pConfig} setPestana={setPConfig}
            config={estado.config} cambiarConfig={cambiarConfig} trono={trono} errores={errores}
            cuadrilla={estado.cuadrilla} cambiarCuadrilla={cambiarCuadrilla}
            cargarCuadrillaEjemplo={() => setEstado((e) => ({ ...e, cuadrilla: cuadrillaEjemplo(), ejemploCuadrilla: true }))}
            opt={estado.opt} cambiarOpt={cambiarOpt}
            esEjemploTrono={estado.ejemploTrono} esEjemploCuadrilla={estado.ejemploCuadrilla}
            cargarTronoEjemplo={() => setEstado((e) => ({ ...e, config: tronoEjemplo(), ejemploTrono: true }))}
            borrarTodo={restablecer} elegirClaves={elegirClaves} />
        </main>
      ) : (
        <main class="contenido no-imprimir" id="resultados">
          {error && <div class="aviso mal" role="alert">{error} <button type="button" class="enlace" onClick={() => setError(null)}>Cerrar</button></div>}
          {errores.length > 0 && (
            <div class="aviso mal">
              Hay datos del trono que corregir. <button type="button" class="enlace" onClick={() => { setSeccion('configuracion'); setPConfig('trono'); }}>Ir a la configuración</button>
            </div>
          )}

          <div class="barra-resultados">
            <nav class="pestanas" role="tablist">
              {([['cuadrante', 'Cuadrante'], ['planta', 'Planta'], ['resumen', 'Resumen'], ['lista', 'Lista']] as [PestanaRes, string][]).map(([k, t]) => (
                <button type="button" role="tab" aria-selected={pRes === k} class={pRes === k ? 'activa' : ''} onClick={() => setPRes(k)}
                  disabled={k === 'resumen' && !resultado}>{t}</button>
              ))}
            </nav>
            <div class="barra-derecha">
              {estado.comprobado && !verRevision && enTrabajo && (
                <button type="button" class="secundario estado-revision" onClick={() => setRevisionAbierta(true)}>
                  {nErrores > 0 ? <span class="t-alta">{nErrores} error{nErrores === 1 ? '' : 'es'}</span>
                    : nAvisos > 0 ? <span class="t-aviso">{nAvisos} aviso{nAvisos === 1 ? '' : 's'}</span> : <span class="t-bien">Revisión</span>}
                </button>
              )}
              {vista && (
                <details class="menu">
                  <summary>Exportar</summary>
                  <div class="menu-lista">
                    <button type="button" onClick={(e) => { cerrarMenu(e); exportarCsvPorVaral(vista); }}>Cuadrante (CSV)</button>
                    <button type="button" onClick={(e) => { cerrarMenu(e); exportarCsv(vista); }}>Lista (CSV)</button>
                    <button type="button" onClick={(e) => { cerrarMenu(e); exportarXlsx(vista).catch((x) => setError(`No se pudo crear el Excel: ${x.message}`)); }}>Excel</button>
                    <button type="button" onClick={(e) => { cerrarMenu(e); window.print(); }}>Imprimir</button>
                  </div>
                </details>
              )}
            </div>
          </div>

          {!vista ? (
            <p class="vacio">Corrige los datos del trono para empezar.</p>
          ) : (
            <div class={`area${verRevision ? ' con-revision' : ''}`}>
              <div class="area-principal">
                {pRes === 'cuadrante' && (
                  <Cuadrante v={vista} cuadrilla={estado.cuadrilla} resaltados={resaltados} modo={modoCuadrante} setModo={setModoCuadrante}
                    onMover={onMover} onPrevisualizar={onPrevisualizar} onClave={alternarClave} herramientas={herramientas} />
                )}
                {pRes === 'planta' && (
                  <>
                    {vista.resultado && <Indicadores r={vista.resultado} antes={previa ? evaluacion.resultado : null} />}
                    <Planta v={vista} resaltados={resaltados} modo={modoPlanta} setModo={setModoPlanta} onClave={alternarClave}
                      onMover={onMover} onPrevisualizar={onPrevisualizar} herramientas={herramientas} />
                  </>
                )}
                {pRes === 'resumen' && vista.resultado && (
                  <Resumen v={vista} prioridad={estado.opt.prioridadConfianza} inclinacionMax={estado.opt.inclinacionMaxGrados} />
                )}
                {pRes === 'lista' && <Lista v={vista} />}
              </div>
              {verRevision && (
                <Revision problemas={problemas} resultado={resultado} error={evaluacion.error} recalculando={recalculando}
                  activo={problemaActivo} onElegir={setProblemaActivo} onCerrar={() => setRevisionAbierta(false)} />
              )}
            </div>
          )}
        </main>
      )}
      {vista && <Impresion v={vista} esEjemplo={esEjemplo} />}
    </>
  );
}
