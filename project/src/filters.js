// src/filters.js
import { state } from "./state.js";

function fillSelect(selector, values) {
  window.d3.select(selector)
    .selectAll("option")
    .data(values)
    .join("option")
    .attr("value", d => d)
    .text(d => d);
}

export function initFilters(rawData, { onChange, onReset }) {
  fillSelect("#yearSelect", ["all", ...Array.from(new Set(rawData.map(d => String(d.Year)))).sort()]);
  fillSelect("#apparatusSelect", ["all", ...Array.from(new Set(rawData.map(d => d.Apparatus))).sort()]);
  fillSelect("#nationSelect", ["all", ...Array.from(new Set(rawData.map(d => d.Nation))).sort()]);
  fillSelect("#qualifiedSelect", ["all", ...Array.from(new Set(rawData.map(d => d.Qualified))).sort()]);
  fillSelect("#athleteSelect", ["all", ...Array.from(new Set(rawData.map(d => d.Athlete))).sort()]);

  window.d3.select("#yearSelect").on("change", e => { state.year = e.target.value; onChange({ selectionOnly: false }); });
  window.d3.select("#apparatusSelect").on("change", e => { state.apparatus = e.target.value; onChange({ selectionOnly: false }); });
  window.d3.select("#nationSelect").on("change", e => { state.nation = e.target.value; onChange({ selectionOnly: false }); });
  window.d3.select("#qualifiedSelect").on("change", e => { state.qualified = e.target.value; onChange({ selectionOnly: false }); });

  window.d3.select("#athleteSelect").on("change", e => {
    const v = e.target.value;
    state.selected = (v === "all") ? null : { Athlete: v };
    onChange({ selectionOnly: true });
  });

  window.d3.select("#clearSelection").on("click", () => onReset());
}

export function updateAthleteOptions(filteredData) {
  const opts = ["all", ...Array.from(new Set(filteredData.map(d => d.Athlete))).sort()];
  const sel = window.d3.select("#athleteSelect");
  if (sel.empty()) return;

  const current = state.selected?.Athlete ?? "all";

  sel.selectAll("option")
    .data(opts, d => d)
    .join(
      enter => enter.append("option").attr("value", d => d).text(d => d),
      upd => upd.attr("value", d => d).text(d => d),
      exit => exit.remove()
    );

  if (!opts.includes(current)) {
    state.selected = null;
    sel.property("value", "all");
  } else {
    sel.property("value", current);
  }
}

export function setSelectValuesFromState() {
  window.d3.select("#yearSelect").property("value", state.year);
  window.d3.select("#apparatusSelect").property("value", state.apparatus);
  window.d3.select("#nationSelect").property("value", state.nation);
  window.d3.select("#qualifiedSelect").property("value", state.qualified);
  window.d3.select("#athleteSelect").property("value", state.selected?.Athlete ?? "all");
}
