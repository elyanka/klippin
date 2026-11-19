/**
 * Stats row: each figure counts up quickly from 0 to its value the first time
 * the row scrolls into view.
 *
 * The values stay authored as text in the HTML / dictionaries ("20,000+",
 * "10B+", "20 000+", "10 Md+"). This module reads whatever is there, counts
 * the number part and keeps everything around it (the "+", "B", " Md") and
 * the thousands separator as written, so copy changes need no code change.
 *
 * No JS or reduced motion: the final values simply show.
 */

import { $$, prefersReducedMotion } from '../core/dom.js';
import { onLocaleChange } from '../core/i18n.js';

/** Tweak here. */
const COUNT = {
  ms: 1100,       // one figure's run
  stagger: 120,   // delay between the figures, left to right
};

/** Fast start, soft landing. */
const ease = (t) => 1 - Math.pow(1 - t, 4);

/** "20,000+" → { prefix: "", digits: "20,000", suffix: "+", value: 20000, sep: "," } */
function parse(text) {
  const m = text.trim().match(/^(\D*?)(\d[\d.,\s  ]*\d|\d)(.*)$/s);
  if (!m) return null;
  const [, prefix, digits, suffix] = m;
  const sep = digits.match(/[^\d]/)?.[0] ?? '';
  const value = Number(digits.replace(/\D/g, ''));
  return Number.isFinite(value) ? { prefix, suffix, value, sep } : null;
}

function format({ prefix, suffix, sep }, n) {
  const digits = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return prefix + digits + suffix;
}

export function initStats() {
  const values = $$('.stat__value');
  if (!values.length || prefersReducedMotion() || !('IntersectionObserver' in globalThis)) return;

  let runId = 0;
  /** The authored texts, kept while the figures show something else. */
  let finals = null;

  // A language switch rewrites the figures: stop counting and leave its text alone.
  onLocaleChange(() => { runId += 1; finals = null; });

  /** Row still below the fold: show zeros, so it never jumps back from the final value. */
  function zero() {
    finals = values.map((el) => el.textContent);
    values.forEach((el, i) => {
      const parts = parse(finals[i]);
      if (parts) el.textContent = format(parts, 0);
    });
  }

  function run() {
    const id = runId;
    const texts = finals ?? values.map((el) => el.textContent);
    finals = texts;
    values.forEach((el, i) => {
      const parts = parse(texts[i]);
      if (!parts) return;
      el.textContent = format(parts, 0);
      const t0 = performance.now() + i * COUNT.stagger;

      const frame = (now) => {
        if (id !== runId) return;
        const t = Math.min(1, Math.max(0, (now - t0) / COUNT.ms));
        // The last frame writes the authored text back, untouched.
        el.textContent = t < 1 ? format(parts, Math.round(parts.value * ease(t))) : texts[i];
        if (t < 1) requestAnimationFrame(frame);
        else if (i === values.length - 1) finals = null;
      };
      requestAnimationFrame(frame);
    });
  }

  const row = values[0].closest('.stats') ?? values[0];
  let first = true;
  const io = new IntersectionObserver((entries) => {
    const visible = entries.some((e) => e.isIntersecting);
    if (first && !visible) zero();
    first = false;
    if (!visible) return;
    io.disconnect();
    run();
  }, { threshold: 0.6 });
  io.observe(row);
}
