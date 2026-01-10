// src/charts/heatmap.js
import { showTooltip, moveTooltip, hideTooltip, fmt } from "../tooltip.js";

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
  const raw = row?.EventDate;
  if (raw) {
    const s = String(raw).trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const name = (row?.Event ?? "").toLowerCase();
  for (const k of Object.keys(EVENT_DATE)) {
    if (name.includes(k)) return new Date(EVENT_DATE[k] + "T00:00:00");
  }

  const y = Number(row?.Year);
  return Number.isFinite(y) ? new Date(`${y}-07-01T00:00:00`) : null;
}

function shortEventLabel(s) {
  const t = String(s ?? "").toLowerCase();
  if (t.includes("liverpool")) return "LIV";
  if (t.includes("munich")) return "MUN";
  if (t.includes("antalya")) return "ANT";
  if (t.includes("antwerp")) return "ANW";
  if (t.includes("rimini")) return "RIM";
  const raw = String(s ?? "").trim();
  return raw.length > 8 ? raw.slice(0, 8) + "…" : raw;
}

/**
 * drawHeatmap(data, opts)
 * opts:
 *  - mode: "year" | "event" | "year_event" (default "year")
 *  - onPickCell:
 *      mode="year"       -> ({ year, apparatus })
 *      mode="event"      -> ({ event, apparatus })
 *      mode="year_event" -> ({ year, event, apparatus })
 */
export function drawHeatmap(data, { onPickCell, mode = "year" } = {}) {
  const d3 = window.d3;
  const svg = d3.select("#heatmap");
  svg.selectAll("*").remove();

  if (!data || data.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f").text("Heatmap: no data");
    d3.select("#hmMin").text("-");
    d3.select("#hmMax").text("-");
    return;
  }

  const { w, h } = getSvgSize(svg);

  const margin = {
    top: 40,
    right: 20,
    bottom: (mode === "event" || mode === "year_event") ? 70 : 40,
    left: 50
  };

  const apps = Array.from(new Set(data.map(d => d.Apparatus))).sort();
  if (apps.length === 0) return;

  // ===== X KEYS =====
  let xKeys = [];

  if (mode === "event") {
    xKeys = Array.from(new Set(data.map(d => d.Event))).filter(Boolean).sort();
  } else if (mode === "year_event") {
    // key: `${Year}|${Event}` (manteniamo anche sample per ordinamento per data)
    const seen = new Map(); // key -> sample row
    for (const row of data) {
      const y = row?.Year;
      const e = row?.Event;
      if (y == null || !e) continue;
      const key = `${y}|${e}`;
      if (!seen.has(key)) seen.set(key, row);
    }

    const arr = Array.from(seen.entries()).map(([key, sample]) => {
      const [yy, ev] = key.split("|");
      const date = parseEventDate(sample);
      return {
        key,
        year: Number(yy),
        event: ev,
        date: date && !Number.isNaN(date.getTime()) ? date : null
      };
    });

    arr.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.date && b.date) return a.date - b.date;
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return a.event.localeCompare(b.event);
    });

    xKeys = arr.map(d => d.key);
  } else {
    xKeys = Array.from(new Set(data.map(d => d.Year))).sort((a, b) => a - b);
  }

  if (xKeys.length === 0) return;

  // ===== AGGREGATION: Apparatus × XKey =====
  const map = new Map();

  if (mode === "event") {
    for (const [app, byEvent] of d3.rollups(
      data,
      v => d3.mean(v, d => d.FinalScore),
      d => d.Apparatus,
      d => d.Event
    )) {
      for (const [ev, avg] of byEvent) map.set(`${app}|${ev}`, avg);
    }
  } else if (mode === "year_event") {
    // group by app, then by (year|event)
    for (const [app, byKey] of d3.rollups(
      data,
      v => d3.mean(v, d => d.FinalScore),
      d => d.Apparatus,
      d => `${d.Year}|${d.Event}`
    )) {
      for (const [key, avg] of byKey) map.set(`${app}|${key}`, avg);
    }
  } else {
    for (const [app, byYear] of d3.rollups(
      data,
      v => d3.mean(v, d => d.FinalScore),
      d => d.Apparatus,
      d => d.Year
    )) {
      for (const [yr, avg] of byYear) map.set(`${app}|${yr}`, avg);
    }
  }

  const cells = [];
  for (const app of apps) {
    for (const key of xKeys) {
      const avg = map.get(`${app}|${key}`);
      cells.push({ app, key, avg: Number.isFinite(avg) ? avg : null });
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

  d3.select("#hmMin").text(fmt(extent[0]));
  d3.select("#hmMax").text(fmt(extent[1]));

  const x = d3.scaleBand()
    .domain(xKeys)
    .range([margin.left, w - margin.right])
    .padding(0.08);

  const y = d3.scaleBand()
    .domain(apps)
    .range([margin.top, h - margin.bottom])
    .padding(0.08);

  // ===== AXES =====
  const xAxis = d3.axisBottom(x);

  if (mode === "year") {
    xAxis.tickFormat(d3.format("d"));
  } else if (mode === "event") {
    xAxis.tickFormat(shortEventLabel);
  } else {
    // year_event: mostra "YY-XXX" (es: 2024-RIM)
    xAxis.tickFormat(k => {
      const [yy, ev] = String(k).split("|");
      return `${yy}-${shortEventLabel(ev)}`;
    });
  }

  const gx = svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(xAxis);

  gx.selectAll(".tick text")
    .attr("fill", "#6f6f6f")
    .attr("font-size", 10)
    .attr("text-anchor", (mode === "event" || mode === "year_event") ? "end" : "middle")
    .attr("transform", (mode === "event" || mode === "year_event") ? "rotate(-25)" : null);

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll(".domain").attr("stroke", "#cfc7bb");
  svg.selectAll(".tick line").attr("stroke", "#e6dfd5");
  svg.selectAll(".tick text").attr("fill", "#6f6f6f");

  // ===== CELLS =====
  svg.append("g")
    .selectAll("rect")
    .data(cells, d => `${d.app}|${d.key}`)
    .enter()
    .append("rect")
    .attr("x", d => x(d.key))
    .attr("y", d => y(d.app))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 6)
    .attr("fill", d => (d.avg === null ? "#f3eee6" : col(d.avg)))
    .attr("stroke", "#d9d2c7")
    .on("mouseover", function (evt, d) {
      d3.select(this).attr("stroke", "black").attr("stroke-width", 1.1);

      let keyLines = "";
      if (mode === "year") {
        keyLines = `<div class="t-row"><span class="t-key">Year</span><span class="t-val">${d.key}</span></div>`;
      } else if (mode === "event") {
        keyLines = `<div class="t-row"><span class="t-key">Event</span><span class="t-val">${d.key}</span></div>`;
      } else {
        const [yy, ev] = String(d.key).split("|");
        keyLines = `
          <div class="t-row"><span class="t-key">Year</span><span class="t-val">${yy}</span></div>
          <div class="t-row"><span class="t-key">Event</span><span class="t-val">${ev}</span></div>
        `;
      }

      showTooltip(`
        <div class="t-title">Heatmap cell</div>
        ${keyLines}
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
      if (typeof onPickCell !== "function") return;

      if (mode === "year") {
        onPickCell({ year: String(d.key), apparatus: d.app });
        return;
      }
      if (mode === "event") {
        onPickCell({ event: d.key, apparatus: d.app });
        return;
      }
      const [yy, ev] = String(d.key).split("|");
      onPickCell({ year: String(yy), event: ev, apparatus: d.app });
    });
}
