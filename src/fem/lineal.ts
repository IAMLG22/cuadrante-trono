// Álgebra lineal densa mínima: factorización de Cholesky (matriz simétrica definida positiva).

export class ErrorSingular extends Error {}

/** Factoriza A (n×n, fila mayor) en sitio: queda L en el triángulo inferior. */
export function cholesky(A: Float64Array, n: number): Float64Array {
  for (let j = 0; j < n; j++) {
    const rj = j * n;
    let s = A[rj + j];
    for (let k = 0; k < j; k++) s -= A[rj + k] * A[rj + k];
    if (!(s > 1e-12 * Math.abs(A[rj + j]) + 1e-300)) throw new ErrorSingular('Matriz no definida positiva');
    const d = Math.sqrt(s);
    A[rj + j] = d;
    for (let i = j + 1; i < n; i++) {
      const ri = i * n;
      let t = A[ri + j];
      for (let k = 0; k < j; k++) t -= A[ri + k] * A[rj + k];
      A[ri + j] = t / d;
    }
  }
  return A;
}

/** Resuelve L·Lᵀ·x = b con el factor de `cholesky`. Devuelve un vector nuevo. */
export function resolverCholesky(L: Float64Array, n: number, b: ArrayLike<number>): Float64Array {
  const x = Float64Array.from(b as ArrayLike<number>);
  for (let i = 0; i < n; i++) {
    const ri = i * n;
    let s = x[i];
    for (let k = 0; k < i; k++) s -= L[ri + k] * x[k];
    x[i] = s / L[ri + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}
