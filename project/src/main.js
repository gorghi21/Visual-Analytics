// src/main.js
import { state, dataStore } from "./state.js";
import { loadCSV } from "./data.js";
import { initFilters, updateAthleteOptions, setSelectValuesFromState } from "./filters.js";
import { renderStats } from "./stats.js";
import { computePCA } from "./pca_math.js";

import { drawScatter } from "./charts/scatter.js";
import { drawTimeline } from "./charts/timeline.js";
import { drawHeatmap } from "./charts/heatmap.js";
import { drawPCA, applyPCABrushStyles, applyPCASelectionStyles } from "./charts/pca.js";
import { setHighlightedCompetition } from "./highlight.js";

// entry
(async function boot() {
  dataStore.rawData = await loadCSV("data/mag_results.csv");

  initFilters(dataStore.rawData, {
    onChange: ({ selectionOnly } = {}) => {
      if (selectionOnly) {
        updateLinkedViews();
        applyPCASelectionStyles();
      } else {
        updateAll();
      }
    },
    onReset: () => resetAll()
  });

  updateAll();
})();

function updateAll() {
  // global filters -> filteredData
  dataStore.filteredData = dataStore.rawData.filter(d =>
    (state.year === "all" || String(d.Year) === String(state.year)) &&
    (state.apparatus === "all" || d.Apparatus === state.apparatus) &&
    (state.nation === "all" || d.Nation === state.nation) &&
    (state.qualified === "all" || d.Qualified === state.qualified)
  );

  updateAthleteOptions(dataStore.filteredData);

  // overview (HEATMAP = SOLO filtri globali)
  drawHeatmap(dataStore.filteredData, {
    onPickCell: ({ year, apparatus }) => {
      state.year = year;
      state.apparatus = apparatus;

      // sync UI (usa window.d3 perché d3 non è importato)
      window.d3.select("#yearSelect").property("value", year);
      window.d3.select("#apparatusSelect").property("value", apparatus);

      updateAll();
    }
  });

  // PCA usa global filtered
  dataStore.pcaPoints = computePCA(dataStore.filteredData, ["Dscore", "Escore", "FinalScore", "Penalties"]);
  drawPCA(dataStore.pcaPoints, {
    onSelectAthlete: (athlete) => {
      state.selected = { Athlete: athlete };
      setSelectValuesFromState();
      updateLinkedViews();
      applyPCASelectionStyles();
    },
    onBrushChange: (idsOrNull) => {
      state.brushedIds = idsOrNull;
      updateLinkedViews();
      applyPCABrushStyles();
    }
  });

  // linked views
  updateLinkedViews();

  setHighlightedCompetition(state.highlighted?.Competition ?? null);
}

function getViewData() {
  let view = dataStore.filteredData;

  if (state.selected?.Athlete) view = view.filter(d => d.Athlete === state.selected.Athlete);
  if (state.brushedIds && state.brushedIds.size > 0) view = view.filter(d => state.brushedIds.has(d.__id));

  return view;
}

function updateLinkedViews() {
  const viewData = getViewData();

  renderStats(viewData);

  drawScatter(viewData, {
    onSelectAthlete: (athlete) => {
      state.selected = { Athlete: athlete };
      setSelectValuesFromState();
      updateLinkedViews();
      applyPCASelectionStyles();
    }
  });

  drawTimeline(viewData);

  applyPCABrushStyles();
  applyPCASelectionStyles();

  // highlight timeline after redraw
  setHighlightedCompetition(state.highlighted?.Competition ?? null);
}

function resetAll() {
  state.year = "all";
  state.apparatus = "all";
  state.nation = "all";
  state.qualified = "all";
  state.selected = null;
  state.highlighted = null;
  state.brushedIds = null;

  setSelectValuesFromState();

  // clear brush group if present
  window.d3.select("#pca").select(".brush").call(window.d3.brush().clear);

  updateAll();
}
