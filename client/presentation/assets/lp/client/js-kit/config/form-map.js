/**
 * Lead form: field definitions and the field -> API payload mapping.
 *
 * The option VALUES below are a backend contract — the API keys on these
 * exact strings. Labels are localized via i18n keys; values never change.
 */

import { SEND_EXTENDED_FIELDS } from './api.js';

/** Budget select value -> [from, to]. `null` upper bound means open-ended. */
export const BUDGET_RANGES = {
  '20k-50k':    [20000, 50000],
  '50k-100k':   [50000, 100000],
  '100k-250k':  [100000, 250000],
  '250k-500k':  [250000, 500000],
  '500k-plus':  [500000, null],
};

/** Backend contract. Do not rename. */
export const ROLES = [
  'executive',
  'director',
  'manager',
  'specialist',
  'other',
];

/** Backend contract. Do not rename. */
export const OBJECTIVES = [
  'mass-reach',
  'audience-growth',
  'engagement-participation',
  'brand-awareness',
  'content-virality',
  'market-penetration',
  'product-launch',
  'conversion-support',
];

/**
 * Form fields in render order.
 *   id       - DOM id and <select>/<input> name
 *   type     - text | email | select | date | textarea | checkbox
 *   required - blocks submit when empty
 *   i18n     - dictionary key prefix; `.label` and `.placeholder` hang off it
 *   options  - for selects, the contract values above
 *   width    - grid span: 'half' | 'full'
 */
export const FIELDS = [
  { id: 'fullName',  type: 'text',     required: true,  width: 'half', i18n: 'form.name',      autocomplete: 'name' },
  { id: 'company',   type: 'text',     required: true,  width: 'half', i18n: 'form.company',   autocomplete: 'organization' },
  { id: 'email',     type: 'email',    required: true,  width: 'full', i18n: 'form.email',     autocomplete: 'email' },
  { id: 'role',      type: 'select',   required: true,  width: 'half', i18n: 'form.role',      options: ROLES },
  { id: 'objective', type: 'select',   required: true,  width: 'half', i18n: 'form.objective', options: OBJECTIVES },
  { id: 'window',    type: 'date',     required: false, width: 'half', i18n: 'form.window' },
  { id: 'budget',    type: 'select',   required: true,  width: 'half', i18n: 'form.budget',    options: Object.keys(BUDGET_RANGES) },
  { id: 'notes',     type: 'textarea', required: false, width: 'full', i18n: 'form.notes' },
];

/** Consent control. Not in the Figma kit; added for GDPR/CNIL. */
export const CONSENT_FIELD = { id: 'privacy', type: 'checkbox', required: true, i18n: 'form.privacy' };

const trim = (v) => (typeof v === 'string' ? v.trim() : v);
const orNull = (v) => (v === '' || v === undefined ? null : v);

/**
 * Build the API payload from a FormData-like accessor.
 * @param {(id: string) => string} get   reads a field's current value
 * @param {boolean} consent              consent checkbox state
 */
export function buildPayload(get, consent) {
  const [budgetFrom, budgetTo] = BUDGET_RANGES[get('budget')] ?? [null, null];

  const payload = {
    fullName:            trim(get('fullName')),
    email:               trim(get('email')),
    companyName:         trim(get('company')),
    role:                orNull(get('role')),
    campaignObjective:   orNull(get('objective')),
    estimatedBudgetFrom: budgetFrom,
    estimatedBudgetTo:   budgetTo,
  };

  if (SEND_EXTENDED_FIELDS) {
    payload.targetWindow          = orNull(get('window'));
    payload.notes                 = orNull(trim(get('notes')));
    payload.privacyPolicyAccepted = Boolean(consent);
  }

  return payload;
}
