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

function powerIteration(A, iters = 200) {
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

export function computePCA(data, cols) {
  const d3 = window.d3;

  const rows = (data || []).filter(d => cols.every(c => Number.isFinite(d[c])));
  const n = rows.length;
  const p = cols.length;
  if (n < 2 || p < 2) return [];

  const mu = cols.map(c => d3.mean(rows, r => r[c]));
  const sd = cols.map(c => {
    const v = d3.deviation(rows, r => r[c]);
    return (Number.isFinite(v) && v > 1e-12) ? v : 1;
  });

  const X = rows.map(r => cols.map((c, j) => (r[c] - mu[j]) / sd[j]));

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

  const v1 = powerIteration(C, 200);
  const l1 = rayleighQuotient(C, v1);
  const C2 = deflate(C, v1, l1);
  const v2 = powerIteration(C2, 200);
  const l2 = rayleighQuotient(C2, v2);

  return rows.map((r, i) => ({
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
    pc2: dot(X[i], v2),
    _eig1: l1,
    _eig2: l2
  }));
}
