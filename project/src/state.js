// src/state.js
export const state = {
  year: "all",
  apparatus: "all",
  nation: "all",
  qualified: "all",    // Y / N / R
  selected: null,      // { Athlete: string } | null
  highlighted: null,   // null | { Competition: string }
  brushedIds: null     // null | Set(__id)
};

export const dataStore = {
  rawData: [],
  filteredData: [],    // global filters
  pcaPoints: []        // PCA computed on filteredData
};
