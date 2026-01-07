// src/tooltip.js
const tooltip = window.d3.select("#tooltip");

export function showTooltip(html, evt) {
  tooltip.html(html).style("display", "block");
  moveTooltip(evt);
}

export function moveTooltip(evt) {
  const pad = 14;
  const x = Math.min(window.innerWidth - 20, evt.clientX + pad);
  const y = Math.min(window.innerHeight - 20, evt.clientY + pad);
  tooltip.style("left", x + "px").style("top", y + "px");
}

export function hideTooltip() {
  tooltip.style("display", "none");
}

export function fmt(x, digits = 3) {
  return Number.isFinite(x) ? x.toFixed(digits) : "-";
}
