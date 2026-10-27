/**
 * Section 06 chart reveal.
 *
 * The lines draw themselves via stroke-dashoffset and the area fades in
 * behind them. Under reduced motion both land in their final state with no
 * transition, which the CSS handles — this module only has to add the class.
 */

import { observeMotion } from '../core/observe.js';
import { CHART } from '../config/motion.js';

export function initOrganicChart() {
  const chart = document.getElementById('organic-chart');
  if (!chart) return;

  observeMotion(
    chart,
    (el) => el.classList.add('is-visible'),
    (el) => el.classList.add('is-visible'),
    { once: true, threshold: CHART.threshold },
  );
}
