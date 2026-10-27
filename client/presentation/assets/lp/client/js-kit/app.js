/**
 * Entry point.
 *
 * i18n resolves first, so modules that read dictionary strings at init time see
 * the right locale. Every init() returns immediately if its root element is
 * absent, so one bundle serves index.html and the legal pages alike.
 */

import { initI18n } from './core/i18n.js';
import { initModalTriggers } from './core/modal.js';

import { initReveal } from './modules/reveal.js';
import { initNavigation } from './modules/navigation.js';
import { initLangSwitcher } from './modules/lang-switcher.js';
import { initMarquee } from './modules/marquee.js';
import { initCounters } from './modules/counter.js';
import { initNetworkAxes } from './modules/network-axes.js';
import { initNetworkMech } from './modules/network-mech.js';
import { initCarousel } from './modules/use-case-carousel.js';
import { initFaq } from './modules/faq.js';
import { initOrganicChart } from './modules/organic-chart.js';
import { initLeadForm } from './modules/lead-form.js';
import { initHeroScene } from './modules/hero-scene.js';
import { initNetworkGlobe } from './modules/network-globe.js';

/** Run an init in isolation: one broken module must not take the page down. */
function safely(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[app] ${name} failed to initialise:`, err);
  }
}

async function boot() {
  safely('reveal', initReveal);

  await initI18n();

  safely('navigation', initNavigation);
  safely('lang-switcher', initLangSwitcher);
  safely('modal-triggers', initModalTriggers);
  safely('marquee', initMarquee);
  safely('counters', initCounters);
  safely('network-axes', initNetworkAxes);

  safely('network-mech', initNetworkMech);
  safely('carousel', initCarousel);
  safely('faq', initFaq);
  safely('organic-chart', initOrganicChart);
  safely('lead-form', initLeadForm);

  startWebGL();
}

/**
 * three.js is a classic `<script defer>`, and a module script is evaluated
 * after deferred scripts — but only once the document has finished parsing.
 * If THREE is somehow not there yet, wait for load rather than giving up:
 * the alternative is silently shipping a hero with no particles at all.
 */
function startWebGL() {
  const boot = () => {
    safely('hero-scene', initHeroScene);

    safely('network-globe', initNetworkGlobe);
  };
  if (globalThis.THREE) boot();
  else globalThis.addEventListener('load', boot, { once: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
