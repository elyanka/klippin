/**
 * EN / FR switcher.
 *
 * There are two switchers in the markup (desktop bar + mobile drawer), so
 * every instance is kept in sync from the locale-change event rather than
 * from the click that caused it.
 */

import { $$, on } from '../core/dom.js';
import { setLocale, getLocale, onLocaleChange } from '../core/i18n.js';

function paint(locale) {
  for (const group of $$('[data-lang-switcher]')) {
    for (const option of $$('[data-locale]', group)) {
      option.setAttribute('aria-checked', String(option.dataset.locale === locale));
    }
  }
}

export function initLangSwitcher() {
  const groups = $$('[data-lang-switcher]');
  if (!groups.length) return;

  for (const group of groups) {
    on(group, 'click', async (event) => {
      const option = event.target.closest('[data-locale]');
      if (!option || option.dataset.locale === getLocale()) return;

      const ok = await setLocale(option.dataset.locale);

      if (!ok) paint(getLocale());
    });

    on(group, 'keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      const options = $$('[data-locale]', group);
      const index = options.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      const next = options[(index + delta + options.length) % options.length];
      next.focus();
      next.click();
    });
  }

  paint(getLocale());
  onLocaleChange(paint);
}
