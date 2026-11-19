/**
 * Earnings ladder: the timeline fires up in one swoosh each time it scrolls
 * into view.
 *
 *   1. run        the line starts unlit; a bright head runs along it once,
 *                 leaving the colour behind. Each dot lights as the head passes
 *                 and the glow trail fades in after the Intermediate dot.
 *                 As the head reaches the Advanced dot, the dot pops and sends
 *                 out a ring.
 *   2. afterglow  the head reaches the end and fades there, and the trail
 *                 flares up and settles.
 *   3. lit        the last stage stays alive: the trail breathes and every few
 *                 seconds the Advanced dot pops and sends out a ring, and a
 *                 softer head shoots out of it and runs out to the end, so the
 *                 dot looks like it fires the trail.
 *
 * When the ladder has completely left the screen it goes back to unlit, so the
 * swoosh plays again on the way back.
 *
 * This module only writes numbers and state classes on .earnings;
 * css/components/earnings.css draws everything from them:
 *   --fill   0 → 1, how much of the line is coloured
 *   --head   0 → 1, where the bright head is
 *   --from   where the head's tail may start (lit state: the Advanced dot, so
 *            the head grows out of the dot instead of trailing in behind it)
 *   --spark  0 → 1, the head's brightness
 *   --trail  0 → 1 (and above 1 during the flare), the glow trail
 *   .is-flare during the afterglow, .is-lit after it, .is-reached per tier,
 *   .is-ping on the Advanced tier each time the head reaches its dot, and at
 *            the start of every lit-state sweep.
 *
 * No JS or reduced motion: no .is-swoosh class, the full static line shows.
 */

import { $, $$, prefersReducedMotion } from '../core/dom.js';

const DESKTOP = '(min-width: 900px)';

/** Tweak here. */
const SWOOSH = {
  desktopMs: 950,    // the run, horizontal line
  mobileMs: 1250,    // the run, vertical line (longer distance)
  startAt: 0.78,     // fires when the ladder's top is this far down the screen (× height)
  afterglowMs: 2200, // how long the finish takes to settle
  flare: 0.75,       // how much brighter than normal the trail gets at the finish
  headLinger: 0.22,  // share of the afterglow the head stays visible at the end
  replay: true,      // play again each time the ladder comes back on screen
  keepAlive: true,   // the lit-state breathing + sweeping head on the last stage
  loopMs: 2400,      // lit state: one ping + sweep every this long (sweep ~1.5s, then a short rest)
  pingLeadMs: 180,   // lit state: the dot pops first, the head leaves it this much later
                     // (around the peak of the pop)
  sweepMs: 1300,     // lit state: how long the head takes from the Advanced dot to the end
  sweepBright: 0.85, // lit state: the sweep head's brightness
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Quick off the mark, soft landing. */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function initEarnings() {
  const ladder = $('.earnings');
  if (!ladder || prefersReducedMotion() || !('IntersectionObserver' in globalThis)) return;

  const tiers = $$('.tier', ladder);
  const dots = tiers.map((t) => t.querySelector('.tier__dot'));
  const desktop = globalThis.matchMedia(DESKTOP);

  // The head: an extra list item, out of the grid and hidden from readers.
  const spark = document.createElement('li');
  spark.className = 'earnings__spark';
  spark.setAttribute('aria-hidden', 'true');
  spark.setAttribute('role', 'presentation');
  ladder.append(spark);

  const set = (name, value) => ladder.style.setProperty(name, value.toFixed(4));

  /** 'unlit' → 'running' → 'lit'; back to 'unlit' when the ladder leaves the screen. */
  let phase = 'unlit';
  let raf = 0;

  function reset() {
    cancelAnimationFrame(raf);
    phase = 'unlit';
    ladder.classList.remove('is-flare', 'is-lit');
    tiers[2]?.classList.remove('is-ping');
    set('--fill', 0); set('--head', 0); set('--spark', 0); set('--trail', 0); set('--from', 0);
    tiers.forEach((tier, i) => tier.classList.toggle('is-reached', i === 0));
  }

  /** Where each dot sits along the line, 0 → 1. */
  function dotPositions() {
    const r = ladder.getBoundingClientRect();
    const cs = getComputedStyle(ladder, '::before');
    const horizontal = desktop.matches;
    const start = horizontal ? r.left + parseFloat(cs.left) : r.top + parseFloat(cs.top);
    const length = (horizontal ? parseFloat(cs.width) : parseFloat(cs.height)) || (horizontal ? r.width : r.height);
    return dots.map((dot) => {
      if (!dot) return 0;
      const d = dot.getBoundingClientRect();
      const centre = horizontal ? d.left + d.width / 2 : d.top + d.height / 2;
      return clamp01((centre - start) / length);
    });
  }

  /** The Advanced dot pops and sends out a ring (restarts if already playing). */
  function ping() {
    const tier = tiers[2];
    if (!tier) return;
    tier.classList.remove('is-ping');
    void tier.offsetWidth; // restart the CSS animations
    tier.classList.add('is-ping');
  }

  /**
   * Lit state, every loopMs: the Advanced dot pops and sends out a ring, then a
   * softer head shoots out of it to the end of the line.
   */
  function sweepLoop(at) {
    const adv = at[2] ?? 0.68;
    set('--from', adv);
    let cycleStart = performance.now();
    let pinged = false;

    const frame = (now) => {
      let t = now - cycleStart;
      // a long gap (tab hidden): start a fresh cycle instead of jumping
      if (t > SWOOSH.loopMs * 2) { cycleStart = now; t = 0; pinged = false; }
      if (t >= SWOOSH.loopMs) { cycleStart += SWOOSH.loopMs; t -= SWOOSH.loopMs; pinged = false; }

      if (!pinged) { pinged = true; ping(); }

      const p = clamp01((t - SWOOSH.pingLeadMs) / SWOOSH.sweepMs);
      const running = t >= SWOOSH.pingLeadMs && p < 1;
      // quick out of the dot, soft landing at the end
      set('--head', running ? adv + (1 - adv) * easeOut(p) : adv);
      // the head grows out of the dot (--from), so it can light up almost at once;
      // the CSS fades it out over the line's end
      set('--spark', running ? SWOOSH.sweepBright * clamp01(p / 0.06) : 0);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  function swoosh() {
    phase = 'running';
    const at = dotPositions();
    const trailFrom = at[1] ?? 0.35;
    let pinged = false;
    const runMs = desktop.matches ? SWOOSH.desktopMs : SWOOSH.mobileMs;
    const t0 = performance.now();

    const frame = (now) => {
      const elapsed = now - t0;

      if (elapsed < runMs) {
        // 1. run
        const fill = ease(elapsed / runMs);
        set('--fill', fill); set('--head', fill); set('--spark', 1);
        set('--trail', clamp01((fill - trailFrom) / (1 - trailFrom || 1)));
        tiers.forEach((tier, i) => { if (fill >= at[i] && !tier.classList.contains('is-reached')) tier.classList.add('is-reached'); });
        if (!pinged && fill >= (at[2] ?? 0.68)) { pinged = true; ping(); }
        raf = requestAnimationFrame(frame);
        return;
      }

      // 2. afterglow
      const t = clamp01((elapsed - runMs) / SWOOSH.afterglowMs);
      if (!ladder.classList.contains('is-flare')) {
        set('--fill', 1); set('--head', 1);
        tiers.forEach((tier) => tier.classList.add('is-reached'));
        if (!pinged) { pinged = true; ping(); }
        ladder.classList.add('is-flare');
      }
      set('--spark', 1 - clamp01(t / SWOOSH.headLinger));
      set('--trail', 1 + SWOOSH.flare * (1 - easeOut(t)));
      if (t < 1) {
        raf = requestAnimationFrame(frame);
        return;
      }

      // 3. lit
      phase = 'lit';
      ladder.classList.remove('is-flare');
      if (SWOOSH.keepAlive) {
        ladder.classList.add('is-lit');
        sweepLoop(at);
      }
    };
    raf = requestAnimationFrame(frame);
  }

  ladder.classList.add('is-swoosh');
  reset();

  // Fire when the ladder's top crosses the start line.
  const enter = new IntersectionObserver((entries) => {
    if (phase !== 'unlit' || !entries.some((e) => e.isIntersecting)) return;
    if (!SWOOSH.replay) enter.disconnect();
    swoosh();
  }, { rootMargin: `0px 0px -${Math.round((1 - SWOOSH.startAt) * 100)}% 0px` });
  enter.observe(ladder);

  // Back to unlit once it is completely off screen, ready to play again.
  if (SWOOSH.replay) {
    new IntersectionObserver((entries) => {
      if (entries.every((e) => !e.isIntersecting)) reset();
    }).observe(ladder);
  }
}
