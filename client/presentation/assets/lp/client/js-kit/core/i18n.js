/**
 * Localization engine.
 *
 * Contract in the markup:
 *   data-i18n="key"                     -> element text content
 *   data-i18n-attr="placeholder:key, aria-label:key2"
 *                                       -> one or more attributes
 *   data-i18n-html="key"                -> inline markup, allowlisted
 *
 * Nothing here ever assigns innerHTML. The rich-text path parses the string
 * and rebuilds it with createElement/textContent against an allowlist, so a
 * dictionary — which is data, and may be edited by someone who is not
 * thinking about XSS — cannot introduce script, styles or event handlers.
 */

import {
  DEFAULT_LOCALE, SUPPORTED_LOCALES, STORAGE_KEY, QUERY_PARAM,
  DICT_PATH, FETCH_TIMEOUT_MS, OG_LOCALE,
  ALLOWED_INLINE_TAGS, ALLOWED_INLINE_CLASSES,
} from '../config/i18n.config.js';
import { $$, storage, queryParam } from './dom.js';
import { clearFormatCache } from './format.js';

/** Dictionaries already fetched, keyed by locale. */
const dictionaries = new Map();

let currentLocale = DEFAULT_LOCALE;

/** Subscribers notified after every successful locale application. */
const listeners = new Set();

const isSupported = (l) => SUPPORTED_LOCALES.includes(l);

/**
 * ?lang= beats a choice made in the switcher, which beats EN. The browser's
 * language is deliberately ignored: everyone lands on EN and only gets FR by
 * asking for it.
 */
export function resolveInitialLocale() {
  const fromQuery = queryParam(QUERY_PARAM);
  if (fromQuery && isSupported(fromQuery)) return fromQuery;

  const stored = storage.get(STORAGE_KEY);
  if (stored && isSupported(stored)) return stored;

  return DEFAULT_LOCALE;
}

export const getLocale = () => currentLocale;

async function loadDictionary(locale) {
  if (dictionaries.has(locale)) return dictionaries.get(locale);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DICT_PATH.replace('{locale}', locale), {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const dict = await res.json();
    dictionaries.set(locale, dict);
    return dict;
  } catch (err) {
    console.warn(`[i18n] could not load "${locale}":`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Look up a flat dotted key. Returns undefined when absent. */
export function t(key, locale = currentLocale) {
  return dictionaries.get(locale)?.[key];
}

/**
 * Turn an allowlisted inline-markup string into a DocumentFragment.
 * Disallowed tags degrade to their text content; disallowed attributes and
 * class names are dropped. Parsing happens in an inert document, so nothing
 * is fetched or executed even while it is being inspected.
 */
function buildInlineFragment(markup) {
  const inert = document.implementation.createHTMLDocument('');
  const host = inert.createElement('div');
  host.innerHTML = markup;

  const fragment = document.createDocumentFragment();

  const convert = (source, target) => {
    for (const node of Array.from(source.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.nodeValue));
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toLowerCase();
      if (!ALLOWED_INLINE_TAGS.includes(tag)) {
        convert(node, target);
        continue;
      }

      const el = document.createElement(tag);
      const classes = (node.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) => ALLOWED_INLINE_CLASSES.includes(c));
      if (classes.length) el.className = classes.join(' ');

      convert(node, el);
      target.appendChild(el);
    }
  };

  convert(host, fragment);
  return fragment;
}

function applyText(root) {
  for (const el of $$('[data-i18n]', root)) {
    const value = t(el.dataset.i18n);
    if (value !== undefined) el.textContent = value;
  }
}

function applyHtml(root) {
  for (const el of $$('[data-i18n-html]', root)) {
    const value = t(el.dataset.i18nHtml);
    if (value === undefined) continue;
    el.replaceChildren(buildInlineFragment(value));
  }
}

function applyAttributes(root) {
  for (const el of $$('[data-i18n-attr]', root)) {
    for (const pair of el.dataset.i18nAttr.split(',')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key) continue;
      const value = t(key);
      if (value !== undefined) el.setAttribute(attr, value);
    }
  }
}

/** <title>, meta description and the OG/Twitter tags that mirror them. */
function applyDocumentMeta(locale) {
  const title = t('meta.title');
  const description = t('meta.description');

  if (title) {
    document.title = title;
    setMeta('property', 'og:title', title);
    setMeta('name', 'twitter:title', title);
  }
  if (description) {
    setMeta('name', 'description', description);
    setMeta('property', 'og:description', description);
    setMeta('name', 'twitter:description', description);
  }
  setMeta('property', 'og:locale', OG_LOCALE[locale] ?? OG_LOCALE[DEFAULT_LOCALE]);

  document.documentElement.lang = locale;
}

function setMeta(attrName, attrValue, content) {
  let tag = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/** Re-apply the active dictionary to a subtree — for dynamically built DOM. */
export function translate(root = document) {
  if (!dictionaries.has(currentLocale)) return;
  applyText(root);
  applyHtml(root);
  applyAttributes(root);
}

/** Notified with the new locale after each successful switch. */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Switch locale. The default locale's copy is authored inline in the HTML,
 * so switching back to it needs no fetch and cannot fail.
 *
 * @returns {Promise<boolean>} whether the locale actually changed
 */
export async function setLocale(locale, { persist = true } = {}) {
  if (!isSupported(locale)) return false;

  const dict = await loadDictionary(locale);

  if (!dict && locale !== DEFAULT_LOCALE) return false;

  currentLocale = locale;
  clearFormatCache();

  if (dictionaries.has(locale)) {
    translate(document);
    applyDocumentMeta(locale);
  } else {
    document.documentElement.lang = locale;
  }

  if (persist) storage.set(STORAGE_KEY, locale);

  document.documentElement.dataset.locale = locale;
  for (const fn of listeners) fn(locale);
  return true;
}

/**
 * Boot. Always resolves — a failed dictionary fetch leaves the inline EN copy
 * in place rather than holding the page.
 *
 * The default locale's dictionary is fetched too, even though its copy is
 * already inline in the HTML. It has to be: strings that only JavaScript ever
 * reads — validation errors, the carousel's position announcement, the
 * burger's expanded label — have no inline element to come from, and without
 * the dictionary t() would hand them back as raw keys.
 */
export async function initI18n() {
  const locale = resolveInitialLocale();
  document.documentElement.dataset.locale = DEFAULT_LOCALE;
  await setLocale(locale, { persist: false });
  return currentLocale;
}
