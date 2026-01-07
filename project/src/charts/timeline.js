// src/charts/timeline.js
import { state } from "../state.js";
import { showTooltip, moveTooltip, hideTooltip, fmt } from "../tooltip.js";
import { setHighlightedCompetition } from "../highlight.js";

function getSvgSize(svgSel, fallbackW = 700, fallbackH = 420) {
  const node = svgSel.node();
  if (!node) return { w: fallbackW, h: fallbackH };

  const r = node.getBoundingClientRect();
  const w = Math.max(1, Math.floor(r.width || fallbackW));
  const h = Math.max(1, Math.floor(r.height || fallbackH));

  svgSel.attr("width", w).attr("height", h);
  return { w, h };
}

// Robust parse for EventDate values like "05/11/2022" (dd/mm/yyyy) or ISO.
function parseEventDateValue(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;

  // ISO or something JS can parse reliably
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return Number.isFinite(+d) ? d : null;
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
    const d = new Date(yy, mm - 1, dd);
    return Number.isFinite(+d) ? d : null;
  }

  const d = new Date(s);
  return Number.isFinite(+d) ? d : null;
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

  // base filter
  let base = (data || []).filter(d => Number.isFinite(d.Year) && Number.isFinite(d.FinalScore));
  if (state.selected?.Athlete) base = base.filter(d => d.Athlete === state.selected.Athlete);

  // require valid EventDate
  base = base.filter(d => parseEventDateValue(d.EventDate));

  if (base.length === 0) {
    svg.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", "#6f6f6f")
      .text("Timeline: no data (missing/invalid EventDate)");
    return;
  }

  const { w, h } = getSvgSize(svg);

  const margin = { top: 30, right: 170, bottom: 45, left: 60 };
  const r = 5;
  const rHover = 7;

  // aggregate by (Competition, Event) and use mean/min/max + date
  const rolled = d3.rollups(
    base,
    v => {
      const date = parseEventDateValue(v[0].EventDate);
      return {
        mean: d3.mean(v, d => d.FinalScore),
        min: d3.min(v, d => d.FinalScore),
        max: d3.max(v, d => d.FinalScore),
        n: v.length,
        date,
        event: v[0].Event,
        comp: v[0].Competition
      };
    },
    d => d.Competition,
    d => d.Event
  );

  const points = [];
  for (const [comp, byEvent] of rolled) {
    for (const [event, agg] of byEvent) {
      if (!agg.date || !Number.isFinite(+agg.date)) continue;
      points.push({
        comp,
        event,
        date: agg.date,
        mean: agg.mean,
        min: agg.min,
        max: agg.max,
        n: agg.n
      });
    }
  }

  points.sort((a, b) => a.date - b.date);

  if (points.length === 0) {
    svg.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", "#6f6f6f")
      .text("Timeline: no points after aggregation");
    return;
  }

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

  // axes
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

  // style axes
  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  // title
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

  // padded clip (avoid cutting hover)
  const pad = rHover + 1;
  svg.append("defs").append("clipPath")
    .attr("id", "clipTimeline")
    .append("rect")
    .attr("x", margin.left - pad)
    .attr("y", margin.top - pad)
    .attr("width", (w - margin.left - margin.right) + 2 * pad)
    .attr("height", (h - margin.top - margin.bottom) + 2 * pad);

  const gPlot = svg.append("g").attr("clip-path", "url(#clipTimeline)");

  // bands
  gPlot.selectAll(".band")
    .data(byComp, d => d[0])
    .enter()
    .append("path")
    .attr("class", "band")
    .attr("fill", d => color(d[0]))
    .attr("opacity", 0.12)
    .attr("d", d => area(d[1]));

  // lines
  gPlot.selectAll(".compLine")
    .data(byComp.map(([comp, arr]) => ({ comp, arr })), d => d.comp)
    .enter()
    .append("path")
    .attr("class", "compLine")
    .attr("fill", "none")
    .attr("stroke", d => color(d.comp))
    .attr("stroke-width", 2.2)
    .attr("d", d => line(d.arr));

  // points
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
    .on("mouseover", function (evt, d) {
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
    .on("mouseout", function () {
      setHighlightedCompetition(null);
      d3.select(this).attr("r", r).attr("stroke", "#ffffff").attr("stroke-width", 1.2);
      hideTooltip();
    });

  // labels (not clipped)
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

  // minimal collision avoidance
  const placed = [];
  labels.each(function (d) {
    const el = d3.select(this);
    const x0 = x(d.date) + 8;
    let y0 = y(d.mean) + 4;
    for (const p of placed) {
      const dx = Math.abs(x0 - p.x);
      const dy = Math.abs(y0 - p.y);
      if (dx < 40 && dy < 12) y0 += 12;
    }
    el.attr("y", y0);
    placed.push({ x: x0, y: y0 });
  });

  // legend
  const legend = svg.append("g")
    .attr("transform", `translate(${w - margin.right + 10},${margin.top})`);

  const legendItems = ["world championships", "european championships"];
  legend.selectAll("g")
    .data(legendItems)
    .enter()
    .append("g")
    .attr("transform", (_, i) => `translate(0,${i * 18})`)
    .each(function (comp) {
      const g = d3.select(this);
      g.append("rect").attr("width", 10).attr("height", 10).attr("fill", color(comp));
      g.append("text").attr("x", 14).attr("y", 10).text(comp).attr("font-size", 11).attr("fill", "#6f6f6f");
    });

  legend.append("text")
    .attr("x", 0)
    .attr("y", 52)
    .attr("font-size", 10)
    .attr("fill", "#6f6f6f")
    .text("Band = min–max • Line = mean");

  // apply current highlight if any
  setHighlightedCompetition(state.highlighted?.Competition ?? null);
}
