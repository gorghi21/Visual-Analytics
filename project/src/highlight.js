// src/highlight.js
import { state } from "./state.js";

export function setHighlightedCompetition(compOrNull) {
  state.highlighted = compOrNull ? { Competition: compOrNull } : null;
  const hc = state.highlighted?.Competition;

  window.d3.select("#timeline").selectAll(".compLine")
    .attr("opacity", d => !hc || d.comp === hc ? 1 : 0.2);

  window.d3.select("#timeline").selectAll(".eventPoint")
    .attr("opacity", d => !hc || d.comp === hc ? 1 : 0.2);

  window.d3.select("#timeline").selectAll(".eventLabel")
    .attr("opacity", d => !hc || d.comp === hc ? 1 : 0.15);
}
