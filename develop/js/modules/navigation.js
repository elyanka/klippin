/**
 * Mobile menu: the drop-down under the bar below 900px.
 * Closes on link click, Escape, a click outside the header, and when the
 * viewport grows past the breakpoint where the desktop links take over.
 */

import { $, on } from '../core/dom.js';
import { t } from '../core/i18n.js';

export function initNavigation() {
  const nav = $('#nav');
  const burger = $('#burger', nav ?? document);
  const menu = $('#nav-menu', nav ?? document);
  if (!nav || !burger || !menu) return;

  const isOpen = () => burger.getAttribute('aria-expanded') === 'true';

  const setOpen = (open) => {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    const label = t(open ? 'nav.menu.close' : 'nav.menu.open');
    if (label) burger.setAttribute('aria-label', label);
  };

  on(burger, 'click', () => setOpen(!isOpen()));

  on(menu, 'click', (event) => {
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

  globalThis.matchMedia('(min-width: 900px)')
    .addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}
