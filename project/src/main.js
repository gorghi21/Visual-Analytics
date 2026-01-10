// src/main.js
import { state, dataStore } from "./state.js";
import { loadCSV } from "./data.js";
import { initFilters, updateAthleteOptions, setSelectValuesFromState } from "./filters.js";
import { renderStats } from "./stats.js";
import { computePCA } from "./pca_math.js";

import { drawScatter } from "./charts/scatter.js";
import { drawTimeline } from "./charts/timeline.js?v=1000";
import { drawHeatmap } from "./charts/heatmap.js";
import { drawPCA, applyPCABrushStyles, applyPCASelectionStyles } from "./charts/pca.js";
import { setHighlightedCompetition } from "./highlight.js";

const PCA_COLS = ["Dscore", "Escore", "FinalScore", "Penalties"];
const MIN_BRUSH_FOR_PCA = 8;

function getPcaInputData() {
  if (state.pcaMode !== "brushed") return dataStore.filteredData;

  const ids = state.brushedIds;
  if (!ids || ids.size < MIN_BRUSH_FOR_PCA) return dataStore.filteredData;

  return dataStore.filteredData.filter(d => ids.has(d.__id));
}

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

  const pcaBtn = document.getElementById("pcaInfoBtn");
  const pcaBox = document.getElementById("pcaInfoBox");

  if (pcaBtn && pcaBox) {
    pcaBtn.addEventListener("click", () => {
      const isOpen = !pcaBox.hasAttribute("hidden");
      if (isOpen) {
        pcaBox.setAttribute("hidden", "");
        pcaBtn.setAttribute("aria-expanded", "false");
      } else {
        pcaBox.removeAttribute("hidden");
        pcaBtn.setAttribute("aria-expanded", "true");
      }
    });
  }

  // NEW: PCA mode checkbox (if present)
  const cb = document.getElementById("pcaOnBrushed");
  if (cb) {
    cb.checked = (state.pcaMode === "brushed");
    cb.addEventListener("change", () => {
      state.pcaMode = cb.checked ? "brushed" : "filtered";
      updateAll();
    });
  }

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

  // overview (heatmap = solo filtri globali)
  drawHeatmap(dataStore.filteredData, {
    mode: "year_event",
    onPickCell: ({ year, event, apparatus }) => {
      // qui decidi cosa fare: puoi filtrare year+apparatus, oppure aggiungere anche event
      state.year = year;
      state.apparatus = apparatus;
      // se hai un filtro event, imposta anche quello:
      // state.event = event;

      window.d3.select("#yearSelect").property("value", year);
      window.d3.select("#apparatusSelect").property("value", apparatus);
      updateAll();
    }
  });

  // NEW: PCA computed on filtered or brushed subset (depending on state.pcaMode)
  const pcaInput = getPcaInputData();
  dataStore.pca = computePCA(pcaInput, PCA_COLS);
  updatePcaInfoBox();

  drawPCA(dataStore.pca.points, {
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
  // NEW: if PCA mode is brushed, brush drives a recomputation of PCA (analytics triggered by interaction)
  if (state.pcaMode === "brushed") {
    const pcaInput = getPcaInputData();
    dataStore.pca = computePCA(pcaInput, PCA_COLS);
    drawPCA(dataStore.pca.points, {
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
  }

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

  // keep pcaMode as chosen by user

  setSelectValuesFromState();

  // clear brush group if present
  window.d3.select("#pca").select(".brush").call(window.d3.brush().clear);

  updateAll();
}

function updatePcaInfoBox() {
  const box = document.getElementById("pcaInfoBox");
  if (!box) return;

  const pca = dataStore.pca;
  if (!pca || !pca.cols) {
    box.innerHTML = `
      <div class="pca-title">PCA details</div>
      <div>Not available.</div>
    `;
    return;
  }

  const fmtPct = x => Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "-";
  const fmtNum = x => Number.isFinite(x) ? x.toFixed(3) : "-";

  box.innerHTML = `
    <div class="pca-title">PCA details</div>

    <div style="margin-bottom:6px; color:#444;">
      <em>
        Dimensionality reduction of performance metrics.
        Points closer together indicate similar overall performance profiles.
      </em>
    </div>

    <div style="margin-top:6px;">
      <b>Computed on:</b>
      ${state.pcaMode === "brushed" ? "brushed subset" : "filtered set"}
      (n = ${pca.n})
    </div>

    <div style="margin-top:6px;">
      <b>Explained variance:</b>
      PC1 ${fmtPct(pca.explained?.[0])},
      PC2 ${fmtPct(pca.explained?.[1])}
    </div>

    <div style="margin-top:10px;"><b>Loadings</b></div>
    <table>
      <thead>
        <tr>
          <th>Variable</th>
          <th>PC1</th>
          <th>PC2</th>
        </tr>
      </thead>
      <tbody>
        ${pca.cols.map(c => `
          <tr>
            <td>${c}</td>
            <td>${fmtNum(pca.loadings?.PC1?.[c])}</td>
            <td>${fmtNum(pca.loadings?.PC2?.[c])}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}