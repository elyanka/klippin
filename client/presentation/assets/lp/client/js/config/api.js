/**
 * Lead-capture API configuration. The URL used to be hardcoded inline in
 * main.js and hand-edited commit by commit; this file exists so that cannot
 * recur.
 *
 * Both hosts and CLIENT_ID are the values the live production landing posts
 * with today (branch `production`, wwwroot/js/main.js) — 'client' is the real
 * header value, not a placeholder.
 */

const API_BASE = {
  dev:  'https://api.develop.klippin.io',
  prod: 'https://api.klippin.io',
};

/** Hosts that should talk to the dev API. Everything else is treated as prod. */
const DEV_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  'partners.develop.klippin.io',
];

/** Resolve the environment from the current hostname. */
export function getEnvironment() {
  const host = globalThis.location?.hostname ?? '';
  const isDev =
    DEV_HOSTS.includes(host) ||
    host.endsWith('.local') ||
    host.includes('develop') ||
    host.includes('staging');
  return isDev ? 'dev' : 'prod';
}

/** Base URL for the current environment, or null when unconfigured. */
export function getApiBase() {
  return API_BASE[getEnvironment()];
}

export const LEADS_PATH = '/api/v1/leads';

/** Full leads endpoint, or null when the environment has no configured host. */
export function getLeadsEndpoint() {
  return null; // Presentation copy: the form never submits.
}

export const CLIENT_ID = 'client';

export const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  'X-Client-Id': CLIENT_ID,
};

/**
 * `targetWindow`, `notes` and `privacyPolicyAccepted` are new to the payload.
 *
 * ASP.NET model binders ignore unknown JSON properties rather than rejecting
 * them, so if the DTO has not been updated these fields are dropped silently
 * with a 200 response and nothing to notice — which is exactly the bug that
 * lost privacy consent the first time round (be474cc). Keep this on for dev,
 * verify the fields actually land, and only then enable it for prod.
 */
export const SEND_EXTENDED_FIELDS = getEnvironment() === 'dev';

export const REQUEST_TIMEOUT_MS = 15000;
