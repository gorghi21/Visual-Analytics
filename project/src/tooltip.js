// src/tooltip.js
const TIP_ID = "tooltip";

export function fmt(x) {
  return Number.isFinite(x) ? x.toFixed(3) : "-";
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(v, hi));
}

function placeTooltip(evt) {
  const tip = document.getElementById(TIP_ID);
  if (!tip) return;

  const pad = 12;
  const offset = 14;

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const rect = tip.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  // preferisci sinistra se sei vicino al bordo destro
  const preferLeft = evt.clientX > vw * 0.6;

  let x = preferLeft
    ? (evt.clientX - rect.width - offset)
    : (evt.clientX + offset);

  let y = evt.clientY + offset;
  if (y + rect.height + pad > vh) y = evt.clientY - rect.height - offset;

  x = clamp(x, pad, vw - rect.width - pad);
  y = clamp(y, pad, vh - rect.height - pad);

  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

export function showTooltip(html, evt) {
  const tip = document.getElementById(TIP_ID);
  if (!tip) return;

  // MARKER VISIBILE: se vedi questo, è il file giusto
  tip.setAttribute("data-tipver", "vFINAL");

  tip.innerHTML = html;
  tip.style.display = "block";

  // aspetta 1 frame per misure reali (font/layout)
  requestAnimationFrame(() => placeTooltip(evt));
}

export function moveTooltip(evt) {
  requestAnimationFrame(() => placeTooltip(evt));
}

export function hideTooltip() {
  const tip = document.getElementById(TIP_ID);
  if (!tip) return;
  tip.style.display = "none";
}
