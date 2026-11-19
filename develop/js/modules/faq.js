/**
 * FAQ accordion.
 *
 * Built on native <details>, so every question is readable and expandable
 * with JavaScript disabled. This module adds two things on top: only one
 * panel open at a time, and an open/close animation.
 *
 * The animation drives the height of the whole <details> card (the question
 * row stays put, the card grows or shrinks around it) with the Web Animations
 * API, so the answer's padding is included and nothing snaps at the end. The
 * answer fades with it, and while it unfolds the card briefly wears the rim
 * and low glow of a hovered How it works card (.is-folding), which fade out
 * once it has settled; the open card rests in its plain orange outline.
 * Folding back has no highlight.
 *
 * Invite: the first question is authored open (so it reads open without JS).
 * With JS it starts closed, and the first time it scrolls into view it
 * unfolds by itself after a beat, so the list is seen collapsed for a moment
 * and then shows how it opens. Skipped if the visitor clicks a question first,
 * arrives on a #question link, or prefers reduced motion. The caret
 * turns back as a close starts (not after it), and a click during
 * an animation reverses it from where it is.
 */

import { $$, on, prefersReducedMotion } from '../core/dom.js';

const OPEN_MS = 340;
const CLOSE_MS = 280;
const EASE_OPEN = 'cubic-bezier(.22, 1, .36, 1)'; // --ease-out
const EASE_CLOSE = 'cubic-bezier(.4, 0, .2, 1)';  // --ease-standard

/** Invite: unfold the first question when it is this far up the screen, after this pause. */
const INVITE = { rootMargin: '0px 0px -30% 0px', delayMs: 450 };

/**
 * Low brand glow under the card while it unfolds (the same glow as a hovered
 * How it works card): it swells and is gone soon after the card has settled.
 */
const GLOW_PEAK = '0 1.25rem 2.5rem -1.25rem rgb(250 73 72 / .60), 0 0 3rem 0 rgb(255 104 57 / .12)';
const GLOW_OFF  = '0 1rem 2rem -1.25rem rgb(250 73 72 / 0), 0 0 3rem 0 rgb(255 104 57 / 0)';

export function initFaq() {
  const list = document.querySelector('[data-faq]');
  if (!list) return;

  const items = $$('details.faq-item', list);
  if (!items.length) return;

  const reduced = prefersReducedMotion();
  /** Running animations per <details>, so a second click can take over. */
  const running = new Map();

  const isOpen = (details) => details.open && !details.classList.contains('is-closing');

  function slide(details, opening) {
    const summary = details.querySelector('summary');
    const panel = details.querySelector('.faq-item__a');
    if (!summary || !panel || reduced || typeof details.animate !== 'function') {
      details.open = opening;
      return;
    }

    // Start from wherever the card is now, mid-animation included.
    const start = details.getBoundingClientRect().height;
    const prev = running.get(details);
    if (prev) {
      prev.height.onfinish = null;
      prev.height.cancel();
      prev.fade.cancel();
      prev.glow?.cancel();
    }

    details.classList.toggle('is-closing', !opening);
    details.classList.toggle('is-folding', opening); // highlight on unfold only
    if (opening) details.open = true;

    // Closed height = question row + the card's borders.
    const borders = details.offsetHeight - details.clientHeight;
    const end = opening
      ? details.scrollHeight + borders
      : summary.getBoundingClientRect().height + borders;

    const ms = opening ? OPEN_MS : CLOSE_MS;
    const easing = opening ? EASE_OPEN : EASE_CLOSE;
    // Clip the answer while the height moves, but leave the 1px rim on the
    // border visible (overflow: hidden would clip it to the padding box).
    details.style.overflow = 'clip';
    details.style.overflowClipMargin = '1px';

    const height = details.animate(
      [{ height: `${start}px` }, { height: `${end}px` }],
      { duration: ms, easing },
    );
    const fade = panel.animate(
      opening
        ? [{ opacity: 0, transform: 'translateY(-.25rem)' }, { opacity: 1, transform: 'none' }]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: opening ? ms : ms * 0.7, easing, fill: 'forwards' },
    );
    // Glow (unfold only): peaks early and is gone a little after the card has settled.
    const glow = opening
      ? details.animate(
        [{ boxShadow: GLOW_OFF }, { boxShadow: GLOW_PEAK, offset: 0.3 }, { boxShadow: GLOW_OFF }],
        { duration: ms * 2.2, easing: 'ease-out' },
      )
      : null;
    running.set(details, { height, fade, glow });

    height.onfinish = () => {
      running.delete(details);
      if (!opening) details.open = false;
      details.classList.remove('is-closing', 'is-folding');
      details.style.overflow = '';
      details.style.overflowClipMargin = '';
      fade.cancel();
    };
  }

  let invite = null; // cancels the pending invite

  for (const details of items) {
    const summary = details.querySelector('summary');
    if (!summary) continue;

    on(summary, 'click', (event) => {
      event.preventDefault();
      invite?.();
      const opening = !isOpen(details);

      if (opening) {
        for (const other of items) {
          if (other !== details && isOpen(other)) slide(other, false);
        }
      }
      slide(details, opening);
    });
  }

  const fromHash = () => {
    const hash = location.hash;
    if (!/^#[A-Za-z][\w-]*$/.test(hash)) return;
    const target = document.querySelector(hash);
    if (target?.matches('details.faq-item') && !isOpen(target)) {
      for (const other of items) if (other !== target && isOpen(other)) slide(other, false);
      slide(target, true);
    }
  };
  on(globalThis, 'hashchange', () => { invite?.(); fromHash(); });

  if (location.hash) {
    fromHash();
  } else if (!reduced && items[0].open && 'IntersectionObserver' in globalThis
    && typeof items[0].animate === 'function') {
    invite = startInvite(items[0], () => { invite = null; slide(items[0], true); });
  }
}

/** Close the first question now; call open() once it has scrolled into view. Returns a cancel. */
function startInvite(first, open) {
  first.open = false;
  let timer = 0;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    timer = setTimeout(open, INVITE.delayMs);
  }, { rootMargin: INVITE.rootMargin });
  io.observe(first);
  return () => { io.disconnect(); clearTimeout(timer); };
}
