import { MATERIALES, NOMBRE_MATERIAL, propiedades } from '../geometria/secciones';
import type { ConfigTrono, Material, RepartoManto, Seccion, TipoMaterial } from '../geometria/tipos';
import { cdgManto, filasSugeridas, fraccionMantoEnMesa, separacionFilas, LETRAS, longitudManto, posicionesVarales, separacionesUniformes } from '../geometria/trono';
import { fmt } from '../io/tablas';
import { Casilla, Grupo, Num, Sel } from './campos';

interface Props {
  config: ConfigTrono;
  cambiar: (f: (c: ConfigTrono) => void) => void;
  nPuestos: number;
}

function CamposMaterial({ m, onCambio }: { m: Material; onCambio: (m: Material) => void }) {
  return (
    <>
      <Sel<TipoMaterial>
        etiqueta="Material"
        valor={m.tipo}
        opciones={(['aluminio', 'acero', 'pino', 'carbono', 'otro'] as TipoMaterial[]).map((t) => [t, NOMBRE_MATERIAL[t]])}
        onCambio={(t) => onCambio(t === 'otro' ? { ...m, tipo: 'otro' } : { ...MATERIALES[t] })}
      />
      <Num etiqueta="Módulo E" unidad="GPa" valor={m.E_GPa} min={0.001} desactivado={m.tipo !== 'otro'} onCambio={(v) => onCambio({ ...m, E_GPa: v })} />
      <Num etiqueta="Densidad" unidad="kg/m³" valor={m.densidad} min={0} desactivado={m.tipo !== 'otro'} onCambio={(v) => onCambio({ ...m, densidad: v })} />
    </>
  );
}

export function FormTrono({ config: c, cambiar, nPuestos }: Props) {
  const s = c.varales.seccion;
  const prop = propiedades(s, c.varales.material);
  const p = c.puestos;
  const sepDel = separacionFilas(c.varales.largoDelante, p.filasDelante);
  const sepDet = separacionFilas(c.varales.largoDetras, p.filasDetras);
  const textoSep = (n: number, sep: number, largo: number) =>
    n === 0 ? 'sin filas' : `una cada ${fmt(sep, 2)} m${sep < 0.4 ? ' (muy juntas)' : sep > 0.6 ? ' (muy separadas)' : ''}${n !== filasSugeridas(largo) ? ` · caben unas ${filasSugeridas(largo)}` : ''}`;
  const n = c.varales.numero;
  const sep = c.varales.separaciones;
  const yv = posicionesVarales(c);
  const anchoVarales = yv[0] - yv[yv.length - 1];

  const cambiarSeccion = (tipo: Seccion['tipo']) =>
    cambiar((c) => {
      c.varales.seccion =
        tipo === 'rect' ? { tipo, ancho: 100, alto: 100, espesor: 5 } :
        tipo === 'redondo' ? { tipo, diametro: 100, espesor: 5 } : { tipo, ancho: 80, alto: 120 };
    });

  return (
    <div class="formulario">
      <Grupo titulo="Mesa">
        <Num etiqueta="Largo" unidad="m" valor={c.mesa.largo} min={0.5} onCambio={(v) => cambiar((c) => (c.mesa.largo = v))} />
        <Num etiqueta="Ancho" unidad="m" valor={c.mesa.ancho} min={0.5} onCambio={(v) => cambiar((c) => (c.mesa.ancho = v))} />
        <Num etiqueta="Altura sobre los varales" unidad="m" valor={c.mesa.altura} min={0}
          ayuda="Se toma como altura del centro de gravedad de mesa e imágenes."
          onCambio={(v) => cambiar((c) => (c.mesa.altura = v))} />
        <Num etiqueta="Peso con imágenes y enseres" unidad="kg" valor={c.mesa.peso} min={0} onCambio={(v) => cambiar((c) => (c.mesa.peso = v))} />
      </Grupo>

      <Grupo titulo="Varales">
        <Sel<number> etiqueta="Número de varales" valor={n} opciones={[4, 6, 8].map((k) => [k, `${k} (${LETRAS.slice(0, k).split('').join(', ')})`])}
          onCambio={(v) => cambiar((c) => {
            c.varales.numero = v as 4 | 6 | 8;
            // Las separaciones dependen del número de varales: se vuelven a proponer iguales
            if (c.varales.separaciones) c.varales.separaciones = separacionesUniformes(c);
          })} />
        <CamposMaterial m={c.varales.material} onCambio={(m) => cambiar((c) => (c.varales.material = m))} />
        <Sel<Seccion['tipo']> etiqueta="Sección" valor={s.tipo}
          opciones={[['rect', 'Tubo rectangular'], ['redondo', 'Tubo redondo'], ['macizo', 'Macizo rectangular']]}
          onCambio={cambiarSeccion} />
        {s.tipo === 'rect' && (
          <>
            <Num etiqueta="Ancho" unidad="mm" valor={s.ancho} min={1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).ancho = v))} />
            <Num etiqueta="Alto" unidad="mm" valor={s.alto} min={1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).alto = v))} />
            <Num etiqueta="Espesor" unidad="mm" valor={s.espesor} min={0.1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).espesor = v))} />
          </>
        )}
        {s.tipo === 'redondo' && (
          <>
            <Num etiqueta="Diámetro" unidad="mm" valor={s.diametro} min={1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).diametro = v))} />
            <Num etiqueta="Espesor" unidad="mm" valor={s.espesor} min={0.1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).espesor = v))} />
          </>
        )}
        {s.tipo === 'macizo' && (
          <>
            <Num etiqueta="Ancho" unidad="mm" valor={s.ancho} min={1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).ancho = v))} />
            <Num etiqueta="Alto" unidad="mm" valor={s.alto} min={1} onCambio={(v) => cambiar((c) => ((c.varales.seccion as typeof s).alto = v))} />
          </>
        )}
        <p class="dato-calculado">
          I = {fmt(prop.inercia * 1e8, 1)} cm⁴ · A = {fmt(prop.area * 1e4, 2)} cm² · {fmt(prop.kgPorMetro, 2)} kg/m
        </p>
        <Num etiqueta="Largo por delante de la mesa" unidad="m" valor={c.varales.largoDelante} min={0} onCambio={(v) => cambiar((c) => (c.varales.largoDelante = v))} />
        <Num etiqueta="Largo por detrás de la mesa" unidad="m" valor={c.varales.largoDetras} min={0} onCambio={(v) => cambiar((c) => (c.varales.largoDetras = v))} />
        <p class="dato-calculado">Sin contar las cabezas de varal.</p>
      </Grupo>

      <Grupo titulo="Separación entre varales">
        <Casilla etiqueta="Misma separación entre todos los varales" valor={sep === null}
          onCambio={(v) => cambiar((c) => (c.varales.separaciones = v ? null : separacionesUniformes(c)))} />
        {sep && sep.map((d, i) => {
          const central = i === sep.length - 1;
          const izq = LETRAS[i], der = LETRAS[i + 1];
          const espejo = central ? '' : ` y ${LETRAS[n - 2 - i]}–${LETRAS[n - 1 - i]}`;
          return (
            <Num etiqueta={central ? `${izq}–${der} (centro)` : `${izq}–${der}${espejo}`} unidad="m" valor={d} min={0.01}
              onCambio={(v) => cambiar((c) => (c.varales.separaciones![i] = v))} />
          );
        })}
        <p class="dato-calculado">
          Entre {LETRAS[0]} y {LETRAS[n - 1]}: {fmt(anchoVarales, 2)} m{sep ? '. Un lado se copia en el otro (el trono es simétrico).' : `, con los exteriores en los bordes de la mesa.`}
          {Math.abs(anchoVarales - c.mesa.ancho) > 0.005 && <> La mesa mide {fmt(c.mesa.ancho, 2)} m de ancho.</>}
        </p>
      </Grupo>

      <Grupo titulo="Cabezas de varal">
        <Num etiqueta="Peso de cada cabeza delantera" unidad="kg" valor={c.varales.cabezas.delante.peso} min={0}
          onCambio={(v) => cambiar((c) => (c.varales.cabezas.delante.peso = v))} />
        <Num etiqueta="Longitud" unidad="m" valor={c.varales.cabezas.delante.longitud} min={0}
          onCambio={(v) => cambiar((c) => (c.varales.cabezas.delante.longitud = v))} />
        <Num etiqueta="Peso de cada cabeza trasera" unidad="kg" valor={c.varales.cabezas.detras.peso} min={0}
          onCambio={(v) => cambiar((c) => (c.varales.cabezas.detras.peso = v))} />
        <Num etiqueta="Longitud" unidad="m" valor={c.varales.cabezas.detras.longitud} min={0}
          onCambio={(v) => cambiar((c) => (c.varales.cabezas.detras.longitud = v))} />
        <p class="dato-calculado">
          Van en la punta de cada varal, a continuación de él. En total {fmt(n * (c.varales.cabezas.delante.peso + c.varales.cabezas.detras.peso), 0)} kg.
        </p>
      </Grupo>

      <Grupo titulo="Puestos">
        <Num etiqueta="Filas por delante de la mesa" entero min={0} max={40} valor={p.filasDelante}
          ayuda={textoSep(p.filasDelante, sepDel, c.varales.largoDelante)}
          onCambio={(v) => cambiar((c) => (c.puestos.filasDelante = v))} />
        <Num etiqueta="Filas por detrás de la mesa" entero min={0} max={40} valor={p.filasDetras}
          ayuda={textoSep(p.filasDetras, sepDet, c.varales.largoDetras)}
          onCambio={(v) => cambiar((c) => (c.puestos.filasDetras = v))} />
        <p class="dato-calculado">Las filas se reparten solas a lo largo de cada voladizo, a la misma distancia unas de otras.</p>
        <Num etiqueta={`Costeros por lado (varales A y ${LETRAS[n - 1]})`} entero min={0} valor={p.costerosPorLado}
          ayuda="Se reparten por igual a lo largo de la mesa."
          onCambio={(v) => cambiar((c) => (c.puestos.costerosPorLado = v))} />
        <p class="dato-calculado">Total: <strong>{nPuestos} puestos</strong></p>
      </Grupo>

      <Grupo titulo={<>Palio <span class="opcional">(opcional)</span></>}>
        <Casilla etiqueta="Lleva palio" valor={c.palio.activo} onCambio={(v) => cambiar((c) => (c.palio.activo = v))} />
        {c.palio.activo && (
          <>
            <Num etiqueta="Peso del palio" unidad="kg" valor={c.palio.peso} min={0} onCambio={(v) => cambiar((c) => (c.palio.peso = v))} />
            <Num etiqueta="Altura sobre la mesa" unidad="m" valor={c.palio.altura} min={0} onCambio={(v) => cambiar((c) => (c.palio.altura = v))} />
          </>
        )}
      </Grupo>

      <Grupo titulo={<>Manto <span class="opcional">(opcional)</span></>}>
        <Casilla etiqueta="Lleva manto" valor={c.manto.activo} onCambio={(v) => cambiar((c) => (c.manto.activo = v))} />
        {c.manto.activo && (
          <>
            <Num etiqueta="Peso del manto" unidad="kg" valor={c.manto.peso} min={0} onCambio={(v) => cambiar((c) => (c.manto.peso = v))} />
            <Num etiqueta="Distancia del final del manto al final de los varales" unidad="m" valor={c.manto.distanciaFinal} min={0}
              onCambio={(v) => cambiar((c) => (c.manto.distanciaFinal = v))} />
            <Sel<RepartoManto> etiqueta="Cómo cae el peso a lo largo" valor={c.manto.reparto}
              opciones={[['final', 'Casi todo al final (cola ancha)'], ['creciente', 'Creciendo hacia atrás'], ['uniforme', 'Igual a lo largo']]}
              onCambio={(v) => cambiar((c) => (c.manto.reparto = v))} />
            <Sel<'mesa' | 'varales'> etiqueta="Dónde apoya su estructura" valor={c.manto.apoyo}
              opciones={[['mesa', 'Sale de la mesa y cuelga hacia atrás'], ['varales', 'Descansa sobre los varales traseros']]}
              onCambio={(v) => cambiar((c) => (c.manto.apoyo = v))} />
            {longitudManto(c) > 0 && c.manto.apoyo === 'mesa' && (
              <p class="dato-calculado">
                Va de la cabeza de la Virgen (centro de la mesa) hacia la cola: mide {fmt(longitudManto(c), 2)} m.
                Su peso lo recibe entero la mesa, pero actúa a {fmt(cdgManto(c), 2)} m por detrás del centro:
                empuja la cola hacia abajo y carga más a los de detrás.
              </p>
            )}
            {longitudManto(c) > 0 && c.manto.apoyo === 'varales' && (
              <p class="dato-calculado">
                Va de la cabeza de la Virgen (centro de la mesa) hacia la cola: mide {fmt(longitudManto(c), 2)} m.
                Sobre la mesa cae el {fmt(100 * fraccionMantoEnMesa(c), 0)} % de su peso
                ({fmt(c.manto.peso * fraccionMantoEnMesa(c), 0)} kg); el resto, {fmt(c.manto.peso * (1 - fraccionMantoEnMesa(c)), 0)} kg,
                lo llevan los varales traseros por igual.
              </p>
            )}
          </>
        )}
      </Grupo>

      <Grupo titulo={<>Quitacimbres <span class="opcional">(opcional)</span></>}>
        <Casilla etiqueta="Lleva quitacimbres" valor={c.quitacimbres.activo} onCambio={(v) => cambiar((c) => (c.quitacimbres.activo = v))} />
        {c.quitacimbres.activo && (
          <>
            <Num etiqueta="Distancia a la punta delantera" unidad="m" valor={c.quitacimbres.distDelante} min={0} onCambio={(v) => cambiar((c) => (c.quitacimbres.distDelante = v))} />
            <Num etiqueta="Distancia a la punta trasera" unidad="m" valor={c.quitacimbres.distDetras} min={0} onCambio={(v) => cambiar((c) => (c.quitacimbres.distDetras = v))} />
            <Num etiqueta="Ancho de la pletina" unidad="mm" valor={c.quitacimbres.ancho} min={1} onCambio={(v) => cambiar((c) => (c.quitacimbres.ancho = v))} />
            <Num etiqueta="Espesor de la pletina" unidad="mm" valor={c.quitacimbres.espesor} min={0.1} onCambio={(v) => cambiar((c) => (c.quitacimbres.espesor = v))} />
            <Sel<'plana' | 'canto'> etiqueta="Colocación" valor={c.quitacimbres.colocacion} opciones={[['plana', 'Plana'], ['canto', 'De canto']]}
              onCambio={(v) => cambiar((c) => (c.quitacimbres.colocacion = v))} />
            <CamposMaterial m={c.quitacimbres.material} onCambio={(m) => cambiar((c) => (c.quitacimbres.material = m))} />
          </>
        )}
      </Grupo>
    </div>
  );
}
