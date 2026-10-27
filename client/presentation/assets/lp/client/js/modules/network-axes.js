/**
 * Section 05 category selector (Gaming / Entertainment / And beyond).
 *
 * Figma drives the Selected state from hover alone, which does not exist on
 * touch and cannot be reached from the keyboard — and these rows are the
 * section's only control. Built as a real tablist instead: roving tabindex,
 * arrow keys, Home/End, persistent selection. Hover still previews.
 *
 * The selection auto-advances while the section is on screen; any real
 * interaction stops the cycle for good rather than fighting the user.
 */

import { $$, on, prefersReducedMotion } from '../core/dom.js';
import { observe } from '../core/observe.js';
import { NETWORK_AXES } from '../config/motion.js';

export function initNetworkAxes() {
  const list = document.querySelector('[data-network-axes]');
  if (!list) return;

  const tabs = $$('[role="tab"]', list);
  if (!tabs.length) return;

  let index = 0;
  let timer = null;
  let cycling = false;
  let userTookOver = false;

  function select(next, { focus = false } = {}) {
    index = (next + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tabs[index].focus();

    globalThis.__networkGlobe?.setCategory(tabs[index].dataset.axis);
  }

  function stopCycle() {
    userTookOver = true;
    cycling = false;
    clearInterval(timer);
    timer = null;
  }

  function startCycle() {
    if (cycling || userTookOver || prefersReducedMotion()) return;
    cycling = true;
    timer = setInterval(() => select(index + 1), NETWORK_AXES.intervalMs);
  }

  tabs.forEach((tab, i) => {
    on(tab, 'click', () => { stopCycle(); select(i); });
    on(tab, 'focus', () => { stopCycle(); select(i); });
  });

  on(list, 'keydown', (event) => {
    const map = {
      ArrowUp: index - 1, ArrowLeft: index - 1,
      ArrowDown: index + 1, ArrowRight: index + 1,
      Home: 0, End: tabs.length - 1,
    };
    if (!(event.key in map)) return;
    event.preventDefault();
    stopCycle();
    select(map[event.key], { focus: true });
  });

  on(list, 'pointerenter', stopCycle);

  select(0);
  observe(list, startCycle, {
    once: false,
    threshold: NETWORK_AXES.threshold,
    onLeave: () => { cycling = false; clearInterval(timer); timer = null; },
  });
}
