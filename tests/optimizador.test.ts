import { describe, expect, it } from 'vitest';
import { calcularCuadrante, ErrorCuadrilla, resumirCargas } from '../src/optimizador/optimizar';
import { construirTrono } from '../src/geometria/trono';
import { aleatorio, optimizadorPorDefecto } from '../src/io/ejemplo';
import { cuadrillaPrueba, tronoPrueba } from './datos';
import { construirModelo, K_PERSONA } from '../src/fem/modelo';
import { perfilIdeal, resolverContacto } from '../src/fem/contacto';

describe('optimizador', () => {
  const c = tronoPrueba();
  const op = optimizadorPorDefecto();

  it('184 puestos en menos de 3 s, sin alabeo y dentro de la inclinación máxima', () => {
    const cuad = cuadrillaPrueba();
    const r = calcularCuadrante(c, cuad, { ...op, prioridadConfianza: 0 });
    console.log('tiempo', r.tiempoMs.toFixed(0), 'ms', JSON.stringify(r.resumen), 'incl', r.inclinacionGrados, 'alabeo', r.alabeoGrados);
    expect(r.tiempoMs).toBeLessThan(3000);
    expect(Math.abs(r.inclinacionGrados)).toBeLessThanOrEqual(1.01);
    // El HdT de 119 cm no llega al varal en ningún sitio y deja un alabeo residual mínimo
    expect(Math.abs(r.alabeoGrados)).toBeLessThan(0.15);
    expect(Math.abs(r.cargasKg.reduce((a, b) => a + b, 0) - r.pesoTotal)).toBeLessThan(1e-4);
    expect(new Set(r.asignacion).size).toBe(184);
  });

  it('mejora claramente a una asignación al azar', () => {
    const cuad = cuadrillaPrueba();
    const r = calcularCuadrante(c, cuad, { ...op, prioridadConfianza: 0 });
    const t = construirTrono(c);
    const m = construirModelo(t);
    const azar = aleatorio(99);
    const h = Float64Array.from(cuad.map((x) => ({ x, k: azar() })).sort((a, b) => a.k - b.k), (o) => o.x.hombro / 100);
    const sdAzar = resumirCargas(Array.from(resolverContacto(m, h).F, (F) => F / 9.81), r.cargaIdeal).desviacionTipica;
    expect(r.resumen.desviacionTipica).toBeLessThan(sdAzar / 2);
    // Con hombros al medio centímetro (≈ ±5 kg) no se puede bajar mucho más
    expect(r.resumen.desviacionTipica).toBeLessThan(0.35 * r.cargaIdeal);
  });

  it('con prioridad de confianza máxima se cubren más puestos clave con confianza 3', () => {
    const cuad = cuadrillaPrueba();
    const r = calcularCuadrante(c, cuad, { ...op, prioridadConfianza: 1 });
    console.log('confianza', JSON.stringify(r.confianza), 'sin', r.sinConfianza?.claveConf3, 'sd', r.resumen.desviacionTipica, r.sinConfianza?.desviacionTipica);
    expect(r.confianza.claveConf3).toBeGreaterThan(r.sinConfianza!.claveConf3);
    expect(r.confianza.claveConf1).toBeLessThanOrEqual(3);
  });

  it('si sobra gente elige reservas y no se repite nadie', () => {
    const cuad = cuadrillaPrueba(202, 7);
    const r = calcularCuadrante(c, cuad, { ...op, prioridadConfianza: 0.3 });
    expect(r.reservas.length).toBe(18);
    expect(new Set([...r.asignacion, ...r.reservas]).size).toBe(202);
    console.log('reservas', r.tiempoMs.toFixed(0), 'ms', r.resumen.desviacionTipica);
  });

  it('si falta gente da un error claro', () => {
    expect(() => calcularCuadrante(c, cuadrillaPrueba(170), op)).toThrow(ErrorCuadrilla);
    expect(() => calcularCuadrante(c, cuadrillaPrueba(170), op)).toThrow(/Faltan 14 hombres de trono/);
  });

  it('si los hombros coinciden con el perfil ideal, el optimizador encuentra el reparto perfecto', () => {
    const t = construirTrono(c);
    const m = construirModelo(t);
    const Fid = m.pesoTotalN / t.puestos.length;
    const w = perfilIdeal(m, Fid).w;
    // Cuadrilla barajada con los hombros exactos del perfil ideal
    const r = aleatorio(3);
    const cuad = Array.from(w, (wi, i) => ({ id: i + 1, nombre: 'P' + i, hombro: 125 + (wi + Fid / K_PERSONA) * 100, confianza: 3 as const }))
      .map((h) => ({ h, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.h);
    const res = calcularCuadrante(c, cuad, { ...op, prioridadConfianza: 0 });
    expect(res.resumen.max - res.resumen.min).toBeLessThan(0.5);
  });
});
