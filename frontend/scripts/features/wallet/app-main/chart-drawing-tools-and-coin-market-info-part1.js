
function _dtRenderOne(canvas, d, isSelected) {
  if (!d || !d.points || !d.points.length) return;
  const p = d.points;
  const c = d.color || '#6366f1';
  const w = isSelected ? 2 : 1.5;

  switch (d.type) {

    case 'trendline':
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      _svgLine(canvas, p[0].x,p[0].y, p[1].x,p[1].y, c, '', w);
      if (isSelected) { _svgCircle(canvas,p[0].x,p[0].y,4,c); _svgCircle(canvas,p[1].x,p[1].y,4,c); }
      break;

    case 'ray': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      const dx=p[1].x-p[0].x, dy=p[1].y-p[0].y;
      const len=Math.hypot(dx,dy)||1, ext=4000;
      _svgLine(canvas, p[0].x,p[0].y, p[0].x+dx/len*ext, p[0].y+dy/len*ext, c, '', w);
      _svgCircle(canvas,p[0].x,p[0].y,4,c);
      break;
    }

    case 'extline': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      const dx=p[1].x-p[0].x, dy=p[1].y-p[0].y;
      const len=Math.hypot(dx,dy)||1, ext=4000;
      const ux=dx/len, uy=dy/len;
      _svgLine(canvas, p[0].x-ux*ext,p[0].y-uy*ext, p[0].x+ux*ext,p[0].y+uy*ext, c, '', w);
      break;
    }

    case 'hline':
      _svgLine(canvas, 0,p[0].y, 9999,p[0].y, c, '', w);
      // price label
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice) {
          const price = _lwCandleSeries.coordinateToPrice(p[0].y);
          if (price) _svgText(canvas, 6, p[0].y - 8, _dtFmtPrice(price), c, 9);
        }
      } catch(_) {}
      break;

    case 'hray':
      _svgLine(canvas, p[0].x,p[0].y, 9999,p[0].y, c, '', w);
      _svgCircle(canvas,p[0].x,p[0].y,4,c);
      break;

    case 'vline':
      _svgLine(canvas, p[0].x,0, p[0].x,9999, c, '', w);
      break;

    case 'rectangle':
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      _svgRect(canvas, p[0].x,p[0].y, p[1].x,p[1].y, c, 'rgba(99,102,241,0.07)');
      if (isSelected) {
        _svgCircle(canvas,p[0].x,p[0].y,4,c); _svgCircle(canvas,p[1].x,p[1].y,4,c);
        _svgCircle(canvas,p[0].x,p[1].y,4,c); _svgCircle(canvas,p[1].x,p[0].y,4,c);
      }
      break;

    case 'channel': {
      // 3 points: p[0]=start, p[1]=end of main line, p[2]=parallel offset
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      _svgLine(canvas, p[0].x,p[0].y, p[1].x,p[1].y, c, '', w);
      if (p.length >= 3) {
        const dy = p[2].y - p[0].y;
        _svgLine(canvas, p[0].x,p[0].y+dy, p[1].x,p[1].y+dy, c, '4 3', w*0.8);
        // midline
        const mdy = dy/2;
        _svgLine(canvas, p[0].x,p[0].y+mdy, p[1].x,p[1].y+mdy, c, '2 4', w*0.6);
      }
      break;
    }

    case 'fib': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      const totalH = p[1].y - p[0].y;
      const x1 = Math.min(p[0].x,p[1].x), x2 = Math.max(p[0].x,p[1].x);
      _FIB_LEVELS.forEach((lvl, i) => {
        const y = p[0].y + totalH * lvl;
        _svgLine(canvas, x1, y, x2, y, _FIB_COLORS[i], '', 1);
        const bgR = _svgEl('rect',{x:x1+2,y:y-8,width:36,height:12,rx:2,fill:'rgba(7,7,15,0.75)'});
        canvas.appendChild(bgR);
        _svgText(canvas, x1+4, y, (lvl*100).toFixed(1)+'%', _FIB_COLORS[i], 9);
      });
      break;
    }

    case 'pitchfork': {
      // p[0]=handle, p[1]=fork top, p[2]=fork bottom
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      if (p.length === 2) { _svgLine(canvas,p[0].x,p[0].y,p[1].x,p[1].y,c,'',w); break; }
      const midX=(p[1].x+p[2].x)/2, midY=(p[1].y+p[2].y)/2;
      _svgLine(canvas, p[0].x,p[0].y, midX,midY, c, '', w);       // handle → mid
      const dx=midX-p[0].x, dy=midY-p[0].y, len=Math.hypot(dx,dy)||1, ext=3000;
      const ux=dx/len, uy=dy/len;
      _svgLine(canvas, midX,midY, midX+ux*ext,midY+uy*ext, c,'',w);        // center prong
      _svgLine(canvas, p[1].x,p[1].y, p[1].x+ux*ext,p[1].y+uy*ext, c,'3 3',w*0.8); // top prong
      _svgLine(canvas, p[2].x,p[2].y, p[2].x+ux*ext,p[2].y+uy*ext, c,'3 3',w*0.8); // bottom prong
      _svgLine(canvas, p[1].x,p[1].y, p[2].x,p[2].y, c,'2 4',w*0.6); // fork bar
      break;
    }

    case 'brush': {
      if (!p || p.length < 2) break;
      const path = _svgEl('path', {
        d: p.map((pt,i) => (i===0?'M':'L')+pt.x.toFixed(1)+' '+pt.y.toFixed(1)).join(' '),
        stroke: c, 'stroke-width': 2, fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      });
      canvas.appendChild(path);
      break;
    }

    case 'text':
      if (!d.text) break;
      // shadow for readability
      const shadow = _svgEl('text', {x:p[0].x+1, y:p[0].y+1, fill:'rgba(0,0,0,0.7)',
        'font-size':13, 'font-family':'monospace','font-weight':'700','dominant-baseline':'middle'});
      shadow.textContent = d.text; canvas.appendChild(shadow);
      _svgText(canvas, p[0].x, p[0].y, d.text, c, 13);
      break;

    case 'measure': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      _svgRect(canvas, p[0].x,p[0].y, p[1].x,p[1].y, '#22d3ee', 'rgba(34,211,238,0.06)');
      // Price % label
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice) {
          const pr1 = _lwCandleSeries.coordinateToPrice(p[0].y);
          const pr2 = _lwCandleSeries.coordinateToPrice(p[1].y);
          if (pr1 && pr2 && pr1 !== 0) {
            const pct  = ((pr2 - pr1) / Math.abs(pr1) * 100).toFixed(2);
            const label = (pct > 0 ? '+' : '') + pct + '%';
            const mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
            const bg = _svgEl('rect',{x:mx-28,y:my-9,width:56,height:18,rx:4,fill:'rgba(10,10,22,0.9)'});
            canvas.appendChild(bg);
            _svgText(canvas, mx, my, label, pct >= 0 ? '#10b981' : '#f43f5e', 10);
          }
        }
      } catch(_) {}
      break;
    }

    case 'zoom': {
      // preview while dragging only (committed drawings aren't saved for zoom)
      if (p.length < 2) break;
      _svgRect(canvas, p[0].x,p[0].y, p[1].x,p[1].y, '#22d3ee', 'rgba(34,211,238,0.06)');
      break;
    }

    case 'arrow': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      const dx=p[1].x-p[0].x, dy=p[1].y-p[0].y;
      const len=Math.hypot(dx,dy)||1;
      const ux=dx/len, uy=dy/len;
      // shaft
      _svgLine(canvas, p[0].x,p[0].y, p[1].x,p[1].y, c, '', w);
      // arrowhead
      const hLen=12, hAngle=0.42;
      const cos1=Math.cos(hAngle), sin1=Math.sin(hAngle);
      const cos2=Math.cos(-hAngle), sin2=Math.sin(-hAngle);
      const ax1=p[1].x-hLen*(ux*cos1-uy*sin1), ay1=p[1].y-hLen*(ux*sin1+uy*cos1);
      const ax2=p[1].x-hLen*(ux*cos2-uy*sin2), ay2=p[1].y-hLen*(ux*sin2+uy*cos2);
      const arrowHead = _svgEl('polygon', {
        points:`${p[1].x},${p[1].y} ${ax1},${ay1} ${ax2},${ay2}`,
        fill: c, stroke: c, 'stroke-width': 1
      });
      canvas.appendChild(arrowHead);
      if (isSelected) { _svgCircle(canvas,p[0].x,p[0].y,4,c); _svgCircle(canvas,p[1].x,p[1].y,4,c); }
      break;
    }

    case 'triangle': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      if (p.length === 2) {
        _svgLine(canvas,p[0].x,p[0].y,p[1].x,p[1].y,c,'',w);
        _svgCircle(canvas,p[0].x,p[0].y,4,c); break;
      }
      const tri = _svgEl('polygon', {
        points:`${p[0].x},${p[0].y} ${p[1].x},${p[1].y} ${p[2].x},${p[2].y}`,
        fill: 'rgba(99,102,241,0.08)', stroke: c, 'stroke-width': w, 'stroke-linejoin': 'round'
      });
      canvas.appendChild(tri);
      if (isSelected) { p.forEach(pt => _svgCircle(canvas,pt.x,pt.y,4,c)); }
      break;
    }

    case 'ellipse': {
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      const cx2=(p[0].x+p[1].x)/2, cy2=(p[0].y+p[1].y)/2;
      const rx2=Math.abs(p[1].x-p[0].x)/2, ry2=Math.abs(p[1].y-p[0].y)/2;
      const el2 = _svgEl('ellipse', { cx:cx2, cy:cy2, rx:Math.max(rx2,2), ry:Math.max(ry2,2),
        fill:'rgba(99,102,241,0.07)', stroke:c, 'stroke-width':w });
      canvas.appendChild(el2);
      if (isSelected) { _svgCircle(canvas,p[0].x,p[0].y,4,c); _svgCircle(canvas,p[1].x,p[1].y,4,c); }
      break;
    }

    case 'hzone': {
      // 2 horizontal price levels → filled band
      if (p.length < 2) { _svgLine(canvas,0,p[0].y,9999,p[0].y,c,'',w); break; }
      const y1h=Math.min(p[0].y,p[1].y), y2h=Math.max(p[0].y,p[1].y);
      const zoneRect = _svgEl('rect', { x:0, y:y1h, width:9999, height:y2h-y1h,
        fill:`rgba(${c==='#6366f1'?'99,102,241':c==='#10b981'?'16,185,129':'244,63,94'},0.10)`,
        stroke:'none' });
      canvas.appendChild(zoneRect);
      _svgLine(canvas,0,y1h,9999,y1h,c,'',w);
      _svgLine(canvas,0,y2h,9999,y2h,c,'2 3',w*0.8);
      // price labels
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice) {
          const pr1=_lwCandleSeries.coordinateToPrice(y1h);
          const pr2=_lwCandleSeries.coordinateToPrice(y2h);
          if (pr1) _svgText(canvas,6,y1h-8,_dtFmtPrice(pr1),c,9);
          if (pr2) _svgText(canvas,6,y2h+14,_dtFmtPrice(pr2),c,9);
        }
      } catch(_){}
      break;
    }

    case 'pricelabel': {
      // single click → horizontal dashed line + price tag box
      _svgLine(canvas,0,p[0].y,9999,p[0].y,c,'4 3',w);
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice) {
          const price=_lwCandleSeries.coordinateToPrice(p[0].y);
          if (price) {
            const label=_dtFmtPrice(price);
            const bx=6, by=p[0].y-10, bw=label.length*6.5+8, bh=16;
            const bg=_svgEl('rect',{x:bx,y:by,width:bw,height:bh,rx:4,
              fill:'rgba(10,10,22,0.88)',stroke:c,'stroke-width':1});
            canvas.appendChild(bg);
            _svgText(canvas,bx+4,p[0].y,label,c,9);
          }
        }
      } catch(_){}
      if (isSelected) _svgCircle(canvas,p[0].x,p[0].y,4,c);
      break;
    }

    case 'daterange': {
      if (p.length < 2) { _svgLine(canvas,p[0].x,0,p[0].x,9999,c,'',w); break; }
      const xl=Math.min(p[0].x,p[1].x), xr=Math.max(p[0].x,p[1].x);
      // vertical lines
      _svgLine(canvas,xl,0,xl,9999,c,'',w);
      _svgLine(canvas,xr,0,xr,9999,c,'',w);
      // horizontal arrow between them at mid-height
      const ymid=140;
      _svgLine(canvas,xl,ymid,xr,ymid,c,'3 3',w*0.8);
      // arrowheads
      _svgLine(canvas,xl,ymid,xl+10,ymid-5,c,'',w*0.8);
      _svgLine(canvas,xl,ymid,xl+10,ymid+5,c,'',w*0.8);
      _svgLine(canvas,xr,ymid,xr-10,ymid-5,c,'',w*0.8);
      _svgLine(canvas,xr,ymid,xr-10,ymid+5,c,'',w*0.8);
      // time label
      try {
        if (_lwChart) {
          const ts=_lwChart.timeScale();
          const t1=ts.coordinateToTime(xl), t2=ts.coordinateToTime(xr);
          if (t1!=null && t2!=null) {
            const diffS=Math.abs(t2-t1);
            const diffH=Math.round(diffS/3600);
            const label=diffH<24?diffH+'h':(Math.round(diffH/24))+'d';
            const mx=(xl+xr)/2;
            const bg=_svgEl('rect',{x:mx-16,y:ymid-11,width:32,height:14,rx:4,fill:'rgba(10,10,22,0.88)',stroke:c,'stroke-width':1});
            canvas.appendChild(bg);
            _svgText(canvas,mx,ymid-2,label,c,9);
          }
        }
      } catch(_){}
      if (isSelected) { _svgCircle(canvas,xl,ymid,4,c); _svgCircle(canvas,xr,ymid,4,c); }
      break;
    }

    case 'abcd': {
      // 4-point pattern: A→B→C→D
      const labels=['A','B','C','D'];
      for (let i=0;i<p.length-1;i++) {
        _svgLine(canvas,p[i].x,p[i].y,p[i+1].x,p[i+1].y,c,'',w);
      }
      p.forEach((pt,i) => {
        _svgCircle(canvas,pt.x,pt.y,5,c);
        const bg=_svgEl('rect',{x:pt.x+7,y:pt.y-10,width:13,height:13,rx:3,fill:'rgba(10,10,22,0.88)',stroke:c,'stroke-width':1});
        canvas.appendChild(bg);
        _svgText(canvas,pt.x+10,pt.y-2,labels[i]||'',c,9);
      });
      if (p.length<4) _svgCircle(canvas,p[p.length-1].x,p[p.length-1].y,4,c);
      break;
    }

    case 'long':
    case 'short': {
      // 3 taps: Entry → Target(TP) → Stop(SL). Profit zone is always green, risk zone always red.
      const isLong = d.type === 'long';
      if (p.length < 1) break;
      const x0 = p[0].x, yE = p[0].y;
      if (p.length < 2) { _svgCircle(canvas,x0,yE,4,c); break; }
      let xL = Math.min(p[0].x,p[1].x), xR = Math.max(p[0].x,p[1].x);
      if (xR - xL < 50) xR = xL + 50;
      const yT = p[1].y;
      if (p.length < 3) {
        // preview while waiting for the stop-loss tap
        _svgRect(canvas, xL, yE, xR, yT, '#10b981', 'rgba(16,185,129,0.12)');
        _svgLine(canvas, xL, yE, xR, yE, '#a5b4fc', '4 3', w);
        break;
      }
      const yS = p[2].y;
      _svgRect(canvas, xL, yE, xR, yT, '#10b981', 'rgba(16,185,129,0.14)');
      _svgRect(canvas, xL, yE, xR, yS, '#f43f5e', 'rgba(244,63,94,0.14)');
      _svgLine(canvas, xL, yE, xR, yE, '#a5b4fc', '', w);
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice) {
          const prE = _lwCandleSeries.coordinateToPrice(yE);
          const prT = _lwCandleSeries.coordinateToPrice(yT);
          const prS = _lwCandleSeries.coordinateToPrice(yS);
          if (prE != null && prT != null && prS != null) {
            const reward = Math.abs(prT - prE);
            const risk   = Math.abs(prE - prS);
            const rr     = risk > 0 ? (reward / risk) : 0;
            const pctT   = (prE !== 0) ? ((prT - prE) / Math.abs(prE) * 100) : 0;
            const pctS   = (prE !== 0) ? ((prS - prE) / Math.abs(prE) * 100) : 0;
            _dtPosLabel(canvas, xR, yT, '#10b981', 'TP  '+_dtFmtPrice(prT)+'  ('+(pctT>=0?'+':'')+pctT.toFixed(2)+'%)');
            _dtPosLabel(canvas, xR, yS, '#f43f5e', 'SL  '+_dtFmtPrice(prS)+'  ('+(pctS>=0?'+':'')+pctS.toFixed(2)+'%)');
            _dtPosLabel(canvas, xR, yE, '#a5b4fc', (isLong?'LONG  ':'SHORT  ')+'Entry '+_dtFmtPrice(prE));
            const midY = (yT+yS)/2;
            const rrColor = isLong ? '#10b981' : '#f43f5e';
            const rrTxt = 'R:R 1:'+rr.toFixed(2);
            const rrBg = _svgEl('rect',{x:xL,y:midY-9,width:rrTxt.length*5.8+10,height:18,rx:4,
              fill:'rgba(10,10,22,0.92)',stroke:rrColor,'stroke-width':1});
            canvas.appendChild(rrBg);
            _svgText(canvas, xL+6, midY, rrTxt, rrColor, 9);
          }
        }
      } catch(_) {}
      if (isSelected) { _svgCircle(canvas,x0,yE,4,'#a5b4fc'); _svgCircle(canvas,xR,yT,4,'#10b981'); _svgCircle(canvas,xR,yS,4,'#f43f5e'); }
      break;
    }

    case 'fibext': {
      // 3 taps: A → B → C. Levels project from C, scaled by the A→B price move.
      if (p.length < 2) { _svgCircle(canvas,p[0].x,p[0].y,4,c); break; }
      if (p.length < 3) { _svgLine(canvas,p[0].x,p[0].y,p[1].x,p[1].y,c,'',w); break; }
      _svgLine(canvas, p[0].x,p[0].y, p[1].x,p[1].y, 'rgba(255,255,255,0.3)', '2 2', 1);
      _svgLine(canvas, p[1].x,p[1].y, p[2].x,p[2].y, 'rgba(255,255,255,0.3)', '2 2', 1);
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice && _lwCandleSeries.priceToCoordinate) {
          const prA = _lwCandleSeries.coordinateToPrice(p[0].y);
          const prB = _lwCandleSeries.coordinateToPrice(p[1].y);
          const prC = _lwCandleSeries.coordinateToPrice(p[2].y);
          if (prA != null && prB != null && prC != null) {
            const diff = prB - prA;
            const xL = Math.min(p[1].x,p[2].x) - 20, xR = Math.max(p[1].x,p[2].x) + 60;
            _FIBEXT_LEVELS.forEach((lvl, i) => {
              const price = prC + diff*lvl;
              const y = _lwCandleSeries.priceToCoordinate(price);
              if (y == null) return;
              _svgLine(canvas, xL, y, xR, y, _FIBEXT_COLORS[i], '', 1);
              const bg=_svgEl('rect',{x:xL+2,y:y-8,width:46,height:12,rx:2,fill:'rgba(7,7,15,0.75)'});
              canvas.appendChild(bg);
              _svgText(canvas, xL+4, y, (lvl*100).toFixed(1)+'%', _FIBEXT_COLORS[i], 9);
            });
          }
        }
      } catch(_) {}
      if (isSelected) { p.forEach(pt => _svgCircle(canvas,pt.x,pt.y,4,c)); }
      break;
    }

    case 'pricerange': {
      // 2-point drag: shows absolute + % price difference between two levels
      if (p.length < 2) { _svgLine(canvas,0,p[0].y,9999,p[0].y,c,'4 3',w); break; }
      const y1 = p[0].y, y2 = p[1].y;
      const xMid = (p[0].x + p[1].x) / 2 || 60;
      _svgLine(canvas, 0, y1, 9999, y1, c, '4 3', 1);
      _svgLine(canvas, 0, y2, 9999, y2, c, '4 3', 1);
      _svgLine(canvas, xMid, y1, xMid, y2, c, '', w);
      _svgLine(canvas, xMid, y1, xMid-5, y1+8, c, '', w*0.8);
      _svgLine(canvas, xMid, y1, xMid+5, y1+8, c, '', w*0.8);
      _svgLine(canvas, xMid, y2, xMid-5, y2-8, c, '', w*0.8);
      _svgLine(canvas, xMid, y2, xMid+5, y2-8, c, '', w*0.8);
      try {
        if (_lwCandleSeries && _lwCandleSeries.coordinateToPrice) {
          const pr1 = _lwCandleSeries.coordinateToPrice(y1);
          const pr2 = _lwCandleSeries.coordinateToPrice(y2);
          if (pr1 != null && pr2 != null) {
            const diff  = pr2 - pr1;
            const pct   = (pr1 !== 0) ? (diff / Math.abs(pr1) * 100) : 0;
            const label = _dtFmtDiff(diff)+'  ('+(pct>=0?'+':'')+pct.toFixed(2)+'%)';
            const midY  = (y1+y2)/2;
            const lc    = diff>=0 ? '#10b981' : '#f43f5e';
            const bg = _svgEl('rect',{x:xMid+10,y:midY-9,width:label.length*5.8+12,height:18,rx:4,
              fill:'rgba(10,10,22,0.92)',stroke:lc,'stroke-width':1});
            canvas.appendChild(bg);
            _svgText(canvas, xMid+16, midY, label, lc, 10);
          }
        }
      } catch(_) {}
      if (isSelected) { _svgCircle(canvas,xMid,y1,4,c); _svgCircle(canvas,xMid,y2,4,c); }
      break;
    }
  }
}

// ── Price formatter ──
function _dtFmtPrice(v) {
  if (v == null) return '';
  return v >= 1 ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
                : '$'+v.toPrecision(5);
}
// ── Signed price-difference formatter (handles negative values correctly, unlike _dtFmtPrice) ──
function _dtFmtDiff(v) {
  if (v == null) return '$0.00';
  const neg = v < 0;
  const av  = Math.abs(v);
  const body = av >= 1 ? av.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : av.toPrecision(5);
  return (neg?'-':'+') + '$' + body;
}

// ══ EVENT SYSTEM ══════════════════════════════════════════════════


// ── Hit test: find which drawing was tapped (returns index or -1) ──
function _dtHitTest(pt) {
  const st = window._dtState;
  const HIT = 14; // px tolerance

  for (let i = st.drawings.length - 1; i >= 0; i--) {
    const d = st.drawings[i];
    if (!d || !d.points || !d.points.length) continue;
    const p = d.points;

    switch (d.type) {
      case 'trendline':
      case 'ray':
      case 'extline':
      case 'channel':
      case 'pitchfork': {
        if (p.length < 2) break;
        if (_dtDistToSegment(pt, p[0], p[1]) < HIT) return i;
        break;
      }
      case 'hline':
        if (Math.abs(pt.y - p[0].y) < HIT) return i;
        break;
      case 'hray':
        if (pt.x >= p[0].x - HIT && Math.abs(pt.y - p[0].y) < HIT) return i;
        break;
      case 'vline':
        if (Math.abs(pt.x - p[0].x) < HIT) return i;
        break;
      case 'rectangle':
      case 'measure':
      case 'zoom': {
        if (p.length < 2) break;
        const rx1=Math.min(p[0].x,p[1].x), rx2=Math.max(p[0].x,p[1].x);
        const ry1=Math.min(p[0].y,p[1].y), ry2=Math.max(p[0].y,p[1].y);
        // Hit on border
        const nearL = Math.abs(pt.x-rx1)<HIT && pt.y>=ry1-HIT && pt.y<=ry2+HIT;
        const nearR = Math.abs(pt.x-rx2)<HIT && pt.y>=ry1-HIT && pt.y<=ry2+HIT;
        const nearT = Math.abs(pt.y-ry1)<HIT && pt.x>=rx1-HIT && pt.x<=rx2+HIT;
        const nearB = Math.abs(pt.y-ry2)<HIT && pt.x>=rx1-HIT && pt.x<=rx2+HIT;
        if (nearL||nearR||nearT||nearB) return i;
        break;
      }
      case 'fib': {
        if (p.length < 2) break;
        const totalH = p[1].y - p[0].y;
        for (const lvl of _FIB_LEVELS) {
          const y = p[0].y + totalH * lvl;
          if (Math.abs(pt.y - y) < HIT) return i;
        }
        break;
      }
      case 'brush': {
        for (let j = 1; j < p.length; j++) {
          if (_dtDistToSegment(pt, p[j-1], p[j]) < HIT + 4) return i;
        }
        break;
      }
      case 'text': {
        // rough hit: 80x20 box around text origin
        if (pt.x >= p[0].x-4 && pt.x <= p[0].x+100 &&
            pt.y >= p[0].y-16 && pt.y <= p[0].y+6) return i;
        break;
      }
      case 'arrow':
        if (p.length < 2) break;
        if (_dtDistToSegment(pt, p[0], p[1]) < HIT) return i;
        break;
      case 'triangle': {
        if (p.length < 2) break;
        for (let j=0;j<p.length-1;j++) { if(_dtDistToSegment(pt,p[j],p[j+1])<HIT) return i; }
        if (p.length===3 && _dtDistToSegment(pt,p[2],p[0])<HIT) return i;
        break;
      }
      case 'ellipse': {
        if (p.length < 2) break;
        const ecx=(p[0].x+p[1].x)/2, ecy=(p[0].y+p[1].y)/2;
        const erx=Math.abs(p[1].x-p[0].x)/2||1, ery=Math.abs(p[1].y-p[0].y)/2||1;
        const norm=Math.pow((pt.x-ecx)/erx,2)+Math.pow((pt.y-ecy)/ery,2);
        if (norm>=0.7 && norm<=1.5) return i;
        break;
      }
      case 'hzone':
        if (p.length<2) { if(Math.abs(pt.y-p[0].y)<HIT) return i; break; }
        { const yz1=Math.min(p[0].y,p[1].y),yz2=Math.max(p[0].y,p[1].y);
          if (pt.y>=yz1-HIT && pt.y<=yz2+HIT) return i; }
        break;
      case 'pricelabel':
        if (Math.abs(pt.y-p[0].y)<HIT) return i;
        break;
      case 'daterange':
        if (p.length<2) { if(Math.abs(pt.x-p[0].x)<HIT) return i; break; }
        { const xl=Math.min(p[0].x,p[1].x),xr=Math.max(p[0].x,p[1].x);
          if(Math.abs(pt.x-xl)<HIT || Math.abs(pt.x-xr)<HIT) return i; }
        break;
      case 'abcd': {
        for (let j=0;j<p.length-1;j++) { if(_dtDistToSegment(pt,p[j],p[j+1])<HIT) return i; }
        break;
      }
      case 'long':
      case 'short': {
        if (p.length < 2) break;
        const xL = Math.min(p[0].x,p[1].x) - HIT, xR = Math.max(p[0].x,p[1].x) + HIT;
        const levels = p.length >= 3 ? [p[0].y, p[1].y, p[2].y] : [p[0].y, p[1].y];
        if (pt.x < xL || pt.x > xR) break;
        for (const ly of levels) { if (Math.abs(pt.y - ly) < HIT) return i; }
        break;
      }
      case 'fibext': {
        if (p.length < 3) { if (_dtDistToSegment(pt,p[0],p[1] || p[0]) < HIT) return i; break; }
        if (_dtDistToSegment(pt,p[0],p[1]) < HIT || _dtDistToSegment(pt,p[1],p[2]) < HIT) return i;
        try {
          const prA = _lwCandleSeries.coordinateToPrice(p[0].y);
          const prB = _lwCandleSeries.coordinateToPrice(p[1].y);
          const prC = _lwCandleSeries.coordinateToPrice(p[2].y);
          const diff = prB - prA;
          for (const lvl of _FIBEXT_LEVELS) {
            const y = _lwCandleSeries.priceToCoordinate(prC + diff*lvl);
            if (y != null && Math.abs(pt.y - y) < HIT) return i;
          }
        } catch(_) {}
        break;
      }
      case 'pricerange':
        if (p.length < 2) { if (Math.abs(pt.y-p[0].y) < HIT) return i; break; }
        if (Math.abs(pt.y-p[0].y) < HIT || Math.abs(pt.y-p[1].y) < HIT) return i;
        break;
    }
  }
  return -1;
}

// Point-to-segment distance
function _dtDistToSegment(pt, a, b) {
  const dx=b.x-a.x, dy=b.y-a.y;
  const lenSq = dx*dx+dy*dy;
  if (lenSq === 0) return Math.hypot(pt.x-a.x, pt.y-a.y);
  let t = ((pt.x-a.x)*dx + (pt.y-a.y)*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(pt.x - (a.x+t*dx), pt.y - (a.y+t*dy));
}
