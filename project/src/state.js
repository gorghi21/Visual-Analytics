// src/state.js
export const state = {
  year: "all",
  apparatus: "all",
  nation: "all",
  qualified: "all",    // Y / N / R
  selected: null,      // { Athlete: string } | null
  highlighted: null,   // null | { Competition: string }
  brushedIds: null,    // null | Set(__id)

  // NEW: PCA computed on filtered set or on brushed subset
  pcaMode: "filtered"  // "filtered" | "brushed"
};

export const dataStore = {
  rawData: [],
  filteredData: [],

  // NEW: full PCA result object (points + diagnostics)
  pca: null
};
