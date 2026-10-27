/**
 * Scroll reveal.
 *
 * The CSS that hides .reveal elements is gated on html.reveal-ready, which this
 * module adds as its very first statement. If it never runs, the class is never
 * added and every .reveal element renders normally instead of staying invisible
 * forever.
 */

import { $$ } from '../core/dom.js';
import { observe } from '../core/observe.js';
import { REVEAL } from '../config/motion.js';

export function initReveal() {
  document.documentElement.classList.add('reveal-ready');

  const targets = $$('.reveal');
  if (!targets.length) return;

  observe(targets, (el) => el.classList.add('is-visible'), {
    once: true,
    threshold: REVEAL.threshold,
    rootMargin: REVEAL.rootMargin,
  });
}
