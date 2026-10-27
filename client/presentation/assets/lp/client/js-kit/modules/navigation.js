/**
 * Fixed navigation: stuck state, scroll spy, mobile drawer.
 *
 * The stuck class is what switches the expensive backdrop-filter on, so it
 * deliberately stays off over the hero, where the WebGL canvas is painting
 * every frame underneath it.
 */

import { $, $$, on, rafThrottle } from '../core/dom.js';
import { observe } from '../core/observe.js';
import { NAV_STUCK_OFFSET } from '../config/motion.js';
import { t } from '../core/i18n.js';

function initStuck(nav) {
  const sync = rafThrottle(() => {
    nav.classList.toggle('is-stuck', globalThis.scrollY > NAV_STUCK_OFFSET);
  });
  on(globalThis, 'scroll', sync, { passive: true });
  sync();
}

/** Mark the nav link whose section is currently on screen. */
/**
 * Publish the bar's real height so html{scroll-padding-top} can offset anchors
 * by exactly it.
 *
 * --nav-height is only a min-height. The 48px CTA plus 24px of padding makes
 * the bar 97px wide-screen and 95px once it collapses to the burger, so any
 * constant is wrong at one of the two — and because every section paints its
 * own background gradient, landing even 2px short shows a strip of the
 * previous section under the bar. Measured, so FR copy, a font swap or a
 * taller CTA cannot bring the strip back.
 */
function initScrollOffset(nav) {
  const publish = () => {
    const height = Math.ceil(nav.getBoundingClientRect().height);
    if (height) document.documentElement.style.setProperty('--nav-offset', `${height}px`);
  };

  if ('ResizeObserver' in globalThis) new ResizeObserver(publish).observe(nav);
  else on(globalThis, 'resize', rafThrottle(publish), { passive: true });
  publish();
}

function initScrollSpy() {
  const links = $$('.client-nav__menu .client-nav__link');
  if (!links.length) return;

  const byId = new Map();
  for (const link of links) {
    const id = link.getAttribute('href')?.replace('#', '');
    if (id) byId.set(id, link);
  }

  const sections = [...byId.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  observe(sections, (el) => {
    for (const link of links) link.removeAttribute('aria-current');
    byId.get(el.id)?.setAttribute('aria-current', 'true');
  }, { once: false, threshold: 0.4 });
}

function initDrawer(nav) {
  const burger = $('#burger', nav);
  const drawer = $('#nav-drawer', nav);
  if (!burger || !drawer) return;

  const setOpen = (open) => {
    drawer.dataset.open = String(open);
    burger.setAttribute('aria-expanded', String(open));
    const key = open ? 'nav.menu.close' : 'nav.menu.open';
    burger.setAttribute('aria-label', t(key) ?? burger.getAttribute('aria-label'));
  };

  const isOpen = () => drawer.dataset.open === 'true';

  on(burger, 'click', () => setOpen(!isOpen()));

  on(drawer, 'click', (event) => {
    if (event.target.closest('a[href^="#"]')) setOpen(false);
  });

  on(document, 'keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      burger.focus();
    }
  });

  on(document, 'click', (event) => {
    if (isOpen() && !nav.contains(event.target)) setOpen(false);
  });

  const mq = globalThis.matchMedia('(min-width: 1001px)');
  mq.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

export function initNavigation() {
  const nav = $('#nav');
  if (!nav) return;
  initStuck(nav);
  initScrollOffset(nav);
  initScrollSpy();
  initDrawer(nav);
}
