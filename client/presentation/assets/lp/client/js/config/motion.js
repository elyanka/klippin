/**
 * Animation timings and observer thresholds.
 * Kept out of the modules so pacing can be tuned in one place.
 */

/** Scroll reveal */
export const REVEAL = {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px',
  staggerMs: 90,
};

/** Hero stats + section counters */
export const COUNTER = {
  durationMs: 1600,
  threshold: 0.5,
  /** Count up from this fraction of the target rather than from zero. */
  startFraction: 0.72,
};

/** The "verified views delivered" ticker in section 03.
 *  TODO(content): PER_SECOND is a presentational increment, not a live feed.
 *  The LIVE badge makes this a factual claim — it needs sign-off, or the
 *  badge has to come off. */
export const LIVE_COUNTER = {
  /** The figure at `epoch`. Every device works the current one out from the
   *  clock, so all visitors see the same number and a reload never rolls it
   *  back. Moving either value moves the number for everyone. */
  startValue: 11560436512,
  epoch: '2026-10-01T00:00:00Z',
  /** Average growth. Each tick adds 1 to ~2x this, picked by a hash of the
   *  tick's index, so the steps look random but match on every device. */
  perSecond: 18,
  tickMs: 400,
  threshold: 0.2,
};

/** References logo marquee */
export const MARQUEE = {
  durationSec: 42,
  threshold: 0,
};

/** Use-case carousel. The track drifts continuously rather than stepping, so
 *  its pacing is a speed, not an interval. */
export const CAROUSEL = {
  /** Drift speed. One card is ~373px wide with its gap, so 50px/s carries a
   *  card past the centre roughly every seven seconds. 0 stops the drift. */
  speedPxPerSec: 50,
  /** How long the drift takes to reach full speed, or to come to rest when
   *  the pointer arrives. Stopping dead under the cursor reads as a fault. */
  rampMs: 320,
  /** A click or an arrow key glides the track by one card over this. */
  nudgeMs: 620,
  /** The drift only runs while this much of the carousel is on screen. */
  threshold: 0.35,
};

/** Section 04 "How it works" — the mechanism figure.
 *  Lengths are in Figma's own 420x340 stage, which modules/network-mech.js
 *  scales to whatever width the illustration ends up at. */
export const MECH = {
  /** One trip round the outer orbit. The ring itself is animated in CSS at
   *  the same 40s — change one and the other has to follow, or the clippers
   *  drift through the dots they are supposed to be riding with. */
  orbitSec: 40,
  /** A particle lives this many orbits: 60s, so the batch released on one
   *  pass is still thinning out when the next one arrives. */
  lifetimeFactor: 1.5,
  /** Dots released per avatar per pass over the contact point... */
  batchSize: 12,
  /** ...staggered by this, so a batch arrives as a stream and not a puff. */
  spawnDelaySec: 0.05,
  /** How fast a dot circles its own avatar, rad/s — far quicker than the
   *  orbit underneath it, which is what makes the avatars read as busy. */
  spinRadPerSec: 4,
  /** Clearance between the avatar's edge and its ring of dots. */
  spreadRadius: 18,
  /** Dot radius and the blur around it. */
  dotRadius: 1.5,
  dotGlow: 6,
  /** The avatars breathe: ±10% over two seconds, offset per seat. */
  pulseSec: 2,
  pulseDepth: 0.1,
  threshold: 0.15,
};

/** Network category auto-cycle in section 05 */
export const NETWORK_AXES = {
  intervalMs: 3400,
  threshold: 0.25,
};

/** Organic-vs-paid chart line draw */
export const CHART = {
  threshold: 0.35,
  drawMs: 2400,
};

/** Nav becomes "stuck" past this scroll offset. */
export const NAV_STUCK_OFFSET = 12;
