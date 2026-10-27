/**
 * Locale-aware formatting. Intl constructors are expensive, so each formatter is
 * built once per (locale, options) pair and cached.
 */

import { INTL_LOCALE, DEFAULT_LOCALE } from '../config/i18n.config.js';

const numberCache = new Map();
const dateCache = new Map();

const tag = (locale) => INTL_LOCALE[locale] ?? INTL_LOCALE[DEFAULT_LOCALE];

function numberFormatter(locale, options = {}) {
  const key = locale + JSON.stringify(options);
  let f = numberCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(tag(locale), options);
    numberCache.set(key, f);
  }
  return f;
}

/** 11560436512 -> "11,560,436,512" (en) / "11 560 436 512" (fr) */
export const formatInteger = (value, locale) =>
  numberFormatter(locale, { maximumFractionDigits: 0 }).format(value);

export const formatDecimal = (value, locale, digits = 1) =>
  numberFormatter(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/**
 * Abbreviated magnitude suffixes, separator included. French uses "Md" for
 * milliard and puts a narrow no-break space before "Md" and "M"; thousands are
 * an uppercase "K" with no space in both locales, per the copy deck.
 */
const SUFFIX = {
  en: { billion: 'B', million: 'M', thousand: 'K' },
  fr: { billion: ' Md', million: ' M', thousand: 'K' },
};

/**
 * Compact a magnitude the way the marketing copy does.
 * 10_000_000_000 -> "10B" (en) / "10 Md" (fr)
 *
 * @param {number} value
 * @param {string} locale
 * @param {object} [opts]
 * @param {number} [opts.digits=1]  fraction digits when not a whole number
 */
export function formatCompact(value, locale, { digits = 1 } = {}) {
  const s = SUFFIX[locale] ?? SUFFIX.en;
  const pick = (divisor, unit) => {
    const n = value / divisor;
    const isWhole = Math.abs(n % 1) < 0.05;
    const num = isWhole
      ? formatInteger(Math.round(n), locale)
      : formatDecimal(n, locale, digits);
    return `${num}${unit}`;
  };

  const abs = Math.abs(value);
  if (abs >= 1e9) return pick(1e9, s.billion);
  if (abs >= 1e6) return pick(1e6, s.million);
  if (abs >= 1e3) return pick(1e3, s.thousand);
  return formatInteger(value, locale);
}

/** Percentage as authored, e.g. 8.2 -> "8.2%" / "8,2 %". */
export const formatPercent = (value, locale) =>
  numberFormatter(locale, {
    style: 'percent',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value / 100);

/** Date for display. The API always receives the raw ISO string instead. */
export function formatDate(isoString, locale, options = { dateStyle: 'long' }) {
  if (!isoString) return '';
  const key = locale + JSON.stringify(options);
  let f = dateCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(tag(locale), options);
    dateCache.set(key, f);
  }
  return f.format(new Date(isoString));
}

/** Drop every cached formatter. Called on locale change. */
export function clearFormatCache() {
  numberCache.clear();
  dateCache.clear();
}
