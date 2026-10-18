/* Replaces the Webflow Interactions (IX2) runtime. */
(function () {
  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  // Category filter: pill buttons, several can be active; a project stays
  // if it belongs to any of the selected categories (or).
  var selected = [];
  var header = document.querySelector('.navigation-copy');
  if (document.querySelector('.cat-pills')) {
    body.classList.add('has-pills');
    var setHeaderH = function () { body.style.setProperty('--header-h', header.offsetHeight + 'px'); };
    setHeaderH();
    window.addEventListener('resize', setHeaderH);
  }
  // the filters sit right under the statement «I visualize.» and stick to the window edge once scrolled past
  var pillBar = document.querySelector('.cat-pills'), pillHome = document.querySelector('.grid-statement');
  if (false && pillBar && pillHome) {   // switched off: the filters stay fixed at the top (desktop) / bottom (phones) again
    var slot = document.createElement('span'); slot.className = 'cat-pills-slot';
    pillHome.appendChild(slot); slot.appendChild(pillBar);
    body.classList.add('pills-inline');
    var pillPinned = false;
    var stick = function () {
      var r = slot.getBoundingClientRect(), mob = window.innerWidth < 768;
      // phones: always at the bottom, as before; desktop: at the top once scrolled past, or while a filter is chosen
      if (selected.length) pillPinned = true;   // once a filter was chosen, the row stays up top, also after «All» again
      var out = mob ? true : r.top < 16 || pillPinned;
      var stuck = pillBar.classList.contains('is-stuck');
      if (out === stuck) return;
      var bs = [].slice.call(pillBar.querySelectorAll('.cat-pill')), was = bs.map(function (x) { return x.getBoundingClientRect(); });
      if (out) { slot.style.height = pillBar.offsetHeight + 'px'; body.appendChild(pillBar); pillBar.classList.add('is-stuck'); }   // on the page itself: moving parents would carry it along
      else { pillBar.classList.remove('is-stuck'); slot.appendChild(pillBar); slot.style.height = ''; }
      if (mob || reduce || Math.abs(r.top - 16) < 4) return;
      // every filter floats to its new place on its own, slowly and at its own pace, like bubbles rising
      bs.forEach(function (x, i) {
        var now = x.getBoundingClientRect(), dx = was[i].left - now.left, dy = was[i].top - now.top;
        var dur = 0.55 + Math.random() * 0.3, delay = Math.random() * 0.1;   // a little out of step, but quick
        x.style.transition = 'none';
        x.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
        void x.offsetWidth;
        x.style.transition = 'transform ' + dur.toFixed(2) + 's cubic-bezier(.3,.7,.3,1) ' + delay.toFixed(2) + 's, scale .2s ease';
        x.style.transform = '';
        setTimeout(function () { x.style.transition = ''; }, (dur + delay) * 1000 + 50);
      });
    };
    window.pillStick = stick;
    window.addEventListener('scroll', stick, { passive: true });
    window.addEventListener('resize', stick);
    setInterval(stick, 400);   // the bubbles move the statement while they settle
    stick();
  }
  var pills = document.querySelectorAll('.cat-pill[data-cat]');
  var reset = document.querySelector('.cat-pill--reset');
  function applyFilter(animate) {
    pills.forEach(function (p) {
      var on = selected.indexOf(p.dataset.cat) > -1;
      p.classList.toggle('is-active', on);
      p.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (reset) reset.hidden = !selected.length;
    body.classList.toggle('has-filter', selected.length > 0);
    var hits = 0;
    var all = [].slice.call(document.querySelectorAll('.pingrid'));
    all.forEach(function (t) {
      var cats = (t.dataset.cats || '').split(' ');
      var match = !selected.length || selected.some(function (k) { return cats.indexOf(k) > -1; });
      t.classList.toggle('is-out', !match);
      if (match && !t.hasAttribute('data-duplicate')) hits++;
    });
    var empty = document.querySelector('.cat-empty');
    var showEmpty = function () { if (empty) empty.hidden = !(selected.length && !hits); };

    var apply = function () {
      all.forEach(function (t) { t.classList.toggle('is-gone', t.classList.contains('is-out')); });
      if (relayout) relayout();
      showEmpty();
    };
    if (!animate || reduce) { apply(); return; }
    // 1. bubbles that no longer fit close their frame (the picture inside keeps its size) …
    var token = applyFilter.token = (applyFilter.token || 0) + 1;
    var leaving = all.filter(function (t) { return !t.classList.contains('is-gone') && t.classList.contains('is-out'); });
    leaving.forEach(function (t) { shrinkPebble(t, 0, 220, 'in'); });
    setTimeout(function () {
      if (token !== applyFilter.token) return;   // a newer click took over
      // 2. … the ones still needed slide over to their new places …
      var before = new Map();
      all.forEach(function (t) {
        if (!t.classList.contains('is-gone')) before.set(t, t.getBoundingClientRect());
        t.style.removeProperty('translate'); t.style.removeProperty('transition');
      });
      var entering = all.filter(function (t) { return t.classList.contains('is-gone') && !t.classList.contains('is-out'); });
      apply();
      all.forEach(function (t) {
        var a = before.get(t);
        if (!a || t.classList.contains('is-gone')) return;
        var b = t.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        t.style.setProperty('transition', 'none', 'important');
        t.style.setProperty('translate', dx + 'px ' + dy + 'px', 'important');
        void t.offsetWidth;
        t.style.setProperty('transition', 'translate .75s cubic-bezier(.65,0,.35,1), transform .6s cubic-bezier(.34,1.4,.64,1), scale .4s ease', 'important');
        t.style.setProperty('translate', '0px 0px', 'important');
        clearTimeout(t._flipTimer);
        t._flipTimer = setTimeout(function () { t.style.removeProperty('translate'); t.style.removeProperty('transition'); }, 800);
      });
      // 3. … and bubbles that come back open up in their spot
      entering.forEach(function (t) {
        if (!t._morph) return;
        t._morph.shrink = 0;
        shrinkPebble(t, 1, 300, 'pop');
      });
    }, leaving.length ? 230 : 0);
  }
  // animate a pebble's outline size (1 = full, 0 = closed); drawn by the morph loop below
  function shrinkPebble(t, to, dur, kind) {
    var m = t._morph;
    if (!m) return;
    m.shrinkAnim = { from: m.shrink == null ? 1 : m.shrink, to: to, start: performance.now(), dur: dur, kind: kind };
  }
  var relayout = null;
  // The statement between the bubbles changes with the filter (last chosen category wins)
  document.body.classList.add('pills-top');   // filters sit at the top
  var STATEMENTS = {
    '': 'I visualize',
    tbm: 'Get things moving.',
    info: 'Data treasure hunting.',
    id: 'Where consistency meets variety.',
    foto: 'Put moments in focus.',
    illu: 'Bringing any idea to life.',
    interaktion: 'Remember, the user is always right.'
  };
  // the letters of the statement are written one by one, like typing
  var stmtShown = null, popRaf = 0, popIv = 0;
  var popLetters = function (chars) {
    cancelAnimationFrame(popRaf);
    if (reduce || !chars.length) return;
    var t0 = performance.now(), STEP = 70, DUR = 520, H = 0;
    var back = function (x) { var c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };   // overshoots a little
    var frame = function (now) {
      var prev = 0, done = true;
      chars.forEach(function (t, i) {
        var x = Math.max(0, Math.min(1, (now - t0 - i * STEP) / DUR));
        if (x < 1) done = false;
        t.style.fillOpacity = Math.min(1, x * 6).toFixed(2);   // typed: each letter simply appears, one after the other
      });
      if (done) { popRaf = 0; clearInterval(popIv); } else if (popRaf !== -1) popRaf = requestAnimationFrame(frame);
    };
    chars.forEach(function (t) { t.style.fillOpacity = '0'; });
    clearInterval(popIv);
    popIv = setInterval(function () { if (popRaf) frame(performance.now()); }, 60);   // keeps going where animation frames are paused
    popRaf = requestAnimationFrame(frame);
    setTimeout(function () { if (popRaf) { chars.forEach(function (t) { t.removeAttribute('dy'); t.style.fillOpacity = ''; }); } }, chars.length * STEP + DUR + 1500);   // safety: never leave letters hidden
  };
  // «Illustration»: the letters are drawn as outlines first, then filled
  var drawLetters = function (chars) {
    cancelAnimationFrame(popRaf);
    if (reduce) return;
    chars.forEach(function (t, i) {
      t.classList.remove('is-drawn'); void t.getBBox;
      t.style.animationDelay = (i * 60) + 'ms, ' + (i * 60 + 800) + 'ms';
      t.classList.add('is-drawn');
    });
    clearTimeout(drawLetters.t); drawLetters.t = setTimeout(function () { chars.forEach(function (t) { t.classList.remove('is-drawn'); }); }, chars.length * 60 + 1700);   // never left half drawn
  };
  // hovering the statement: the letter under the pointer grows a little, its neighbours a bit less (like a soft magnifier)
  (function () {
    var st = document.querySelector('.grid-statement');
    if (!st || reduce || !window.matchMedia('(hover: hover)').matches) return;
    var mx = null, cur = [], raf = 0;
    var loop = function () {
      raf = 0;
      var spans = [].slice.call(st.querySelectorAll('tspan')), moving = false;
      if (cur.length !== spans.length) cur = spans.map(function () { return 1; });
      spans.forEach(function (t, i) {
        var focus = false, want = 1;   // (the photography focus effect is switched off)
        if (mx !== null && document.body.dataset.stmt !== 'foto') {   // «Focusing moments.»: no hover effect at all
          var b = t.getBoundingClientRect();
          if (b.width) {
            var d = Math.abs(b.left + b.width / 2 - mx) / (focus ? 46 : 34), g = Math.exp(-d * d);
            want = focus ? 1 - g : 1 + 0.22 * g;   // «Photography»: 0 = sharp under the pointer, 1 = blurred further away
          }
        } else if (focus) want = 0;
        cur[i] += (want - cur[i]) * 0.18;
        if (Math.abs(want - cur[i]) > 0.002) moving = true;
        if (focus) {
          t.style.fontSize = '';
          var bl = Math.max(0, cur[i] - 0.05);
          t.style.fillOpacity = bl < 0.02 ? '' : (1 - bl * 0.85).toFixed(2);
          t.style.textShadow = bl < 0.02 ? '' : '0 0 ' + (bl * 9).toFixed(1) + 'px rgba(17,17,17,' + (bl * 0.9).toFixed(2) + ')';
        } else {
          t.style.fillOpacity = ''; t.style.textShadow = '';
          t.style.fontSize = Math.abs(cur[i] - 1) < 0.002 ? '' : (cur[i] * 100).toFixed(1) + '%';
        }
      });
      if (moving) raf = requestAnimationFrame(loop);
    };
    var kick = function () { if (!raf) raf = requestAnimationFrame(loop); };
    st.addEventListener('mousemove', function (e) { if (e.target.closest('.cat-pills')) { mx = null; } else mx = e.clientX; kick(); });
    st.addEventListener('mouseleave', function () { mx = null; kick(); });
  })();
  // «Photography»: the statement comes into focus, from blurred to sharp, like a lens finding it
  var focusLetters = function () {
    cancelAnimationFrame(popRaf);
    var svg = document.querySelector('.grid-statement__svg');
    if (reduce || !svg) return;
    svg.classList.remove('is-focusing'); void svg.getBoundingClientRect();
    svg.classList.add('is-focusing');
    clearTimeout(focusLetters.t); focusLetters.t = setTimeout(function () { svg.classList.remove('is-focusing'); }, 1100);   // never stays blurred
  };
  // «Motion»: the letters whoosh in from the left one by one – the one with the longest way (the last) sets off first
  var zipLetters = function (chars) {
    cancelAnimationFrame(popRaf);
    if (reduce || !chars.length) return;
    var t0 = performance.now(), STEP = 45, DUR = 650, D = 420, n = chars.length;
    var back = function (x) { var c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
    var frame = function (now) {
      var prev = 0, done = true;
      chars.forEach(function (t, i) {
        var x = Math.max(0, Math.min(1, (now - t0 - (n - 1 - i) * STEP) / DUR));
        if (x < 1) done = false;
        var off = -D * (1 - back(x));   // from far left, a small overshoot to the right, then settles
        if (i && chars[i - 1].parentNode !== t.parentNode) prev = 0;   // every line starts afresh
        t.setAttribute('dx', (off - prev).toFixed(2)); prev = off;
        t.style.fillOpacity = Math.min(1, x * 3).toFixed(2);
      });
      if (done) { popRaf = 0; clearInterval(popIv); chars.forEach(function (t) { t.removeAttribute('dx'); }); }
      else if (popRaf !== -1) popRaf = requestAnimationFrame(frame);
    };
    chars.forEach(function (t) { t.style.fillOpacity = '0'; });
    clearInterval(popIv);
    popIv = setInterval(function () { if (popRaf) frame(performance.now()); }, 60);
    popRaf = requestAnimationFrame(frame);
  };
  // the letters bubble up where they stand: each grows from nothing, a little wobbly, like the bubbles do
  var growLetters = function (chars) {
    cancelAnimationFrame(popRaf);
    if (reduce || !chars.length) return;
    var t0 = performance.now(), DUR = 700;
    var delays = chars.map(function (c, i) { return i * 18 + Math.random() * 220; });
    var wob = function (x) { return 1 - Math.cos(x * Math.PI * 2.2) * Math.exp(-5 * x); };   // grows, overshoots, settles
    var frame = function (now) {
      var done = true;
      chars.forEach(function (t, i) {
        var x = Math.max(0, Math.min(1, (now - t0 - delays[i]) / DUR));
        if (x < 1) done = false;
        t.style.fontSize = x >= 1 ? '' : (Math.max(0.01, wob(x)) * 100).toFixed(1) + '%';
        t.style.fillOpacity = x >= 1 ? '' : Math.min(1, x * 4).toFixed(2);
      });
      if (done) { popRaf = 0; clearInterval(popIv); } else popRaf = requestAnimationFrame(frame);
    };
    chars.forEach(function (t) { t.style.fillOpacity = '0'; t.style.fontSize = '1%'; });
    clearInterval(popIv);
    popIv = setInterval(function () { if (popRaf) frame(performance.now()); }, 60);
    popRaf = requestAnimationFrame(frame);
  };
  // the statement comes in softly out of a blur – the letters only very slightly out of step, no growing, no wobble
  var blurInLetters = function (chars) {
    cancelAnimationFrame(popRaf);
    if (reduce || !chars.length) return;
    var t0 = performance.now(), DUR = 900;
    var delays = chars.map(function () { return Math.random() * 160; });
    var frame = function (now) {
      var done = true;
      chars.forEach(function (t, i) {
        var x = Math.max(0, Math.min(1, (now - t0 - delays[i]) / DUR)), e = 1 - Math.pow(1 - x, 3);
        if (x < 1) done = false;
        t.style.fillOpacity = x >= 1 ? '' : e.toFixed(2);
        t.style.textShadow = x >= 1 ? '' : '0 0 ' + (10 * (1 - e)).toFixed(1) + 'px rgba(17,17,17,' + (0.6 * (1 - e)).toFixed(2) + ')';
      });
      if (done) { popRaf = 0; clearInterval(popIv); } else popRaf = requestAnimationFrame(frame);
    };
    chars.forEach(function (t) { t.style.fillOpacity = '0'; t.style.fontSize = ''; });
    clearInterval(popIv);
    popIv = setInterval(function () { if (popRaf) frame(performance.now()); }, 60);
    popRaf = requestAnimationFrame(frame);
  };
  // «Photography»: the sentence slowly comes from blurred into focus
  var pullFocus = function () {
    var svg = document.querySelector('.grid-statement__svg');
    if (reduce || !svg) return;
    svg.classList.remove('is-pulling', 'is-focusing'); void svg.getBoundingClientRect();
    svg.classList.add('is-pulling');
    clearTimeout(pullFocus.t); pullFocus.t = setTimeout(function () { svg.classList.remove('is-pulling'); }, 3300);
  };
  // «Interaction»: first «Remember,» – then, after a short pause, the rest of the sentence
  var rememberFirst = function (chars) {
    focusLetters();
    if (reduce) return;
    var firstLine = chars.length && chars[0].parentNode, rest = chars.filter(function (t) { return t.parentNode !== firstLine; });
    rest.forEach(function (t) { t.style.transition = 'none'; t.style.fillOpacity = '0'; });
    clearTimeout(rememberFirst.t);
    rememberFirst.t = setTimeout(function () {
      rest.forEach(function (t) { t.style.transition = 'fill-opacity .7s ease'; t.style.fillOpacity = '1'; });
      setTimeout(function () { rest.forEach(function (t) { t.style.transition = ''; t.style.fillOpacity = ''; }); }, 800);
    }, 1100);
  };
  // «Data Viz»: the letters turn up one by one in random order, like finds
  var scatterLetters = function (chars) {
    if (reduce || !chars.length) return;
    clearTimeout(scatterLetters.t);
    chars.forEach(function (t) {
      t.style.transition = 'none'; t.style.fillOpacity = '0';
      var d = Math.random() * 1300;
      setTimeout(function () { t.style.transition = 'fill-opacity .25s ease'; t.style.fillOpacity = '1'; }, d);
    });
    scatterLetters.t = setTimeout(function () { chars.forEach(function (t) { t.style.transition = ''; t.style.fillOpacity = ''; }); }, 1700);
  };
  // «Motion»: opens like the others, just with a bit more bounce
  var bouncier = function () {
    var svg = document.querySelector('.grid-statement__svg');
    if (reduce || !svg) return;
    svg.classList.remove('is-focusing', 'is-bouncy'); void svg.getBoundingClientRect();
    svg.classList.add('is-bouncy');
    clearTimeout(bouncier.t); bouncier.t = setTimeout(function () { svg.classList.remove('is-bouncy'); }, 1500);
  };
  // «Identity»: only ever one letter is off – it is nudged into place (sometimes a touch too far, then back),
  // a short stop, then the next letter somewhere else in the sentence
  var kernIntoPlace = function (chars) {
    clearTimeout(kernIntoPlace.t);
    focusLetters();
    if (reduce || !chars.length) return;
    var cand = chars.map(function (t, i) { return i && chars[i - 1].parentNode === t.parentNode && t.textContent !== ' ' ? i : -1; }).filter(function (i) { return i > -1; });
    var picks = cand.sort(function () { return Math.random() - .5; }).slice(0, Math.min(4, cand.length));
    var queue = [];
    picks.forEach(function (k) {
      var o = (Math.random() < .5 ? -1 : 1) * (8 + Math.random() * 6);
      var path = Math.random() < .5 ? [o, o * .5, -o * .25, 0] : [o, o * .55, o * .2, 0];   // sometimes a little past, then back
      path.forEach(function (v, n) { queue.push({ k: k, v: v, wait: n === path.length - 1 ? 380 : 170 }); });
    });
    var run = function () {
      var q = queue.shift();
      if (!q) return;
      chars.forEach(function (t, i) { if (i === q.k && q.v) t.setAttribute('dx', q.v.toFixed(1)); else t.removeAttribute('dx'); });
      kernIntoPlace.t = setTimeout(run, q.wait);
    };
    kernIntoPlace.t = setTimeout(run, 500);
  };
  var setStatement = function () {
    var p = document.querySelector('.grid-statement');
    if (!p) return;
    var txt = STATEMENTS[selected.length ? selected[selected.length - 1] : ''] || STATEMENTS[''];
    // long sentences get three lines (bigger type), short ones two of similar length
    // without a filter: one big line «I visualise» and the topics small underneath
    var sub = p.querySelector('.grid-statement__sub');
    if (!sub) { sub = document.createElement('span'); sub.className = 'grid-statement__sub'; p.appendChild(sub); }
    var subTxt = selected.length ? '' : 'Interaction · Data Viz · Motion · Identity · Photography · Illustration';
    sub.classList.remove('is-leaving');
    var fitSub = function () {   // the topic line on one line if it fits at a still readable size, otherwise it wraps
      sub.style.fontSize = ''; sub.style.whiteSpace = 'nowrap';
      var w = sub.clientWidth, sw = sub.scrollWidth;
      if (!w || sw <= w) return;
      var fs = parseFloat(getComputedStyle(sub).fontSize) * w / sw * 0.98;
      if (fs >= 9.5) sub.style.fontSize = fs.toFixed(2) + 'px'; else sub.style.whiteSpace = '';
    };
    setTimeout(fitSub, 0);
    if (sub.textContent !== subTxt) {
      sub.textContent = subTxt;
      if (subTxt && stmtShown !== null && !reduce) {   // the topic line opens together with the statement
        sub.classList.remove('is-focusing'); void sub.offsetWidth; sub.classList.add('is-focusing');
        setTimeout(function () { sub.classList.remove('is-focusing'); }, 1100);
      }
    }
    var nLines = txt.length > 30 ? 3 : 2, words = txt.split(' ');   // longer sentences on three lines, so all can be bigger
    var split = function (n) {
      if (n === 2) {
        var best = 0, diff = 1e9;
        for (var k = 1; k < words.length; k++) {
          var d = Math.abs(words.slice(0, k).join(' ').length - words.slice(k).join(' ').length);
          if (d < diff) { diff = d; best = k; }
        }
        return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
      }
      var bestL = null, worst = 1e9;
      for (var a = 1; a < words.length - 1; a++) for (var b = a + 1; b < words.length; b++) {
        var L = [words.slice(0, a).join(' '), words.slice(a, b).join(' '), words.slice(b).join(' ')];
        var m = Math.max(L[0].length, L[1].length, L[2].length);
        if (m < worst) { worst = m; bestL = L; }
      }
      return bestL;
    };
    var lines = !selected.length ? [txt, ''] : words.length > nLines - 1 ? split(nLines) : [txt, ''];
    var svgEl = p.querySelector('svg'), NSs = 'http://www.w3.org/2000/svg';
    var paths = svgEl.querySelectorAll('path');
    if (paths.length < 3) {   // add a third line to the curved statement once
      var pid = paths[0].id.replace(/-0$/, '-2'), np = document.createElementNS(NSs, 'path');
      np.setAttribute('id', pid); np.setAttribute('d', 'M -80 186 C 100 186, 300 186, 480 186');
      svgEl.insertBefore(np, svgEl.querySelector('text'));
      var nt = document.createElementNS(NSs, 'text'), ntp = document.createElementNS(NSs, 'textPath');
      ntp.setAttribute('href', '#' + pid); ntp.setAttribute('startOffset', '50%'); ntp.setAttribute('text-anchor', 'middle');
      nt.appendChild(ntp); svgEl.appendChild(nt);
    }
    svgEl.setAttribute('viewBox', lines.length === 3 ? '0 18 400 186' : !selected.length ? '0 18 400 70' : '0 18 400 128');
    var tps = p.querySelectorAll('textPath');
    // every letter in its own tspan, so the letters can pop in one after the other
    var chars = [];
    tps.forEach(function (tp, k) {
      tp.textContent = '';
      (lines[k] || '').split('').forEach(function (c) {
        var t = document.createElementNS(NSs, 'tspan'); t.textContent = c; tp.appendChild(t); chars.push(t);
      });
    });
    p.querySelectorAll('text').forEach(function (t) { t.style.whiteSpace = 'pre'; });
    var svgS = p.querySelector('.grid-statement__svg'); if (svgS) svgS.classList.remove('is-leaving');
    if (txt !== stmtShown) {
      var first = stmtShown === null; stmtShown = txt;
      if (!first) (selected[0] === 'illu' ? drawLetters : selected[0] === 'foto' ? pullFocus : selected[0] === 'interaktion' ? rememberFirst : selected[0] === 'info' ? scatterLetters : selected[0] === 'tbm' ? bouncier : selected[0] === 'id' ? kernIntoPlace : focusLetters)(chars);   // Illustration: drawn; Photography: slowly into focus; others: open
      else if (svgS && !reduce) {   // on load: wait for the web font, so it opens once, in its final size
        svgS.style.opacity = '0';
        sub.style.opacity = '0';
        var go = function () {
          if (svgS.style.opacity !== '0') return;
          svgS.style.opacity = ''; sub.style.opacity = ''; focusLetters();
          if (sub.textContent) { sub.classList.add('is-focusing'); setTimeout(function () { sub.classList.remove('is-focusing'); }, 1100); }
        };
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(go, 60); });
        setTimeout(go, 1500);
      }
    }
    p.setAttribute('aria-label', txt);
    document.body.dataset.stmt = selected[0] || '';   // which statement is showing (some effects belong to one category)
    // shrink the type if a line is too wide: text on a path drops every letter past the path's
    // end, so measure each line as plain text (in SVG units) and fit it to ~360 of the 380 units
    var svg = p.querySelector('svg'), texts = p.querySelectorAll('text');
    texts.forEach(function (t) { t.style.removeProperty('font-size'); t.removeAttribute('transform'); });
    var probe = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    probe.setAttribute('class', 'grid-statement__probe'); probe.style.visibility = 'hidden';
    svg.appendChild(probe);
    var maxW = 0;
    lines.forEach(function (l) { probe.textContent = l; try { maxW = Math.max(maxW, probe.getComputedTextLength()); } catch (e) {} });
    svg.removeChild(probe);
    var base = parseFloat(getComputedStyle(texts[0]).fontSize) || 60;
    if (maxW > 0) {   // every statement as big as the column allows (or smaller if a line is too long); the lines spread apart to match
      var g = Math.min(1.6, 360 / maxW), nL = lines.filter(function (l) { return l; }).length || 1, mid = (nL - 1) / 2;
      if (selected.length) {   // all filter sentences share one size: the largest at which even the longest one still fits
        var gAll = 1.6, pr = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        pr.setAttribute('class', 'grid-statement__probe'); pr.style.visibility = 'hidden'; svg.appendChild(pr);
        Object.keys(STATEMENTS).forEach(function (key) {
          if (!key) return;
          var w = STATEMENTS[key].split(' '), ls;
          if (STATEMENTS[key].length > 30) {   // same three-line split as below
            var worst = 1e9;
            for (var a3 = 1; a3 < w.length - 1; a3++) for (var b3 = a3 + 1; b3 < w.length; b3++) {
              var L3 = [w.slice(0, a3).join(' '), w.slice(a3, b3).join(' '), w.slice(b3).join(' ')];
              var m3 = Math.max(L3[0].length, L3[1].length, L3[2].length);
              if (m3 < worst) { worst = m3; ls = L3; }
            }
          } else {
            var best = 1, diff = 1e9;
            for (var q = 1; q < w.length; q++) { var d = Math.abs(w.slice(0, q).join(' ').length - w.slice(q).join(' ').length); if (d < diff) { diff = d; best = q; } }
            ls = [w.slice(0, best).join(' '), w.slice(best).join(' ')];
          }
          ls.forEach(function (l) {
            pr.textContent = l; try { var lw = pr.getComputedTextLength(); if (lw) gAll = Math.min(gAll, 360 / lw); } catch (e) {}
          });
        });
        svg.removeChild(pr);
        g = gAll;
      }
      texts.forEach(function (t, k) {
        t.style.setProperty('font-size', (base * g).toFixed(1) + 'px', 'important');
        if (k < nL) t.setAttribute('transform', 'translate(0 ' + ((k - mid) * 58 * (g - 1)).toFixed(1) + ')');
      });
      var top = 70 + mid * 58 - mid * 58 * g - 52 * g;
      svg.setAttribute('viewBox', '0 ' + top.toFixed(0) + ' 400 ' + ((nL - 1) * 58 * g + 60 * g).toFixed(0));
    }
  };
  // re-measure once the web font has loaded (it is wider than the fallback) and on resize
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setStatement);
  window.addEventListener('resize', setStatement);
  function toggleCat(cat) {
    // only one filter at a time: a second click on the active one shows everything again
    selected = selected.indexOf(cat) > -1 ? [] : [cat];
    applyFilter(true);
    // the old sentence closes like a bubble, then the new one opens
    var sv = document.querySelector('.grid-statement__svg');
    clearTimeout(toggleCat.t);
    var subL = document.querySelector('.grid-statement__sub'); if (subL && subL.textContent && !reduce) subL.classList.add('is-leaving');
    if (sv && !reduce) { sv.classList.remove('is-focusing'); sv.classList.add('is-leaving'); toggleCat.t = setTimeout(setStatement, 600); }   // back while the bubbles are settling
    else setStatement();
    if (window.pillStick) window.pillStick();
  }
  if (reset) reset.addEventListener('click', function () { setTimeout(setStatement, 0); });
  window.addEventListener('load', setStatement);
  // coming from a link like index.html?filter=illu: open the page with that filter already chosen
  var wanted = new URLSearchParams(location.search).get('filter');
  if (wanted && document.querySelector('.cat-pill[data-cat="' + wanted + '"]')) {
    selected = [wanted]; applyFilter(false); setTimeout(setStatement, 0);
  }
  pills.forEach(function (p) { p.addEventListener('click', function () {
    toggleCat(p.dataset.cat);
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });   // back to the top, where the new selection starts
  }); });
  if (reset) reset.addEventListener('click', function () { selected = []; applyFilter(true); });

  // Homepage column zoom: 1 column by default, more with the control bottom left
  var zoom = document.querySelector('.col-zoom');
  var grid = document.querySelector('.container-5');
  if (zoom && grid) {
    var range = zoom.querySelector('input'), out = zoom.querySelector('.col-zoom__value');
    var less = zoom.querySelector('.col-zoom__less'), more = zoom.querySelector('.col-zoom__more');
    var maxCols = function () { return window.innerWidth < 600 ? 4 : window.innerWidth < 992 ? 6 : 10; };
    var setCols = function (n) {
      n = Math.max(1, Math.min(maxCols(), n));
      range.max = maxCols();
      range.value = n; out.textContent = n;
      grid.style.setProperty('--cols', n);
      grid.dataset.cols = n;
      less.disabled = n <= 1; more.disabled = n >= maxCols();
      buildColumns(n);
      markSmall();
    };
    // Real column wrappers (instead of CSS columns) so each column can move on its own
    var allTiles = [].slice.call(grid.querySelectorAll('.pingrid, .grid-statement'));
    var ratio = function (t) {
      var m = t.querySelector('img, video');
      if (!m) return 0.45;   // the text statement between the bubbles
      var w = +m.getAttribute('width') || m.naturalWidth || m.videoWidth || 1;
      var h = +m.getAttribute('height') || m.naturalHeight || m.videoHeight || 1;
      return h / w;
    };
    var cols = [], leadRatio = 0;
    function buildColumns(n) {
      cols.forEach(function (c) { c.remove(); });
      cols = [];
      // with a filter on, the statement should stay about where it is on the full page: the bubble above it
      // (first in the middle column) is the visible one closest in height to the one there without a filter.
      // The full page itself keeps its order.
      var filtered = allTiles.some(function (t) { return t.classList.contains('is-gone'); });
      var stmtT = allTiles.filter(function (t) { return t.hasAttribute('data-after'); })[0];
      var lead = null;
      if (filtered && leadRatio) {
        allTiles.forEach(function (t) {
          if (t === stmtT || t.classList.contains('is-gone') || t.hasAttribute('data-duplicate')) return;
          if (t.dataset.below && allTiles.some(function (x) { return x.dataset.title === t.dataset.below && !x.classList.contains('is-gone'); })) return;
          if (!lead || Math.abs(ratio(t) - leadRatio) < Math.abs(ratio(lead) - leadRatio)) lead = t;
        });
      }
      if (n <= 1) {
        grid.classList.remove('is-masonry');
        allTiles.forEach(function (t) { grid.appendChild(t); });
        if (stmtT) {   // phones: the statement right after the first visible bubble
          var firstVis = allTiles.filter(function (t) { return t !== stmtT && !t.classList.contains('is-gone') && !t.hasAttribute('data-duplicate'); })[0];
          if (firstVis) { grid.insertBefore(firstVis, grid.firstChild); firstVis.after(stmtT); }
        }
        return;
      }
      grid.classList.add('is-masonry');
      var heights = [];
      for (var i = 0; i < n; i++) {
        var c = document.createElement('div');
        c.className = 'masonry-col';
        c.dataset.dir = i % 2 ? 'up' : 'down';
        grid.appendChild(c); cols.push(c); heights.push(0);
      }
      var below = function (t) {   // bubbles that should sit directly under this one (data-below="its title")
        return allTiles.filter(function (x) { return x.dataset.below && x.dataset.below === t.dataset.title && !x.classList.contains('is-gone'); });
      };
      var place = function (t, k) {
        cols[k].appendChild(t); heights[k] += ratio(t) + 0.1;
        below(t).forEach(function (x) { place(x, k); });
      };
      if (lead) place(lead, Math.min(1, n - 1));
      allTiles.forEach(function (t) {
        if (t === lead || (lead && t.parentElement === cols[Math.min(1, n - 1)])) return;   // already placed (with its followers)
        if (t.hasAttribute('data-after')) return;   // placed below its bubble afterwards
        if (t.hasAttribute('data-duplicate')) { cols[0].appendChild(t); return; }
        if (t.classList.contains('is-gone')) { cols[0].appendChild(t); return; }
        if (t.dataset.below) {   // follows its bubble, unless that one is filtered out
          var ref = allTiles.filter(function (x) { return x.dataset.title === t.dataset.below; })[0];
          if (ref && !ref.classList.contains('is-gone')) return;
        }
        place(t, heights.indexOf(Math.min.apply(null, heights)));
      });
      // statements tied to a bubble sit right below it, in the same column
      // the statement always sits second in the middle column, right below its first visible bubble
      allTiles.forEach(function (t) {
        if (!t.hasAttribute('data-after')) return;
        var col = cols[Math.min(1, cols.length - 1)];
        var first = [].filter.call(col.children, function (x) { return x !== t && !x.classList.contains('is-gone') && !x.hasAttribute('data-duplicate'); })[0];
        if (first) first.after(t); else col.insertBefore(t, col.firstChild);
        if (!filtered && first) leadRatio = ratio(first);   // remember how tall the bubble above it is on the full page
      });
      parallax();
    }
    // (column parallax removed – tiles float gently instead, see "Slow-motion float")
    function parallax() {}


    // fixed layout so the bubbles always keep the same shape: 3 columns on desktop,
    // 2 on tablets, 1 on phones (the zoom control is hidden)
    var fixedCols = function () { return window.innerWidth < 600 ? 1 : window.innerWidth < 992 ? 2 : 3; };
    relayout = function () { buildColumns(+range.value); markSmall(); };
    // phones and tablets: the first bubble may run off the top, so «I visualize» sits at about two thirds of the screen
    var sec = grid.closest('.section');
    var liftStatement = function () {
      if (!sec) return;
      sec.style.removeProperty('margin-top');
      if (window.innerWidth >= 992 || selected.length) return;
      var st = grid.querySelector('.grid-statement');
      if (!st) return;
      var r = st.getBoundingClientRect(), mid = r.top + window.scrollY + r.height / 2, want = window.innerHeight * 2 / 3;
      if (mid > want) sec.style.setProperty('margin-top', (parseFloat(getComputedStyle(sec).marginTop) - (mid - want)).toFixed(0) + 'px', 'important');
    };
    window.addEventListener('load', liftStatement);
    window.addEventListener('resize', function () { setTimeout(liftStatement, 80); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(liftStatement);
    setTimeout(liftStatement, 50);
    setCols(fixedCols());
    range.addEventListener('input', function () { setCols(+range.value); });
    less.addEventListener('click', function () { setCols(+range.value - 1); });
    more.addEventListener('click', function () { setCols(+range.value + 1); });
    window.addEventListener('resize', function () { setCols(fixedCols()); });
  }

  // Corners: images that are small on screen get a smaller radius
  function markSmall() {
    document.querySelectorAll('img:not(.logo-image-copy):not(.image-11), video, .pingrid, .station__frame, .w-video')
      .forEach(function (el) { el.classList.toggle('is-small', el.getBoundingClientRect().width < 300); });
  }
  markSmall();
  window.addEventListener('load', markSmall);
  window.addEventListener('resize', markSmall);
  document.addEventListener('load', function (e) { if (e.target.tagName === 'IMG') markSmall(); }, true);

  // Hover videos: play only while the pointer (or keyboard focus) is on them
  var canHover = window.matchMedia('(hover: hover)').matches;
  document.querySelectorAll('video.hover-video').forEach(function (v) {
    var host = v.closest('.pingrid') || v;
    v.muted = true;
    if (!canHover) { v.setAttribute('data-autoplay', ''); return; } // touch: play when visible
    var playTimer;
    var play = function () {
      clearTimeout(playTimer);
      playTimer = setTimeout(function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); v.classList.add('is-playing'); }, 0);
    };
    var stop = function () { clearTimeout(playTimer); v.pause(); v.currentTime = 0; v.classList.remove('is-playing'); }; // back to the title frame
    host.addEventListener('mouseenter', play);
    host.addEventListener('mouseleave', stop);
    host.addEventListener('focus', play);
    host.addEventListener('blur', stop);
  });

  // Hover previews: while a bubble is hovered (on phones: while it sits in the middle of the
  // screen) it shows its project – a Vimeo clip, a video file or the project's pictures
  // flicking by. Everything is created on demand and removed again afterwards.
  var coverSize = function (t, el, ratio) {   // let a 16:9 player cover the whole bubble
    var w = t.offsetWidth, h = t.offsetHeight, cw = w, ch = w / ratio;
    if (ch < h) { ch = h; cw = h * ratio; }
    el.style.width = cw + 'px'; el.style.height = ch + 'px';
    el.style.left = (w - cw) / 2 + 'px'; el.style.top = (h - ch) / 2 + 'px';
  };
  document.querySelectorAll('.container-5 .pingrid').forEach(function (t) {
    var d = t.dataset, layer = null, slideTimer = null;
    if ((!d.vimeo && !d.previewVideo && !d.slides) || d.vimeoPreload !== undefined) return;
    var start = function () {
      if (layer) return;
      if (d.vimeo) {
        layer = document.createElement('iframe');
        layer.className = 'tile-preview tile-vimeo';
        layer.allow = 'autoplay; fullscreen';
        layer.title = d.title;
        layer.src = 'https://player.vimeo.com/video/' + d.vimeo + '?background=1&autoplay=1&muted=1&loop=1&dnt=1' + (d.vimeoStart ? '#t=' + d.vimeoStart + 's' : '');
        coverSize(t, layer, +d.vimeoRatio || 16 / 9);   // data-vimeo-ratio for videos that are not 16:9
        if (d.vimeoZoom) {   // zoom in when the video has its own empty margin
          var zw = parseFloat(layer.style.width) * d.vimeoZoom, zh = parseFloat(layer.style.height) * d.vimeoZoom;
          layer.style.width = zw + 'px'; layer.style.height = zh + 'px';
          layer.style.left = (t.offsetWidth - zw) / 2 + 'px'; layer.style.top = (t.offsetHeight - zh) / 2 + 'px';
        }
        if (d.vimeoFit === 'contain') {   // small, centred – same size as on the title image
          var cw = t.offsetWidth * 0.82, ch = cw * 9 / 16;
          layer.style.width = cw + 'px'; layer.style.height = ch + 'px';
          layer.style.left = (t.offsetWidth - cw) / 2 + 'px'; layer.style.top = (t.offsetHeight - ch) / 2 + 'px';
        }
        if (d.vimeoAlign === 'left') layer.style.left = '0px';
      } else if (d.previewVideo) {
        layer = document.createElement('video');
        layer.className = 'tile-preview';
        layer.muted = true; layer.loop = true; layer.playsInline = true; layer.autoplay = true;
        layer.src = d.previewVideo;
        if (d.previewStart) layer.addEventListener('loadedmetadata', function () { layer && (layer.currentTime = +d.previewStart); }, { once: true });
        var pl = layer.play(); if (pl && pl.catch) pl.catch(function () {});
      } else {
        var list = d.slides.split('|'), k = 0;
        layer = document.createElement('img');
        layer.className = 'tile-preview';
        layer.alt = '';
        layer.src = list[0];
        list.forEach(function (u) { var im = new Image(); im.src = u; });   // preload the rest
        slideTimer = setInterval(function () { k = (k + 1) % list.length; layer.src = list[k]; }, +d.slidesMs || 650);   // data-slides-ms for a slower change
      }
      t.insertBefore(layer, t.querySelector('.tile__shade') || t.querySelector('.tile__info'));
    };
    var stop = function () {
      clearInterval(slideTimer); slideTimer = null;
      if (layer) { if (layer.pause) layer.pause(); layer.remove(); layer = null; }
    };
    t._previewStart = start; t._previewStop = stop;
    if (canHover) {
      t.addEventListener('mouseenter', start);
      t.addEventListener('mouseleave', stop);
      t.addEventListener('focus', start);
      t.addEventListener('blur', stop);
    }
  });

  // Tiles marked data-vimeo-preload: the player is loaded (paused, hidden) as soon as the tile
  // comes near the screen, so on hover the video starts right away instead of loading first
  document.querySelectorAll('.container-5 .pingrid[data-vimeo-preload]').forEach(function (t) {
    var d = t.dataset, frame = null;
    var send = function (method, value) {
      if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify(value === undefined ? { method: method } : { method: method, value: value }), '*');
    };
    var load = function () {
      if (frame) return;
      frame = document.createElement('iframe');
      frame.className = 'tile-preview tile-vimeo tile-vimeo--preloaded';
      frame.allow = 'autoplay; fullscreen';
      frame.title = d.title;
      frame.src = 'https://player.vimeo.com/video/' + d.vimeo + '?autoplay=0&muted=1&loop=1&controls=0&title=0&byline=0&portrait=0&dnt=1';
      var cw = t.offsetWidth * 0.82, ch = cw * 9 / 16;
      frame.style.width = cw + 'px'; frame.style.height = ch + 'px';
      frame.style.left = (t.offsetWidth - cw) / 2 + 'px'; frame.style.top = (t.offsetHeight - ch) / 2 + 'px';
      t.insertBefore(frame, t.querySelector('.tile__shade') || t.querySelector('.tile__info'));
    };
    if ('IntersectionObserver' in window) {
      var pio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { load(); pio.disconnect(); } }, { rootMargin: '400px 0px' });
      pio.observe(t);
    } else load();
    var on = function () { load(); t.classList.add('is-previewing'); send('setVolume', 0); send('play'); };
    var off = function () { t.classList.remove('is-previewing'); send('pause'); send('setCurrentTime', 0); };
    t._previewStart = on; t._previewStop = off;
    if (canHover) { t.addEventListener('mouseenter', on); t.addEventListener('mouseleave', off); t.addEventListener('focus', on); t.addEventListener('blur', off); }
  });

  // Short looping excerpt of a Vimeo video (data-from … data-to seconds), plays on its own
  // without controls; loaded only when it comes near the screen
  document.querySelectorAll('.vimeo-loop[data-vimeo]').forEach(function (box) {
    var d = box.dataset, from = +d.from || 0, to = +d.to || 0, frame = null;
    var send = function (method, value) {
      if (frame && frame.contentWindow) frame.contentWindow.postMessage(JSON.stringify(value === undefined ? { method: method } : { method: method, value: value }), '*');
    };
    var load = function () {
      frame = document.createElement('iframe');
      frame.allow = 'autoplay; fullscreen';
      frame.title = box.getAttribute('aria-label') || '';
      frame.src = 'https://player.vimeo.com/video/' + d.vimeo + '?background=1&autoplay=1&muted=1&loop=1&dnt=1#t=' + from + 's';
      box.appendChild(frame);
      window.addEventListener('message', function (e) {
        if (e.source !== frame.contentWindow) return;
        var m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (err) { return; }
        if (!m) return;
        if (m.event === 'ready') { send('addEventListener', 'timeupdate'); send('addEventListener', 'playProgress'); send('setCurrentTime', from); }
        if ((m.event === 'timeupdate' || m.event === 'playProgress') && m.data && to) {
          var t = m.data.seconds;
          if (t >= to || t < from - 0.5) send('setCurrentTime', from);
        }
      });
    };
    if ('IntersectionObserver' in window) {
      var lio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { load(); lio.disconnect(); } }, { rootMargin: '300px 0px' });
      lio.observe(box);
    } else load();
  });

  // Reels with a cover picture: the player is only loaded once the cover is clicked
  document.querySelectorAll('.reel-cover').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.classList.contains('is-playing')) return;
      // only one reel at a time: the others in this row go back to their cover
      var row = b.closest('.video-row');
      if (row) row.querySelectorAll('.reel-cover.is-playing').forEach(function (o) {
        var m = o.querySelector('video, iframe');
        if (m) { if (m.pause) m.pause(); m.remove(); }
        o.classList.remove('is-playing');
      });
      b.classList.add('is-playing');
      var el;
      if (b.dataset.vimeo) {
        el = document.createElement('iframe');
        el.allow = 'autoplay; fullscreen; picture-in-picture';
        el.allowFullscreen = true;
        el.src = 'https://player.vimeo.com/video/' + b.dataset.vimeo + '?autoplay=1&dnt=1';
      } else {
        el = document.createElement('video');
        el.controls = true; el.playsInline = true; el.autoplay = true;
        el.src = b.dataset.video;
      }
      el.title = b.getAttribute('aria-label') || '';
      b.appendChild(el);
      var p = el.play && el.play(); if (p && p.catch) p.catch(function () {});
    });
  });

  // Project videos play only while visible (saves data on long pages)
  var autoVids = document.querySelectorAll('video[data-autoplay]');
  if (autoVids.length && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 });
    autoVids.forEach(function (v) { vio.observe(v); });
  }

  // Deep links (#digital, #print …): images above the target load lazily and push it
  // down, so keep the target aligned until the page has settled
  if (location.hash.length > 1) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) {
      target.closest('.split__media') && [].forEach.call(document.querySelectorAll('.split__media img'), function (im) {
        if (im.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) im.loading = 'eager';
      });
      if (target.tagName === 'IMG') target.loading = 'eager';
      var align = function () { target.scrollIntoView({ block: 'start' }); };
      var stopAt = Date.now() + 4000, userMoved = false;
      ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
        window.addEventListener(ev, function () { userMoved = true; }, { once: true, passive: true });
      });
      document.addEventListener('load', function (e) {
        if (!userMoved && Date.now() < stopAt && e.target.tagName === 'IMG') align();
      }, true);
      window.addEventListener('load', function () { if (!userMoved) align(); });
      align();
    }
  }

  // Dice in the project navigation: jump to a random other project
  var dice = document.querySelector('.project-nav__dice[data-random]');
  if (dice && window.PROJECTS && window.PROJECTS.length > 1) {
    dice.addEventListener('click', function (e) {
      var here = location.pathname.split('/').pop();
      var pool = window.PROJECTS.filter(function (p) { return p !== here; });
      e.preventDefault();
      dice.classList.add('is-rolling');
      setTimeout(function () { location.href = pool[Math.floor(Math.random() * pool.length)]; }, reduce ? 0 : 350);
    });
  }

  // Homepage tiles: every pebble has its own living outline. Idle it drifts very slowly and
  // gently; on hover (or, on touch screens, while it is the focused bubble) it morphs strongly
  // and quickly. Amplitude and speed ease between the two, so the shape never jumps.
  var morphTiles = [].slice.call(document.querySelectorAll('.container-5 .pingrid, .bubble-photo'));
  var defs = document.querySelector('.blob-defs defs');
  var SVGNS = 'http://www.w3.org/2000/svg', PTS = 96;
  var mk = function (tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var a in attrs) el.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(el);
    return el;
  };
  var morphs = morphTiles.map(function (t, i) {
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    var path = mk('path', { id: 'pbp-' + i }, defs);
    mk('use', { href: '#pbp-' + i }, mk('clipPath', { id: 'pb-' + i, clipPathUnits: 'objectBoundingBox' }, defs));
    var mask = mk('mask', { id: 'pbr-' + i, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1.5, height: 1.5 }, defs);
    mk('rect', { width: 1.5, height: 1.5, fill: '#fff' }, mask);
    mk('use', { href: '#pbp-' + i, fill: '#000', transform: 'translate(.25 .25) translate(.5 .5) scale(.988) translate(-.5 -.5)' }, mask);
    t.style.setProperty('--pebble', 'url(#pb-' + i + ')');

    // the paper-edge rim: a soft shadow sheet with the pebble cut out of it
    var sh = document.createElement('span');
    sh.className = 'tile__shade';
    var svg = mk('svg', { viewBox: '0 0 1.5 1.5', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, sh);
    mk('rect', { width: 1.5, height: 1.5, fill: 'rgb(30,38,46)', 'fill-opacity': '.2', mask: 'url(#pbr-' + i + ')' }, mk('g', { filter: 'url(#pbblur)' }, svg));
    t.insertBefore(sh, t.querySelector('.tile__info'));

    return t._morph = {
      tailA: null,   // speech-bubble corner switched off (set an angle in radians to bring it back)
      t: t, path: path, svg: svg, amp: 1, speed: 1, visible: true, on: false, burst: 0,
      // harmonics 2–5: base amplitude, phase and drift direction/speed of each
      h: [[2, rnd(.075, .1)], [3, rnd(.05, .075)], [4, rnd(.025, .04)], [5, rnd(.01, .02)]].map(function (k) {
        return { k: k[0], a: k[1], p: rnd(0, 6.283), w: rnd(.12, .3) * (Math.random() < .5 ? -1 : 1) };
      })
    };
  });
  var drawPebble = function (m) {
    var p = [], x0 = 9, x1 = -9, y0 = 9, y1 = -9, i, s, TW = 0.17;
    var radius = function (th) {
      var r = 1; m.h.forEach(function (h) { r += h.a * m.amp * Math.cos(h.k * th + h.p); }); return r;
    };
    var angles = [];
    for (i = 0; i < PTS; i++) angles.push(6.2832 * i / PTS);
    if (m.tailA != null) {   // make sure the sharp tip and both base corners are exact points
      var ta = (m.tailA % 6.2832 + 6.2832) % 6.2832;
      angles = angles.filter(function (a) { var d = Math.abs(Math.atan2(Math.sin(a - ta), Math.cos(a - ta))); return d > 0.01; });
      angles.push(ta, (ta - TW + 6.2832) % 6.2832, (ta + TW) % 6.2832);
      angles.sort(function (a, b) { return a - b; });
    }
    angles.forEach(function (th) {
      var r = radius(th), tail = false;
      if (m.tailA != null) {   // speech-bubble tail: a small, pointed corner sticking out at the bottom
        var dth = Math.atan2(Math.sin(th - m.tailA), Math.cos(th - m.tailA));
        var u = Math.max(0, 1 - Math.abs(dth) / TW);
        r += 0.13 * u;
        tail = Math.abs(dth) <= TW + 1e-6;
      }
      var x = r * Math.cos(th), y = r * Math.sin(th);
      p.push([x, y, tail]);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    });
    // fit into the tile's box, so the pebble always fills it and no image edge shows
    // (while filtering, the outline closes in towards the middle: shrink < 1)
    var k = m.shrink == null ? 1 : Math.max(0.0005, m.shrink);
    p = p.map(function (q) {
      var x = .003 + (q[0] - x0) / (x1 - x0) * .994, y = .003 + (q[1] - y0) / (y1 - y0) * .994;
      return [.5 + (x - .5) * k, .5 + (y - .5) * k, q[2]];
    });
    var f = function (v) { return v.toFixed(4); }, N = p.length;
    s = 'M' + f(p[0][0]) + ',' + f(p[0][1]);
    for (i = 0; i < N; i++) {   // closed Catmull-Rom curve as Béziers; straight lines along the tail
      var a = p[(i + N - 1) % N], b = p[i], c = p[(i + 1) % N], d = p[(i + 2) % N];
      if (b[2] && c[2]) { s += 'L' + f(c[0]) + ',' + f(c[1]); continue; }
      s += 'C' + f(b[0] + (c[0] - a[0]) / 6) + ',' + f(b[1] + (c[1] - a[1]) / 6) + ' ' +
        f(c[0] - (d[0] - b[0]) / 6) + ',' + f(c[1] - (d[1] - b[1]) / 6) + ' ' + f(c[0]) + ',' + f(c[1]);
    }
    m.path.setAttribute('d', s + 'Z');
  };
  // calm: small amplitude, slow drift (hovered or not) · when hover starts or ends the pebble
  // wobbles strongly and quickly for a moment, then settles back to calm
  var IDLE_AMP = .4, BURST_AMP = 1, BURST_SPEED = 8;
  morphs.forEach(function (m) { m.amp = IDLE_AMP; drawPebble(m); });
  if (!reduce && morphs.length) {
    if ('IntersectionObserver' in window) {
      var mio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { morphs[morphTiles.indexOf(e.target)].visible = e.isIntersecting; });
      }, { rootMargin: '100px 0px' });
      morphTiles.forEach(function (t) { mio.observe(t); });
    }
    var lastT = performance.now();
    var tick = function (now) {
      var dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
      var ease = 1 - Math.pow(.0005, dt);   // smooth approach, independent of frame rate
      morphs.forEach(function (m) {
        if (m.shrinkAnim) {   // filter: frame is sucked in (slow start, then ever faster) or pops open
          var sa = m.shrinkAnim, u = Math.min(1, (now - sa.start) / sa.dur), c = 1.70158, e;
          e = sa.kind === 'in' ? u * u * u : sa.kind === 'pop' ? 1 - Math.pow(1 - u, 3) : 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2);
          m.shrink = sa.from + (sa.to - sa.from) * e;
          if (u >= 1) { m.shrink = sa.to; m.shrinkAnim = null; }
        }
        if (!m.visible) return;
        var on = m.t.matches(':hover') || m.t.classList.contains('is-pressed');
        if (on !== m.on) { m.on = on; m.burst = 1; }
        if (m.t._grow !== undefined) {   // touch: scrolling the bubble bigger or smaller makes it wobble a bit
          m.burst = Math.min(1, (m.burst || 0) + Math.abs(m.t._grow - (m.lastGrow === undefined ? m.t._grow : m.lastGrow)) * 4);
          m.lastGrow = m.t._grow;
        }
        m.burst = (m.burst || 0) * Math.pow(.12, dt);   // the wobble dies away within about a second
        m.amp += (IDLE_AMP + m.burst * BURST_AMP - m.amp) * ease;
        m.speed += (1 + m.burst * BURST_SPEED - m.speed) * ease;
        m.h.forEach(function (h) { h.p += h.w * m.speed * dt; });
        drawPebble(m);
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Slow-motion float: every tile drifts and breathes very slowly, each at its own pace
  document.querySelectorAll('.container-5 .pingrid').forEach(function (t, i) {
    var rnd = function (a, b) { return a + Math.random() * (b - a); };
    t.style.setProperty('--float-dur', rnd(11, 18).toFixed(1) + 's');
    t.style.setProperty('--float-delay', '-' + rnd(0, 18).toFixed(1) + 's');
    t.style.setProperty('--float-y', rnd(2, 4).toFixed(1) + 'px');
    t.style.setProperty('--float-r', '0deg');
  });

  // Light from above the screen: the paper-edge shadow inside each pebble shifts while scrolling
  var lit = document.querySelectorAll('.container-5 .pingrid');
  if (lit.length && !reduce) {
    var shade = function () {
      var vw = window.innerWidth, vh = window.innerHeight;
      var rects = [].map.call(lit, function (t) { return t.getBoundingClientRect(); });   // read everything first, then write (no layout thrashing)
      lit.forEach(function (t, i) {
        var r = rects[i];
        if (r.bottom < -200 || r.top > vh + 200) return;
        var dx = (r.left + r.width / 2 - vw / 2) / vw, dy = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
        // tile in the middle of the screen: even rim all round; moving up: light from below
        // (shadow along the bottom edge); moving down: light from above (shadow along the top edge)
        // a lamp in the middle of the screen shines straight at the page: right under it the rim is even;
        // the further a pebble sits from it, the more the rim gathers on the side facing the lamp
        var len = 1, k = t.matches(':hover') ? 2 : 10;
        // and the pebble itself changes a little – slightly foreshortened away from the lamp
        t.style.scale = (1 - Math.abs(dx) * 0.035).toFixed(4) + ' ' + (1 - Math.abs(dy) * 0.035).toFixed(4);
        var s = t.querySelector('.tile__shade');
        if (s) s.firstChild.style.transform = 'translate(' + (dx * 2 * k).toFixed(1) + 'px, ' + (dy * k).toFixed(1) + 'px)';
      });
    };
    var shadeQueued = false;
    window.addEventListener('scroll', function () {
      if (shadeQueued) return; shadeQueued = true;   // at most once per frame, in step with the screen
      var f, tm, go = function () { cancelAnimationFrame(f); clearTimeout(tm); shadeQueued = false; shade(); };
      f = requestAnimationFrame(go); tm = setTimeout(go, 50);
    }, { passive: true });
    window.addEventListener('scrollend', shade);
    lit.forEach(function (t) { t.addEventListener('mouseenter', function () { setTimeout(shade, 0); }); t.addEventListener('mouseleave', function () { setTimeout(shade, 0); }); });
    window.addEventListener('resize', shade);
    shade();
  }

  // While scrolling, tiles passing under a resting mouse must not zoom: hover only counts
  // once the page stands still again
  var scrollTimer;
  window.addEventListener('scroll', function () {
    if (!body.classList.contains('is-scrolling')) body.classList.add('is-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () { body.classList.remove('is-scrolling'); }, 180);
  }, { passive: true });

  // Click on a pebble: the project opens right away (the press shows only while the next page loads)
  document.querySelectorAll('.container-5 .pingrid').forEach(function (t) {
    t.addEventListener('click', function (e) {
      if (reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      t.classList.remove('is-pressed'); void t.offsetWidth; t.classList.add('is-pressed');
    });
  });
  // coming back with the browser's back button: no bubble stays pressed
  window.addEventListener('pageshow', function () {
    document.querySelectorAll('.container-5 .pingrid.is-pressed').forEach(function (t) { t.classList.remove('is-pressed'); });
  });

  // Keep every bubble's proportions moderate (no long, stretched pebbles):
  // the visible area is clamped between 4:3 landscape and 4:5 portrait, the image fills it.
  document.querySelectorAll('.container-5 .pingrid .imggrid').forEach(function (m) {
    var w = +m.getAttribute('width') || m.naturalWidth || m.videoWidth || 4;
    var h = +m.getAttribute('height') || m.naturalHeight || m.videoHeight || 3;
    var r = Math.min(1.25, Math.max(0.75, h / w));
    m.style.aspectRatio = (1 / r).toFixed(4);
    m.style.objectFit = 'cover';
  });

  // Touch screens and narrow (mobile) views: the bubble size follows the scroll instead of hover
  var scrollGrowMq = window.matchMedia('(hover: none), (max-width: 767px)');
  if (document.querySelector('.container-5 .pingrid')) {
    var focusTiles = [].slice.call(document.querySelectorAll('.container-5 .pingrid'));
    var current = null, focusTimer;
    var pickFocus = function () {
      var mid = window.innerHeight / 2, best = null, bestDist = Infinity;
      focusTiles.forEach(function (t) {
        var r = t.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        var d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = t; }
      });
      if (best && bestDist > window.innerHeight * 0.3) best = null;   // nothing near the middle
      if (best !== current) {
        if (current) current.classList.remove('is-focus');
        if (best) best.classList.add('is-focus');
        current = best;
      }
    };
    // growth follows the scroll: the closer a bubble is to the middle of the screen, the bigger it is
    var growQueued = false;
    var grow = function () {
      growQueued = false;
      if (!scrollGrowMq.matches) {   // wide desktop window: normal hover instead
        focusTiles.forEach(function (t) { delete t._grow; t.classList.remove('is-center'); t.style.removeProperty('--grow-s'); t.style.removeProperty('--grow-i'); });
        return;
      }
      var vh = window.innerHeight, mid = vh / 2;
      var rects = focusTiles.map(function (t) { return t.getBoundingClientRect(); });   // read first, then write
      focusTiles.forEach(function (t, i) {
        var r = rects[i];
        if (r.bottom < -100 || r.top > vh + 100) {   // far off screen: small again, and nothing keeps playing
          clearTimeout(t._dwell);
          if (t._previewOn) { t._previewOn = false; t._previewStop(); }
          if (t._grow !== 0) {
            t._grow = 0; t.classList.remove('is-center');
            t.style.setProperty('--grow-s', '.76'); t.style.setProperty('--grow-i', (.9 / .76).toFixed(4));
          }
          return;
        }
        var p = Math.max(0, Math.min(1, 1 - Math.abs(r.top + r.height / 2 - mid) / (vh * 0.45)));
        p = p * p * (3 - 2 * p);                        // smoothstep …
        p = p * p * p * (p * (p * 6 - 15) + 10);         // … and smootherstep on top: a strong ease-in-out
        var centred = p > .85;                           // title (and preview) only while the bubble is in the middle
        if (centred !== t.classList.contains('is-center')) t.classList.toggle('is-center', centred);
        // the preview (video or pictures) only starts once the bubble has rested in the middle for a moment
        // (each scroll step restarts the wait), so nothing loads while one scrolls past – keeps scrolling smooth
        clearTimeout(t._dwell);
        if (centred && t._previewStart && !t._previewOn) {
          t._dwell = setTimeout(function () { if (t.classList.contains('is-center')) { t._previewOn = true; t._previewStart(); } }, 800);
        } else if (!centred && t._previewOn) { t._previewOn = false; t._previewStop(); }
        var s = .76 + .24 * p;          // bubble: 0.76 → 1.00 (never wider than its column, so never cut)
        var seen = .9 + .12 * p;        // image as seen: 0.90 → 1.02 (zooms a little too)
        t._grow = p;
        t.style.setProperty('--grow-s', s.toFixed(4));
        // never below 1.06: the image always overfills the bubble, so no edge can show while it grows
        t.style.setProperty('--grow-i', Math.max(1.06, seen / s).toFixed(4));
      });
    };
    var queueGrow = function () {   // once per frame, together with the screen refresh
      if (growQueued) return; growQueued = true;
      var f, tm, go = function () { cancelAnimationFrame(f); clearTimeout(tm); grow(); };
      f = requestAnimationFrame(go); tm = setTimeout(go, 50);   // timer only as a backup if frames are held back
    };
    window.addEventListener('scroll', function () { queueGrow(); clearTimeout(focusTimer); focusTimer = setTimeout(pickFocus, 60); }, { passive: true });
    window.addEventListener('resize', function () { queueGrow(); pickFocus(); });
    grow(); pickFocus();
  }

  // Tiles blur in when scrolled into view
  var tiles = document.querySelectorAll('.pingrid');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('is-visible', e.isIntersecting);
        if (e.isIntersecting) e.target.classList.add('is-in');   // rises in once, from below
      });
    }, { rootMargin: '0px 0px -5% 0px' });
    tiles.forEach(function (t) { io.observe(t); });
  } else {
    tiles.forEach(function (t) { t.classList.add('is-visible', 'is-in'); });
  }

  // Rise-in also checked directly on scroll (robust even where the observer is late)
  var homeTiles = [].slice.call(document.querySelectorAll('.container-5 .pingrid'));
  var revealInView = function () {
    var vh = window.innerHeight;
    // measured without the 70px rise-in offset, so bubbles that peek in at the bottom show up right away
    homeTiles.filter(function (t) {
      if (t.classList.contains('is-in')) return false;
      var r = t.getBoundingClientRect();
      return r.top - 70 < vh - 10 && r.bottom > 0;
    }).forEach(function (t) { t.classList.add('is-in'); });   // all reads first, then the writes
  };
  if (homeTiles.length) {
    window.addEventListener('scroll', revealInView, { passive: true });
    window.addEventListener('resize', revealInView);
    revealInView();
  }

  // Statements between the bubbles: their lines sit on gentle curves that wave a little all the
  // time and swing more while the page is scrolled or the mouse moves over them
  var stmts = [].slice.call(document.querySelectorAll('.grid-statement__svg'));
  if (stmts.length && !reduce) {
    var energy = 0, lastY = window.scrollY, lastStmt = performance.now(), phase = 0;
    var waves = stmts.map(function (svg) {
      var w = { lines: [].slice.call(svg.querySelectorAll('path')), visible: true };
      svg.addEventListener('mousemove', function (e) { energy = Math.min(1, energy + (Math.abs(e.movementX) + Math.abs(e.movementY)) * .004); });
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { w.visible = es[0].isIntersecting; }).observe(svg);
      return w;
    });
    window.addEventListener('scroll', function () {
      energy = Math.min(1, energy + Math.abs(window.scrollY - lastY) * .004);
      lastY = window.scrollY;
    }, { passive: true });
    var wave = function (now) {
      var dt = Math.min(.1, (now - lastStmt) / 1000); lastStmt = now;
      energy *= Math.pow(.25, dt);                 // swings settle within a few seconds
      phase += dt * (.6 + energy * 3);
      var amp = energy * (document.body.dataset.stmt === 'tbm' ? 34 : 12);   // all swing a little while scrolling, «Motion» the most
      waves.forEach(function (w, k) {
        if (!w.visible) return;
        w.lines.forEach(function (l, i) {
          var y = 70 + i * 58, ph = phase + k * 2.1 + i * 1.3;
          var a = Math.sin(ph) * amp, b = Math.sin(ph * 1.2 + 2) * amp;
          l.setAttribute('d', 'M -80 ' + y + ' C 100 ' + (y - a).toFixed(1) + ', 300 ' + (y + b).toFixed(1) + ', 480 ' + y);
        });
      });
      requestAnimationFrame(wave);
    };
    requestAnimationFrame(wave);
  }

  applyFilter();

  // About page: curved journey line that draws itself while scrolling
  var track = document.querySelector('.journey__track');
  if (track) {
    var svgJ = track.querySelector('.journey__line');
    var pathBg = track.querySelector('.journey__path--bg');
    var pathFg = track.querySelector('.journey__path--fg');
    var stations = [].slice.call(track.querySelectorAll('.station'));
    var lut = [], total = 0;
    var buildPath = function () {
      var tr = track.getBoundingClientRect();
      svgJ.setAttribute('viewBox', '0 0 ' + tr.width + ' ' + tr.height);
      var pts = stations.map(function (st) {
        var d = st.querySelector('.station__dot').getBoundingClientRect();
        return [d.left + d.width / 2 - tr.left, d.top + d.height / 2 - tr.top];
      });
      // start above the first station, end below the last one
      pts.unshift([pts[0][0], 0]);
      // Irregular curve through all stations: every segment gets its own
      // swing (deterministic, so it looks the same on every visit), and the
      // station marked data-loop gets an extra loop.
      var loops = stations.map(function (st) { return st.hasAttribute('data-loop'); });
      loops.unshift(false);
      var wob = function (i, k) { return Math.sin(i * 12.9898 + k * 78.233) * 43758.5453 % 1; };
      var narrow = tr.width < 600;
      var swing = narrow ? 24 : 110;
      var d = 'M' + pts[0][0] + ',' + pts[0][1];
      var cur = pts[0];
      for (var i = 1; i < pts.length; i++) {
        var b = pts[i], dy = b[1] - cur[1];
        var c1 = [cur[0] + wob(i, 1) * swing, cur[1] + dy * (0.35 + 0.3 * Math.abs(wob(i, 2)))];
        var c2 = [b[0] + wob(i, 3) * swing, b[1] - dy * (0.25 + 0.35 * Math.abs(wob(i, 4)))];
        d += ' C' + c1[0].toFixed(1) + ',' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ',' + c2[1].toFixed(1) + ' ' + b[0] + ',' + b[1];
        cur = b;
        if (loops[i]) {
          // a loop that leaves the dot downwards, circles round and crosses itself
          var r = narrow ? 30 : 72, x = b[0], y = b[1];
          d += ' C' + (x + r * 0.3) + ',' + (y + r * 1.4) + ' ' + (x + r * 2.2) + ',' + (y + r * 1.6) + ' ' + (x + r * 2) + ',' + (y + r * 0.4);
          d += ' C' + (x + r * 1.8) + ',' + (y - r * 0.9) + ' ' + (x + r * 0.2) + ',' + (y - r * 0.6) + ' ' + (x + r * 0.4) + ',' + (y + r * 0.8);
          cur = [x + r * 0.4, y + r * 0.8];
        }
      }
      pathBg.setAttribute('d', d);
      pathFg.setAttribute('d', d);
      total = pathFg.getTotalLength();
      pathFg.style.strokeDasharray = total;
      lut = [];
      for (var l = 0; l <= total; l += 8) lut.push([l, pathFg.getPointAtLength(l).y]);
      updateJourney();
    };
    var updateJourney = function () {
      var tr = track.getBoundingClientRect();
      var target = reduce ? Infinity : window.innerHeight * 0.62 - tr.top; // y inside the track
      var drawn = total;
      for (var i = 0; i < lut.length; i++) { if (lut[i][1] > target) { drawn = lut[i][0]; break; } }
      pathFg.style.strokeDashoffset = (total - drawn).toFixed(1);
      // parallax: images drift against the scroll direction inside their frame
      if (!reduce) track.querySelectorAll('.station__frame').forEach(function (f) {
        var r = f.getBoundingClientRect();
        var rel = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight; // -1..1 around centre
        var fi = f.querySelector('img'); if (fi && !fi.closest('.station__media--illu')) fi.style.setProperty('--parallax', (rel * -0.18 * r.height).toFixed(1) + 'px');
      });
      stations.forEach(function (st) {
        var d = st.querySelector('.station__dot').getBoundingClientRect();
        st.classList.toggle('is-reached', reduce || d.top + d.height / 2 < window.innerHeight * 0.62);
      });
    };
    window.addEventListener('scroll', updateJourney, { passive: true });
    var jrt;
    window.addEventListener('resize', function () { clearTimeout(jrt); jrt = setTimeout(buildPath, 150); });
    window.addEventListener('load', buildPath);
    buildPath();
  }

  // About page: ":Photography" changes colour as you scroll
  var farben = document.querySelectorAll('.punktaufz.farben, .punktaufz .farben');
  if (farben.length) {
    var stops = [[0, [0, 0, 0]], [8, [97, 5, 5]], [16, [182, 161, 8]], [28, [42, 17, 155]], [40, [228, 149, 0]], [53, [0, 0, 0]]];
    function colourAt(p) {
      for (var i = 1; i < stops.length; i++) {
        if (p <= stops[i][0]) {
          var a = stops[i - 1], b = stops[i], t = (p - a[0]) / (b[0] - a[0]);
          return 'rgb(' + a[1].map(function (v, k) { return Math.round(v + (b[1][k] - v) * t); }).join(',') + ')';
        }
      }
      return 'rgb(0,0,0)';
    }
    function onScroll() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max * 100 : 0;
      farben.forEach(function (el) { el.style.color = colourAt(p); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // About page: "Stay up to date" cycles through colours on hover
  document.querySelectorAll('.link-13').forEach(function (el) {
    el.addEventListener('mouseenter', function () { el.classList.add('is-cycling'); });
    el.addEventListener('mouseleave', function () { el.classList.remove('is-cycling'); });
  });
  // Before/after sliders: two identical page views on top of each other; a line sweeps across
  // on its own (grey "before" turns into blue "after") until you drag it yourself
  document.querySelectorAll('[data-compare]').forEach(function (fig) {
    var range = fig.querySelector('.compare__range'), auto = false, visible = false, t0 = null;   // no automatic sweep: the line rests in the middle until you drag it
    var set = function (v) { fig.style.setProperty('--pos', v + '%'); };
    set(range.value);
    var stopAuto = function () { auto = false; };
    range.addEventListener('input', function () { stopAuto(); set(range.value); });
    ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) { range.addEventListener(ev, stopAuto, { passive: true }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.4 }).observe(fig);
    var sweep = function (now) {
      if (!auto) return;
      if (visible) {
        if (t0 === null) t0 = now;
        var v = 50 - 46 * Math.cos((now - t0) / 1000 * Math.PI / 3);   // slow back-and-forth, 6 s per sweep
        range.value = v; set(v);
      }
      requestAnimationFrame(sweep);
    };
    requestAnimationFrame(sweep);
  });
  // About timeline: cards sit at the start of their bar; push them down where they would overlap
  var tl = document.querySelector('.tl__body');
  if (tl) {
    var tlItems = [].slice.call(tl.querySelectorAll('.tl__item'));
    var layoutTl = function () {
      var mobile = window.matchMedia('(max-width: 767px)').matches, bottom = 0;
      var groups = mobile ? [tlItems] : [tlItems.filter(function (li) { return li.classList.contains('tl__item--edu'); }),
                                          tlItems.filter(function (li) { return li.classList.contains('tl__item--work'); })];
      groups.forEach(function (g) {
        var last = -1e9;
        g.map(function (li) { return { li: li, want: parseFloat(getComputedStyle(li).getPropertyValue(mobile ? '--card-m' : '--card')) }; })
         .sort(function (a, b) { return a.want - b.want; })
         .forEach(function (o) {
           var card = o.li.querySelector('.tl__card'), top = Math.max(o.want, last + 16);
           card.style.top = top + 'px'; last = top + card.offsetHeight; bottom = Math.max(bottom, last);
         });
      });
      var bars = tlItems.map(function (li) { return parseFloat(getComputedStyle(li).getPropertyValue('--bot')); });
      tl.style.height = Math.max(bottom, Math.max.apply(null, bars)) + 24 + 'px';
    };
    layoutTl();
    window.addEventListener('resize', layoutTl);
    window.addEventListener('load', layoutTl);
  }
  // About timeline: each station is a hand-drawn, gently waving line. Always visible as a faint
  // dashed trace; it is drawn in its colour (education black, work in the employer's colour)
  // as the page scrolls past it.
  var tlBody = document.querySelector('.tl__body');
  if (tlBody) {
    var NS = 'http://www.w3.org/2000/svg';
    var wsvg = document.createElementNS(NS, 'svg');
    wsvg.setAttribute('class', 'tl__waves'); wsvg.setAttribute('aria-hidden', 'true');
    tlBody.insertBefore(wsvg, tlBody.firstChild);
    var waves = [];
    var drawWaves = function () {
      wsvg.innerHTML = ''; waves = [];
      var box = tlBody.getBoundingClientRect();
      wsvg.setAttribute('width', box.width); wsvg.setAttribute('height', tlBody.offsetHeight);
      [].forEach.call(tlBody.querySelectorAll('.tl__item'), function (li, k) {
        var bar = li.querySelector('.tl__bar').getBoundingClientRect();
        var x = bar.left - box.left + bar.width / 2, y0 = bar.top - box.top, y1 = bar.bottom - box.top;
        var d = 'M' + x.toFixed(1) + ' ' + y0.toFixed(1), amp = 5, wl = 70, ph = k * 1.7;
        for (var y = y0 + 4; y <= y1; y += 4) d += ' L' + (x + Math.sin((y - y0) / wl * 6.283 + ph) * amp).toFixed(1) + ' ' + y.toFixed(1);
        var bg = document.createElementNS(NS, 'path'), fg = document.createElementNS(NS, 'path');
        bg.setAttribute('d', d); bg.setAttribute('class', 'tl__wave-bg');
        fg.setAttribute('d', d); fg.setAttribute('class', 'tl__wave');
        fg.style.stroke = li.dataset.color || '#111';
        wsvg.appendChild(bg); wsvg.appendChild(fg);
        var len = fg.getTotalLength(); fg.style.strokeDasharray = len; fg.style.strokeDashoffset = len;
        waves.push({ fg: fg, len: len, y0: y0, y1: y1 });
      });
      paintWaves();
    };
    var paintWaves = function () {
      var top = tlBody.getBoundingClientRect().top, line = window.innerHeight * 0.7 - top;
      waves.forEach(function (w) {
        var p = Math.max(0, Math.min(1, (line - w.y0) / (w.y1 - w.y0)));
        w.fg.style.strokeDashoffset = (w.len * (1 - p)).toFixed(1);
      });
    };
    window.addEventListener('scroll', paintWaves, { passive: true });
    window.addEventListener('resize', function () { setTimeout(drawWaves, 60); });
    window.addEventListener('load', drawWaves);
    setTimeout(drawWaves, 80);
  }
  // About: the journey is one line with gentle curves that grows while scrolling. Each station
  // sits on the line; it lights up in its colour once the line reaches it.
  var jr = document.querySelector('.journey');
  if (jr) {
    var NSJ = 'http://www.w3.org/2000/svg';
    var jsvg = document.createElementNS(NSJ, 'svg');
    jsvg.setAttribute('class', 'journey__svg'); jsvg.setAttribute('aria-hidden', 'true');
    jr.insertBefore(jsvg, jr.firstChild);
    var jStops = [].slice.call(jr.querySelectorAll('.journey__stop'));
    var jCx = 0, jTodayY = 0, jLine = null, jLen = 0, jYs = [], jEnd = 0, jNow = 0, jTopY = 0, jClip = null;
    var jDraw = function () {
      // Drawn like a transit map: a straight main line with fine year ticks, big hollow stations,
      // the SimpleTrain track branching off to the left and the master's lane to the right
      var w = jr.offsetWidth, mobile = window.matchMedia('(max-width: 767px)').matches;
      var wide = jr.classList.contains('journey--wide');
      var cx = mobile ? 40 : w / 2, offL = mobile ? -26 : (wide ? -96 : -58), offR = mobile ? 26 : (wide ? 96 : 58), R = mobile ? 50 : (wide ? 110 : 60);   // desktop: work (and the track) left, education (and the master's lane) right   // desktop: education left, work (and the track) right
      jr.style.setProperty('--jcx', cx + 'px');   // the side headings sit around the line
      var PPY = mobile ? (wide ? 90 : 80) : (wide ? 84 : 66), curTop = 0;   // wide: lots of room, it grows while scrolling   // compact
      var yrOf = function (li, last) {   // exact dates from data-start / data-end (e.g. 2019.5 = mid-2019), else the years in the text
        var dv = last ? li.dataset.end : li.dataset.start;
        if (dv) return +dv;
        var m = ((li.querySelector('.tl__time') || {}).textContent || '').match(/(?:19|20)\d\d/g);
        return m ? +(last ? m[m.length - 1] : m[0]) : new Date().getFullYear();
      };
      // 2018 at the top, today at the bottom
      var list = jr.querySelector('.journey__list'), bottoms = { work: -1e9, edu: -1e9 }, maxBottom = 0;
      list.style.position = 'relative';
      var listTop = list.getBoundingClientRect().top - jsvg.getBoundingClientRect().top;   // list position in drawing coordinates
      var yMaxYr = Math.max.apply(null, jStops.map(function (li) { return yrOf(li, true); })) + 0.9;   // the track runs on well past 2027 to today's point
      var yMinYr = Math.min.apply(null, jStops.map(function (li) { return yrOf(li); }));
      var chips = document.querySelector('.split--about .punktaufz'), stk = document.querySelector('.split--about .split__sticky'), sec = jr.closest('section');
      if (!mobile && !wide && chips && stk && sec) {   // no taller than the text column on the left (title to the chips)
        var avail = (chips.getBoundingClientRect().bottom - stk.getBoundingClientRect().top) - (list.getBoundingClientRect().top - sec.getBoundingClientRect().top);
        PPY = Math.max(40, Math.min(66, (avail - 34) / (yMaxYr - yMinYr)));   // the black «today» point level with the bottom of the chips
      }
      var yLocal = function (yr) { return (yr - yMinYr) * PPY + 24; };   // 2018 at the top, today at the bottom
      var yAtYear = function (yr) { return yLocal(yr) + listTop; };
      jYs = jStops.map(function () { return 0; });
      var order = jStops.map(function (li, k) {
        return { li: li, k: k, mid: yLocal(yrOf(li)) - 4 };   // the title sits level with its start point
      }).sort(function (p, q) { return p.mid - q.mid; });
      order.forEach(function (o) {
        var li = o.li, side = mobile ? 'work' : (li.classList.contains('journey__stop--edu') ? 'edu' : 'work');
        li.style.position = 'absolute'; li.style.left = '0'; li.style.right = '0'; li.style.marginTop = '0';
        var card = li.querySelector('.journey__card'), role = li.querySelector('.tl__role');
        if (!mobile) {   // final size first, so the heights are right
          card.style.setProperty('width', 'fit-content', 'important'); card.style.setProperty('max-width', (wide ? '340px' : '260px'), 'important');
          card.style.setProperty('text-align', side === 'work' ? 'right' : 'left', 'important');
        }
        var roleMid = role ? role.getBoundingClientRect().top - li.getBoundingClientRect().top + Math.min(role.offsetHeight, 18) / 2 : 18;
        var top = Math.max(o.mid + 4 - roleMid, bottoms[side] + 12);   // the title level with its point, with some air to the text above
        li.style.top = top + 'px';
        bottoms[side] = top + li.offsetHeight; maxBottom = Math.max(maxBottom, bottoms[side]);
        jYs[o.k] = top + 18 + listTop;
      });
      var y0Year = Math.min.apply(null, jStops.map(function (li) { return yrOf(li); }));
      list.style.height = Math.max(maxBottom, yLocal(yMaxYr) + 40) + 30 + 'px';   // room for the track and the master's end below the last station
      var last = jYs.length - 1;
      var table = [[y0Year, 0]];
      var firstYr = Math.floor(table[0][0]), lastYr = Math.floor(Math.max.apply(null, jStops.map(function (li) { return yrOf(li, true); })));
      var yTop = yAtYear(yMinYr); jTopY = yTop;
      var yFuture = yAtYear(yMaxYr);
      // from mid-2025 on there is only the SimpleTrain track: the line ends there, the track carries on
      jNow = yAtYear(2025.5);   // the line ends here, below it only the track
      var yOld = yAtYear(y0Year);
      jEnd = yFuture + 30;
      // the main line swings gently; branches follow it and leave / rejoin in wide, soft curves
      var xAt = function (y) { return cx; };   // a straight line
      var ease = function (t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
      var bX = function (y, y1, y2, dx) { var r = Math.min(R, (y2 - y1) / 2.2); return xAt(y) + dx * Math.min(ease((y - y1) / r), ease((y2 - y) / r)); };
      var along = function (y1, y2, fx) { var p = 'M' + fx(y1).toFixed(1) + ' ' + y1.toFixed(1); for (var y = y1 + 4; y < y2; y += 4) p += ' L' + fx(y).toFixed(1) + ' ' + y.toFixed(1); return p + ' L' + fx(y2).toFixed(1) + ' ' + y2.toFixed(1); };
      var d = along(yOld, jNow, xAt);
      var branch = function (y1, y2, dx) { return along(y1, y2, function (y) { return bX(y, y1, y2, dx); }); };
      var extra = '';
      var tk = jStops.map(function (li) { return li.dataset.track === 'start'; }).indexOf(true);
      if (tk > -1) {   // SimpleTrain: a real track (rails + sleepers) until «Now»
        var t1 = yAtYear(yrOf(jStops[tk]));   // leaves the line just before 2020 (own station), comes back mid-2025 and carries on
        extra += '<path class="journey__sleepers" d="' + branch(t1, jNow, offL) + along(jNow, yFuture, xAt).replace(/^M/, ' L') + '"/>';   // leaves the line in 2019, rejoins mid-2025 and goes on alone
      }
      var laneIdx = jStops.map(function (li, k) { return li.dataset.lane ? k : -1; }).filter(function (k) { return k > -1; });
      if (laneIdx.length) {   // master's: from HSLU to FHGR, joins the line again below «Now»
        var laneEnd = yAtYear(yrOf(jStops[laneIdx[laneIdx.length - 1]], true));
        var laneStart = yAtYear(yrOf(jStops[laneIdx[0]]));
        extra += '<path class="journey__lane is-edu" d="' + branch(laneStart, laneEnd, offR) + '"/>';   // joins the track when the master's ends
      }
      var ticks = '', noTicks = true;
      for (var yr = firstYr; yr <= lastYr + 1; yr++) {   // one more tick for 2027, without a number
        var ty = yAtYear(yr).toFixed(1), lab = '';   // no year numbers
        var tx = xAt(+ty);
        ticks += '<line class="journey__tick" x1="' + (tx - 7).toFixed(1) + '" x2="' + (tx + 7).toFixed(1) + '" y1="' + ty + '" y2="' + ty + '"/>' +
          '<text class="journey__year" x="' + (yr === firstYr && !mobile ? tx + 16 : tx - 16).toFixed(1) + '" y="' + (+ty + 4).toFixed(1) + '" text-anchor="' + (yr === firstYr && !mobile ? 'start' : 'end') + '">' + lab + '</text>';
      }
      jsvg.innerHTML = '<clipPath id="jclip"><rect x="-50" y="0" width="' + (w + 100) + '" height="0"/></clipPath>' +
        '<path class="journey__bg" d="' + d + '"/>' + (noTicks ? '' : '<g class="journey__ticks">' + ticks + '</g>') +
        '<g clip-path="url(#jclip)">' + extra + '</g><path class="journey__line" d="' + d + '"/>';
      var sl = jsvg.querySelector('.journey__sleepers');
      if (sl) {   // two rails at a constant distance from the centre of the track, also in the curves
        var L = sl.getTotalLength(), A = [], B = [];
        for (var u = 0; u <= L; u += 3) {
          var p0 = sl.getPointAtLength(Math.max(0, u - 1)), p1 = sl.getPointAtLength(Math.min(L, u + 1)), pc = sl.getPointAtLength(u);
          var dx = p1.x - p0.x, dy = p1.y - p0.y, n = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / n * 2.6, ny = dx / n * 2.6;
          A.push((pc.x + nx).toFixed(1) + ' ' + (pc.y + ny).toFixed(1)); B.push((pc.x - nx).toFixed(1) + ' ' + (pc.y - ny).toFixed(1));
        }
        sl.insertAdjacentHTML('afterend', '<path class="journey__rail" d="M' + A.join(' L') + '"/><path class="journey__rail" d="M' + B.join(' L') + '"/>');
      }
      // the line is cut into pieces at every station: each piece has a round point at both ends
      var stopsY = [];   // the line starts at the first station
      jStops.forEach(function (li, k) {
        var onL = li.dataset.lane && k !== laneIdx[0];
        if (onL) return;
        if (k !== tk) stopsY.push(k === last ? jNow : yAtYear(yrOf(li)));   // the SimpleTrain track branches off without cutting the line
      });
      var starts = stopsY.slice();
      jStops.forEach(function (li, k) {   // ends cut the line too, unless a station starts right there anyway
        if (!li.dataset.end || k === tk || li.dataset.lane) return;
        var ye = Math.min(jNow, yAtYear(yrOf(li, true)));
        if (!starts.some(function (v) { return Math.abs(v - ye) < 16; })) stopsY.push(ye);
      });
      stopsY.push(jNow);
      stopsY.sort(function (p, q) { return p - q; });
      var cuts = stopsY.filter(function (v, i) { return i === 0 || v - stopsY[i - 1] > 8; });   // dates that close together share one cut
      var gap = 0, rr = mobile ? 5 : 5.5, segs = '';   // one continuous line, points mark the dates   // small enough that close dates (e.g. 2019) stay apart
      for (var c = 0; c < cuts.length - 1; c++) {
        var ya = cuts[c] + (c === 0 ? 0 : gap), yb = cuts[c + 1] - (c + 1 === cuts.length - 1 ? 0 : gap);
        if (yb - ya < 1) yb = ya + 1;   // very short pieces still show their two points
        segs += '<path class="journey__seg" d="' + along(ya, yb, xAt) + '"/>' +
          '<circle class="journey__node" cx="' + xAt(ya).toFixed(1) + '" cy="' + ya.toFixed(1) + '" r="' + rr + '"/><circle class="journey__node" cx="' + xAt(yb).toFixed(1) + '" cy="' + yb.toFixed(1) + '" r="' + rr + '"/>';
      }
      laneIdx.forEach(function (k, i) {   // stations on the master's lane
        if (i === 0) return;
        var ny = yAtYear(yrOf(jStops[k]));
        segs += '<circle class="journey__node" cx="' + bX(ny, laneStart, laneEnd, offR).toFixed(1) + '" cy="' + ny.toFixed(1) + '" r="' + rr + '"/>';
      });
      if (tk > -1) segs += '<circle class="journey__node" cx="' + xAt(t1).toFixed(1) + '" cy="' + t1.toFixed(1) + '" r="' + rr + '"/>';   // SimpleTrain starts here
      if (laneIdx.length) segs += '<circle class="journey__node" cx="' + xAt(laneEnd).toFixed(1) + '" cy="' + laneEnd.toFixed(1) + '" r="' + rr + '"/>';   // master's completed
      segs += '<circle class="journey__today" cx="' + xAt(yFuture).toFixed(1) + '" cy="' + yFuture.toFixed(1) + '" r="' + (rr + 5.5) + '"/>';   // today: a black point at the very end of the track
      var note = list.querySelector('.journey__note');
      if (note) {   // today's sentence beside the black point
        note.style.position = 'absolute'; note.style.margin = '0';
        var nx = xAt(yFuture);
        if (mobile) { note.style.left = (nx + rr + 12) + 'px'; note.style.right = '0'; note.style.textAlign = 'left'; }
        else { note.style.left = 'auto'; note.style.right = (w - (nx - rr - 14)).toFixed(0) + 'px'; note.style.width = wide ? '340px' : '260px'; note.style.textAlign = 'right'; }
        var nr = note.querySelector('.tl__role'), nMid = nr ? nr.getBoundingClientRect().top - note.getBoundingClientRect().top + Math.min(nr.offsetHeight, 18) / 2 : 0;
        var nTop = yFuture - listTop - nMid;
        note.style.top = nTop.toFixed(1) + 'px';
        list.style.height = Math.max(parseFloat(list.style.height) || 0, nTop + note.offsetHeight + 24) + 'px';
      }
      var nodes = segs.match(/<circle[^>]*\/>/g) || [];   // points after all line pieces, so they sit on top
      segs = segs.replace(/<circle[^>]*\/>/g, '') + nodes.join('');
      jsvg.querySelector('g[clip-path]').insertAdjacentHTML('beforeend', segs);
      jTodayY = yFuture;
      var marks = [];   // which side each station point belongs to (for the hover)
      jStops.forEach(function (li, k) {
        var side = li.classList.contains('journey__stop--edu') ? 'edu' : 'work', onL = li.dataset.lane && k !== laneIdx[0];
        var ys = [k === last ? jNow : yAtYear(yrOf(li))];
        if (li.dataset.end) ys.push(li.dataset.lane ? yAtYear(yrOf(li, true)) : Math.min(jNow, yAtYear(yrOf(li, true))));
        ys.forEach(function (y, i) { marks.push({ y: y, x: onL && i === 0 ? bX(y, laneStart, laneEnd, offR) : xAt(y), side: side }); });
      });
      [].forEach.call(jsvg.querySelectorAll('circle.journey__node'), function (c) {
        var cy = +c.getAttribute('cy'), cxx = +c.getAttribute('cx'), sides = {};
        marks.forEach(function (m) { if (Math.abs(m.y - cy) < 3 && Math.abs(m.x - cxx) < 3) sides[m.side] = 1; });
        var ks = Object.keys(sides); if (ks.length === 1) c.classList.add('is-' + ks[0]);
      });
      [].forEach.call(jsvg.querySelectorAll('.journey__sleepers, .journey__rail'), function (e) { e.classList.add('is-work'); });
      jCx = cx;
      jLine = jsvg.querySelector('.journey__line'); jLen = jLine.getTotalLength(); jClip = jsvg.querySelector('#jclip rect');
      jLine.style.strokeDasharray = jLen;
      jStops.forEach(function (li, k) {   // the FHGR station sits on the master's lane
        var dot = li.querySelector('.journey__dot'), onLane = li.dataset.lane && k !== laneIdx[0];
        dot.style.left = (cx + (onLane ? offR : 0)) + 'px';
        var dotY = k === last ? jNow : yAtYear(yrOf(li));   // «Now» where only the track is left; FHGR in mid-2024
        dot.style.top = (15 + dotY - jYs[k]).toFixed(1) + 'px';   // the point marks the start, the text may sit a little lower
      });
      if (!mobile) {   // texts in two columns, each joined to its point by a fine line
        var leaders = '', svgTop = jsvg.getBoundingClientRect().top;
        var reachAt = function (y, edu) {   // how far the track (left) or the master's lane (right) sticks out from the line at this height
          if (!edu && tk > -1 && y >= t1 && y <= jNow) return xAt(y) - bX(y, t1, jNow, offL) + 6;
          if (edu && laneIdx.length && y >= laneStart && y <= laneEnd) return bX(y, laneStart, laneEnd, offR) - xAt(y) + 3;
          return 0;
        };
        jStops.forEach(function (li, k) {   // each text as close to its point as it can be, only pushed out where a track is in the way
          var card = li.querySelector('.journey__card'), edu = li.classList.contains('journey__stop--edu');
          var py = k === last ? jNow : yAtYear(yrOf(li)), px = xAt(py);
          if (li.dataset.lane && k !== laneIdx[0]) px = bX(py, laneStart, laneEnd, offR);
          var cb = card.getBoundingClientRect(), ct = Math.min(cb.top - svgTop, py - 8), cbm = Math.max(cb.bottom - svgTop, py + 8);
          var reach = Math.abs(px - xAt(py)) + rr;
          for (var yy = ct; yy <= cbm; yy += 3) reach = Math.max(reach, reachAt(yy, edu));
          var e = edu ? xAt(py) + reach + 14 : xAt(py) - reach - 14;   // near edge of the text
          if (!edu) { card.style.setProperty('margin-left', 'auto', 'important'); card.style.setProperty('margin-right', (w - e).toFixed(0) + 'px', 'important'); }   // work: left of the line
          else { card.style.setProperty('margin-left', e.toFixed(0) + 'px', 'important'); card.style.setProperty('margin-right', '0', 'important'); }   // education: right of the line
          var sx = px + (edu ? rr + 2 : -rr - 2), ex = e + (edu ? -4 : 4);
          var role = card.querySelector('.tl__role') || card, rb = role.getBoundingClientRect(), ty = rb.top - svgTop + Math.min(rb.height, 18) / 2;   // always to the title
          if (Math.abs(ex - sx) > 3) leaders += '<line class="journey__leader is-' + (edu ? 'edu' : 'work') + '" x1="' + sx.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + ex.toFixed(1) + '" y2="' + ty.toFixed(1) + '"/>';
        });
        jsvg.insertAdjacentHTML('afterbegin', '<g class="journey__leaders">' + leaders + '</g>');
      } else {   // phone: every text on the right, joined to its point by a fine line to its title
        var mLead = '', sb = jsvg.getBoundingClientRect();
        jStops.forEach(function (li, k) {
          var edu = li.classList.contains('journey__stop--edu'), py = k === last ? jNow : yAtYear(yrOf(li)), px = xAt(py);
          if (li.dataset.lane && k !== laneIdx[0]) px = bX(py, laneStart, laneEnd, offR);
          var role = li.querySelector('.tl__role') || li, rb = role.getBoundingClientRect();
          var ex = rb.left - sb.left - 6, ty = rb.top - sb.top + Math.min(rb.height, 18) / 2, sx = px + rr + 2;
          if (ex - sx > 3) mLead += '<line class="journey__leader is-' + (edu ? 'edu' : 'work') + '" x1="' + sx.toFixed(1) + '" y1="' + py.toFixed(1) + '" x2="' + ex.toFixed(1) + '" y2="' + ty.toFixed(1) + '"/>';
        });
        jsvg.insertAdjacentHTML('afterbegin', '<g class="journey__leaders">' + mLead + '</g>');
      }
      jPaint();
    };
    // Hovering one side greys out the other: on «Work» the education stops and lines turn light grey, and the other way round
    jr.addEventListener('mousemove', function (e) {
      if (window.matchMedia('(max-width: 767px)').matches) return;
      var side = e.clientX - jsvg.getBoundingClientRect().left < jCx ? 'work' : 'edu';
      jr.classList.toggle('hover-work', side === 'work'); jr.classList.toggle('hover-edu', side === 'edu');
    });
    jr.addEventListener('mouseleave', function () { jr.classList.remove('hover-work', 'hover-edu'); });
    // When the timeline comes into view, the lines grow once, slowly, from 2018 down to today.
    // Line pieces and the master's lane grow with round ends; the rails are simply revealed.
    var jShown = 0, jRaf = 0, jT0 = 0, JDUR = 4200, jParts = null;
    var jEase = function (t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var jWide = jr.classList.contains('journey--wide');
    var jTarget = function () {
      if (jWide) {   // the line follows the scrolling: its tip sits a little below the middle of the window
        var upto = window.innerHeight * 0.62 - jsvg.getBoundingClientRect().top;
        return Math.max(0, Math.min(1, (upto - jTopY + 20) / Math.max(1, jEnd - jTopY + 40)));
      }
      if (!jT0) {
        var r = jr.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.85 && r.bottom > 0) jT0 = performance.now(); else return 0;
      }
      return jEase(Math.min(1, (performance.now() - jT0) / JDUR));
    };
    var jPrep = function () {   // measure every growing path once per drawing
      var g = jsvg.querySelector('g[clip-path]');
      if (g) {
        g.removeAttribute('clip-path');
        [].forEach.call(g.querySelectorAll('.journey__sleepers, .journey__rail'), function (el) { el.setAttribute('clip-path', 'url(#jclip)'); });
      }
      jParts = [].map.call(jsvg.querySelectorAll('.journey__seg, .journey__lane'), function (el) {
        var bb = el.getBBox(), len = el.getTotalLength();
        el.style.strokeDasharray = len + ' ' + len;
        return { el: el, y1: bb.y, y2: bb.y + bb.height, len: len };
      });
    };
    var jApply = function (p) {
      var upto = jTopY - 20 + p * (jEnd - jTopY + 40);   // drawn from the top (2018) down to here
      if (jClip) { jClip.setAttribute('y', '-20'); jClip.setAttribute('height', (upto + 20).toFixed(0)); }
      if (jParts) jParts.forEach(function (o) {
        var f = Math.max(0, Math.min(1, (upto - o.y1) / Math.max(1, o.y2 - o.y1)));
        o.el.style.strokeDashoffset = (o.len * (1 - f)).toFixed(1);
        o.el.style.visibility = f > 0 ? 'visible' : 'hidden';
      });
      jStops.forEach(function (li, k) { li.classList.toggle('is-on', p >= 0.999 || jYs[k] - 30 <= upto); });
      var td = jsvg.querySelector('.journey__today');   // the colourful point waits for the line
      if (td && jTodayY) {   // the point pops up, and its sentence appears, once the line has arrived
        var arrived = upto >= jTodayY - 2, nt = jr.querySelector('.journey__note');
        td.classList.toggle('is-shown', arrived);
        if (nt) nt.classList.toggle('is-shown', arrived);
      }
    };
    var jLastF = 0;
    var jStep = function () {
      jLastF = performance.now();
      var t = jTarget();
      if (jWide) { jShown += (t - jShown) * 0.12; if (Math.abs(t - jShown) < 0.0008) jShown = t; } else jShown = t;   // eases after the scroll
      jApply(jShown);
      jRaf = (jWide ? jShown !== t : jShown < 1) ? requestAnimationFrame(jStep) : 0;
    };
    var jPaint = function () {
      if (!jLine) return;
      if (!jParts || !jParts.length || !document.contains(jParts[0].el)) jPrep();
      if (document.hidden) { if (jT0) jT0 = performance.now() - JDUR; jShown = jTarget(); jApply(jShown); return; }   // hidden tab: no animation frames
      jApply(jShown);
      if (!jRaf && (jWide || jShown < 1)) jRaf = requestAnimationFrame(jStep);
    };
    document.addEventListener('visibilitychange', function () { jRaf = 0; jPaint(); });
    setInterval(function () { if (jLine && performance.now() - jLastF > 250 && (jWide || jShown < 1)) { jShown = jTarget(); jApply(jShown); } }, 120);   // keeps growing even where animation frames are paused
    window.addEventListener('scroll', jPaint, { passive: true });
    window.addEventListener('resize', function () { setTimeout(jDraw, 60); });
    window.addEventListener('load', jDraw);
    jDraw();
  }
  // Rows of videos that belong together (e.g. the 1824 iris trio) always run in sync:
  // they start together when the row comes into view and pause together when it leaves
  document.querySelectorAll('.iris-trio').forEach(function (row) {
    var vids = [].slice.call(row.querySelectorAll('video'));
    var go = function () {
      if (!vids.every(function (v) { return v.paused; })) return;
      var t = vids[0].currentTime;
      vids.forEach(function (v) { v.muted = true; v.currentTime = t; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); });
    };
    var stop = function () { vids.forEach(function (v) { v.pause(); }); };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) go(); else stop(); }, { threshold: .2 }).observe(row);
    } else go();
    vids.forEach(function (v) { v.addEventListener('canplay', function () { var r = row.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) go(); }, { once: true }); });
  });

  // Buttons bob gently up and down while the page is scrolled, each a little out of step
  (function () {
    if (reduce) return;
    var sel = '.navigation-item-copy, .navigation-item-copy-2, .back-link, .project-nav__link, .project-nav__dice, .surprise-btn';
    var energy = 0, lastY = window.scrollY, ph = 0, raf = 0, last = performance.now();
    var tick = function (now) {
      var dt = Math.min(.1, (now - last) / 1000); last = now;
      energy *= Math.pow(.2, dt); ph += dt * 7;
      var btns = document.querySelectorAll(sel), still = energy < .01;
      [].forEach.call(btns, function (b, i) {
        b.style.translate = still ? '' : '0 ' + (Math.sin(ph + i * 0.9) * 3.5 * energy).toFixed(2) + 'px';
      });
      raf = still ? 0 : requestAnimationFrame(tick);
    };
    window.addEventListener('scroll', function () {
      energy = Math.min(1, energy + Math.abs(window.scrollY - lastY) * .006); lastY = window.scrollY;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }, { passive: true });
  })();

  // two-version images (e.g. «Fit for Future»): switch back and forth every few seconds
  document.querySelectorAll('.crossfade').forEach(function (c) {
    if (reduce) return;
    setInterval(function () { c.classList.toggle('is-b'); }, 2500);
  });
  // Contact form (about page): sent to Basin in the background, answer shown below the button.
  document.querySelectorAll('form[data-basin]').forEach(function (form) {
    var status = form.querySelector('.msg__status');
    var send = form.querySelector('.msg__send');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      send.disabled = true;
      status.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); })
        .then(function () { form.reset(); status.textContent = 'Thank you! Your message has been sent.'; })
        .catch(function () { status.textContent = 'Sorry, that did not work. Please try again later or write me on Instagram (@k.hugentobler).'; })
        .then(function () { send.disabled = false; });
    });
  });
  // Links to a spot on the same page (e.g. «Contact me!» → the contact form): glide down instead of jumping
  document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return;
      e.preventDefault();
      history.replaceState(null, '', a.getAttribute('href'));
      var from = window.scrollY, to = from + target.getBoundingClientRect().top - (parseFloat(getComputedStyle(target).scrollMarginTop) || 0);
      if (reduce) { window.scrollTo(0, to); return; }
      var dist = to - from, dur = Math.min(1400, Math.max(600, Math.abs(dist) * .45)), t0 = performance.now();
      var done = false;
      var step = function () {
        if (done) return;
        var u = Math.min(1, (performance.now() - t0) / dur), k = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;   // ease in and out
        window.scrollTo(0, from + dist * k);
        if (u >= 1) { done = true; return; }
        next();
      };
      var raf, tmo;
      var next = function () {   // next screen frame – with a timer as backup in case frames are held back
        var go = function () { cancelAnimationFrame(raf); clearTimeout(tmo); step(); };
        raf = requestAnimationFrame(go); tmo = setTimeout(go, 24);
      };
      step();
    });
  });
})();
