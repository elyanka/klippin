/**
 * Count-up metrics (hero stats, mechanism platform figures) and the "LIVE"
 * verified-views ticker in section 03.
 *
 * Both re-render on locale change: the separators and magnitude suffixes
 * differ between en-US and fr-FR ("1.2B+" vs "1,2 Md+").
 */

import { $, $$, prefersReducedMotion } from '../core/dom.js';
import { observe } from '../core/observe.js';
import { formatInteger, formatCompact } from '../core/format.js';
import { getLocale, onLocaleChange } from '../core/i18n.js';
import { COUNTER, LIVE_COUNTER } from '../config/motion.js';

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/** Trailing "+" is presentational and lives here, not in the dictionary. */
function render(el, value, locale) {
  const style = el.dataset.countFormat === 'compact'
    ? formatCompact(value, locale)
    : formatInteger(Math.round(value), locale);
  el.textContent = el.dataset.countSuffix === 'none' ? style : `${style}+`;
}

/**
 * The locale is read per frame, not captured when the animation starts.
 * Switching language mid-count-up otherwise finishes in the old locale and
 * leaves "10B+" sitting there after everything else has turned French.
 */
function animate(el) {
  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;

  const from = target * COUNTER.startFraction;
  let started = null;

  function frame(now) {
    started ??= now;
    const p = Math.min((now - started) / COUNTER.durationMs, 1);
    render(el, from + (target - from) * easeOut(p), getLocale());
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function initCountUps() {
  const targets = $$('[data-count]');
  if (!targets.length) return;

  const paint = () => {
    const locale = getLocale();
    for (const el of targets) render(el, Number(el.dataset.count), locale);
  };

  if (prefersReducedMotion()) {
    paint();
  } else {
    observe(targets, (el) => animate(el), {
      once: true,
      threshold: COUNTER.threshold,
    });
  }

  onLocaleChange(paint);
}

const LIVE_EPOCH_MS = Date.parse(LIVE_COUNTER.epoch);

/** Integer hash (lowbias32) mapped to [0, 1). Same input, same output, on
 *  every device. */
function hash01(n) {
  let x = n >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/**
 * The ticker's value at a wall-clock time. A pure function of `nowMs`.
 *
 * Tick k sits at k * step plus a hashed offset in [0, step - 1). Two
 * neighbouring offsets differ by less than step - 1, so each tick adds
 * between 1 and ~2 * step: never zero, never backwards.
 */
function liveValueAt(nowMs) {
  const { startValue, perSecond, tickMs } = LIVE_COUNTER;
  const tick = Math.floor(Math.max(0, nowMs - LIVE_EPOCH_MS) / tickMs);
  const step = (perSecond * tickMs) / 1000;
  const jitter = hash01(tick) * Math.max(0, step - 1);
  return startValue + Math.floor(tick * step + jitter);
}

/**
 * The live ticker.
 *
 * NOTE: the value comes from the clock (see liveValueAt), not from a feed.
 * The "LIVE" badge above it therefore makes a claim the page cannot currently
 * back — see TODO in config/motion.js.
 */
function initLiveCounter() {
  const el = $('#live-counter');
  if (!el) return;

  let timer = null;
  let running = false;

  const paint = () => {
    el.textContent = formatInteger(liveValueAt(Date.now()), getLocale());
  };

  /** Wakes on the tick boundary, so every open page changes digits together. */
  function tick() {
    paint();
    const sinceEpoch = Math.max(0, Date.now() - LIVE_EPOCH_MS);
    timer = setTimeout(tick, LIVE_COUNTER.tickMs - (sinceEpoch % LIVE_COUNTER.tickMs));
  }

  paint();
  onLocaleChange(paint);

  if (prefersReducedMotion()) return;

  observe(el, () => {
    if (running) return;
    running = true;
    tick();
  }, {
    once: false,
    threshold: LIVE_COUNTER.threshold,
    onLeave: () => { running = false; clearTimeout(timer); },
  });
}

export function initCounters() {
  initCountUps();
  initLiveCounter();
}
