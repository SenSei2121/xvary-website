/**
 * Time-based chapter timelines (labels from chapter.range).
 * Call window.initDemoTimeline() after #ch-* nodes exist (end of inline build).
 *
 * Mount: #demo-timeline-mount[data-variant="rail-spine|..."]
 */
(function () {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function jumpToChapter(n, e) {
    var el = document.getElementById('ch-' + n);
    if (el) {
      if (e) e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      try {
        history.replaceState(null, '', '#ch-' + n);
      } catch (err) { /* ignore */ }
    }
  }

  function bindJump(a, n) {
    a.addEventListener('click', function (e) {
      jumpToChapter(n, e);
    });
  }

  var renderers = {

    'rail-spine': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-rail-spine';
      nav.setAttribute('aria-label', 'chapter timeline by period');

      var track = document.createElement('div');
      track.className = 'tl-rail-spine-track';

      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var seg = document.createElement('a');
        seg.className = 'tl-rail-spine-seg' + (i > 0 ? ' tl-rail-spine-seg--split' : '');
        seg.href = '#ch-' + n;
        seg.setAttribute('title', ch.title);
        seg.innerHTML = '<span class="tl-rail-spine-dot" aria-hidden="true"></span>' +
          '<span class="tl-rail-spine-range">' + esc(ch.range) + '</span>';
        bindJump(seg, n);
        track.appendChild(seg);
      });

      nav.appendChild(track);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'magazine-rail': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-magazine-rail';
      nav.setAttribute('aria-label', 'period rail');
      var row = document.createElement('div');
      row.className = 'tl-magazine-rail-row';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var a = document.createElement('a');
        a.className = 'tl-magazine-pill';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.innerHTML = '<span class="tl-magazine-pill-range">' + esc(ch.range) + '</span>' +
          '<span class="tl-magazine-pill-title">' + esc(ch.title) + '</span>';
        bindJump(a, n);
        row.appendChild(a);
      });
      nav.appendChild(row);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'card-calendar': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-card-calendar';
      nav.setAttribute('aria-label', 'period chips');
      var row = document.createElement('div');
      row.className = 'tl-card-cal-row';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var a = document.createElement('a');
        a.className = 'tl-card-cal-chip';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.textContent = ch.range;
        bindJump(a, n);
        row.appendChild(a);
        if (i < R.chapters.length - 1) {
          var arr = document.createElement('span');
          arr.className = 'tl-card-cal-arr';
          arr.setAttribute('aria-hidden', 'true');
          arr.textContent = '→';
          row.appendChild(arr);
        }
      });
      nav.appendChild(row);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'newspaper-rule': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-newspaper-rule';
      nav.setAttribute('aria-label', 'dateline sequence');
      var inner = document.createElement('div');
      inner.className = 'tl-np-inner';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        if (i > 0) {
          var sep = document.createElement('span');
          sep.className = 'tl-np-sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '◆';
          inner.appendChild(sep);
        }
        var a = document.createElement('a');
        a.className = 'tl-np-link';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.textContent = ch.range;
        bindJump(a, n);
        inner.appendChild(a);
      });
      nav.appendChild(inner);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'terminal-trace': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-terminal-trace';
      nav.setAttribute('aria-label', 'trace log');
      var pre = document.createElement('div');
      pre.className = 'tl-term-body';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var line = document.createElement('a');
        line.className = 'tl-term-line';
        line.href = '#ch-' + n;
        line.setAttribute('title', ch.title);
        line.innerHTML = '<span class="tl-term-brkt">[</span><span class="tl-term-range">' + esc(ch.range) + '</span><span class="tl-term-brkt">]</span>' +
          (i < R.chapters.length - 1 ? ' <span class="tl-term-arrow">──→</span>' : '');
        bindJump(line, n);
        pre.appendChild(line);
      });
      nav.appendChild(pre);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'filmstrip': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-filmstrip';
      nav.setAttribute('aria-label', 'period tabs');
      var row = document.createElement('div');
      row.className = 'tl-film-row';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var a = document.createElement('a');
        a.className = 'tl-film-cell';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.innerHTML = '<span class="tl-film-range">' + esc(ch.range) + '</span><span class="tl-film-perf" aria-hidden="true"></span>';
        bindJump(a, n);
        row.appendChild(a);
      });
      nav.appendChild(row);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'zigzag-spine': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-zigzag';
      nav.setAttribute('aria-label', 'alternating timeline');
      var axis = document.createElement('div');
      axis.className = 'tl-zz-axis';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var row = document.createElement('div');
        row.className = 'tl-zz-row ' + (i % 2 === 0 ? 'tl-zz-row--up' : 'tl-zz-row--dn');
        var a = document.createElement('a');
        a.className = 'tl-zz-hit';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.innerHTML = '<span class="tl-zz-range">' + esc(ch.range) + '</span><span class="tl-zz-dot" aria-hidden="true"></span>';
        bindJump(a, n);
        row.appendChild(a);
        axis.appendChild(row);
      });
      nav.appendChild(axis);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'toc-spine': function (mount, R) {
      mount.classList.add('tl-mount--ghost');
      mount.setAttribute('aria-hidden', 'true');
      var list = document.getElementById('toc-list');
      if (!list) return;
      list.querySelectorAll('li').forEach(function (li, i) {
        var ch = R.chapters[i];
        if (!ch || li.querySelector('.tl-toc-spine-date')) return;
        var sp = document.createElement('span');
        sp.className = 'tl-toc-spine-date';
        sp.textContent = ch.range;
        li.insertBefore(sp, li.firstChild);
      });
      var aside = list.closest('.toc');
      if (aside && !aside.querySelector('.tl-toc-window-cap')) {
        var c = capEl(R);
        c.classList.add('tl-toc-window-cap');
        aside.appendChild(c);
      }
    },

    'ledger-marks': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-ledger';
      nav.setAttribute('aria-label', 'period ticks');
      var ticks = document.createElement('div');
      ticks.className = 'tl-ledger-ticks';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var t = document.createElement('div');
        t.className = 'tl-ledger-tick';
        var a = document.createElement('a');
        a.className = 'tl-ledger-a';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.innerHTML = '<span class="tl-ledger-mark" aria-hidden="true"></span><span class="tl-ledger-range">' + esc(ch.range) + '</span>';
        bindJump(a, n);
        t.appendChild(a);
        ticks.appendChild(t);
      });
      nav.appendChild(ticks);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    },

    'bento-meter': function (mount, R) {
      var nav = document.createElement('nav');
      nav.className = 'tl tl-meter';
      nav.setAttribute('aria-label', 'period meter');
      var strip = document.createElement('div');
      strip.className = 'tl-meter-strip';
      R.chapters.forEach(function (ch, i) {
        var n = i + 1;
        var a = document.createElement('a');
        a.className = 'tl-meter-seg';
        a.href = '#ch-' + n;
        a.setAttribute('title', ch.title);
        a.innerHTML = '<span class="tl-meter-fill"></span><span class="tl-meter-lbl">' + esc(ch.range) + '</span>';
        bindJump(a, n);
        strip.appendChild(a);
      });
      nav.appendChild(strip);
      mount.appendChild(nav);
      mount.appendChild(capEl(R));
    }
  };

  function capEl(R) {
    var cap = document.createElement('div');
    cap.className = 'tl-cap';
    cap.textContent = R.windowLabel || '';
    return cap;
  }

  window.initDemoTimeline = function () {
    var R = window.MR_DEMO_DATA;
    var mount = document.getElementById('demo-timeline-mount');
    if (!mount || !R || !R.chapters || !R.chapters.length) return;

    var variant = mount.getAttribute('data-variant') || 'rail-spine';
    mount.innerHTML = '';
    mount.className = 'demo-timeline-mount tl-mount-v--' + variant.replace(/[^a-z-]/g, '');

    var fn = renderers[variant] || renderers['rail-spine'];
    fn(mount, R);
  };
})();
