// src/stats.js
import { state } from "./state.js";

export function renderStats(data) {
  const d3 = window.d3;

  const n = data.length;
  const avgFinal = n ? d3.mean(data, d => d.FinalScore) : NaN;
  const avgD = n ? d3.mean(data, d => d.Dscore) : NaN;
  const avgE = n ? d3.mean(data, d => d.Escore) : NaN;

  const brushInfo =
    state.brushedIds && state.brushedIds.size > 0
      ? `&nbsp; | &nbsp;<b>Brush:</b> ${state.brushedIds.size}`
      : "";

  d3.select("#stats").html(`
    <span class="stats-metric"><b>Rows:</b> ${n}</span>
    <span class="stats-metric"><b>Avg Final:</b> ${isNaN(avgFinal) ? "-" : avgFinal.toFixed(3)}</span>
    <span class="stats-metric"><b>Avg D:</b> ${isNaN(avgD) ? "-" : avgD.toFixed(3)}</span>
    <span class="stats-metric"><b>Avg E:</b> ${isNaN(avgE) ? "-" : avgE.toFixed(3)}</span>
    ${brushInfo}
  `);
}
