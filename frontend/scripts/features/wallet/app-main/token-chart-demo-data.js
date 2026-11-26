
// ══════════════════════════════════════════════
// ── UNIFIED CHART SCREEN ──
// Single function: LINE + CANDLE tabs, instant demo data
// ══════════════════════════════════════════════

// ── Generate instant demo data so chart shows immediately ──
function _genDemoLineData(hours, basePrice) {
  const now = Date.now();
  const count = Math.min(120, hours <= 1 ? 60 : hours <= 24 ? 72 : 90);
  const step = (hours * 3600000) / count;
  let price = basePrice || 1000;
  const out = [];
  for (let i = 0; i < count; i++) {
    price = price * (1 + (Math.random() - 0.495) * 0.022);
    out.push([now - (count - i) * step, Math.max(price * 0.01, price)]);
  }
  return out;
}

function _genDemoCandleData(hours, basePrice) {
  const now = Date.now();
  const count = Math.min(60, hours <= 4 ? 48 : hours <= 24 ? 24 : 42);
  const step = (hours * 3600000) / count;
  let price = basePrice || 1000;
  const out = [];
  for (let i = 0; i < count; i++) {
    const o = price;
    const move = price * 0.025;
    const h = o + Math.random() * move;
    const l = o - Math.random() * move;
    const c = l + Math.random() * (h - l);
    price = c;
    out.push([now - (count - i) * step, o, h, l, c]);
  }
  return out;
}

// ── Alias: openTokenChartFull → openTokenChart (backward compat) ──
function openTokenChartFull(t) { openTokenChart(t); }
