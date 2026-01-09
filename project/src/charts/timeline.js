// src/charts/timeline.js (COMPLETO - adaptive: multi-year timeline, single-year strip/beeswarm)
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
  const raw = row?.EventDate;
  if (raw) {
    const s = String(raw).trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); // DD/MM/YYYY
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    const d = new Date(s); // YYYY-MM-DD
    if (!Number.isNaN(d.getTime())) return d;
  }

  const name = (row?.Event ?? "").toLowerCase();
  for (const k of Object.keys(EVENT_DATE)) {
    if (name.includes(k)) return new Date(EVENT_DATE[k] + "T00:00:00");
  }

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

function compColor(comp) {
  const c = (comp ?? "").toLowerCase();
  if (c.includes("world")) return "#1f77b4";
  if (c.includes("europe")) return "#ff7f0e";
  return "#888";
}

function aggregateByCompEvent(base) {
  const d3 = window.d3;

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

  const rows = [];
  for (const [comp, byEvent] of rolled) {
    for (const [event, agg] of byEvent) {
      const date = parseEventDate(agg.sample);
      if (!date || Number.isNaN(date.getTime())) continue;
      rows.push({
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
  rows.sort((a, b) => a.date - b.date);
  return rows;
}

function drawMultiYearTimeline(svg, base, rows, w, h) {
  const d3 = window.d3;

  const margin = { top: 12, right: 30, bottom: 45, left: 60 };
  const r = 5;
  const rHover = 7;

  const x = d3.scaleTime()
    .domain(d3.extent(rows, d => d.date))
    .range([margin.left + rHover, w - margin.right - rHover]);

  // Y veritiero (da aggregati) + padding minimo tecnico
  const yMin = d3.min(rows, d => d.min);
  const yMax = d3.max(rows, d => d.max);
  const padY = Math.max(0.02, (yMax - yMin) * 0.06);

  const y = d3.scaleLinear()
    .domain([yMin - padY, yMax + padY])
    .nice()
    .range([h - margin.bottom - rHover, margin.top + rHover]);

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

  const byComp = d3.groups(rows, d => d.comp);

  const area = d3.area()
    .x(d => x(d.date))
    .y0(d => y(d.min))
    .y1(d => y(d.max))
    .curve(d3.curveMonotoneX);

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.mean))
    .curve(d3.curveMonotoneX);

  // clip
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
    .attr("fill", d => compColor(d[0]))
    .attr("opacity", 0.12)
    .attr("d", d => area(d[1]));

  gPlot.selectAll(".compLine")
    .data(byComp.map(([comp, arr]) => ({ comp, arr })), d => d.comp)
    .enter()
    .append("path")
    .attr("class", "compLine")
    .attr("fill", "none")
    .attr("stroke", d => compColor(d.comp))
    .attr("stroke-width", 2.2)
    .attr("d", d => line(d.arr));

  const pts = gPlot.append("g");

  pts.selectAll("circle")
    .data(rows, d => `${d.comp}|${d.event}`)
    .enter()
    .append("circle")
    .attr("class", "eventPoint")
    .attr("cx", d => x(d.date))
    .attr("cy", d => y(d.mean))
    .attr("r", r)
    .attr("fill", d => compColor(d.comp))
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

  // labels brevi vicino ai punti
  const labelLayer = svg.append("g");
  const labels = labelLayer.selectAll("text.eventLabel")
    .data(rows, d => `${d.comp}|${d.event}`)
    .enter()
    .append("text")
    .attr("class", "eventLabel")
    .attr("font-size", 10)
    .attr("fill", "#6f6f6f")
    .text(d => shortEvent(d.event))
    .attr("x", d => {
      const px = x(d.date);
      const nearRight = px > (w - margin.right - 18);
      return nearRight ? (px - 8) : (px + 8);
    })
    .attr("text-anchor", d => {
      const px = x(d.date);
      const nearRight = px > (w - margin.right - 18);
      return nearRight ? "end" : "start";
    })
    .attr("y", d => y(d.mean) + 4);

  const placed = [];
  labels.each(function() {
    const el = d3.select(this);
    const x0 = +el.attr("x");
    let y0 = +el.attr("y");
    for (const p of placed) {
      if (Math.abs(x0 - p.x) < 26 && Math.abs(y0 - p.y) < 12) y0 += 12;
    }
    el.attr("y", y0);
    placed.push({ x: x0, y: y0 });
  });

  setHighlightedCompetition(state.highlighted?.Competition ?? null);
}

function drawSingleYearStrip(svg, base, year, w, h) {
  const d3 = window.d3;

  const margin = { top: 12, right: 30, bottom: 45, left: 60 };

  // eventi ordinati per data
  const eventInfo = d3.rollups(
    base,
    v => ({ date: parseEventDate(v[0]) }),
    d => d.Event
  )
  .map(([event, obj]) => ({ event, date: obj.date }))
  .filter(d => d.date && !Number.isNaN(d.date.getTime()))
  .sort((a, b) => a.date - b.date);

  if (eventInfo.length === 0) {
    svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f")
      .text("Single-year view: missing/invalid EventDate");
    return;
  }

  const events = eventInfo.map(d => d.event);

  // X evento (band)
  const x0 = d3.scaleBand()
    .domain(events)
    .range([margin.left, w - margin.right])
    .paddingInner(0.28)
    .paddingOuter(0.12);

  // per ogni evento: quali competizioni esistono davvero?
  const compsByEvent = new Map();
  for (const e of events) compsByEvent.set(e, new Set());
  for (const d of base) {
    if (compsByEvent.has(d.Event)) compsByEvent.get(d.Event).add(d.Competition);
  }
  const compsSortedByEvent = new Map();
  for (const [e, set] of compsByEvent) {
    compsSortedByEvent.set(e, Array.from(set).sort((a, b) => String(a).localeCompare(String(b))));
  }

  // Y veritiero dai punti
  const yMin = d3.min(base, d => d.FinalScore);
  const yMax = d3.max(base, d => d.FinalScore);
  const padY = Math.max(0.02, (yMax - yMin) * 0.06);

  const y = d3.scaleLinear()
    .domain([yMin - padY, yMax + padY])
    .nice()
    .range([h - margin.bottom, margin.top]);

  // assi
  svg.append("g")
    .attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x0).tickFormat(ev => shortEvent(ev)))
    .call(g => g.selectAll(".tick text").attr("font-size", 10).attr("fill", "#6f6f6f"));

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

  // posizionamento X:
  // - se 1 competizione: tutto centrato sull'evento
  // - se 2 competizioni: offset simmetrico sinistra/destra
  const delta = x0.bandwidth() * 0.18; // distanza dal centro quando separiamo 2 competizioni

  function xCenter(event) {
    const bx = x0(event);
    return (bx == null) ? null : (bx + x0.bandwidth() / 2);
  }

  function xFor(event, comp) {
    const c = xCenter(event);
    if (c == null) return null;

    const comps = compsSortedByEvent.get(event) || [];
    if (comps.length <= 1) return c; // unico -> centro

    // due o più: usa due posizioni (sinistra/destra) basate sull'ordine
    const idx = comps.indexOf(comp);
    if (idx === -1) return c;

    // per sicurezza, se >2, distribuisci su più offset piccoli
    if (comps.length === 2) {
      return c + (idx === 0 ? -delta : +delta);
    } else {
      const step = (2 * delta) / (comps.length - 1);
      return c - delta + idx * step;
    }
  }

  // stats per (Event, Competition)
  const stats = d3.rollups(
    base,
    v => ({
      mean: d3.mean(v, d => d.FinalScore),
      min: d3.min(v, d => d.FinalScore),
      max: d3.max(v, d => d.FinalScore),
      n: v.length
    }),
    d => d.Event,
    d => d.Competition
  );

  const statRows = [];
  for (const [event, byComp] of stats) {
    for (const [comp, s] of byComp) {
      statRows.push({ event, comp, ...s });
    }
  }

  // clip
  svg.append("defs").append("clipPath")
    .attr("id", "clipStrip")
    .append("rect")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", (w - margin.left - margin.right))
    .attr("height", (h - margin.top - margin.bottom));

  const gPlot = svg.append("g").attr("clip-path", "url(#clipStrip)");

  // jitter attorno al centro (più stretto quando separiamo 2 competizioni)
  function jitterMaxFor(event) {
    const comps = compsSortedByEvent.get(event) || [];
    return Math.max(2, (comps.length <= 1 ? x0.bandwidth() * 0.14 : x0.bandwidth() * 0.10));
  }

  function xPos(d) {
    const c = xFor(d.Event, d.Competition);
    if (c == null) return null;
    const j = jitterMaxFor(d.Event);
    return c + (Math.random() * 2 - 1) * j;
  }

  // punti
  const r = 2.6;
  const rHover = 4.2;

  gPlot.selectAll("circle.stripPt")
    .data(base, d => d.__id ?? `${d.Event}|${d.Competition}|${d.Athlete}|${d.FinalScore}`)
    .enter()
    .append("circle")
    .attr("class", "stripPt")
    .attr("cx", d => xPos(d))
    .attr("cy", d => y(d.FinalScore))
    .attr("r", r)
    .attr("fill", d => compColor(d.Competition))
    .attr("opacity", 0.35)
    .on("mouseover", function(evt, d) {
      setHighlightedCompetition(d.Competition);
      d3.select(this).attr("r", rHover).attr("opacity", 0.9).attr("stroke", "black").attr("stroke-width", 0.8);

      showTooltip(`
        <div class="t-title">${d.Athlete ?? "Athlete"}</div>
        <div class="t-row"><span class="t-key">Year</span><span class="t-val">${year}</span></div>
        <div class="t-row"><span class="t-key">Event</span><span class="t-val">${d.Event}</span></div>
        <div class="t-row"><span class="t-key">Competition</span><span class="t-val">${d.Competition}</span></div>
        <div class="t-row"><span class="t-key">Final</span><span class="t-val">${fmt(d.FinalScore)}</span></div>
        <div class="t-row"><span class="t-key">D</span><span class="t-val">${fmt(d.Dscore)}</span></div>
        <div class="t-row"><span class="t-key">E</span><span class="t-val">${fmt(d.Escore)}</span></div>
      `, evt);
    })
    .on("mousemove", evt => moveTooltip(evt))
    .on("mouseout", function() {
      setHighlightedCompetition(null);
      d3.select(this).attr("r", r).attr("opacity", 0.35).attr("stroke", null).attr("stroke-width", null);
      hideTooltip();
    });

  // whisker + mean (centro coerente con i punti)
  const cap = 7;

  gPlot.selectAll("line.evWhisker")
    .data(statRows, d => `${d.event}|${d.comp}`)
    .enter()
    .append("line")
    .attr("class", "evWhisker")
    .attr("x1", d => xFor(d.event, d.comp))
    .attr("x2", d => xFor(d.event, d.comp))
    .attr("y1", d => y(d.min))
    .attr("y2", d => y(d.max))
    .attr("stroke", "#2b2b2b")
    .attr("stroke-width", 1.1)
    .attr("opacity", 0.55);

  gPlot.selectAll("line.evCapMin")
    .data(statRows, d => `${d.event}|${d.comp}`)
    .enter()
    .append("line")
    .attr("class", "evCapMin")
    .attr("x1", d => xFor(d.event, d.comp) - cap)
    .attr("x2", d => xFor(d.event, d.comp) + cap)
    .attr("y1", d => y(d.min))
    .attr("y2", d => y(d.min))
    .attr("stroke", "#2b2b2b")
    .attr("stroke-width", 1.1)
    .attr("opacity", 0.55);

  gPlot.selectAll("line.evCapMax")
    .data(statRows, d => `${d.event}|${d.comp}`)
    .enter()
    .append("line")
    .attr("class", "evCapMax")
    .attr("x1", d => xFor(d.event, d.comp) - cap)
    .attr("x2", d => xFor(d.event, d.comp) + cap)
    .attr("y1", d => y(d.max))
    .attr("y2", d => y(d.max))
    .attr("stroke", "#2b2b2b")
    .attr("stroke-width", 1.1)
    .attr("opacity", 0.55);

  gPlot.selectAll("circle.evMean")
    .data(statRows, d => `${d.event}|${d.comp}`)
    .enter()
    .append("circle")
    .attr("class", "evMean")
    .attr("cx", d => xFor(d.event, d.comp))
    .attr("cy", d => y(d.mean))
    .attr("r", 5.2)
    .attr("fill", d => compColor(d.comp))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.4)
    .attr("opacity", 0.95);

  setHighlightedCompetition(state.highlighted?.Competition ?? null);
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

  const years = Array.from(new Set(base.map(d => d.Year))).sort();
  const singleYear = years.length === 1;

  const { w, h } = getSvgSize(svg);

  if (!singleYear) {
    const rows = aggregateByCompEvent(base);
    if (rows.length === 0) {
      svg.append("text").attr("x", 20).attr("y", 30).attr("fill", "#6f6f6f")
        .text("Timeline: no data (missing/invalid EventDate)");
      return;
    }
    drawMultiYearTimeline(svg, base, rows, w, h);
    return;
  }

  drawSingleYearStrip(svg, base, years[0], w, h);
}
