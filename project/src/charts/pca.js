// src/charts/pca.js
import { state } from "../state.js";
import { showTooltip, moveTooltip, hideTooltip, fmt } from "../tooltip.js";

function getSvgSize(svgSel, fallbackW = 700, fallbackH = 420) {
  const node = svgSel.node();
  if (!node) return { w: fallbackW, h: fallbackH };

  const r = node.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width || fallbackW));
  const h = Math.max(1, Math.floor(r.height || fallbackH));

  svgSel.attr("width", w).attr("height", h);
  return { w, h };
}

// NOTE: assumes each row has PC1, PC2 numeric.
// If your columns are named differently, adapt here.
export function drawPCA(data, { onBrush, onSelectAthlete } = {}) {
  const d3 = window.d3;
  const svg = d3.select("#pca");

  svg.selectAll("*").remove();

  const base = (data || []).filter(d => Number.isFinite(d.PC1) && Number.isFinite(d.PC2));
  if (base.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f").text("PCA: no data (missing PC1/PC2)");
    return;
  }

  const { w, h } = getSvgSize(svg);

  const margin = { top: 25, right: 20, bottom: 40, left: 55 };
  const r = 3;
  const rHover = 6;

  const x = d3.scaleLinear()
    .domain(d3.extent(base, d => d.PC1)).nice()
    .range([margin.left + rHover, w - margin.right - rHover]);

  const y = d3.scaleLinear()
    .domain(d3.extent(base, d => d.PC2)).nice()
    .range([h - margin.bottom - rHover, margin.top + rHover]);

  // clip
  svg.append("defs").append("clipPath")
    .attr("id", "clipPCA")
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", w - margin.left - margin.right)
    .attr("height", h - margin.top - margin.bottom);

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // style axes
  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  // labels
  svg.append("text")
    .attr("x", w / 2)
    .attr("y", h - 5)
    .attr("text-anchor", "middle")
    .text("PC1");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .text("PC2");

  const g = svg.append("g").attr("clip-path", "url(#clipPCA)");

  g.selectAll("circle")
    .data(base, d => d.__id ?? `${d.Athlete}|${d.Event}|${d.Apparatus}|${d.Year}|${d.FinalScore}`)
    .enter()
    .append("circle")
    .attr("class", "pcaPoint")
    .attr("cx", d => x(d.PC1))
    .attr("cy", d => y(d.PC2))
    .attr("r", r)
    .attr("fill", "#808080")
    .attr("opacity", 0.75)
    .attr("stroke", d => (state.selected?.Athlete && d.Athlete === state.selected.Athlete) ? "black" : null)
    .attr("stroke-width", d => (state.selected?.Athlete && d.Athlete === state.selected.Athlete) ? 1.5 : null)
    .on("mouseover", function (evt, d) {
      d3.select(this).attr("r", rHover).attr("stroke", "black").attr("stroke-width", 1.2);

      showTooltip(`
        <div class="t-title">${d.Athlete}</div>
        <div class="t-row"><span class="t-key">Nation</span><span class="t-val">${d.Nation}</span></div>
        <div class="t-row"><span class="t-key">Year</span><span class="t-val">${d.Year}</span></div>
        <div class="t-row"><span class="t-key">Event</span><span class="t-val">${d.Event}</span></div>
        <div class="t-row"><span class="t-key">Apparatus</span><span class="t-val">${d.Apparatus}</span></div>
        <hr style="border:none;border-top:1px solid #eee7dd;margin:8px 0;">
        <div class="t-row"><span class="t-key">PC1</span><span class="t-val">${fmt(d.PC1)}</span></div>
        <div class="t-row"><span class="t-key">PC2</span><span class="t-val">${fmt(d.PC2)}</span></div>
      `, evt);
    })
    .on("mousemove", evt => moveTooltip(evt))
    .on("mouseout", function () {
      d3.select(this).attr("r", r).attr("stroke", null).attr("stroke-width", null);
      hideTooltip();
    })
    .on("click", function (_, d) {
      if (typeof onSelectAthlete === "function") onSelectAthlete(d.Athlete);
    });

  // brush
  const brush = d3.brush()
    .extent([[margin.left, margin.top], [w - margin.right, h - margin.bottom]])
    .on("brush end", (evt) => {
      if (typeof onBrush !== "function") return;
      const sel = evt.selection;
      if (!sel) { onBrush(null); return; }

      const [[x0, y0], [x1, y1]] = sel;
      const brushed = base.filter(d =>
        x(d.PC1) >= x0 && x(d.PC1) <= x1 &&
        y(d.PC2) >= y0 && y(d.PC2) <= y1
      );
      onBrush(brushed);
    });

  svg.append("g").attr("class", "pcaBrush").call(brush);
}
