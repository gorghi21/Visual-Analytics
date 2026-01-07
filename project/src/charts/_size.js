// src/charts/_size.js
export function getSvgSize(svgSel, fallbackW = 700, fallbackH = 420) {
  const node = svgSel.node();
  if (!node) return { w: fallbackW, h: fallbackH };

  const r = node.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width  || fallbackW));
  const h = Math.max(1, Math.floor(r.height || fallbackH));

  // sincronizza gli attributi (d3 usa questi)
  svgSel.attr("width", w).attr("height", h);
  return { w, h };
}
