// src/charts/pca.js
import { state } from "../state.js";
import { showTooltip, moveTooltip, hideTooltip, fmt } from "../tooltip.js";

function getSvgSize(svgSel, fallbackW = 700, fallbackH = 420) {
  const node = svgSel.node();
  const attrW = +svgSel.attr("width") || fallbackW;
  const attrH = +svgSel.attr("height") || fallbackH;
  if (!node) return { w: attrW, h: attrH };

  const r = node.getBoundingClientRect();
  const w = (r.width && r.width > 50) ? Math.floor(r.width) : attrW;
  const h = (r.height && r.height > 50) ? Math.floor(r.height) : attrH;

  svgSel.attr("width", w).attr("height", h);
  svgSel.attr("viewBox", `0 0 ${w} ${h}`);
  return { w, h };
}

export function drawPCA(points, { onSelectAthlete, onBrushChange }) {
  const d3 = window.d3;

  const svg = d3.select("#pca");
  svg.selectAll("*").remove();

  if (!points || points.length < 2) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f")
      .text("PCA: not enough data (need >= 2 rows after global filters)");
    return;
  }

  const { w, h } = getSvgSize(svg);

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const r = 4;
  const rHover = 6;

  const x = d3.scaleLinear()
    .domain(d3.extent(points, d => d.pc1)).nice()
    .range([margin.left + rHover, w - margin.right - rHover]);

  const y = d3.scaleLinear()
    .domain(d3.extent(points, d => d.pc2)).nice()
    .range([h - margin.bottom - rHover, margin.top + rHover]);

  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  svg.append("text").attr("x", w / 2).attr("y", h - 5).attr("text-anchor", "middle").text("PC1");
  svg.append("text").attr("transform", "rotate(-90)").attr("x", -h / 2).attr("y", 15)
    .attr("text-anchor", "middle").text("PC2");

  const pad = rHover + 1;
  svg.append("defs").append("clipPath")
    .attr("id", "clipPCA")
    .append("rect")
    .attr("x", margin.left - pad)
    .attr("y", margin.top - pad)
    .attr("width", (w - margin.left - margin.right) + 2 * pad)
    .attr("height", (h - margin.top - margin.bottom) + 2 * pad);

  const g = svg.append("g").attr("clip-path", "url(#clipPCA)");

  g.selectAll("circle")
    .data(points, d => d.__id)
    .enter()
    .append("circle")
    .attr("class", "pcaPoint")
    .attr("cx", d => x(d.pc1))
    .attr("cy", d => y(d.pc2))
    .attr("r", r)
    .attr("fill", "#888")
    .attr("opacity", 0.85)
    .on("mouseover", function(evt, d) {
      d3.select(this).attr("stroke", "black").attr("stroke-width", 1.2).attr("r", rHover);
      showTooltip(`
        <div class="t-title">${d.Athlete}</div>
        <div class="t-row"><span class="t-key">Year</span><span class="t-val">${d.Year}</span></div>
        <div class="t-row"><span class="t-key">Apparatus</span><span class="t-val">${d.Apparatus}</span></div>
        <div class="t-row"><span class="t-key">Final</span><span class="t-val">${fmt(d.FinalScore)}</span></div>
        <div class="t-row"><span class="t-key">PC1</span><span class="t-val">${fmt(d.pc1)}</span></div>
        <div class="t-row"><span class="t-key">PC2</span><span class="t-val">${fmt(d.pc2)}</span></div>
      `, evt);
    })
    .on("mousemove", evt => moveTooltip(evt))
    .on("mouseout", function() {
      d3.select(this).attr("stroke", null).attr("stroke-width", null).attr("r", r);
      hideTooltip();
    })
    .on("click", function(_, d) { onSelectAthlete(d.Athlete); });

  const brush = d3.brush()
    .extent([[margin.left, margin.top], [w - margin.right, h - margin.bottom]])
    .on("brush end", ({ selection }) => {
      if (!selection) return onBrushChange(null);

      const [[x0, y0], [x1, y1]] = selection;
      const ids = new Set();
      for (const p of points) {
        const px = x(p.pc1);
        const py = y(p.pc2);
        if (x0 <= px && px <= x1 && y0 <= py && py <= y1) ids.add(p.__id);
      }
      onBrushChange(ids.size > 0 ? ids : new Set());
    });

  svg.append("g").attr("class", "brush").call(brush);

  applyPCABrushStyles();
  applyPCASelectionStyles();
}

export function applyPCABrushStyles() {
  const ids = state.brushedIds;
  window.d3.select("#pca").selectAll(".pcaPoint")
    .attr("opacity", d => {
      if (!ids) return 0.85;
      return ids.has(d.__id) ? 0.95 : 0.15;
    });
}

export function applyPCASelectionStyles() {
  const sel = state.selected?.Athlete;
  window.d3.select("#pca").selectAll(".pcaPoint")
    .attr("stroke", d => sel && d.Athlete === sel ? "black" : null)
    .attr("stroke-width", d => sel && d.Athlete === sel ? 2 : null);
}
