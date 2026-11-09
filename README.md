# Cuadrante de trono

Aplicación web estática    (Vite + TypeScript + Preact) que calcula qué hombre de trono va en cada
puesto para que el peso se reparta lo más igual posible.

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # tests de validación (Vitest)
npm run build    # web estática en dist/
```

## Módulos

- `src/geometria` – secciones y materiales, puestos, y numeración (A1…H32).
- `src/fem` – mesa rígida (z0, a, b) + voladizos de Euler-Bernoulli + quitacimbres; contacto
  unilateral por conjunto activo; comprobación en cuesta.
- `src/optimizador` – perfil ideal, modelo linealizado (G = T·K⁻¹·Tᵀ), barrido a·x + c·flecha,
  intercambios por parejas espejo, selección de reservas y Web Worker.
- `src/io` – importar CSV / pegado de Excel, exportar CSV y Excel, localStorage, datos de ejemplo.
- `src/ui` – interfaz.

## Supuestos

- Rigidez de cada HdT: 20 kN/m (fija). 1 cm de diferencia de hombro ≈ 20 kg de carga.
- Costeros repartidos uniformemente a lo largo de la mesa, sobre el eje de A y H.
- Filas: se indica cuántas van delante y detrás y se reparten por igual en el voladizo.
- El centro de gravedad de mesa e imágenes se toma a la «altura sobre los varales» de la mesa;
  el del palio, a esa altura más la suya.
