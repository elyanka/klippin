/** Small DOM helpers shared by every module. No side effects on import. */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** addEventListener that returns its own removal function. */
export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

export function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Collapse bursts of calls into one per animation frame. */
export function rafThrottle(fn) {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
}

export const prefersReducedMotion = () =>
  globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const supportsHover = () =>
  globalThis.matchMedia?.('(hover: hover)').matches ?? false;

/** Read a URL query parameter. */
export const queryParam = (name) =>
  new URLSearchParams(globalThis.location?.search ?? '').get(name);

/** localStorage that never throws — private mode and blocked storage. */
export const storage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { return false; }
  },
};

/** Width of the vertical scrollbar, for compensating during scroll lock. */
export const scrollbarWidth = () =>
  globalThis.innerWidth - document.documentElement.clientWidth;
