// ── Apply candles to chart ──
// ── Shared MA calculator ──
function _calcMA(data, period) {
  const result = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function _lwRenderMainSeries(type, candles) {
  if (!_lwChart || !candles || !candles.length) return;
  // Remove old main series only (keep MA series) — recreated below as the correct series type
  if (_lwCandleSeries) { try { _lwChart.removeSeries(_lwCandleSeries); } catch(e){} _lwCandleSeries = null; }
  if (type === 'candle') {
    _lwCandleSeries = _lwChart.addCandlestickSeries({ upColor:'#10b981', downColor:'#f43f5e', borderUpColor:'#10b981', borderDownColor:'#f43f5e', wickUpColor:'#10b981', wickDownColor:'#f43f5e' });
    _lwCandleSeries.setData(candles);
    _lwApplyHighLowMarkers(candles);
  } else if (type === 'heikinashi') {
    _lwCandleSeries = _lwChart.addCandlestickSeries({ upColor:'#10b981', downColor:'#f43f5e', borderUpColor:'#10b981', borderDownColor:'#f43f5e', wickUpColor:'#10b981', wickDownColor:'#f43f5e' });
    const ha = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i], p = ha[i-1];
      const haClose = (c.open + c.high + c.low + c.close) / 4;
      const haOpen  = p ? (p.open + p.close) / 2 : (c.open + c.close) / 2;
      const haHigh  = Math.max(c.high, haOpen, haClose);
      const haLow   = Math.min(c.low,  haOpen, haClose);
      ha.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
    }
    _lwCandleSeries.setData(ha);
    _lwApplyHighLowMarkers(candles);
  } else if (type === 'baseline') {
    const mid = (Math.max(...candles.map(c=>c.high)) + Math.min(...candles.map(c=>c.low))) / 2;
    _lwCandleSeries = _lwChart.addBaselineSeries({ baseValue:{ type:'price', price: mid }, topLineColor:'#10b981', topFillColor1:'rgba(16,185,129,0.15)', topFillColor2:'rgba(16,185,129,0.02)', bottomLineColor:'#f43f5e', bottomFillColor1:'rgba(244,63,94,0.02)', bottomFillColor2:'rgba(244,63,94,0.15)' });
    _lwCandleSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
  } else if (type === 'line') {
    _lwCandleSeries = _lwChart.addLineSeries({ color:'#6366f1', lineWidth:2, crosshairMarkerVisible:true, crosshairMarkerRadius:4 });
    _lwCandleSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
  } else if (type === 'area') {
    _lwCandleSeries = _lwChart.addAreaSeries({ lineColor:'#6366f1', topColor:'rgba(99,102,241,0.28)', bottomColor:'rgba(99,102,241,0.02)', lineWidth:2, crosshairMarkerVisible:true, crosshairMarkerRadius:4 });
    _lwCandleSeries.setData(candles.map(c => ({ time: c.time, value: c.close })));
  } else if (type === 'bar') {
    _lwCandleSeries = _lwChart.addBarSeries({ upColor:'#10b981', downColor:'#f43f5e' });
    _lwCandleSeries.setData(candles);
    _lwApplyHighLowMarkers(candles);
  } else if (type === 'hollowcandle') {
    _lwCandleSeries = _lwChart.addCandlestickSeries({
      upColor:'rgba(0,0,0,0)', downColor:'#f43f5e',
      borderUpColor:'#10b981', borderDownColor:'#f43f5e',
      wickUpColor:'#10b981', wickDownColor:'#f43f5e'
    });
    _lwCandleSeries.setData(candles);
    _lwApplyHighLowMarkers(candles);
  } else if (type === 'renko') {
    const brick = (Math.max(...candles.map(c=>c.high)) - Math.min(...candles.map(c=>c.low))) / 40 || 1;
    const renkoBars = [];
    let base = candles[0].close;
    let dir = 0; // 0 unknown, 1 up, -1 down
    for (let i = 0; i < candles.length; i++) {
      const price = candles[i].close;
      let moved = price - base;
      while (Math.abs(moved) >= brick) {
        const stepDir = moved > 0 ? 1 : -1;
        if (dir !== 0 && stepDir !== dir && Math.abs(moved) < brick * 2) break; // need reversal of 2 bricks
        const open = base;
        const close = base + stepDir * brick;
        renkoBars.push({ time: candles[i].time, open, high: Math.max(open, close), low: Math.min(open, close), close });
        base = close;
        dir = stepDir;
        moved = price - base;
      }
    }
    _lwCandleSeries = _lwChart.addCandlestickSeries({ upColor:'#10b981', downColor:'#f43f5e', borderUpColor:'#10b981', borderDownColor:'#f43f5e', wickUpColor:'#10b981', wickDownColor:'#f43f5e' });
    _lwCandleSeries.setData(renkoBars.length ? renkoBars : candles);
  } else if (type === 'kagi') {
    const reversal = (Math.max(...candles.map(c=>c.high)) - Math.min(...candles.map(c=>c.low))) / 25 || 1;
    const points = [];
    let curDir = 0, curVal = candles[0].close, extreme = candles[0].close;
    points.push({ time: candles[0].time, value: curVal });
    for (let i = 1; i < candles.length; i++) {
      const price = candles[i].close;
      if (curDir === 0) {
        if (Math.abs(price - extreme) >= reversal) { curDir = price > extreme ? 1 : -1; extreme = price; points.push({ time: candles[i].time, value: extreme }); }
      } else if (curDir === 1) {
        if (price > extreme) { extreme = price; points.push({ time: candles[i].time, value: extreme }); }
        else if (extreme - price >= reversal) { curDir = -1; extreme = price; points.push({ time: candles[i].time, value: extreme }); }
      } else {
        if (price < extreme) { extreme = price; points.push({ time: candles[i].time, value: extreme }); }
        else if (price - extreme >= reversal) { curDir = 1; extreme = price; points.push({ time: candles[i].time, value: extreme }); }
      }
    }
    _lwCandleSeries = _lwChart.addLineSeries({ color:'#6366f1', lineWidth:2, crosshairMarkerVisible:true, crosshairMarkerRadius:4 });
    _lwCandleSeries.setData(points);
  } else if (type === 'pnf') {
    const boxSize = (Math.max(...candles.map(c=>c.high)) - Math.min(...candles.map(c=>c.low))) / 30 || 1;
    const reversalBoxes = 3;
    const bars = [];
    let dir = 0, base = candles[0].close;
    for (let i = 1; i < candles.length; i++) {
      const price = candles[i].close;
      let moved = price - base;
      while (Math.abs(moved) >= boxSize) {
        const stepDir = moved > 0 ? 1 : -1;
        if (dir !== 0 && stepDir !== dir && Math.abs(moved) < boxSize * reversalBoxes) break;
        const open = base, close = base + stepDir * boxSize;
        bars.push({ time: candles[i].time, open, high: Math.max(open, close), low: Math.min(open, close), close });
        base = close; dir = stepDir; moved = price - base;
      }
    }
    _lwCandleSeries = _lwChart.addBarSeries({ upColor:'#10b981', downColor:'#f43f5e' });
    _lwCandleSeries.setData(bars.length ? bars : candles);
  } else if (type === 'linebreak') {
    const lines = 3;
    const bars = [];
    let history = [candles[0].close];
    for (let i = 1; i < candles.length; i++) {
      const price = candles[i].close;
      const recent = history.slice(-lines);
      const up = price > Math.max(...recent);
      const down = price < Math.min(...recent);
      if (up || down || bars.length === 0) {
        const open = history[history.length - 1];
        bars.push({ time: candles[i].time, open, high: Math.max(open, price), low: Math.min(open, price), close: price });
        history.push(price);
      }
    }
    _lwCandleSeries = _lwChart.addCandlestickSeries({ upColor:'#10b981', downColor:'#f43f5e', borderUpColor:'#10b981', borderDownColor:'#f43f5e', wickUpColor:'#10b981', wickDownColor:'#f43f5e' });
    _lwCandleSeries.setData(bars.length ? bars : candles);
  } else {
    _lwCandleSeries = _lwChart.addCandlestickSeries({ upColor:'#10b981', downColor:'#f43f5e', borderUpColor:'#10b981', borderDownColor:'#f43f5e', wickUpColor:'#10b981', wickDownColor:'#f43f5e' });
    _lwCandleSeries.setData(candles);
    _lwApplyHighLowMarkers(candles);
  }
}
