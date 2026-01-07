// src/charts/heatmap.js
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

export function drawHeatmap(data, { onPickCell } = {}) {
  const d3 = window.d3;
  const svg = d3.select("#heatmap");
  svg.selectAll("*").remove();

  if (!data || data.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f").text("Heatmap: no data");
    // aggiorna legenda barra se esiste
    d3.select("#hmMin").text("-");
    d3.select("#hmMax").text("-");
    return;
  }

  const { w, h } = getSvgSize(svg);
  const margin = { top: 40, right: 20, bottom: 40, left: 50 };

  const years = Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b);
  const apps = Array.from(new Set(data.map(d => d.Apparatus))).sort();
  if (years.length === 0 || apps.length === 0) return;

  const map = new Map();
  for (const [app, byYear] of d3.rollups(
    data,
    v => d3.mean(v, d => d.FinalScore),
    d => d.Apparatus,
    d => d.Year
  )) {
    for (const [year, avg] of byYear) map.set(`${app}|${year}`, avg);
  }

  const cells = [];
  for (const app of apps) {
    for (const year of years) {
      const avg = map.get(`${app}|${year}`);
      cells.push({ app, year, avg: Number.isFinite(avg) ? avg : null });
    }
  }

  const vals = cells.filter(d => d.avg !== null).map(d => d.avg);
  if (vals.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f").text("Heatmap: no numeric FinalScore");
    d3.select("#hmMin").text("-");
    d3.select("#hmMax").text("-");
    return;
  }

  const extent = d3.extent(vals);
  const col = d3.scaleSequential(d3.interpolateYlGnBu).domain(extent);

  // legenda in barra (HTML)
  d3.select("#hmMin").text(fmt(extent[0]));
  d3.select("#hmMax").text(fmt(extent[1]));

  const x = d3.scaleBand()
    .domain(years)
    .range([margin.left, w - margin.right])
    .padding(0.08);

  const y = d3.scaleBand()
    .domain(apps)
    .range([margin.top, h - margin.bottom])
    .padding(0.08);

  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  svg.append("g")
    .selectAll("rect")
    .data(cells, d => `${d.app}|${d.year}`)
    .enter()
    .append("rect")
    .attr("x", d => x(d.year))
    .attr("y", d => y(d.app))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 6)
    .attr("fill", d => (d.avg === null ? "#f3eee6" : col(d.avg)))
    .attr("stroke", "#d9d2c7")
    .on("mouseover", function (evt, d) {
      d3.select(this).attr("stroke", "black").attr("stroke-width", 1.1);
      showTooltip(`
        <div class="t-title">Heatmap cell</div>
        <div class="t-row"><span class="t-key">Year</span><span class="t-val">${d.year}</span></div>
        <div class="t-row"><span class="t-key">Apparatus</span><span class="t-val">${d.app}</span></div>
        <div class="t-row"><span class="t-key">Avg Final</span><span class="t-val">${d.avg === null ? "-" : fmt(d.avg)}</span></div>
      `, evt);
    })
    .on("mousemove", evt => moveTooltip(evt))
    .on("mouseout", function () {
      d3.select(this).attr("stroke", "#d9d2c7").attr("stroke-width", 1);
      hideTooltip();
    })
    .on("click", function (_, d) {
      if (typeof onPickCell === "function") onPickCell({ year: String(d.year), apparatus: d.app });
    });
}
