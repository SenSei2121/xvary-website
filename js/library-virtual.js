/**
 * library-virtual.js — True virtual scroll for Stacks card view.
 *
 * Replaces the paginated "load more" card rendering with a windowed
 * virtual scroll that keeps only ~30-50 DOM nodes regardless of dataset
 * size. Uses actual DOM measurements for stable scroll geometry.
 *
 * Architecture: creates a sibling container (#library-grid-virtual) and
 * collapses the original #library-grid so library-page.js can keep writing
 * to it without visual conflict. Hooks directly into filter/sort/search
 * controls for independent data processing.
 *
 * Requires: /js/vendor/pretext.js + /js/pretext-utils.js loaded first.
 * Must load AFTER library-page.js.
 */
;(function () {
  'use strict'

  var PU = window.PretextUtils
  if (!PU) return

  var origGrid = document.getElementById('library-grid')
  var loadMoreWrap = document.getElementById('library-load-more-wrap')
  if (!origGrid) return

  // ── Helpers (match library-page.js rendering) ──

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  function escAttr(s) { return esc(s).replace(/`/g, '&#96;') }
  function trunc(s, n) { var t = String(s || ''); return t.length <= n ? t : t.slice(0, n - 1) + '\u2026' }
  function num(v, d) { if (v == null || v === '') return d; var n = Number(v); return Number.isFinite(n) ? n : d }

  function parseUpside(v) {
    var m = String(v || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/)
    return m ? Number(m[0]) : -99999
  }
  function parseMarketCap(v) {
    var m = String(v || '').trim().replace(/[$~,]/g, '').match(/(-?\d+(\.\d+)?)([TMBK]?)/i)
    if (!m) return -1
    var n = Number(m[1]), u = (m[3] || '').toUpperCase()
    return n * (u === 'T' ? 1e12 : u === 'B' ? 1e9 : u === 'M' ? 1e6 : u === 'K' ? 1e3 : 1)
  }
  function healthRank(v) {
    var t = String(v || '').trim().toUpperCase()
    if (!t || t === 'N/A') return -1
    var c = t.charAt(0)
    return 10 * (c === 'A' ? 5 : c === 'B' ? 4 : c === 'C' ? 3 : c === 'D' ? 2 : c === 'F' ? 1 : 0)
      + (t.match(/\+/g) || []).length - (t.match(/-/g) || []).length
  }
  function fmtDate(d) {
    if (!d) return 'unknown'
    var dt = new Date(d)
    return Number.isFinite(dt.getTime())
      ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()
      : String(d).toLowerCase()
  }
  function posClass(p) { return p === 'hold' ? 'neutral' : p }
  function moveClass(n, p) { return n <= -99999 ? posClass(p) : n < 0 ? 'short' : n > 0 ? 'long' : posClass(p) }
  function isNew(d) {
    if (!d) return false
    var t = Date.parse(d)
    return Number.isFinite(t) && t >= Date.now() - 604800000
  }

  // ── Data processing ──

  function processRaw(raw) {
    if (!Array.isArray(raw)) return []
    var compMap = {}
    raw.forEach(function (r) {
      var tk = String(r && r.ticker || '').toUpperCase()
      var cs = num(r && r.composite_score, -1)
      if (tk && cs >= 0 && !compMap[tk]) compMap[tk] = cs
    })

    var items = raw.map(function (r) {
      var type = r.type === 'snapshot' ? 'snapshot' : 'report'
      var sortDate = r.publishedAt || r.updated || ''
      var posLower = String(r.position || 'Neutral').toLowerCase()
      var cs = num(r.composite_score, -1)
      if (cs < 0) {
        var tk = String(r.ticker || '').toUpperCase()
        if (compMap[tk] >= 0) cs = compMap[tk]
        else { var cv = num(r.conviction, -1); if (cv >= 0) cs = 10 * cv }
      }
      return {
        ticker: String(r.ticker || ''), tickerLower: String(r.ticker || '').toLowerCase(),
        name: String(r.name || r.title || r.ticker || ''),
        nameLower: String(r.name || r.title || r.ticker || '').toLowerCase(),
        sector: String(r.sector || 'Unknown'),
        sectorLower: String(r.sector || 'Unknown').toLowerCase(),
        positionLower: posLower,
        positionRank: posLower === 'long' ? 3 : (posLower === 'neutral' || posLower === 'hold') ? 2 : posLower === 'short' ? 1 : 0,
        compositeScore: cs, effectiveScore: cs,
        upside: String(r.upside || r.target_upside || ''),
        upsideNumber: parseUpside(r.target_upside || r.upside),
        description: String(type === 'snapshot' ? (r.oneliner || r.verdict || r.summary || '') : (r.verdict || r.summary || r.oneliner || '')),
        sortDate: sortDate, url: String(r.url || '#'), type: type,
        ungated: !!r.ungated, newItem: isNew(sortDate),
        healthRank: healthRank(r.health_score),
        marketCapValue: parseMarketCap(r.market_cap)
      }
    })

    var snapTickers = {}
    items.forEach(function (it) { if (it.type === 'snapshot') snapTickers[it.tickerLower] = true })
    var extras = []
    items.forEach(function (it) {
      if (it.type === 'report' && !snapTickers[it.tickerLower]) {
        var cl = {}; for (var k in it) if (Object.prototype.hasOwnProperty.call(it, k)) cl[k] = it[k]
        cl.type = 'snapshot'; cl.url = '/stock/' + it.tickerLower + '/snapshot/'
        extras.push(cl)
      }
    })
    return items.concat(extras)
  }

  function filterData(items, filter, query) {
    var q = (query || '').toLowerCase()
    return items.filter(function (it) {
      var ok = filter === 'all' ||
        (filter === 'report' ? it.type === 'report' :
         filter === 'snapshot' ? it.type === 'snapshot' :
         filter === 'long' || filter === 'short' ? it.positionLower === filter :
         filter === 'neutral' ? (it.positionLower === 'neutral' || it.positionLower === 'hold') :
         it.sector === filter)
      if (!ok) return false
      return !q || it.tickerLower.indexOf(q) >= 0 || it.nameLower.indexOf(q) >= 0 || it.sectorLower.indexOf(q) >= 0
    })
  }

  function nc(a, b) { return (a || 0) - (b || 0) }
  function sc(a, b) { return String(a || '').localeCompare(String(b || '')) }

  function sortData(items, key) {
    return items.slice().sort(function (a, b) {
      if (key === 'upside') return nc(b.upsideNumber, a.upsideNumber) || nc(b.effectiveScore, a.effectiveScore) || sc(a.ticker, b.ticker)
      if (key === 'alphabetical') return sc(a.ticker, b.ticker)
      if (key === 'sector') return sc(a.sector, b.sector) || sc(a.ticker, b.ticker)
      if (key === 'health') return nc(b.healthRank, a.healthRank) || nc(b.effectiveScore, a.effectiveScore) || sc(a.ticker, b.ticker)
      if (key === 'updated') return sc(b.sortDate, a.sortDate) || nc(b.effectiveScore, a.effectiveScore) || sc(a.ticker, b.ticker)
      if (key === 'marketCap') return nc(b.marketCapValue, a.marketCapValue) || nc(b.effectiveScore, a.effectiveScore) || sc(a.ticker, b.ticker)
      if (key === 'position') return nc(b.positionRank, a.positionRank) || nc(b.effectiveScore, a.effectiveScore) || sc(a.ticker, b.ticker)
      return nc(b.effectiveScore, a.effectiveScore) || sc(b.sortDate, a.sortDate) || sc(a.ticker, b.ticker)
    })
  }

  function sectionize(items, filter, key) {
    if (filter === 'all') {
      var reports = items.filter(function (it) { return it.type === 'report' })
      var snaps = items.filter(function (it) { return it.type === 'snapshot' })
      if (key === 'alphabetical' || key === 'sector') {
        var out = []
        if (reports.length) out.push({ title: 'deep dives', items: reports })
        return out.concat(groupBySector(snaps, key))
      }
      var res = []
      if (reports.length) res.push({ title: 'deep dives', items: reports })
      if (snaps.length) res.push({ title: 'snapshots', items: snaps })
      return res
    }
    if (key === 'alphabetical' || key === 'sector') return groupBySector(items, key)
    return [{ title: filter === 'report' ? 'deep dives' : (filter === 'snapshot' ? 'snapshots' : filter), items: items }]
  }

  function groupBySector(items, subsort) {
    var map = {}
    items.forEach(function (it) { if (!map[it.sector]) map[it.sector] = []; map[it.sector].push(it) })
    return Object.keys(map).sort().map(function (s) {
      return { title: s.toLowerCase(), items: subsort === 'sector' ? sortData(map[s], 'alphabetical') : map[s] }
    })
  }

  // ── Card HTML ──

  function gaugeHTML(item) {
    var s = item.compositeScore >= 0 ? Math.min(100, Math.max(0, item.compositeScore)) : 0
    var arc = 100.53, off = (arc * (1 - s / 100)).toFixed(2)
    return '<div class="rcard-gauge"><svg viewBox="0 0 80 48">'
      + '<path class="gauge-track" d="M 8,44 A 32,32 0 0,1 72,44"/>'
      + '<path class="gauge-fill" d="M 8,44 A 32,32 0 0,1 72,44" stroke-dasharray="' + arc + '" stroke-dashoffset="' + off + '"/>'
      + '</svg><span class="gauge-number">' + s + '</span></div>'
  }

  function cardHTML(it) {
    var title = trunc((it.name || it.ticker).toLowerCase(), 72)
    var desc = trunc(it.description.toLowerCase(), 160)
    var over = it.type === 'report' ? 'deep dive / ' + it.sectorLower : 'snapshot / ' + it.sectorLower
    var badges = ''
    if (it.newItem) badges += '<span class="library-badge library-badge--new">new</span>'
    if (it.type === 'report' && it.ungated) badges += '<span class="library-badge library-badge--free">free</span>'
    if (it.type === 'report') badges += '<span class="library-badge library-badge--report">deep dive</span>'
    var co = title.toLowerCase() !== it.name.toLowerCase()
      ? '<div class="rcard-co">' + esc(it.name.toLowerCase()) + '</div>' : ''

    return '<a class="rcard' + (it.type === 'report' ? ' rcard--report' : '') + '"'
      + ' href="' + escAttr(it.url) + '" data-card-link'
      + ' data-ticker="' + escAttr(it.ticker) + '" data-type="' + escAttr(it.type) + '">'
      + '<div class="rcard-main"><div class="rcard-topline">'
      + '<div class="rcard-overline">' + esc(over) + '</div>'
      + '<div class="rcard-badges">' + badges + '</div></div>'
      + '<div class="rcard-heading"><div class="rcard-ident">'
      + '<div class="rcard-ticker">' + esc(it.ticker.toLowerCase()) + '</div>'
      + '<div class="rcard-title">' + esc(title) + '</div>' + co + '</div>'
      + '<div class="rcard-score">' + gaugeHTML(it)
      + '<div class="rcard-score-copy">'
      + '<span class="rcard-score-label">composite</span>'
      + '<span class="rcard-score-value">' + esc(it.compositeScore >= 0 ? Math.round(it.compositeScore) + '/100' : 'n/a') + '</span>'
      + '</div></div></div>'
      + '<div class="rcard-v">' + esc(desc) + '</div>'
      + '<div class="rcard-signalbar">'
      + '<div class="rcard-pos ' + esc(posClass(it.positionLower)) + '">' + esc(it.positionLower) + '</div>'
      + '<div class="rcard-move ' + esc(moveClass(it.upsideNumber, it.positionLower)) + '">' + esc(it.upside || 'n/a') + '</div>'
      + '<div class="rcard-date">updated ' + esc(fmtDate(it.sortDate)) + '</div>'
      + '</div></div></a>'
  }

  function sectionHeaderHTML(title, items) {
    var scores = items.map(function (it) { return it.effectiveScore }).filter(function (s) { return s >= 0 })
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b }, 0) / scores.length) : -1
    var sub = items.length + ' names \u00b7 avg composite: ' + (avg >= 0 ? avg : 'n/a')
    return '<div class="library-section-head"><div class="sec-label">' + esc(title)
      + '</div><div class="library-section-meta">' + esc(sub) + '</div></div>'
  }

  // ── Virtual scroll engine ──

  var _allData = []
  var _vItems = []
  var _heights = []
  var _positions = []
  var _totalH = 0
  var _cols = 2
  var _gap = 20
  var _vGrid = null
  var _spacer = null
  var _pool = []
  var _lastS = -1
  var _lastE = -1
  var _active = false
  var _rafId = 0
  var BUFFER = 800

  function getViewMode() {
    var btn = document.querySelector('[data-view-toggle].active')
    return btn ? btn.getAttribute('data-view-toggle') : 'cards'
  }

  function readUI() {
    var s = document.getElementById('lib-sort')
    var q = document.getElementById('lib-search')
    var f = document.querySelector('.fb.active')
    return {
      sort: s ? s.value : 'composite',
      query: q ? q.value : '',
      filter: f ? (f.dataset.filter || 'all') : 'all'
    }
  }

  function buildItems() {
    var ui = readUI()
    var filtered = filterData(_allData, ui.filter, ui.query)
    var sorted = sortData(filtered, ui.sort)
    var sections = sectionize(sorted, ui.filter, ui.sort)

    _vItems = []
    var totalCards = 0
    sections.forEach(function (sec) {
      _vItems.push({ type: 'header', html: sectionHeaderHTML(sec.title, sec.items) })
      sec.items.forEach(function (it) {
        _vItems.push({ type: 'card', html: cardHTML(it) })
        totalCards++
      })
    })
    _vItems.push({
      type: 'meta',
      html: '<div class="library-results-meta">' + totalCards + ' of ' + totalCards + ' shown</div>'
    })
    return totalCards
  }

  function measureAll() {
    if (!_vGrid) return
    var cW = _vGrid.offsetWidth
    _cols = window.innerWidth > 900 ? 2 : 1
    _gap = Math.max(16, Math.min(28, window.innerWidth * 0.022))
    var cardW = _cols > 1 ? (cW - _gap * (_cols - 1)) / _cols : cW

    _heights = []
    var frag = document.createElement('div')
    frag.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0'
    document.body.appendChild(frag)

    for (var i = 0; i < _vItems.length; i++) {
      frag.style.width = (_vItems[i].type === 'card' ? cardW : cW) + 'px'
      frag.innerHTML = _vItems[i].html
      _heights.push(frag.firstElementChild ? frag.firstElementChild.offsetHeight : 40)
    }
    document.body.removeChild(frag)
  }

  function computePositions() {
    if (!_vGrid) return
    var cW = _vGrid.offsetWidth
    _cols = window.innerWidth > 900 ? 2 : 1
    _gap = Math.max(16, Math.min(28, window.innerWidth * 0.022))
    var cardW = _cols > 1 ? (cW - _gap * (_cols - 1)) / _cols : cW

    _positions = []
    var colH = []
    for (var c = 0; c < _cols; c++) colH.push(0)

    for (var i = 0; i < _vItems.length; i++) {
      var h = _heights[i] || 40
      if (_vItems[i].type !== 'card') {
        var mx = Math.max.apply(null, colH)
        _positions.push({ y: mx, col: 0, w: cW, h: h, span: _cols })
        for (var c2 = 0; c2 < _cols; c2++) colH[c2] = mx + h + (_gap * 0.6)
      } else {
        var sh = 0
        for (var c3 = 1; c3 < _cols; c3++) { if (colH[c3] < colH[sh]) sh = c3 }
        _positions.push({ y: colH[sh], col: sh, w: cardW, h: h, span: 1 })
        colH[sh] += h + _gap
      }
    }
    _totalH = Math.max.apply(null, colH) || 0
    if (_spacer) _spacer.style.height = _totalH + 'px'
  }

  function renderWindow() {
    if (!_spacer || !_vGrid) return

    var st = window.scrollY
    var rect = _vGrid.getBoundingClientRect()
    var cTop = rect.top + st
    var vTop = st - cTop - BUFFER
    var vBot = st - cTop + window.innerHeight + BUFFER

    var start = 0
    for (var i = 0; i < _positions.length; i++) {
      if (_positions[i].y + _positions[i].h >= vTop) { start = i; break }
    }
    var end = _positions.length
    for (var j = start; j < _positions.length; j++) {
      if (_positions[j].y > vBot) { end = j; break }
    }

    if (start === _lastS && end === _lastE) return
    _lastS = start; _lastE = end

    var need = end - start
    while (_pool.length < need) {
      var nd = document.createElement('div')
      nd.style.position = 'absolute'
      nd.style.boxSizing = 'border-box'
      _spacer.appendChild(nd)
      _pool.push(nd)
    }

    var used = 0
    for (var k = start; k < end; k++) {
      var p = _positions[k], el = _pool[used]
      el.style.top = p.y + 'px'
      el.style.width = p.span > 1 ? '100%' : p.w + 'px'
      el.style.left = p.span > 1 ? '0' : (p.col * (p.w + _gap)) + 'px'
      el.innerHTML = _vItems[k].html
      el.hidden = false
      if (_entranceObs) observePoolNode(el)
      used++
    }
    for (var m = used; m < _pool.length; m++) _pool[m].hidden = true
  }

  function onScroll() {
    if (!_rafId) {
      _rafId = requestAnimationFrame(function () { _rafId = 0; renderWindow() })
    }
  }

  // ── Viewport entrance animations ──

  var _entranceObs = null

  function setupEntranceObserver() {
    if (_entranceObs) _entranceObs.disconnect()
    if (!('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    _entranceObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        var el = entry.target
        el.classList.remove('vcard-enter')
        el.classList.add('vcard-visible')
        var gauges = el.querySelectorAll('.gauge-init')
        for (var i = 0; i < gauges.length; i++) gauges[i].classList.remove('gauge-init')
        _entranceObs.unobserve(el)
      })
    }, { threshold: 0.05 })
  }

  function observePoolNode(el) {
    if (!_entranceObs) return
    el.classList.add('vcard-enter')
    var gauges = el.querySelectorAll('.rcard-gauge')
    for (var i = 0; i < gauges.length; i++) gauges[i].classList.add('gauge-init')
    _entranceObs.observe(el)
  }

  // ── Lifecycle ──

  var _liveRegion = null

  function createLiveRegion() {
    _liveRegion = document.createElement('div')
    _liveRegion.setAttribute('role', 'status')
    _liveRegion.setAttribute('aria-live', 'polite')
    _liveRegion.setAttribute('aria-atomic', 'true')
    _liveRegion.className = 'sr-only'
    document.body.appendChild(_liveRegion)
  }

  function announceResults(count) {
    if (!_liveRegion) createLiveRegion()
    _liveRegion.textContent = count + ' results shown'
  }

  function createVGrid() {
    _vGrid = document.createElement('div')
    _vGrid.className = 'grid'
    _vGrid.id = 'library-grid-virtual'
    _vGrid.style.position = 'relative'
    _vGrid.setAttribute('role', 'feed')
    _vGrid.setAttribute('aria-label', 'Stock research cards')
    origGrid.parentNode.insertBefore(_vGrid, origGrid.nextSibling)

    _spacer = document.createElement('div')
    _spacer.style.position = 'relative'
    _spacer.style.width = '100%'
    _vGrid.appendChild(_spacer)

    attachHoverPreview(_vGrid)
  }

  // ── Hover preview (mirrors library-page.js tooltip) ──

  function attachHoverPreview(container) {
    var tooltip = document.getElementById('library-hover-preview')
    if (!tooltip) return

    var hoverEl = null
    var hoverTimer = 0

    function findItem(ticker) {
      return _allData.find(function (it) { return it.ticker === ticker })
    }

    function previewHTML(it) {
      var cs = it.compositeScore >= 0 ? Math.round(it.compositeScore) + '/100' : 'n/a'
      return '<div class="library-preview-head">'
        + '<div class="library-preview-ticker">' + esc(it.ticker.toLowerCase()) + '</div>'
        + '<div class="library-preview-tags"><span>' + esc(it.type) + '</span>'
        + '<span>' + esc(it.sectorLower) + '</span></div></div>'
        + '<div class="library-preview-grid">'
        + cell('composite', cs)
        + cell('position', it.positionLower)
        + cell('upside', it.upside || 'n/a')
        + cell('sector', it.sectorLower)
        + '</div>'
    }

    function cell(label, val) {
      return '<div class="library-preview-cell"><span>' + esc(label)
        + '</span><strong>' + esc(String(val || 'n/a').toLowerCase()) + '</strong></div>'
    }

    function positionTooltip(x, y) {
      var r = tooltip.getBoundingClientRect()
      var left = x + 18, top = y + 18
      if (left + r.width > window.innerWidth - 18) left = x - r.width - 18
      if (top + r.height > window.innerHeight - 18) top = y - r.height - 18
      tooltip.style.left = Math.max(18, left) + 'px'
      tooltip.style.top = Math.max(18, top) + 'px'
    }

    container.addEventListener('mouseover', function (e) {
      if (window.innerWidth < 768) return
      var card = e.target.closest('[data-ticker]')
      if (!card || card === hoverEl) return
      hoverEl = card
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(function () {
        var tk = card.getAttribute('data-ticker') || ''
        var it = findItem(tk)
        if (it) {
          tooltip.innerHTML = previewHTML(it)
          tooltip.hidden = false
          tooltip.style.position = 'fixed'
          tooltip.style.zIndex = '200'
        }
      }, 180)
    })

    container.addEventListener('mouseout', function (e) {
      var card = e.target.closest('[data-ticker]')
      if (card && e.relatedTarget && card.contains(e.relatedTarget)) return
      hoverEl = null
      clearTimeout(hoverTimer)
      tooltip.hidden = true
    })

    container.addEventListener('mousemove', function (e) {
      if (!tooltip.hidden) positionTooltip(e.clientX, e.clientY)
    })

    container.addEventListener('click', function (e) {
      var card = e.target.closest('[data-card-link]')
      if (card && typeof window.plausible === 'function') {
        window.plausible('Library Card Click', {
          props: { ticker: card.getAttribute('data-ticker') || 'unknown', view: 'cards' }
        })
      }
    })
  }

  function collapseOrigGrid() {
    origGrid.style.cssText = 'position:absolute !important;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;clip:rect(0,0,0,0)'
  }

  function restoreOrigGrid() {
    origGrid.style.cssText = ''
  }

  function activate() {
    if (getViewMode() !== 'cards') return
    var total = buildItems()

    if (!total) {
      if (_vGrid) _vGrid.hidden = true
      restoreOrigGrid()
      announceResults(0)
      return
    }

    if (!_vGrid) createVGrid()
    _vGrid.hidden = false
    _vGrid.setAttribute('aria-busy', 'true')
    collapseOrigGrid()

    while (_spacer && _spacer.childNodes.length > 0) _spacer.removeChild(_spacer.lastChild)
    _pool = []
    _lastS = -1
    _lastE = -1
    _active = true

    setupEntranceObserver()
    measureAll()
    computePositions()
    renderWindow()

    _vGrid.setAttribute('aria-busy', 'false')
    announceResults(total)

    window.addEventListener('scroll', onScroll, { passive: true })
    if (loadMoreWrap) loadMoreWrap.hidden = true
  }

  function deactivate() {
    _active = false
    window.removeEventListener('scroll', onScroll)
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0 }
    if (_vGrid) _vGrid.hidden = true
    restoreOrigGrid()
    _pool = []
  }

  function refresh() {
    if (!_active) { activate(); return }
    if (_vGrid) _vGrid.setAttribute('aria-busy', 'true')
    var total = buildItems()
    if (!total) { deactivate(); announceResults(0); return }
    while (_spacer && _spacer.childNodes.length > 0) _spacer.removeChild(_spacer.lastChild)
    _pool = []
    _lastS = -1
    _lastE = -1
    measureAll()
    computePositions()
    renderWindow()
    if (_vGrid) _vGrid.setAttribute('aria-busy', 'false')
    announceResults(total)
  }

  // ── Control hooks ──

  function hookControls() {
    var sortEl = document.getElementById('lib-sort')
    var searchEl = document.getElementById('lib-search')
    var filterBox = document.getElementById('filters')

    if (sortEl) sortEl.addEventListener('change', function () { if (_active) requestAnimationFrame(refresh) })
    if (searchEl) {
      var _st = null
      searchEl.addEventListener('input', function () {
        if (!_active) return
        clearTimeout(_st)
        _st = setTimeout(refresh, 120)
      })
    }
    if (filterBox) {
      filterBox.addEventListener('click', function (e) {
        if (e.target.closest('.fb') && _active) setTimeout(refresh, 0)
      })
    }

    document.querySelectorAll('[data-view-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-view-toggle')
        if (m === 'cards' && !_active) requestAnimationFrame(activate)
        else if (m === 'table' && _active) deactivate()
      })
    })
  }

  // ── Resize ──

  var _rt = null, _lw = window.innerWidth
  window.addEventListener('resize', function () {
    if (!_active) return
    if (Math.abs(window.innerWidth - _lw) < 40) return
    _lw = window.innerWidth
    clearTimeout(_rt)
    _rt = setTimeout(refresh, 150)
  }, { passive: true })

  // ── Init ──

  function init() {
    if (loadMoreWrap) loadMoreWrap.hidden = true
    _allData = processRaw(window.XVARY_LIBRARY_DATA)
    hookControls()

    if (getViewMode() === 'cards') {
      requestAnimationFrame(activate)
    }
  }

  PU.onReady(function () {
    if (window.XVARY_LIBRARY_READY || Array.isArray(window.XVARY_LIBRARY_DATA)) {
      requestAnimationFrame(init)
    } else {
      var done = false
      var handler = function () {
        if (done) return; done = true
        document.removeEventListener('xvary-library-ready', handler)
        window.removeEventListener('xvary-library-ready', handler)
        requestAnimationFrame(init)
      }
      document.addEventListener('xvary-library-ready', handler)
      window.addEventListener('xvary-library-ready', handler)
    }
  })
})()
