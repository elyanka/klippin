/**
 * Entry point.
 *
 * i18n resolves first, so modules that read dictionary strings at init time see
 * the right locale. Every init() returns immediately if its root element is
 * absent, so one bundle serves index.html and the blog pages alike.
 */

import { initI18n } from './core/i18n.js';
import { initNavigation } from './modules/navigation.js';
import { initLangSwitcher } from './modules/lang-switcher.js';
import { initFaq } from './modules/faq.js';
import { initEarnings } from './modules/earnings.js';
import { initStats } from './modules/stats.js';
import { initHeroVisual } from './modules/hero-visual.js';
import { initBlog } from './modules/blog.js';

/** Run an init in isolation: one broken module must not take the page down. */
function safely(name, fn) {
  try {
    fn();
  } catch (err) {
    console.error(`[app] ${name} failed to initialise:`, err);
  }
}

async function boot() {
  // Not locale-dependent: start the hero as early as possible.
  safely('hero-visual', initHeroVisual);

  await initI18n();

  safely('navigation', initNavigation);
  safely('lang-switcher', initLangSwitcher);
  safely('faq', initFaq);
  safely('earnings', initEarnings);
  safely('stats', initStats);
  safely('blog', initBlog);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
