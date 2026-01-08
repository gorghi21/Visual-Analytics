// src/pca_math.js
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v) {
  return Math.sqrt(dot(v, v));
}

function matVec(A, v) {
  const out = new Array(A.length).fill(0);
  for (let i = 0; i < A.length; i++) {
    let s = 0;
    for (let j = 0; j < v.length; j++) s += A[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

function powerIteration(A, iters = 250) {
  const p = A.length;
  let v = new Array(p).fill(0).map(() => Math.random());
  let nv = norm(v);
  v = v.map(x => x / (nv || 1));

  for (let t = 0; t < iters; t++) {
    const Av = matVec(A, v);
    const nAv = norm(Av);
    if (!Number.isFinite(nAv) || nAv < 1e-12) break;
    v = Av.map(x => x / nAv);
  }
  return v;
}

function rayleighQuotient(A, v) {
  const Av = matVec(A, v);
  const num = dot(v, Av);
  const den = dot(v, v);
  return den ? num / den : 0;
}

function deflate(A, v, lambda) {
  const p = A.length;
  const out = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) out[i][j] = A[i][j] - lambda * v[i] * v[j];
  }
  return out;
}

/**
 * Returns:
 * {
 *   points: [{... , pc1, pc2}],
 *   cols, n, mean, sd,
 *   eigenvalues: [l1, l2],
 *   explained: [e1, e2],  // fractions
 *   loadings: { PC1: {col: val}, PC2: {col: val} }
 * }
 */
export function computePCA(data, cols) {
  const d3 = window.d3;

  const rows = (data || []).filter(d => cols.every(c => Number.isFinite(d[c])));
  const n = rows.length;
  const p = cols.length;

  if (n < 2 || p < 2) {
    return {
      points: [],
      cols,
      n,
      mean: [],
      sd: [],
      eigenvalues: [0, 0],
      explained: [0, 0],
      loadings: { PC1: {}, PC2: {} }
    };
  }

  const mean = cols.map(c => d3.mean(rows, r => r[c]));
  const sd = cols.map((c, j) => {
    const v = d3.deviation(rows, r => r[c]);
    return (Number.isFinite(v) && v > 1e-12) ? v : 1;
  });

  // Standardized matrix X (n x p)
  const X = rows.map(r => cols.map((c, j) => (r[c] - mean[j]) / sd[j]));

  // Covariance matrix C = (X^T X)/(n-1)
  const C = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      for (let b = a; b < p; b++) C[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 0; a < p; a++) {
    for (let b = a; b < p; b++) {
      C[a][b] /= (n - 1);
      C[b][a] = C[a][b];
    }
  }

  // First 2 PCs
  const v1 = powerIteration(C, 250);
  const l1 = rayleighQuotient(C, v1);

  const C2 = deflate(C, v1, l1);
  const v2 = powerIteration(C2, 250);
  const l2 = rayleighQuotient(C2, v2);

  const eigenvaluesAll = [l1, l2].map(x => (Number.isFinite(x) ? x : 0));

  // Total variance = trace(C)
  let totalVar = 0;
  for (let i = 0; i < p; i++) totalVar += C[i][i];
  totalVar = (Number.isFinite(totalVar) && totalVar > 1e-12) ? totalVar : 1;

  const explained = [
    eigenvaluesAll[0] / totalVar,
    eigenvaluesAll[1] / totalVar
  ].map(x => (Number.isFinite(x) ? Math.max(0, x) : 0));

  const loadings = {
    PC1: Object.fromEntries(cols.map((c, j) => [c, v1[j]])),
    PC2: Object.fromEntries(cols.map((c, j) => [c, v2[j]]))
  };

  const points = rows.map((r, i) => ({
    __id: r.__id,
    Athlete: r.Athlete,
    Nation: r.Nation,
    Year: r.Year,
    Apparatus: r.Apparatus,
    Qualified: r.Qualified,
    Competition: r.Competition,
    Event: r.Event,
    FinalScore: r.FinalScore,
    Dscore: r.Dscore,
    Escore: r.Escore,
    Penalties: r.Penalties,
    pc1: dot(X[i], v1),
    pc2: dot(X[i], v2)
  }));

  return {
    points,
    cols,
    n,
    mean,
    sd,
    eigenvalues: eigenvaluesAll,
    explained,
    loadings
  };
}
