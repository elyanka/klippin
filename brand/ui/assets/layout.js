// Layout helpers for Rules, Foundations and Components: highlight the current section in the
// sidebar, and flow card grids into as many columns as the width and the number of cards allow.
(function () {
  var links = [].slice.call(document.querySelectorAll('.subnav a[href^="#"]'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
  if (links.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a, i) { a.classList.toggle('on', targets[i] === e.target); });
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    targets.forEach(function (t) { if (t) io.observe(t); });
  }

  // Card grids flow into balanced columns: as many ~380px columns as fit, never more than there are cards,
  // so two cards share the width and a long card no longer leaves holes under its short neighbours.
  function flow() {
    document.querySelectorAll('body.side .grid-2, body.side .grid-3').forEach(function (g) {
      var items = 0;
      [].forEach.call(g.children, function (c) { items += c.classList.contains('stack') ? c.children.length : 1; });
      g.style.columnCount = Math.max(1, Math.min(items, Math.floor((g.clientWidth + 16) / 396)));
    });
  }
  if (document.querySelector('body.side')) {
    flow();
    var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(flow, 120); });
  }
  // Desktop-width web specimens: scale the whole piece down to the card width so its layout stays true.
  function fit() {
    document.querySelectorAll('.fit').forEach(function (f) {
      var c = f.firstElementChild; if (!c) return;
      c.style.zoom = 1;
      var z = Math.min(1, f.clientWidth / c.scrollWidth);
      c.style.zoom = z < 1 ? z.toFixed(3) : '';
    });
  }
  fit();
  addEventListener('load', fit);
  var ft; addEventListener('resize', function () { clearTimeout(ft); ft = setTimeout(fit, 120); });
})();
