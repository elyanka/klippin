// Version toggles and live token hex labels for the mockups page.
(function () {
  function hex(c) {
    var m = c.match(/rgba?\(([^)]+)\)/); if (!m) return c;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    var h = '#' + p.slice(0, 3).map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join('').toUpperCase();
    return p.length > 3 && p[3] < 1 ? h + ' · ' + Math.round(p[3] * 100) + '%' : h;
  }
  document.querySelectorAll('[data-tok]').forEach(function (el) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(el.dataset.tok).trim();
    if (v.indexOf('gradient') !== -1) { el.textContent = 'gradient'; return; }
    var probe = document.createElement('span'); probe.style.color = v; document.body.appendChild(probe);
    el.textContent = hex(getComputedStyle(probe).color); probe.remove();
  });
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem('klippin-mock-versions') || '{}'); } catch (e) {}
  function apply() {
    document.querySelectorAll('[data-show]').forEach(function (cb) {
      document.querySelectorAll('.version[data-v="' + cb.dataset.show + '"], .strip-row[data-v="' + cb.dataset.show + '"]').forEach(function (v) { v.hidden = !cb.checked; });
    });
  }
  document.querySelectorAll('[data-show]').forEach(function (cb) {
    if (cb.dataset.show in saved) cb.checked = saved[cb.dataset.show];
    cb.addEventListener('change', function () {
      saved[cb.dataset.show] = cb.checked;
      try { localStorage.setItem('klippin-mock-versions', JSON.stringify(saved)); } catch (e) {}
      apply();
    });
  });
  apply();

  var canvas = document.querySelector('.canvas'), zr = document.querySelector('[data-zoom]'), zl = document.querySelector('[data-zoom-label]');
  if (!canvas || !zr) { apply(); return; }
  var boards = [].slice.call(document.querySelectorAll('.layer-rows .board-wrap'));
  function meta(b) { var p = b.querySelector('.board-name span').textContent.split(' · '); return { layer: p[0], name: p.slice(1).join(' · ') }; }
  function dev(b, v) { var d = b.querySelector('.version[data-v="' + v + '"] .device'); d = d.cloneNode(true); d.dataset.v = v; return d; }

  // Rows view: one row per version, scrolled sideways in sync.
  var strip = document.createElement('div'); strip.className = 'strip';
  var heads = { 1: ['Today', 'Old values'], 2: ['Tokens', 'Iteration 1'], 3: ['Kit', 'Full target'] };
  // A page can name its own rows: <main class="canvas" data-heads='{"1":["Original","The app today"],…}'>
  try { var own = JSON.parse(document.querySelector('.canvas').dataset.heads || 'null'); if (own) heads = own; } catch (e) {}
  var scrollers = [];
  function row(v) {
    var r = document.createElement('div'); r.className = 'strip-row' + (v ? '' : ' strip-row--head');
    if (v) r.dataset.v = v;
    var lab = document.createElement('div'); lab.className = 'strip-label';
    if (v) lab.innerHTML = '<span class="vnum' + (v == 3 ? ' vnum--brand' : '') + '">' + v + '</span><b>' + heads[v][0] + '</b><span>' + heads[v][1] + '</span>';
    var sc = document.createElement('div'); sc.className = 'strip-scroll';
    r.appendChild(lab); r.appendChild(sc); strip.appendChild(r); scrollers.push(sc);
    return sc;
  }
  var rows = [row(0), row(1), row(2), row(3)], prevLayer = null;
  boards.forEach(function (b) {
    var m = meta(b), start = m.layer !== prevLayer; prevLayer = m.layer;
    rows.forEach(function (sc, v) {
      var cell = document.createElement('div'); cell.className = 'strip-cell' + (start ? ' layer-start' : '');
      if (v === 0) {
        cell.innerHTML = '<div class="strip-name">' + (start ? '<em>' + m.layer + '</em>' : '') + '<a href="#' + b.id + '"></a></div>';
        cell.querySelector('a').textContent = m.name;
        if (start) cell.dataset.layer = 'layer-' + m.layer.toLowerCase().replace(/ /g, '-');
        cell.dataset.board = b.id;
      } else cell.appendChild(dev(b, v));
      sc.appendChild(cell);
    });
  });
  canvas.insertBefore(strip, canvas.firstChild);
  // Whichever row the pointer is on leads; the others follow its scroll.
  var lead = scrollers[1];
  scrollers.forEach(function (s) {
    ['pointerenter', 'pointerdown', 'wheel', 'touchstart', 'focus'].forEach(function (ev) {
      s.addEventListener(ev, function () { lead = s; }, { passive: true });
    });
    s.addEventListener('scroll', function () {
      if (s !== lead) return;
      scrollers.forEach(function (o) { if (o !== s) o.scrollLeft = s.scrollLeft; });
    }, { passive: true });
  });

  // Board view: areas in app order, each a grid of screens, packed into balanced columns.
  var bview = document.createElement('div'), bc = document.createElement('div');
  bview.className = 'bview'; bc.className = 'bcanvas';
  var areas = [];
  boards.forEach(function (b) {
    var m = meta(b), a = areas[areas.length - 1];
    if (!a || a.layer !== m.layer) areas.push(a = { layer: m.layer, boards: [] });
    a.boards.push(b);
  });
  var PER_ROW = 10, COLS = 3;
  areas.forEach(function (a) {
    a.rows = Math.ceil(a.boards.length / PER_ROW);
    a.cols = Math.ceil(a.boards.length / a.rows);
  });
  // Split the ordered areas into COLS runs so the tallest column is as short as possible.
  function weight(i, j) { var w = 0; for (var k = i; k < j; k++) w += areas[k].rows + 0.4; return w; }
  var best = null;
  (function cut(start, left, acc) {
    if (left === 1) { var r = acc.concat([[start, areas.length]]), m = Math.max.apply(null, r.map(function (c) { return weight(c[0], c[1]); })); if (!best || m < best.m) best = { m: m, r: r }; return; }
    for (var e = start + 1; e <= areas.length - left + 1; e++) cut(e, left - 1, acc.concat([[start, e]]));
  })(0, Math.min(COLS, areas.length), []);
  var boardW = 480 + (best.r.length - 1) * 240;
  best.r.forEach(function (c) {
    boardW += 240 + Math.max.apply(null, areas.slice(c[0], c[1]).map(function (a) { return a.cols * 393 + (a.cols - 1) * 80; }));
    var col = document.createElement('div'); col.className = 'bcol';
    areas.slice(c[0], c[1]).forEach(function (a) {
      var sec = document.createElement('section'); sec.className = 'bsec';
      sec.dataset.layer = 'layer-' + a.layer.toLowerCase().replace(/ /g, '-');
      sec.innerHTML = '<h3>' + a.layer + '<small>' + a.boards.length + (a.boards.length === 1 ? ' screen' : ' screens') + '</small></h3>';
      var grid = document.createElement('div'); grid.className = 'bgrid'; grid.style.setProperty('--cols', a.cols);
      a.boards.forEach(function (b) {
        var cell = document.createElement('div'); cell.className = 'bcell'; cell.dataset.board = b.id;
        var lab = document.createElement('span'); lab.textContent = meta(b).name; cell.appendChild(lab);
        [1, 2, 3].forEach(function (v) { cell.appendChild(dev(b, v)); });
        grid.appendChild(cell);
      });
      sec.appendChild(grid); col.appendChild(sec);
    });
    bc.appendChild(col);
  });
  bview.appendChild(bc); canvas.insertBefore(bview, canvas.firstChild);
  var subnav = document.querySelector('.subnav');
  function fitHeight() { bview.style.height = (innerHeight - (parseFloat(getComputedStyle(subnav).top) || 0) - subnav.offsetHeight) + 'px'; }
  addEventListener('resize', fitHeight);
  // Drag to pan, Ctrl/Cmd + scroll to zoom around the pointer.
  var drag = null;
  bview.addEventListener('pointerdown', function (e) { if (e.button) return; drag = { x: e.clientX, y: e.clientY, l: bview.scrollLeft, t: bview.scrollTop }; bview.classList.add('dragging'); bview.setPointerCapture(e.pointerId); });
  bview.addEventListener('pointermove', function (e) { if (!drag) return; bview.scrollLeft = drag.l - (e.clientX - drag.x); bview.scrollTop = drag.t - (e.clientY - drag.y); });
  bview.addEventListener('pointerup', function () { drag = null; bview.classList.remove('dragging'); });
  bview.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    var r = bview.getBoundingClientRect(), old = view.bz / 100;
    var nz = Math.max(+zr.min, Math.min(+zr.max, Math.round(view.bz * (e.deltaY < 0 ? 1.1 : 0.9))));
    var px = e.clientX - r.left, py = e.clientY - r.top;
    var cx = (bview.scrollLeft + px) / old, cy = (bview.scrollTop + py) / old;
    setZoom(nz);
    bview.scrollLeft = cx * nz / 100 - px; bview.scrollTop = cy * nz / 100 - py;
  }, { passive: false });

  // State: view, per-view zoom, version on the board.
  var view = { mode: 'board', z: 30, bz: 0, pick: '3' };
  try { var sv = JSON.parse(localStorage.getItem('klippin-mock-view4') || '{}'); for (var k in sv) view[k] = sv[k]; } catch (e) {}
  function fitZoom() { return Math.max(3, Math.min(30, Math.floor((innerWidth - 32) / boardW * 100))); }
  if (!view.bz) view.bz = fitZoom();
  function save() { try { localStorage.setItem('klippin-mock-view4', JSON.stringify(view)); } catch (e) {} }
  function setZoom(z) {
    if (view.mode === 'board') { view.bz = z; document.body.style.setProperty('--bz', z / 100); }
    else { view.z = z; document.body.style.setProperty('--z', z / 100); }
    zr.value = z; zl.textContent = z + '%'; save();
  }
  function setMode(m) {
    view.mode = m;
    ['board', 'rows', 'list'].forEach(function (x) { document.body.classList.toggle('view-' + x, x === m); });
    document.querySelectorAll('[data-view]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.view === m); });
    document.body.style.setProperty('--z', view.z / 100); document.body.style.setProperty('--bz', view.bz / 100);
    zr.min = m === 'board' ? 3 : 20; zr.max = m === 'board' ? 60 : 100;
    var z = m === 'board' ? view.bz : view.z; zr.value = z; zl.textContent = z + '%';
    if (m === 'board') fitHeight();
    save();
  }
  function setPick(v) {
    view.pick = v; bc.dataset.v = v;
    document.querySelectorAll('[data-pick]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.pick === v); });
    save();
  }
  document.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.view); }); });
  document.querySelectorAll('[data-pick]').forEach(function (b) { b.addEventListener('click', function () { setPick(b.dataset.pick); }); });
  zr.addEventListener('input', function () { setZoom(+zr.value); });
  var fitBtn = document.querySelector('[data-fit]');
  if (fitBtn) fitBtn.addEventListener('click', function () { setZoom(fitZoom()); bview.scrollTo(0, 0); });
  document.addEventListener('keydown', function (e) {
    if (view.mode !== 'board' || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === '1' || e.key === '2' || e.key === '3') setPick(e.key);
  });

  // Layer links jump inside the board or the rows instead of the page.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || view.mode === 'list') return;
    var id = a.getAttribute('href').slice(1);
    if (view.mode === 'rows') {
      var cell = rows[0].querySelector('[data-layer="' + id + '"]') || rows[0].querySelector('[data-board="' + id + '"]');
      if (!cell) return;
      e.preventDefault(); lead = scrollers[0];
      scrollers[0].scrollTo({ left: cell.offsetLeft - scrollers[0].offsetLeft - 4, behavior: 'smooth' });
    } else {
      var t = bc.querySelector('[data-layer="' + id + '"]') || bc.querySelector('[data-board="' + id + '"]');
      if (!t) return;
      e.preventDefault();
      var tr = t.getBoundingClientRect(), vr = bview.getBoundingClientRect();
      bview.scrollTo({ left: bview.scrollLeft + tr.left - vr.left - 40, top: bview.scrollTop + tr.top - vr.top - 40, behavior: 'smooth' });
    }
  });

  setMode(view.mode); setPick(view.pick);
  apply();
})();
