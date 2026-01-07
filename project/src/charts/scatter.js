// src/charts/scatter.js
import { state } from "../state.js";
import { showTooltip, moveTooltip, hideTooltip, fmt } from "../tooltip.js";
import { setHighlightedCompetition } from "../highlight.js";

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

export function drawScatter(data, { onSelectAthlete }) {
  const d3 = window.d3;

  const svg = d3.select("#scatter");
  svg.selectAll("*").remove();

  if (!data || data.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f").text("Scatter: no data");
    return;
  }

  const { w, h } = getSvgSize(svg);

  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const r = 4;
  const rHover = 6;

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.Dscore)).nice()
    .range([margin.left + rHover, w - margin.right - rHover]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d.Escore)).nice()
    .range([h - margin.bottom - rHover, margin.top + rHover]);

  const color = d3.scaleOrdinal()
    .domain(["Y", "N", "R"])
    .range(["#2ca02c", "#d62728", "#1f77b4"]);

  svg.append("defs").append("clipPath")
    .attr("id", "clipScatter")
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", w - margin.left - margin.right)
    .attr("height", h - margin.top - margin.bottom);

  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(-(w - margin.left - margin.right)).tickFormat(""))
    .call(g => g.selectAll("line").attr("stroke", "#eee7dd"))
    .call(g => g.select(".domain").remove());

  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  svg.append("text")
    .attr("x", w / 2)
    .attr("y", h - 5)
    .attr("text-anchor", "middle")
    .text("D-score");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .text("E-score");

  const gPoints = svg.append("g").attr("clip-path", "url(#clipScatter)");

  gPoints.selectAll("circle")
    .data(data, d => d.__id ?? `${d.Athlete}|${d.EventDate}|${d.Apparatus}|${d.Competition}|${d.FinalScore}`)
    .enter()
    .append("circle")
    .attr("class", "scatterPoint")
    .attr("cx", d => x(d.Dscore))
    .attr("cy", d => y(d.Escore))
    .attr("r", r)
    .attr("fill", d => color(d.Qualified))
    .attr("opacity", 0.85)
    .attr("stroke", d => (state.selected?.Athlete && d.Athlete === state.selected.Athlete) ? "black" : null)
    .attr("stroke-width", d => (state.selected?.Athlete && d.Athlete === state.selected.Athlete) ? 2 : null)
    .on("mouseover", function (evt, d) {
      setHighlightedCompetition(d.Competition);
      d3.select(this).attr("stroke", "black").attr("stroke-width", 1.5).attr("r", rHover);

      showTooltip(`
        <div class="t-title">${d.Athlete}</div>
        <div class="t-row"><span class="t-key">Nation</span><span class="t-val">${d.Nation}</span></div>
        <div class="t-row"><span class="t-key">Year</span><span class="t-val">${d.Year}</span></div>
        <div class="t-row"><span class="t-key">Competition</span><span class="t-val">${d.Competition}</span></div>
        <div class="t-row"><span class="t-key">Event</span><span class="t-val">${d.Event}</span></div>
        <div class="t-row"><span class="t-key">Apparatus</span><span class="t-val">${d.Apparatus}</span></div>
        <div class="t-row"><span class="t-key">Qualified</span><span class="t-val">${d.Qualified}</span></div>
        <hr style="border:none;border-top:1px solid #eee7dd;margin:8px 0;">
        <div class="t-row"><span class="t-key">D</span><span class="t-val">${fmt(d.Dscore)}</span></div>
        <div class="t-row"><span class="t-key">E</span><span class="t-val">${fmt(d.Escore)}</span></div>
        <div class="t-row"><span class="t-key">Pen</span><span class="t-val">${fmt(d.Penalties)}</span></div>
        <div class="t-row"><span class="t-key">Final</span><span class="t-val">${fmt(d.FinalScore)}</span></div>
        <div class="t-row"><span class="t-key">Rank</span><span class="t-val">${Number.isFinite(d.Rank) ? d.Rank : "-"}</span></div>
      `, evt);
    })
    .on("mousemove", evt => moveTooltip(evt))
    .on("mouseout", function () {
      setHighlightedCompetition(null);
      d3.select(this).attr("stroke", null).attr("stroke-width", null).attr("r", r);
      hideTooltip();
    })
    .on("click", function (_, d) {
      onSelectAthlete(d.Athlete);
    });
}
