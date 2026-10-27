/**
 * Modal stack: focus trap, Escape, refcounted scroll lock, focus restore.
 *
 * A stack rather than one "current dialog", because the lead form opens a
 * success dialog on top of itself. With a single `lastFocused` the second open
 * overwrote the first and closing returned focus into a hidden dialog.
 */

import { $$, on, scrollbarWidth } from './dom.js';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** @type {{el: HTMLElement, opener: Element|null, release: () => void}[]} */
const stack = [];

const topEntry = () => stack.at(-1);

function focusableWithin(el) {
  return $$(FOCUSABLE, el).filter(
    (n) => n.offsetParent !== null || n === document.activeElement,
  );
}

function lockScroll() {
  if (stack.length > 1) return;
  const root = document.documentElement;
  root.style.setProperty('--scrollbar-width', `${scrollbarWidth()}px`);
  root.classList.add('is-scroll-locked');
}

function unlockScroll() {
  if (stack.length > 0) return;
  const root = document.documentElement;
  root.classList.remove('is-scroll-locked');
  root.style.removeProperty('--scrollbar-width');
}

function handleKeydown(event) {
  const entry = topEntry();
  if (!entry) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal(entry.el);
    return;
  }

  if (event.key !== 'Tab') return;

  const items = focusableWithin(entry.el);
  if (!items.length) {
    event.preventDefault();
    entry.el.focus();
    return;
  }

  const first = items[0];
  const last = items.at(-1);
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !entry.el.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !entry.el.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

on(document, 'keydown', handleKeydown);

export function openModal(el, { opener = document.activeElement } = {}) {
  if (!el || stack.some((e) => e.el === el)) return;

  const offClick = on(el, 'mousedown', (event) => {
    if (event.target.matches('[data-modal-overlay]')) closeModal(el);
  });
  const offClose = on(el, 'click', (event) => {
    if (event.target.closest('[data-modal-close]')) closeModal(el);
  });

  stack.push({ el, opener, release: () => { offClick(); offClose(); } });

  el.hidden = false;
  el.setAttribute('aria-hidden', 'false');
  el.dataset.open = 'true';
  lockScroll();

  const target =
    el.querySelector('[data-autofocus]') ?? focusableWithin(el)[0] ?? el;
  requestAnimationFrame(() => target.focus());
}

export function closeModal(el) {
  const index = stack.findIndex((e) => e.el === el);
  if (index === -1) return;

  const [entry] = stack.splice(index, 1);
  entry.release();

  el.dataset.open = 'false';
  el.setAttribute('aria-hidden', 'true');
  el.hidden = true;

  unlockScroll();

  if (!stack.length && entry.opener?.isConnected) entry.opener.focus();
  else topEntry()?.el.focus();
}

export const isOpen = (el) => stack.some((e) => e.el === el);

/** Wire [data-modal-open="id"] triggers. Idempotent. */
export function initModalTriggers(root = document) {
  for (const trigger of $$('[data-modal-open]', root)) {
    if (trigger.dataset.modalBound === 'true') continue;
    trigger.dataset.modalBound = 'true';
    on(trigger, 'click', (event) => {
      event.preventDefault();
      const target = document.getElementById(trigger.dataset.modalOpen);
      if (target) openModal(target, { opener: trigger });
    });
  }
}
