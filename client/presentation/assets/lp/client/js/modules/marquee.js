/**
 * References logo marquee.
 *
 * The track is duplicated so a -50% translate loops seamlessly. The clone is
 * aria-hidden, so the same seven slots are not announced twice.
 *
 * WCAG 2.2.2: this moves for longer than five seconds, so it pauses on hover
 * and focus (CSS), pauses when scrolled out of view, and does not animate at
 * all under prefers-reduced-motion.
 */

import { $$, prefersReducedMotion } from '../core/dom.js';
import { observe } from '../core/observe.js';
import { MARQUEE } from '../config/motion.js';

export function initMarquee() {
  for (const marquee of $$('[data-marquee]')) {
    const track = marquee.firstElementChild;
    if (!track || track.dataset.cloned === 'true') continue;

    track.style.setProperty('--marquee-duration', `${MARQUEE.durationSec}s`);

    if (prefersReducedMotion()) continue;

    const clone = track.cloneNode(true);
    for (const item of Array.from(clone.children)) {
      item.setAttribute('aria-hidden', 'true');
      item.removeAttribute('data-i18n');
    }
    track.append(...clone.children);
    track.dataset.cloned = 'true';

    observe(marquee, () => { marquee.dataset.paused = 'false'; }, {
      once: false,
      threshold: MARQUEE.threshold,
      onLeave: () => { marquee.dataset.paused = 'true'; },
    });
  }
}
