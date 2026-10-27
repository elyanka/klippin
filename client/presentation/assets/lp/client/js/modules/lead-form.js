/**
 * Lead form: validation, submit, error and success states.
 *
 * Everything about the request shape lives in config/api.js and
 * config/form-map.js. This module only reads the DOM, decides whether the
 * form is submittable, and reports the outcome.
 */

import { $, on } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { openModal } from '../core/modal.js';
import { buildPayload, FIELDS } from '../config/form-map.js';
import { getLeadsEndpoint, REQUEST_HEADERS, REQUEST_TIMEOUT_MS } from '../config/api.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initLeadForm() {
  const form = document.getElementById('lead-form');
  if (!form) return;

  const errorBox = $('#form-error', form);
  const submit = $('[data-submit]', form);
  const consent = $('#privacy', form);
  const endpoint = getLeadsEndpoint();

  const value = (id) => form.elements[id]?.value ?? '';

  function showError(key) {
    if (!errorBox) return;
    errorBox.textContent = t(key) ?? key;
    errorBox.hidden = false;
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  if (!endpoint) {
    submit?.setAttribute('disabled', '');
    submit?.setAttribute('aria-disabled', 'true');
    showError('form.error.unconfigured');
    console.error('[lead-form] no API base configured for this environment — submit disabled');
    return;
  }

  function setLoading(on) {
    if (!submit) return;
    submit.classList.toggle('is-loading', on);
    submit.disabled = on;
    const label = $('[data-submit-label]', submit);
    if (label) label.textContent = t(on ? 'form.submitting' : 'form.submit') ?? label.textContent;
  }

  /** @returns {string|null} an i18n error key, or null when valid. */
  function validate() {
    const missing = FIELDS.filter((f) => f.required && !value(f.id).trim());
    if (missing.length) {
      form.elements[missing[0].id]?.focus();
      return 'form.error.required';
    }
    if (!EMAIL_RE.test(value('email').trim())) {
      form.elements.email?.focus();
      return 'form.error.email';
    }
    if (consent && !consent.checked) {
      consent.focus();
      return 'form.privacy.error';
    }
    return null;
  }

  on(form, 'submit', async (event) => {
    event.preventDefault();
    clearError();

    const problem = validate();
    if (problem) { showError(problem); return; }

    setLoading(true);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: REQUEST_HEADERS,
        body: JSON.stringify(buildPayload(value, consent?.checked)),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

      form.reset();
      const modal = document.getElementById('success-modal');
      if (modal) openModal(modal, { opener: submit });
    } catch (err) {
      console.error('[lead-form] submit failed:', err);
      showError('form.error.generic');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  });

  on(form, 'input', clearError);
}
