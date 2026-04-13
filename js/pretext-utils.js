/**
 * XVARY Pretext utilities — shared text measurement helpers.
 * Wraps @chenglou/pretext with site-specific typography configs.
 * Requires /js/vendor/pretext.js loaded first (exposes window.Pretext).
 */
;(function () {
  'use strict'

  var P = window.Pretext
  if (!P) {
    console.warn('[pretext-utils] window.Pretext not found — load vendor/pretext.js first')
    return
  }

  var _ready = false
  var _readyCallbacks = []
  var _preparedCache = new Map()
  var _chromeCache = {}

  // ── Resolve CSS clamp at current viewport ──
  function resolveClamp(min, vw, max) {
    var val = window.innerWidth * vw / 100
    return Math.max(min, Math.min(max, val))
  }

  // ── Font string builders (match CSS exactly) ──
  function rcardTickerFont() {
    var sz = Math.round(resolveClamp(30, 3.8, 52))
    return '700 ' + sz + 'px Space Grotesk'
  }
  function rcardTitleFont() { return '700 19px Space Grotesk' }
  function rcardDescFont() { return '14px Space Grotesk' }

  function pulseCardTitleFont(featured) {
    if (featured) {
      var sz = Math.round(resolveClamp(30, 5, 52))
      return '700 ' + sz + 'px Space Grotesk'
    }
    var sz2 = Math.round(resolveClamp(20, 2.2, 26))
    return '700 ' + sz2 + 'px Space Grotesk'
  }
  function pulseCardDeckFont(featured) {
    if (featured) {
      var sz = Math.round(resolveClamp(17, 2.2, 22))
      return sz + 'px Space Grotesk'
    }
    var sz2 = Math.round(resolveClamp(16, 1.5, 18))
    return sz2 + 'px Space Grotesk'
  }
  function pulseCardBodyFont(featured) {
    return (featured ? '17' : '16') + 'px Space Grotesk'
  }

  // ── Prepare + cache ──
  function cached(text, font) {
    var key = font + '||' + text
    var hit = _preparedCache.get(key)
    if (hit) return hit
    var p = P.prepare(text, font)
    _preparedCache.set(key, p)
    if (_preparedCache.size > 2000) {
      var iter = _preparedCache.keys()
      for (var j = 0; j < 500; j++) _preparedCache.delete(iter.next().value)
    }
    return p
  }

  function measureText(text, font, width, lineHeight) {
    if (!text) return 0
    var p = cached(text, font)
    var r = P.layout(p, width, lineHeight)
    return r.height
  }

  function measureTextLines(text, font, width, lineHeight, maxLines) {
    if (!text) return 0
    var p = cached(text, font)
    var r = P.layout(p, width, lineHeight)
    var lines = r.lineCount
    if (maxLines && lines > maxLines) lines = maxLines
    return lines * lineHeight
  }

  // ── Rcard (Stacks page) height ──
  // Fixed chrome: topline(~28) + heading-gap(18) + gauge(56+2+16=74 or row on mobile)
  //   + desc-pad(14) + signalbar(36+16=52) + card padding(top24+bot22=46, mobile 18*2=36)
  var RCARD_CHROME_DESKTOP = 46 + 28 + 18 + 52
  var RCARD_CHROME_MOBILE = 36 + 28 + 18 + 52

  function measureRcard(ticker, title, description, containerWidth) {
    var isMobile = window.innerWidth < 768
    var chrome = isMobile ? RCARD_CHROME_MOBILE : RCARD_CHROME_DESKTOP

    // Ticker height
    var tickerFont = rcardTickerFont()
    var tickerLh = Math.round(resolveClamp(30, 3.8, 52) * 0.88)
    var tickerH = measureText(ticker.toLowerCase(), tickerFont, containerWidth, tickerLh)

    // Title: single line usually, but measure anyway
    var titleW = isMobile ? containerWidth : containerWidth - 96 - 18
    var titleH = measureText(title.toLowerCase(), rcardTitleFont(), titleW, Math.round(19 * 1.12))

    // Description: clamped to 3 lines (5 on mobile)
    var maxDescLines = isMobile ? 5 : 3
    var descLh = Math.round(14 * 1.72)
    var descH = measureTextLines(description.toLowerCase(), rcardDescFont(), containerWidth, descLh, maxDescLines) + 14

    // Score gauge beside ticker on desktop, below on mobile
    var gaugeH = isMobile ? 56 + 12 : 0

    var total = chrome + tickerH + 8 + titleH + descH + gaugeH
    return Math.max(isMobile ? 0 : 288, Math.ceil(total))
  }

  // ── Pulse card height ──
  var PULSE_CHROME = 28 + 24 + 24 + 20 + 36 + 12

  function measurePulseCard(title, deck, body, containerWidth, isFeatured) {
    var cardPadW = containerWidth - 56

    var titleFont = pulseCardTitleFont(isFeatured)
    var titleLh = isFeatured ? Math.round(resolveClamp(30, 5, 52) * 0.96) : Math.round(resolveClamp(20, 2.2, 26) * 1.12)
    var titleH = measureText(title || '', titleFont, cardPadW, titleLh)

    var deckH = 0
    if (deck) {
      var deckFont = pulseCardDeckFont(isFeatured)
      var deckLh = Math.round((isFeatured ? resolveClamp(17, 2.2, 22) : resolveClamp(16, 1.5, 18)) * 1.38)
      deckH = measureText(deck, deckFont, cardPadW, deckLh) + 8
    }

    var bodyH = 0
    if (body) {
      var bodyFont = pulseCardBodyFont(isFeatured)
      var bodyLh = Math.round((isFeatured ? 17 : 16) * (isFeatured ? 1.65 : 1.6))
      bodyH = measureText(body, bodyFont, cardPadW, bodyLh) + 12
    }

    return Math.ceil(PULSE_CHROME + titleH + deckH + bodyH)
  }

  // ── Stable swap (CLS prevention) ──
  function stableSwap(el, newHTML, opts) {
    opts = opts || {}
    var duration = opts.duration || 200
    var oldH = el.offsetHeight
    el.style.minHeight = oldH + 'px'
    el.style.overflow = 'hidden'
    el.style.transition = 'min-height ' + duration + 'ms ease, opacity ' + duration + 'ms ease'

    el.style.opacity = '0.6'
    requestAnimationFrame(function () {
      el.innerHTML = newHTML
      requestAnimationFrame(function () {
        var newH = el.scrollHeight
        el.style.minHeight = newH + 'px'
        el.style.opacity = '1'
        setTimeout(function () {
          el.style.minHeight = ''
          el.style.overflow = ''
          el.style.transition = ''
        }, duration + 50)
      })
    })
  }

  // ── Font-ready init ──
  function onReady(cb) {
    if (_ready) { cb(); return }
    _readyCallbacks.push(cb)
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      _ready = true
      for (var i = 0; i < _readyCallbacks.length; i++) _readyCallbacks[i]()
      _readyCallbacks = []
    })
  } else {
    window.addEventListener('load', function () {
      _ready = true
      for (var i = 0; i < _readyCallbacks.length; i++) _readyCallbacks[i]()
      _readyCallbacks = []
    })
  }

  // ── Invalidate cache on significant resize (clamp-based fonts change) ──
  var _lastCacheWidth = window.innerWidth
  window.addEventListener('resize', function () {
    if (Math.abs(window.innerWidth - _lastCacheWidth) > 40) {
      _preparedCache.clear()
      _lastCacheWidth = window.innerWidth
    }
  })

  // ── Expose API ──
  window.PretextUtils = {
    resolveClamp: resolveClamp,
    measureText: measureText,
    measureTextLines: measureTextLines,
    measureRcard: measureRcard,
    measurePulseCard: measurePulseCard,
    stableSwap: stableSwap,
    onReady: onReady,
    clearCache: function () {
      _preparedCache.clear()
      P.clearCache()
    }
  }
})()
