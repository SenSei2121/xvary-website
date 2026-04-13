/* ═══════════════════════════════════════════════════════════
   Semper Signum — report-core.js
   Shared infrastructure for all generated reports.
   Contains: tab navigation, Chart.js defaults, canonical K palette,
   calculator engine, and glossary filter.

   This is the SINGLE SOURCE OF TRUTH for the K palette.
   Values match the CSS custom properties in dist/report.css exactly.
   ═══════════════════════════════════════════════════════════ */

/* ═══ NAVIGATION (SPATIAL + LEGACY TABS) ═══ */
function _paneElementFromId(id) {
  if (!id) return null;
  if (id.indexOf('p-') === 0) return document.getElementById(id);
  return document.getElementById('p-' + id) || document.getElementById(id);
}

function _setSpatialActive(id) {
  var paneId = id && id.indexOf('p-') === 0 ? id : ('p-' + id);
  document.querySelectorAll('.js-nav a[href^="#"]').forEach(function(a) {
    var on = a.getAttribute('href') === '#' + paneId;
    a.classList.toggle('active', on);
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

function _goSpatial(id) {
  var paneId = id && id.indexOf('p-') === 0 ? id : ('p-' + id);
  var el = _paneElementFromId(paneId);
  if (!el) return false;
  if (history.replaceState) history.replaceState(null, '', '#' + paneId);
  else location.hash = paneId;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  _setSpatialActive(paneId);
  setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 80);
  return true;
}

function _goTabbed(id, btn) {
  document.querySelectorAll('.pane').forEach(function(p) { p.classList.remove('on'); });
  document.querySelectorAll('.tb').forEach(function(b) { b.classList.remove('on'); });
  var el = _paneElementFromId(id);
  if (el) el.classList.add('on');
  if (btn && btn.classList && btn.classList.contains('tb')) {
    btn.classList.add('on');
  } else {
    document.querySelectorAll('.tb').forEach(function(b) {
      var onclick = b.getAttribute('onclick') || '';
      if (onclick.indexOf("'" + id + "'") >= 0) b.classList.add('on');
    });
  }
  window.scrollTo({ top: 0 });
  setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 60);
}

function go(id, btn) {
  if (document.querySelector('.dd-sidebar') || document.body.classList.contains('dd-spatial-v06')) {
    if (_goSpatial(id)) return;
  }
  _goTabbed(id, btn);
}

function showPane(id, btn) {
  go(id, btn);
}

/* ═══ CANONICAL K PALETTE ═══ */
/* Matches report.css --chart-1 through --chart-8, semantic, and grays */
var K = {
  /* Blue ramp (data series differentiation) */
  d1: '#051C2C',  /* --chart-1 (ink) */
  d2: '#2251FF',  /* --chart-2 (accent) */
  d3: '#2563EB',  /* --chart-3 */
  d4: '#4A90D9',  /* --chart-4 (accent-light) */
  d5: '#7EBCE6',  /* --chart-5 */
  d6: '#A0B4C8',  /* --chart-6 */
  d7: '#C5D5E4',  /* --chart-7 */
  d8: '#D4DDE5',  /* --chart-8 (ink-08) */
  /* Semantic */
  gn: '#1A7F5A',  /* --positive */
  rd: '#C53030',  /* --negative */
  am: '#B7791F',  /* --caution */
  /* Grays (neutral/baseline) */
  g1: '#374151',  /* --chart-gray-1 */
  g2: '#6B7280',  /* --chart-gray-2 */
  g3: '#9CA3AF'   /* --chart-gray-3 */
};

/* ═══ CHART.JS DEFAULTS ═══ */
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#6B8299';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 12;
  Chart.defaults.plugins.legend.labels.font = { size: 10.5, weight: 500 };
  Chart.defaults.plugins.tooltip.backgroundColor = '#051C2C';
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 4;
  Chart.defaults.elements.line.tension = 0.3;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.point.radius = 4;
  Chart.defaults.elements.point.hoverRadius = 7;
  Chart.defaults.elements.bar.borderRadius = 4;
}

/* Shared chart helpers */
var grd = { color: 'rgba(0,0,0,0.06)' };
var ng = { display: false };

/* ═══ CALCULATOR ENGINE ═══ */
function calcUpdate(calcId) {
  var box = document.getElementById('calc-' + calcId);
  if (!box) return;
  var formula = box.getAttribute('data-formula') || 'weighted_average';
  if (formula === 'scenario_weight' || formula === 'scenario_weighting') {
    formula = 'weighted_average';
  }
  var sliders = box.querySelectorAll('input[type="range"]');
  var outputs = box.querySelectorAll('.calc-outputs [data-calc-output="true"]');

  /* Update displayed slider values */
  sliders.forEach(function(s) {
    var valEl = document.getElementById(s.id + '-val');
    if (valEl) valEl.textContent = s.value;
  });

  if (formula === 'weighted_average') {
    calcWeightedAverage(sliders, outputs, box);
  } else if (formula === 'sensitivity') {
    calcSensitivity(sliders, outputs, box);
  }
}

function calcWeightedAverage(sliders, outputs, box) {
  /* Normalize weights to sum to 100 */
  var total = 0;
  var items = [];
  sliders.forEach(function(s) {
    var w = parseFloat(s.value) || 0;
    var scenarioValue = s.getAttribute('data-scenario-value') || '';
    var numVal = parseFloat(scenarioValue.replace(/[^0-9.\-]/g, '')) || 0;
    /* Extract scenario price from label text: "AI Winter ($80)" → 80 */
    if (!numVal) {
      var label = s.previousElementSibling ? s.previousElementSibling.textContent : '';
      var priceMatch = label.match(/\$([0-9,.]+)/);
      numVal = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
    }
    /* Final fallback to numeric data-value-label */
    if (!numVal) {
      var vl = s.getAttribute('data-value-label') || '0';
      numVal = parseFloat(vl.replace(/[^0-9.\-]/g, '')) || 0;
    }
    total += w;
    items.push({ weight: w, value: numVal });
  });

  /* Update total indicator */
  var totalEl = box.querySelector('[id$="-total"]');
  if (totalEl) {
    totalEl.textContent = 'Total: ' + total + '%';
    totalEl.style.color = total === 100 ? 'var(--positive)' : 'var(--negative)';
  }

  if (total === 0) total = 1;
  var weighted = 0;
  items.forEach(function(it) {
    weighted += (it.weight / total) * it.value;
  });

  /* Find current price from the page header (.pr in interactive, .cv-metric-value in PDF) */
  var priceEl = document.querySelector('.pr');
  if (!priceEl) {
    document.querySelectorAll('.cv-metric-label').forEach(function(lbl) {
      if (!priceEl && lbl.textContent.indexOf('Current Price') >= 0) {
        priceEl = lbl.parentElement && lbl.parentElement.querySelector('.cv-metric-value');
      }
    });
  }
  var currentPrice = 0;
  if (priceEl) {
    currentPrice = parseFloat(priceEl.textContent.replace(/[^0-9.\-]/g, '')) || 0;
  }

  var upside = currentPrice > 0 ? ((weighted / currentPrice) - 1) * 100 : 0;
  var sharesB = parseFloat(box.getAttribute('data-shares') || '0');
  var impliedMcap = sharesB > 0 ? (weighted * sharesB) / 1e3 : 0;
  var downProb = 0, upProb = 0;
  items.forEach(function(it, i) {
    if (it.value < currentPrice) downProb += items[i].weight;
    else upProb += items[i].weight;
  });

  outputs.forEach(function(o) {
    var fmt = o.getAttribute('data-format');
    var oid = o.id || '';
    if (fmt === 'dollar') {
      o.textContent = '$' + Math.round(weighted);
    } else if (fmt === 'percent') {
      o.textContent = (upside >= 0 ? '+' : '') + Math.round(upside) + '%';
    } else if (fmt === 'market_cap') {
      o.textContent = impliedMcap >= 1
        ? '$' + impliedMcap.toFixed(1) + 'T'
        : '$' + Math.round(impliedMcap * 1000) + 'B';
    } else if (fmt === 'down_prob') {
      o.textContent = downProb + '%';
    } else if (fmt === 'up_prob') {
      o.textContent = upProb + '%';
    } else {
      o.textContent = weighted.toFixed(2);
    }
  });
}

/* ═══ CALCULATOR RESET ═══ */
function calcReset(calcId) {
  var box = document.querySelector('[data-calc-id="' + calcId + '"]');
  if (!box) return;
  box.querySelectorAll('input[type="range"]').forEach(function(s) {
    var def = s.getAttribute('data-default');
    if (def !== null) s.value = def;
  });
  calcUpdate(calcId);
}

function calcSensitivity(sliders, outputs, box) {
  var baseTam = parseFloat(box.getAttribute('data-base-tam') || '0');
  var currentRevenue = parseFloat(box.getAttribute('data-current-revenue') || '0');
  var vals = {};
  sliders.forEach(function(s) {
    vals[s.id] = parseFloat(s.value) || 0;
  });

  if (baseTam > 0) {
    var samRatio = (vals['tam-sam'] || 0) / 100;
    var somRatio = (vals['tam-som'] || 0) / 100;
    var penetration = (vals['tam-pen'] || 0) / 100;
    var share = (vals['tam-share'] || 0) / 100;
    var growthFactor = 1 + ((vals['tam-growth'] || 0) / 100);
    var aspFactor = (vals['tam-asp'] || 100) / 100;
    var unitFactor = (vals['tam-units'] || 100) / 100;
    var recurringFactor = 0.65 + ((vals['tam-recurring'] || 0) / 100) * 0.7;
    var cycleFactor = 0.6 + ((vals['tam-cycles'] || 0) / 100) * 0.8;
    var margin = (vals['tam-margin'] || 0) / 100;

    var effectiveTam = baseTam * samRatio * growthFactor * cycleFactor;
    var revenuePotential = effectiveTam * share * penetration * (0.5 + somRatio) * aspFactor * unitFactor * recurringFactor;
    var ebitPotential = revenuePotential * margin;
    var capturePct = baseTam > 0 ? (revenuePotential / baseTam) * 100 : 0;

    var totalEl = box.querySelector('[id$="-total"]');
    if (totalEl) {
      totalEl.textContent = currentRevenue > 0
        ? 'Revenue opportunity: ' + Math.round((revenuePotential / currentRevenue) * 100) + '% of current revenue'
        : 'TAM capture: ' + capturePct.toFixed(1) + '%';
      totalEl.style.color = 'var(--accent)';
    }

    outputs.forEach(function(o) {
      var metric = o.getAttribute('data-metric') || '';
      var fmt = o.getAttribute('data-format') || 'number';
      var value = revenuePotential;
      if (metric === 'effective_tam') {
        value = effectiveTam;
      } else if (metric === 'ebit_opportunity') {
        value = ebitPotential;
      } else if (metric === 'tam_capture_pct') {
        value = capturePct;
      }
      if (fmt === 'dollar') {
        o.textContent = '$' + Math.round(value).toLocaleString();
      } else if (fmt === 'percent') {
        o.textContent = value.toFixed(1) + '%';
      } else {
        o.textContent = value.toFixed(2);
      }
    });
    return;
  }

  var result = 1;
  sliders.forEach(function(s) {
    result *= (parseFloat(s.value) || 100) / 100;
  });
  outputs.forEach(function(o) {
    var fmt = o.getAttribute('data-format');
    if (fmt === 'dollar') {
      o.textContent = '$' + result.toFixed(2);
    } else if (fmt === 'percent') {
      o.textContent = ((result - 1) * 100).toFixed(1) + '%';
    } else {
      o.textContent = result.toFixed(2);
    }
  });
}

/* ═══ GLOSSARY FILTER ═══ */
function filterGloss(q) {
  if (!q) q = '';
  q = q.toLowerCase();
  var items = document.querySelectorAll('.gloss-item');
  var cats = document.querySelectorAll('.gloss-cat');
  if (!q) {
    items.forEach(function(i) { i.style.display = ''; });
    cats.forEach(function(c) { c.style.display = ''; });
    return;
  }
  var catVis = new Map();
  cats.forEach(function(c) { catVis.set(c, false); });
  items.forEach(function(i) {
    var match = i.textContent.toLowerCase().indexOf(q) >= 0;
    i.style.display = match ? '' : 'none';
    if (match) {
      /* Find preceding category header */
      var prev = i.previousElementSibling;
      while (prev && !prev.classList.contains('gloss-cat')) prev = prev.previousElementSibling;
      if (prev) catVis.set(prev, true);
    }
  });
  cats.forEach(function(c) { c.style.display = catVis.get(c) ? '' : 'none'; });
}
/* Legacy alias */
function filterGlossary() {
  var q = (document.getElementById('gloss-q') || {}).value || '';
  filterGloss(q);
}

/* ═══ SPATIAL-06 HELPERS ═══ */
function _isTypingTarget(target) {
  if (!target || !target.closest) return false;
  return !!target.closest('input, textarea, select, [contenteditable="true"]');
}

function _spatialPaneIds() {
  if (Array.isArray(window.XVARY_PANE_IDS) && window.XVARY_PANE_IDS.length) {
    return window.XVARY_PANE_IDS.slice();
  }
  return Array.from(document.querySelectorAll('.pane[id^="p-"]')).map(function(el) {
    return el.id;
  });
}

function _spatialHotkeyMap(paneIds) {
  if (window.XVARY_HOTKEY_MAP && typeof window.XVARY_HOTKEY_MAP === 'object') {
    return window.XVARY_HOTKEY_MAP;
  }
  var keys = '1234567890abcdefghijklmnopqrstuvwxyz'.split('');
  var map = {};
  paneIds.forEach(function(id, idx) {
    if (idx < keys.length) map[keys[idx]] = id;
  });
  return map;
}

function _initReadingProgress() {
  var bar = document.getElementById('reading-progress');
  if (!bar) return;
  var update = function() {
    var h = document.documentElement;
    var denom = Math.max(h.scrollHeight - h.clientHeight, 1);
    var pct = (h.scrollTop / denom) * 100;
    bar.style.width = Math.min(Math.max(pct, 0), 100) + '%';
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function _initSpatialScrollSpy(paneIds) {
  var links = Array.from(document.querySelectorAll('.js-nav a[href^="#"]'));
  if (!links.length || !paneIds.length || typeof IntersectionObserver === 'undefined') return;

  var sections = paneIds
    .map(function(id) { return document.getElementById(id); })
    .filter(Boolean);
  if (!sections.length) return;

  var setActive = function(id) {
    _setSpatialActive(id);
  };

  var obs = new IntersectionObserver(function(entries) {
    entries.sort(function(a, b) { return b.intersectionRatio - a.intersectionRatio; });
    var hit = entries.find(function(entry) {
      return entry.isIntersecting && entry.intersectionRatio > 0.12;
    });
    if (hit) setActive(hit.target.id);
  }, { rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.12, 0.25, 0.45] });

  sections.forEach(function(el) { obs.observe(el); });
  links.forEach(function(a) {
    a.addEventListener('click', function() {
      setActive(a.getAttribute('href').slice(1));
    });
  });
}

function _initSpatialHotkeys(paneIds) {
  if (!paneIds.length) return;
  var hotkeyMap = _spatialHotkeyMap(paneIds);

  function keyToHotkey(e) {
    if (e.metaKey || e.ctrlKey) return null;
    var k = e.key;
    if (k.length === 1) k = k.toLowerCase();
    if (hotkeyMap[k] != null) return k;
    if (e.altKey && e.code && e.code.indexOf('Digit') === 0) {
      var d = e.code.replace('Digit', '');
      if (hotkeyMap[d] != null) return d;
    }
    if (e.altKey && e.code && e.code.indexOf('Key') === 0) {
      var L = e.code.replace('Key', '').toLowerCase();
      if (hotkeyMap[L] != null) return L;
    }
    return null;
  }

  document.addEventListener('keydown', function(e) {
    if (_isTypingTarget(e.target)) return;
    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault();
      var help = document.getElementById('kbd-help');
      if (help) help.hidden = !help.hidden;
      return;
    }
    if (e.key === 'Escape') {
      var openHelp = document.getElementById('kbd-help');
      if (openHelp && !openHelp.hidden) {
        openHelp.hidden = true;
        e.preventDefault();
      }
      return;
    }
    var hk = keyToHotkey(e);
    if (!hk || !hotkeyMap[hk]) return;
    e.preventDefault();
    go(hotkeyMap[hk]);
  });
}

function _initSpatialNav() {
  if (!document.querySelector('.dd-sidebar') && !document.body.classList.contains('dd-spatial-v06')) {
    return;
  }
  var paneIds = _spatialPaneIds();
  if (!paneIds.length) return;
  _initReadingProgress();
  _initSpatialScrollSpy(paneIds);
  _initSpatialHotkeys(paneIds);
  _setSpatialActive(paneIds[0]);
}

/* ═══ INIT ON LOAD ═══ */
function _initCalcs() {
  document.querySelectorAll('.calc-box').forEach(function(box) {
    var calcId = box.getAttribute('data-calc-id');
    if (calcId) calcUpdate(calcId);
  });
}

function _initReportCore() {
  _initCalcs();
  _initSpatialNav();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initReportCore);
} else {
  _initReportCore();
}
