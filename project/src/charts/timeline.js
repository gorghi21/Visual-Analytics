// src/charts/timeline.js
import { state } from "../state.js";
import { showTooltip, moveTooltip, hideTooltip, fmt } from "../tooltip.js";
import { setHighlightedCompetition } from "../highlight.js";

const EVENT_DATE = {
  "liverpool": "2022-11-05",
  "munich":   "2022-08-18",
  "antalya":  "2023-04-11",
  "antwerp":  "2023-09-30",
  "rimini":   "2024-04-24"
};

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

function parseEventDate(row) {
  // Preferisci EventDate del dataset (DD/MM/YYYY o YYYY-MM-DD). Fallback su mappa.
  const raw = row?.EventDate;
  if (raw) {
    const s = String(raw).trim();
    // DD/MM/YYYY
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    // YYYY-MM-DD
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const name = (row?.Event ?? "").toLowerCase();
  for (const k of Object.keys(EVENT_DATE)) {
    if (name.includes(k)) return new Date(EVENT_DATE[k] + "T00:00:00");
  }
  // fallback: 1 luglio dell'anno
  const y = Number(row?.Year);
  return Number.isFinite(y) ? new Date(`${y}-07-01T00:00:00`) : null;
}

function shortEvent(s) {
  const t = (s ?? "").toLowerCase();
  if (t.includes("liverpool")) return "LIV";
  if (t.includes("munich")) return "MUN";
  if (t.includes("antalya")) return "ANT";
  if (t.includes("antwerp")) return "ANW";
  if (t.includes("rimini")) return "RIM";
  return (s ?? "").slice(0, 3).toUpperCase();
}

export function drawTimeline(data) {
  const d3 = window.d3;

  const svg = d3.select("#timeline");
  svg.selectAll("*").remove();

  const base = (data || []).filter(d => Number.isFinite(d.Year) && Number.isFinite(d.FinalScore));
  if (base.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f").text("Timeline: no data");
    return;
  }

  const { w, h } = getSvgSize(svg);

  const margin = { top: 30, right: 170, bottom: 45, left: 60 };
  const r = 5;
  const rHover = 7;

  // aggrega per (Competition, Event)
  const rolled = d3.rollups(
    base,
    v => ({
      mean: d3.mean(v, d => d.FinalScore),
      min: d3.min(v, d => d.FinalScore),
      max: d3.max(v, d => d.FinalScore),
      n: v.length,
      sample: v[0]
    }),
    d => d.Competition,
    d => d.Event
  );

  const points = [];
  for (const [comp, byEvent] of rolled) {
    for (const [event, agg] of byEvent) {
      const date = parseEventDate(agg.sample);
      if (!date || Number.isNaN(date.getTime())) continue;
      points.push({
        comp,
        event,
        date,
        mean: agg.mean,
        min: agg.min,
        max: agg.max,
        n: agg.n
      });
    }
  }

  if (points.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f")
      .text("Timeline: no data (missing/invalid EventDate)");
    return;
  }

  points.sort((a, b) => a.date - b.date);

  const x = d3.scaleTime()
    .domain(d3.extent(points, d => d.date))
    .range([margin.left + rHover, w - margin.right - rHover]);

  const y = d3.scaleLinear()
    .domain([d3.min(points, d => d.min), d3.max(points, d => d.max)])
    .nice()
    .range([h - margin.bottom - rHover, margin.top + rHover]);

  const color = d3.scaleOrdinal()
    .domain(["world championships", "european championships"])
    .range(["#1f77b4", "#ff7f0e"]);

  // assi
  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.timeFormat("%Y")));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  // grid y
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickSize(-(w - margin.left - margin.right)).tickFormat(""))
    .call(g => g.selectAll("line").attr("stroke", "#eee7dd"))
    .call(g => g.select(".domain").remove());

  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  const title = state.selected?.Athlete
    ? `FinalScore trend (mean + range) – ${state.selected.Athlete}`
    : "FinalScore trend (mean + range) – global view (filtered)";

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 18)
    .attr("font-weight", "600")
    .text(title);

  const byComp = d3.groups(points, d => d.comp);

  const area = d3.area()
    .x(d => x(d.date))
    .y0(d => y(d.min))
    .y1(d => y(d.max))
    .curve(d3.curveMonotoneX);

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.mean))
    .curve(d3.curveMonotoneX);

  const pad = rHover + 1;
  svg.append("defs").append("clipPath")
    .attr("id", "clipTimeline")
    .append("rect")
    .attr("x", margin.left - pad)
    .attr("y", margin.top - pad)
    .attr("width", (w - margin.left - margin.right) + 2 * pad)
    .attr("height", (h - margin.top - margin.bottom) + 2 * pad);

  const gPlot = svg.append("g").attr("clip-path", "url(#clipTimeline)");

  gPlot.selectAll(".band")
    .data(byComp, d => d[0])
    .enter()
    .append("path")
    .attr("class", "band")
    .attr("fill", d => color(d[0]))
    .attr("opacity", 0.12)
    .attr("d", d => area(d[1]));

  gPlot.selectAll(".compLine")
    .data(byComp.map(([comp, arr]) => ({ comp, arr })), d => d.comp)
    .enter()
    .append("path")
    .attr("class", "compLine")
    .attr("fill", "none")
    .attr("stroke", d => color(d.comp))
    .attr("stroke-width", 2.2)
    .attr("d", d => line(d.arr));

  const pts = gPlot.append("g");

  pts.selectAll("circle")
    .data(points, d => `${d.comp}|${d.event}`)
    .enter()
    .append("circle")
    .attr("class", "eventPoint")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.mean))
    .attr("r", r)
    .attr("fill", d => color(d.comp))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.2)
    .on("mouseover", function(evt, d) {
      setHighlightedCompetition(d.comp);
      d3.select(this).attr("r", rHover).attr("stroke", "black").attr("stroke-width", 1.2);

      showTooltip(`
        <div class="t-title">${d.event}</div>
        <div class="t-row"><span class="t-key">Competition</span><span class="t-val">${d.comp}</span></div>
        <div class="t-row"><span class="t-key">Date</span><span class="t-val">${d3.timeFormat("%Y-%m-%d")(d.date)}</span></div>
        <div class="t-row"><span class="t-key">Mean Final</span><span class="t-val">${fmt(d.mean)}</span></div>
        <div class="t-row"><span class="t-key">Min–Max</span><span class="t-val">${fmt(d.min)} – ${fmt(d.max)}</span></div>
        <div class="t-row"><span class="t-key">Rows</span><span class="t-val">${d.n}</span></div>
      `, evt);
    })
    .on("mousemove", evt => moveTooltip(evt))
    .on("mouseout", function() {
      setHighlightedCompetition(null);
      d3.select(this).attr("r", r).attr("stroke", "#ffffff").attr("stroke-width", 1.2);
      hideTooltip();
    });

  // labels NOT clipped
  const labelLayer = svg.append("g");

  const labels = labelLayer.selectAll("text.eventLabel")
    .data(points, d => `${d.comp}|${d.event}`)
    .enter()
    .append("text")
    .attr("class", "eventLabel")
    .attr("x", d => x(d.date) + 8)
    .attr("y", d => y(d.mean) + 4)
    .attr("font-size", 10)
    .attr("fill", "#6f6f6f")
    .text(d => shortEvent(d.event));

  // collision avoid minimale
  const placed = [];
  labels.each(function(d) {
    const el = d3.select(this);
    const x0 = x(d.date) + 8;
    let y0 = y(d.mean) + 4;
    for (const p of placed) {
      if (Math.abs(x0 - p.x) < 40 && Math.abs(y0 - p.y) < 12) y0 += 12;
    }
    el.attr("y", y0);
    placed.push({ x: x0, y: y0 });
  });

  // update legenda HTML (niente SVG)
  d3.select("#tlLegendLine").text("Line = mean");
  d3.select("#tlLegendBand").text("Band = min–max");

  setHighlightedCompetition(state.highlighted?.Competition ?? null);
}
