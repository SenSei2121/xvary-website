/* ═══════════════════════════════════════════════════════════
   Semper Signum — d3-charts.js
   D3.js rendering functions for chart types that Chart.js
   cannot handle well: waterfall, football field, heatmap,
   treemap, and sparklines.

   Uses the canonical K palette from report-core.js.
   All charts render as inline SVG for vector-quality PDF.
   ═══════════════════════════════════════════════════════════ */

var SS_D3 = (function() {
  'use strict';

  var FONT = "'Inter', -apple-system, sans-serif";

  function _k(key) { return (typeof K !== 'undefined' && K[key]) || '#6B7280'; }

  function _fmtVal(v, fmt) {
    if (!fmt) return String(v);
    if (fmt === '%') return v + '%';
    if (fmt === 'x') return v + 'x';
    if (fmt.charAt(0) === '$') {
      var suffix = fmt.slice(1);
      if (typeof v === 'number') {
        var rounded = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
        return '$' + rounded.toLocaleString() + suffix;
      }
      return '$' + v + suffix;
    }
    return String(v);
  }

  /* ═══ WATERFALL CHART ═══ */
  function renderWaterfall(containerId, config) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var items = config.items || [];
    if (items.length < 2) return;

    var rect = container.getBoundingClientRect();
    var W = rect.width || 600;
    var H = parseInt(config.height) || 300;
    var margin = {top: 30, right: 20, bottom: 50, left: 60};
    var w = W - margin.left - margin.right;
    var h = H - margin.top - margin.bottom;
    var fmt = (config.options || {}).value_format || '$';

    var running = 0;
    var processed = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.type === 'total' && it.value != null) {
        processed.push({label: it.label, start: 0, end: it.value, value: it.value, isTotal: true});
        running = it.value;
      } else if (it.type === 'total' && it.value == null) {
        processed.push({label: it.label, start: 0, end: running, value: running, isTotal: true});
      } else {
        var delta = it.value || 0;
        processed.push({label: it.label, start: running, end: running + delta, value: delta, isTotal: false});
        running += delta;
      }
    }

    var allVals = [];
    for (var j = 0; j < processed.length; j++) {
      allVals.push(processed[j].start, processed[j].end);
    }
    var yMin = Math.min.apply(null, allVals);
    var yMax = Math.max.apply(null, allVals);
    var yPad = (yMax - yMin) * 0.15 || 1;

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.fontFamily = FONT;

    var barW = Math.max(20, Math.min(60, w / processed.length * 0.65));
    var gap = (w - barW * processed.length) / (processed.length + 1);

    function yScale(v) {
      return margin.top + h - ((v - (yMin - yPad)) / (yMax - yMin + 2 * yPad)) * h;
    }

    // Grid lines
    var nTicks = 5;
    var step = (yMax - yMin + 2 * yPad) / nTicks;
    for (var t = 0; t <= nTicks; t++) {
      var tickVal = yMin - yPad + t * step;
      var tickY = yScale(tickVal);
      var gridLine = document.createElementNS(ns, 'line');
      gridLine.setAttribute('x1', margin.left);
      gridLine.setAttribute('x2', W - margin.right);
      gridLine.setAttribute('y1', tickY);
      gridLine.setAttribute('y2', tickY);
      gridLine.setAttribute('stroke', 'rgba(0,0,0,0.06)');
      gridLine.setAttribute('stroke-width', '1');
      svg.appendChild(gridLine);

      var tickLabel = document.createElementNS(ns, 'text');
      tickLabel.setAttribute('x', margin.left - 6);
      tickLabel.setAttribute('y', tickY + 3);
      tickLabel.setAttribute('text-anchor', 'end');
      tickLabel.setAttribute('fill', '#6B8299');
      tickLabel.setAttribute('font-size', '10');
      tickLabel.textContent = _fmtVal(Math.round(tickVal), fmt);
      svg.appendChild(tickLabel);
    }

    for (var b = 0; b < processed.length; b++) {
      var p = processed[b];
      var x = margin.left + gap + b * (barW + gap);
      var y1 = yScale(Math.max(p.start, p.end));
      var y2 = yScale(Math.min(p.start, p.end));
      var barH = Math.max(2, y2 - y1);

      var color;
      if (p.isTotal) color = _k('d2');
      else if (p.value >= 0) color = _k('gn');
      else color = _k('rd');

      var bar = document.createElementNS(ns, 'rect');
      bar.setAttribute('x', x);
      bar.setAttribute('y', y1);
      bar.setAttribute('width', barW);
      bar.setAttribute('height', barH);
      bar.setAttribute('rx', '3');
      bar.setAttribute('fill', color);
      svg.appendChild(bar);

      // Connector line to next bar
      if (b < processed.length - 1 && !p.isTotal) {
        var conn = document.createElementNS(ns, 'line');
        conn.setAttribute('x1', x + barW);
        conn.setAttribute('x2', x + barW + gap);
        conn.setAttribute('y1', yScale(p.end));
        conn.setAttribute('y2', yScale(p.end));
        conn.setAttribute('stroke', '#D4DDE5');
        conn.setAttribute('stroke-width', '1');
        conn.setAttribute('stroke-dasharray', '3,2');
        svg.appendChild(conn);
      }

      // Value label above/below bar
      var valLabel = document.createElementNS(ns, 'text');
      valLabel.setAttribute('x', x + barW / 2);
      valLabel.setAttribute('text-anchor', 'middle');
      valLabel.setAttribute('fill', _k('d1'));
      valLabel.setAttribute('font-size', '10');
      valLabel.setAttribute('font-weight', '600');
      if (p.isTotal || p.value >= 0) {
        valLabel.setAttribute('y', y1 - 5);
      } else {
        valLabel.setAttribute('y', y2 + 12);
      }
      var prefix = (!p.isTotal && p.value > 0) ? '+' : '';
      valLabel.textContent = prefix + _fmtVal(p.value, fmt);
      svg.appendChild(valLabel);

      // X-axis label
      var xLabel = document.createElementNS(ns, 'text');
      xLabel.setAttribute('x', x + barW / 2);
      xLabel.setAttribute('y', H - margin.bottom + 14);
      xLabel.setAttribute('text-anchor', 'middle');
      xLabel.setAttribute('fill', '#6B8299');
      xLabel.setAttribute('font-size', '10');
      xLabel.setAttribute('font-weight', p.isTotal ? '700' : '400');
      xLabel.textContent = p.label;
      svg.appendChild(xLabel);
    }

    container.appendChild(svg);
  }

  /* ═══ FOOTBALL FIELD CHART ═══ */
  function renderFootballField(containerId, config) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var methods = config.methods || [];
    if (methods.length === 0) return;

    var currentPrice = config.current_price || 0;
    var W = 960;
    var rowH = 48;
    var margin = {top: 34, right: 55, bottom: 38, left: 200};
    var H = margin.top + methods.length * rowH + margin.bottom;
    var w = W - margin.left - margin.right;

    var allVals = [currentPrice];
    for (var i = 0; i < methods.length; i++) {
      allVals.push(methods[i].low, methods[i].high);
    }
    var xMin = Math.min.apply(null, allVals) * 0.9;
    var xMax = Math.max.apply(null, allVals) * 1.1;

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.fontFamily = FONT;
    svg.style.display = 'block';

    function xScale(v) {
      return margin.left + ((v - xMin) / (xMax - xMin)) * w;
    }

    // X-axis ticks
    var nTicks = 6;
    var xStep = (xMax - xMin) / nTicks;
    for (var t = 0; t <= nTicks; t++) {
      var xv = xMin + t * xStep;
      var tx = xScale(xv);
      var tick = document.createElementNS(ns, 'text');
      tick.setAttribute('x', tx);
      tick.setAttribute('y', H - margin.bottom + 20);
      tick.setAttribute('text-anchor', 'middle');
      tick.setAttribute('fill', '#6B8299');
      tick.setAttribute('font-size', '12');
      tick.textContent = '$' + Math.round(xv);
      svg.appendChild(tick);
    }

    // Current price line
    if (currentPrice) {
      var cpx = xScale(currentPrice);
      var cpLine = document.createElementNS(ns, 'line');
      cpLine.setAttribute('x1', cpx);
      cpLine.setAttribute('x2', cpx);
      cpLine.setAttribute('y1', margin.top - 5);
      cpLine.setAttribute('y2', H - margin.bottom);
      cpLine.setAttribute('stroke', _k('am'));
      cpLine.setAttribute('stroke-width', '1.5');
      cpLine.setAttribute('stroke-dasharray', '5,3');
      svg.appendChild(cpLine);

      var cpLabel = document.createElementNS(ns, 'text');
      cpLabel.setAttribute('x', cpx);
      cpLabel.setAttribute('y', margin.top - 10);
      cpLabel.setAttribute('text-anchor', 'middle');
      cpLabel.setAttribute('fill', _k('am'));
      cpLabel.setAttribute('font-size', '12');
      cpLabel.setAttribute('font-weight', '700');
      cpLabel.textContent = 'Current $' + currentPrice;
      svg.appendChild(cpLabel);
    }

    var barColors = [_k('d2'), _k('d3'), _k('d4'), _k('d5'), _k('d6')];

    for (var m = 0; m < methods.length; m++) {
      var method = methods[m];
      var cy = margin.top + m * rowH + rowH / 2;
      var bColor = barColors[m % barColors.length];

      // Method label
      var label = document.createElementNS(ns, 'text');
      label.setAttribute('x', margin.left - 14);
      label.setAttribute('y', cy + 5);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', _k('d1'));
      label.setAttribute('font-size', '13');
      label.setAttribute('font-weight', '600');
      label.textContent = method.label;
      svg.appendChild(label);

      // Range bar
      var x1 = xScale(method.low);
      var x2 = xScale(method.high);
      var rangeBar = document.createElementNS(ns, 'rect');
      rangeBar.setAttribute('x', x1);
      rangeBar.setAttribute('y', cy - 14);
      rangeBar.setAttribute('width', Math.max(6, x2 - x1));
      rangeBar.setAttribute('height', 28);
      rangeBar.setAttribute('rx', '5');
      rangeBar.setAttribute('fill', bColor);
      rangeBar.setAttribute('opacity', '0.22');
      svg.appendChild(rangeBar);

      // Darker inner bar (P25-P75 feel, using mid ± small range)
      var midSpread = (method.high - method.low) * 0.15;
      var innerX1 = xScale(method.mid - midSpread);
      var innerX2 = xScale(method.mid + midSpread);
      var innerBar = document.createElementNS(ns, 'rect');
      innerBar.setAttribute('x', innerX1);
      innerBar.setAttribute('y', cy - 11);
      innerBar.setAttribute('width', Math.max(6, innerX2 - innerX1));
      innerBar.setAttribute('height', 22);
      innerBar.setAttribute('rx', '4');
      innerBar.setAttribute('fill', bColor);
      innerBar.setAttribute('opacity', '0.55');
      svg.appendChild(innerBar);

      // Mid dot
      var midDot = document.createElementNS(ns, 'circle');
      midDot.setAttribute('cx', xScale(method.mid));
      midDot.setAttribute('cy', cy);
      midDot.setAttribute('r', '5');
      midDot.setAttribute('fill', bColor);
      svg.appendChild(midDot);

      // Low/High labels
      var lowLabel = document.createElementNS(ns, 'text');
      lowLabel.setAttribute('x', x1 - 6);
      lowLabel.setAttribute('y', cy + 5);
      lowLabel.setAttribute('text-anchor', 'end');
      lowLabel.setAttribute('fill', '#6B8299');
      lowLabel.setAttribute('font-size', '11');
      lowLabel.textContent = '$' + Math.round(method.low);
      svg.appendChild(lowLabel);

      var highLabel = document.createElementNS(ns, 'text');
      highLabel.setAttribute('x', x2 + 6);
      highLabel.setAttribute('y', cy + 5);
      highLabel.setAttribute('text-anchor', 'start');
      highLabel.setAttribute('fill', '#6B8299');
      highLabel.setAttribute('font-size', '11');
      highLabel.textContent = '$' + Math.round(method.high);
      svg.appendChild(highLabel);
    }

    container.appendChild(svg);
  }

  /* ═══ HEATMAP CHART ═══ */
  function renderHeatmap(containerId, config) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var rows = config.rows || [];
    var cols = config.cols || [];
    var values = config.values || [];
    if (rows.length === 0 || cols.length === 0) return;

    var highlight = config.highlight_value;
    var fmt = (config.options || {}).value_format || '$';
    var rect = container.getBoundingClientRect();
    var W = rect.width || 600;
    var cellW = Math.min(80, (W - 90) / (cols.length + 1));
    var cellH = 32;
    var labelW = 70;
    var headerH = 40;
    var H = headerH + rows.length * cellH + 20;

    // Find value range
    var allVals = [];
    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        if (typeof values[r][c] === 'number') allVals.push(values[r][c]);
      }
    }
    var vMin = Math.min.apply(null, allVals);
    var vMax = Math.max.apply(null, allVals);

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.fontFamily = FONT;

    // Color interpolation: low values = red-ish, high values = green-ish
    function cellColor(v) {
      if (vMax === vMin) return _k('d5');
      var t = (v - vMin) / (vMax - vMin);
      var rr = Math.round(197 - t * 171);
      var gg = Math.round(48 + t * 79);
      var bb = Math.round(48 + t * 42);
      return 'rgb(' + rr + ',' + gg + ',' + bb + ')';
    }

    // Column header label
    if (config.col_label) {
      var colHdr = document.createElementNS(ns, 'text');
      colHdr.setAttribute('x', labelW + (cols.length * cellW) / 2);
      colHdr.setAttribute('y', 12);
      colHdr.setAttribute('text-anchor', 'middle');
      colHdr.setAttribute('fill', _k('d1'));
      colHdr.setAttribute('font-size', '10');
      colHdr.setAttribute('font-weight', '700');
      colHdr.textContent = config.col_label;
      svg.appendChild(colHdr);
    }

    // Row header label
    if (config.row_label) {
      var rowHdr = document.createElementNS(ns, 'text');
      rowHdr.setAttribute('x', 8);
      rowHdr.setAttribute('y', headerH + (rows.length * cellH) / 2);
      rowHdr.setAttribute('text-anchor', 'middle');
      rowHdr.setAttribute('fill', _k('d1'));
      rowHdr.setAttribute('font-size', '10');
      rowHdr.setAttribute('font-weight', '700');
      rowHdr.setAttribute('transform', 'rotate(-90, 8, ' + (headerH + (rows.length * cellH) / 2) + ')');
      svg.appendChild(rowHdr);
    }

    // Column headers
    for (var ci = 0; ci < cols.length; ci++) {
      var chdr = document.createElementNS(ns, 'text');
      chdr.setAttribute('x', labelW + ci * cellW + cellW / 2);
      chdr.setAttribute('y', headerH - 6);
      chdr.setAttribute('text-anchor', 'middle');
      chdr.setAttribute('fill', '#6B8299');
      chdr.setAttribute('font-size', '10');
      chdr.setAttribute('font-weight', '600');
      chdr.textContent = cols[ci];
      svg.appendChild(chdr);
    }

    // Cells
    for (var ri = 0; ri < rows.length; ri++) {
      // Row label
      var rLabel = document.createElementNS(ns, 'text');
      rLabel.setAttribute('x', labelW - 6);
      rLabel.setAttribute('y', headerH + ri * cellH + cellH / 2 + 4);
      rLabel.setAttribute('text-anchor', 'end');
      rLabel.setAttribute('fill', '#6B8299');
      rLabel.setAttribute('font-size', '10');
      rLabel.setAttribute('font-weight', '600');
      rLabel.textContent = rows[ri];
      svg.appendChild(rLabel);

      for (var cj = 0; cj < cols.length; cj++) {
        var val = (values[ri] || [])[cj];
        if (val == null) continue;

        var cx = labelW + cj * cellW;
        var cy = headerH + ri * cellH;

        var cell = document.createElementNS(ns, 'rect');
        cell.setAttribute('x', cx + 1);
        cell.setAttribute('y', cy + 1);
        cell.setAttribute('width', cellW - 2);
        cell.setAttribute('height', cellH - 2);
        cell.setAttribute('rx', '3');
        cell.setAttribute('fill', cellColor(val));
        cell.setAttribute('opacity', '0.18');
        svg.appendChild(cell);

        // Highlight cell matching the base case
        var isHighlight = highlight != null && Math.abs(val - highlight) < 0.5;
        if (isHighlight) {
          var hlRect = document.createElementNS(ns, 'rect');
          hlRect.setAttribute('x', cx + 1);
          hlRect.setAttribute('y', cy + 1);
          hlRect.setAttribute('width', cellW - 2);
          hlRect.setAttribute('height', cellH - 2);
          hlRect.setAttribute('rx', '3');
          hlRect.setAttribute('fill', 'none');
          hlRect.setAttribute('stroke', _k('d2'));
          hlRect.setAttribute('stroke-width', '2');
          svg.appendChild(hlRect);
        }

        var cellText = document.createElementNS(ns, 'text');
        cellText.setAttribute('x', cx + cellW / 2);
        cellText.setAttribute('y', cy + cellH / 2 + 4);
        cellText.setAttribute('text-anchor', 'middle');
        cellText.setAttribute('fill', _k('d1'));
        cellText.setAttribute('font-size', '10');
        cellText.setAttribute('font-weight', isHighlight ? '700' : '500');
        cellText.textContent = _fmtVal(val, fmt);
        svg.appendChild(cellText);
      }
    }

    container.appendChild(svg);
  }

  /* ═══ TREEMAP CHART ═══ */
  function renderTreemap(containerId, config) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    var items = config.items || [];
    if (items.length === 0) return;

    var fmt = (config.options || {}).value_format || '';
    var rect = container.getBoundingClientRect();
    var W = rect.width || 600;
    var H = parseInt(config.height) || 280;

    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].value;

    // Simple squarified treemap using slice-and-dice
    var rects = _squarify(items, 0, 0, W, H);

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.fontFamily = FONT;

    var defaultColors = ['d1','d2','d3','d4','d5','d6','d7','d8'];

    for (var j = 0; j < rects.length; j++) {
      var r = rects[j];
      var item = items[j];
      var color = _k(item.color || defaultColors[j % defaultColors.length]);
      var pct = total > 0 ? (item.value / total * 100).toFixed(1) : '0';

      var tmRect = document.createElementNS(ns, 'rect');
      tmRect.setAttribute('x', r.x + 1.5);
      tmRect.setAttribute('y', r.y + 1.5);
      tmRect.setAttribute('width', Math.max(0, r.w - 3));
      tmRect.setAttribute('height', Math.max(0, r.h - 3));
      tmRect.setAttribute('rx', '4');
      tmRect.setAttribute('fill', color);
      tmRect.setAttribute('opacity', '0.15');
      svg.appendChild(tmRect);

      // Border
      var tmBorder = document.createElementNS(ns, 'rect');
      tmBorder.setAttribute('x', r.x + 1.5);
      tmBorder.setAttribute('y', r.y + 1.5);
      tmBorder.setAttribute('width', Math.max(0, r.w - 3));
      tmBorder.setAttribute('height', Math.max(0, r.h - 3));
      tmBorder.setAttribute('rx', '4');
      tmBorder.setAttribute('fill', 'none');
      tmBorder.setAttribute('stroke', color);
      tmBorder.setAttribute('stroke-width', '1.5');
      tmBorder.setAttribute('opacity', '0.4');
      svg.appendChild(tmBorder);

      // Labels only if cell is big enough
      if (r.w > 50 && r.h > 30) {
        var nameText = document.createElementNS(ns, 'text');
        nameText.setAttribute('x', r.x + 8);
        nameText.setAttribute('y', r.y + 18);
        nameText.setAttribute('fill', _k('d1'));
        nameText.setAttribute('font-size', r.w > 100 ? '12' : '10');
        nameText.setAttribute('font-weight', '700');
        nameText.textContent = item.label;
        svg.appendChild(nameText);

        if (r.h > 45) {
          var valText = document.createElementNS(ns, 'text');
          valText.setAttribute('x', r.x + 8);
          valText.setAttribute('y', r.y + 34);
          valText.setAttribute('fill', '#6B8299');
          valText.setAttribute('font-size', '10');
          valText.setAttribute('font-weight', '500');
          valText.textContent = _fmtVal(item.value, fmt) + ' (' + pct + '%)';
          svg.appendChild(valText);
        }
      }
    }

    container.appendChild(svg);
  }

  function _squarify(items, x, y, w, h) {
    if (items.length === 0) return [];
    if (items.length === 1) return [{x: x, y: y, w: w, h: h}];

    var total = 0;
    for (var i = 0; i < items.length; i++) total += items[i].value;
    if (total <= 0) return items.map(function() { return {x:x, y:y, w:0, h:0}; });

    // Split along the longer axis
    var horizontal = w >= h;
    var mid = 0;
    var sum = 0;
    var half = total / 2;
    for (mid = 0; mid < items.length - 1; mid++) {
      sum += items[mid].value;
      if (sum >= half) { mid++; break; }
    }
    if (mid === 0) mid = 1;

    var leftItems = items.slice(0, mid);
    var rightItems = items.slice(mid);
    var leftTotal = 0;
    for (var l = 0; l < leftItems.length; l++) leftTotal += leftItems[l].value;
    var ratio = leftTotal / total;

    var leftRects, rightRects;
    if (horizontal) {
      var splitW = w * ratio;
      leftRects = _squarify(leftItems, x, y, splitW, h);
      rightRects = _squarify(rightItems, x + splitW, y, w - splitW, h);
    } else {
      var splitH = h * ratio;
      leftRects = _squarify(leftItems, x, y, w, splitH);
      rightRects = _squarify(rightItems, x, y + splitH, w, h - splitH);
    }
    return leftRects.concat(rightRects);
  }

  /* ═══ SPARKLINES ═══ */
  function renderSparklines() {
    var els = document.querySelectorAll('[data-sparkline]');
    for (var i = 0; i < els.length; i++) {
      _renderOneSparkline(els[i]);
    }
  }

  function _renderOneSparkline(el) {
    var raw = el.getAttribute('data-sparkline');
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch(e) { return; }
    if (!Array.isArray(data) || data.length < 2) return;

    var w = 56, h = 18;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.style.display = 'block';
    svg.style.marginTop = '4px';

    var mn = Math.min.apply(null, data);
    var mx = Math.max.apply(null, data);
    var range = mx - mn || 1;
    var pad = 2;

    var points = [];
    for (var i = 0; i < data.length; i++) {
      var px = pad + (i / (data.length - 1)) * (w - 2 * pad);
      var py = h - pad - ((data[i] - mn) / range) * (h - 2 * pad);
      points.push(px.toFixed(1) + ',' + py.toFixed(1));
    }

    var trending = data[data.length - 1] >= data[0];
    var color = trending ? _k('gn') : _k('rd');

    var polyline = document.createElementNS(ns, 'polyline');
    polyline.setAttribute('points', points.join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', '1.5');
    polyline.setAttribute('stroke-linecap', 'round');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    // End dot
    var lastPt = points[points.length - 1].split(',');
    var dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', lastPt[0]);
    dot.setAttribute('cy', lastPt[1]);
    dot.setAttribute('r', '2');
    dot.setAttribute('fill', color);
    svg.appendChild(dot);

    el.appendChild(svg);
  }

  return {
    renderWaterfall: renderWaterfall,
    renderFootballField: renderFootballField,
    renderHeatmap: renderHeatmap,
    renderTreemap: renderTreemap,
    renderSparklines: renderSparklines
  };
})();
