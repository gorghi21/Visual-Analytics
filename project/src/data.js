// src/data.js
function keyOf(obj, wanted) {
  const normWanted = wanted.toLowerCase().replace(/\s+/g, "");
  for (const k of Object.keys(obj)) {
    const nk = k.toLowerCase().replace(/\s+/g, "");
    if (nk === normWanted) return k;
  }
  return null;
}

function toNum(x) {
  if (x === null || x === undefined) return NaN;
  const s = String(x).trim().replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

function normalizeData(data) {
  return data.map(d => {
    const kAthlete     = keyOf(d, "Athlete");
    const kNation      = keyOf(d, "Nation");
    const kYear        = keyOf(d, "Year");
    const kCompetition = keyOf(d, "Competition");
    const kEvent       = keyOf(d, "Event");
    const kQualified   = keyOf(d, "Qualified");
    const kApparatus   = keyOf(d, "Apparatus");
    const kD           = keyOf(d, "Dscore");
    const kE           = keyOf(d, "Escore");
    const kPen         = keyOf(d, "Penalties");
    const kFinal       = keyOf(d, "FinalScore");
    const kRank        = keyOf(d, "Rank");

    return {
      Athlete: (d[kAthlete] ?? "").toString().trim(),
      Nation: (d[kNation] ?? "").toString().trim(),
      Year: Number(String(d[kYear] ?? "").trim()),
      Competition: (d[kCompetition] ?? "").toString().trim().toLowerCase(),
      Event: (d[kEvent] ?? "").toString().trim(),
      Qualified: (d[kQualified] ?? "").toString().trim().toUpperCase(),
      Apparatus: (d[kApparatus] ?? "").toString().trim(),
      Dscore: toNum(d[kD]),
      Escore: toNum(d[kE]),
      Penalties: toNum(d[kPen]),
      FinalScore: toNum(d[kFinal]),
      Rank: Number(String(d[kRank] ?? "").trim())
    };
  }).filter(d =>
    d.Athlete !== "" &&
    Number.isFinite(d.Year) &&
    d.Apparatus !== "" &&
    Number.isFinite(d.Dscore) &&
    Number.isFinite(d.Escore) &&
    Number.isFinite(d.FinalScore)
  );
}

export async function loadCSV(url) {
  const text = await window.d3.text(url);

  const parseComma = window.d3.dsvFormat(",").parse(text);
  const parseSemi  = window.d3.dsvFormat(";").parse(text);
  const dataRaw = (parseSemi.columns.length > parseComma.columns.length) ? parseSemi : parseComma;

  const cleaned = dataRaw.map(r => {
    const o = {};
    for (const k of dataRaw.columns) {
      const kk = k.replace(/\uFEFF/g, "").trim();
      o[kk] = r[k];
    }
    return o;
  });

  const normalized = normalizeData(cleaned);

  normalized.forEach((d, i) => { d.__id = i; });

  return normalized;
}
