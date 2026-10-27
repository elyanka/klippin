/** Shared IntersectionObserver factory. */

import { prefersReducedMotion } from './dom.js';

/**
 * Observe elements and run `onEnter` when they intersect.
 *
 * @param {Element|Element[]} targets
 * @param {(el: Element) => void} onEnter
 * @param {object} [opts]
 * @param {boolean} [opts.once=true]      unobserve after the first entry
 * @param {number}  [opts.threshold=0]
 * @param {string}  [opts.rootMargin='0px']
 * @param {(el: Element) => void} [opts.onLeave]
 * @returns {() => void} disconnect
 */
export function observe(targets, onEnter, opts = {}) {
  const { once = true, threshold = 0, rootMargin = '0px', onLeave } = opts;
  const list = Array.isArray(targets) ? targets : [targets];
  const elements = list.filter(Boolean);
  if (!elements.length) return () => {};

  if (!('IntersectionObserver' in globalThis)) {
    elements.forEach(onEnter);
    return () => {};
  }

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        onEnter(entry.target);
        if (once) io.unobserve(entry.target);
      } else if (onLeave) {
        onLeave(entry.target);
      }
    }
  }, { threshold, rootMargin });

  elements.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

/**
 * Run `onEnter` unless the user has asked for reduced motion, in which case
 * apply `staticFallback` immediately. Used by every animated counter/chart.
 */
export function observeMotion(targets, onEnter, staticFallback, opts = {}) {
  const list = Array.isArray(targets) ? targets : [targets];
  if (prefersReducedMotion()) {
    list.filter(Boolean).forEach(staticFallback);
    return () => {};
  }
  return observe(targets, onEnter, opts);
}
