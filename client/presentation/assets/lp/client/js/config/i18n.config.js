/**
 * Localization constants. EN copy is authored inline in the HTML, so the default
 * locale needs no round trip and shows no flash of untranslated content; only a
 * switch away from it fetches a dictionary.
 */

export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = ['en', 'fr'];

/** BCP-47 tags for Intl, keyed by our short locale code. */
export const INTL_LOCALE = {
  en: 'en-US',
  fr: 'fr-FR',
};

/** og:locale values. */
export const OG_LOCALE = {
  en: 'en_US',
  fr: 'fr_FR',
};

export const STORAGE_KEY = 'klippin.locale';

export const QUERY_PARAM = 'lang';

/** Dictionary location. {locale} is substituted. */
export const DICT_PATH = 'i18n/{locale}.json';

/** Give up waiting on a dictionary after this long and keep the current copy. */
export const FETCH_TIMEOUT_MS = 4000;

/**
 * Inline markup permitted inside a data-i18n-html value. Anything else in a
 * translated string is rendered as literal text, so a dictionary can never
 * inject script, styles, event handlers or arbitrary elements.
 */
export const ALLOWED_INLINE_TAGS = ['span', 'br', 'strong', 'em', 'b', 'i'];

/** Class names a translated <span> may carry. Everything else is stripped. */
export const ALLOWED_INLINE_CLASSES = ['t-grad', 't-grad-metric', 'u-nowrap'];
