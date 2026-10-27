/**
 * FAQ accordion.
 *
 * Built on native <details>, so every question is readable and expandable
 * with JavaScript disabled. This module adds two things on top: only one
 * panel open at a time, and a height transition — <details> cannot animate
 * its own open/close, so the panel height is driven explicitly.
 */

import { $$, on, prefersReducedMotion } from '../core/dom.js';

const DURATION = 320;

export function initFaq() {
  const list = document.querySelector('[data-faq]');
  if (!list) return;

  const items = $$('details.faq-item', list);
  if (!items.length) return;

  const reduced = prefersReducedMotion();

  /** Animate a panel between 0 and its natural height. */
  function slide(details, opening) {
    const panel = details.querySelector('.client-faq-item__a');
    if (!panel || reduced) {
      details.open = opening;
      return;
    }

    const start = panel.getBoundingClientRect().height;
    if (opening) details.open = true;

    panel.style.height = 'auto';
    const end = opening ? panel.getBoundingClientRect().height : 0;
    panel.style.height = `${start}px`;
    panel.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      panel.style.transition = `height ${DURATION}ms cubic-bezier(.4,0,.2,1)`;
      panel.style.height = `${end}px`;
    });

    const done = () => {
      panel.style.transition = '';
      panel.style.height = '';
      panel.style.overflow = '';
      if (!opening) details.open = false;
      panel.removeEventListener('transitionend', done);
    };
    panel.addEventListener('transitionend', done);
  }

  for (const details of items) {
    const summary = details.querySelector('summary');
    if (!summary) continue;

    on(summary, 'click', (event) => {
      event.preventDefault();
      const opening = !details.open;

      if (opening) {
        for (const other of items) {
          if (other !== details && other.open) slide(other, false);
        }
      }
      slide(details, opening);
    });
  }

  const fromHash = () => {
    const hash = location.hash;
    if (!/^#[A-Za-z][\w-]*$/.test(hash)) return;
    const target = document.querySelector(hash);
    if (target?.matches('details.faq-item') && !target.open) {
      for (const other of items) if (other !== target && other.open) slide(other, false);
      slide(target, true);
    }
  };
  on(globalThis, 'hashchange', fromHash);
  if (location.hash) fromHash();
}
