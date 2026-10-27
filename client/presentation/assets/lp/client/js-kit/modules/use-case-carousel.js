/**
 * Use-case carousel.
 *
 * The track drifts continuously and is never parked on a card: one rAF loop owns
 * the transform, so there is no CSS transition on it and no step to land on.
 * Each card's scale and opacity come from its distance to the centre, run
 * through a smoothstep between the two values the stylesheet declares — the
 * numbers stay in CSS.
 *
 * Looping clones the full set on both sides and wraps the offset modulo one
 * set's width, so the wrap is invisible in either direction.
 *
 * WCAG 2.2.2: the design carries no chrome for a pause control, so the drift
 * holds on hover, on keyboard focus inside the section and while it is off
 * screen. Under prefers-reduced-motion it never drifts at all.
 */

import { $, $$, on, debounce, prefersReducedMotion } from '../core/dom.js';
import { CAROUSEL } from '../config/motion.js';
import { observe } from '../core/observe.js';
import { t, onLocaleChange } from '../core/i18n.js';

export function initCarousel() {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const track = $('.client-carousel__track', root);
  const viewport = $('.client-carousel__viewport', root);
  const status = $('[data-carousel-status]', root);
  if (!track || !viewport) return;

  const real = $$('.client-case-card', track);
  const count = real.length;
  if (!count) return;

  const cloneSet = () => {
    const fragment = document.createDocumentFragment();
    for (const card of real) {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.dataset.clone = 'true';

      for (const el of $$('[data-i18n], [data-i18n-html]', clone)) {
        el.removeAttribute('data-i18n');
        el.removeAttribute('data-i18n-html');
      }
      fragment.appendChild(clone);
    }
    return fragment;
  };
  track.insertBefore(cloneSet(), track.firstChild);
  track.appendChild(cloneSet());

  const all = $$('.client-case-card', track);
  const home = count + Math.floor(count / 2);

  const styles = getComputedStyle(root);
  const dimScale = parseFloat(styles.getPropertyValue('--case-scale')) || 0.92;
  const dimAlpha = parseFloat(styles.getPropertyValue('--case-dim')) || 0.4;

  let centers = [];
  let stepWidth = 0;
  let setWidth = 0;
  let middle = 0;
  let origin = 0;
  let x = 0;
  let active = -1;

  function measure() {
    const base = all[0].offsetParent === track ? 0 : track.offsetLeft;
    centers = all.map((el) => el.offsetLeft - base + el.offsetWidth / 2);
    setWidth = centers[count] - centers[0];
    stepWidth = count > 1 ? centers[1] - centers[0] : setWidth;
    middle = viewport.clientWidth / 2;
    origin = middle - centers[home];
  }

  /** Slide back into the window the clones cover. Every set is identical, so
   *  a jump of exactly one set is invisible. */
  function wrap() {
    if (setWidth <= 0) return;
    while (x < origin - setWidth) x += setWidth;
    while (x > origin) x -= setWidth;
  }

  let painted = new Array(all.length).fill(null);

  function paint() {
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;

    let nearest = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < all.length; i++) {
      const distance = Math.abs(centers[i] + x - middle) / stepWidth;
      if (distance < nearestDistance) { nearestDistance = distance; nearest = i; }

      const linear = distance >= 1 ? 0 : 1 - distance;
      const ramp = linear * linear * (3 - 2 * linear);
      if (painted[i] !== null && Math.abs(painted[i] - ramp) < 0.002) continue;
      painted[i] = ramp;

      const card = all[i];
      card.style.transform = `scale(${(dimScale + (1 - dimScale) * ramp).toFixed(4)})`;
      card.style.opacity = (dimAlpha + (1 - dimAlpha) * ramp).toFixed(3);
    }

    if (nearest !== active) {
      all[active]?.classList.remove('is-active');
      all[nearest].classList.add('is-active');
      active = nearest;
    }
  }

  const canDrift = CAROUSEL.speedPxPerSec > 0 && !prefersReducedMotion();
  const holds = new Set(['offscreen']);
  const drifting = () => canDrift && !holds.size && !dragging && !glide;

  let speed = 0;
  let glide = null;
  let frame = null;
  let previous = 0;

  function tick(now) {
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;

    if (glide) {
      const progress = Math.min((now - glide.start) / glide.ms, 1);
      const eased = 1 - (1 - progress) ** 3;
      x = glide.from + (glide.to - glide.from) * eased;
      if (progress >= 1) glide = null;
      speed = 0;
    } else if (!dragging) {
      const target = drifting() ? CAROUSEL.speedPxPerSec : 0;

      speed += (target - speed) * (1 - Math.exp(-dt * 1000 / CAROUSEL.rampMs));
      x -= speed * dt;
    }

    wrap();
    paint();

    const busy = glide || dragging || drifting() || Math.abs(speed) > 0.05;
    frame = busy ? requestAnimationFrame(tick) : null;
    if (!busy) speed = 0;
  }

  /** Start the loop, or leave it running. Idle costs no frames at all. */
  function run() {
    if (frame !== null) return;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  }

  const hold = (reason, held) => {
    if (held) holds.add(reason);
    else { holds.delete(reason); run(); }
  };

  function announce(at) {
    if (!status) return;
    const template = t('cases.status') ?? '{current} / {total}';
    status.textContent = template
      .replace('{current}', String((at % count) + 1))
      .replace('{total}', String(count));
  }

  /** Glide to an offset, then hand the track back to the drift. */
  function glideTo(to) {
    glide = {
      from: x,
      to,
      start: performance.now(),

      ms: prefersReducedMotion() ? 1 : CAROUSEL.nudgeMs,
    };
    run();

    let at = 0;
    let best = Infinity;
    for (let i = 0; i < all.length; i++) {
      const d = Math.abs(centers[i] + to - middle);
      if (d < best) { best = d; at = i; }
    }
    announce(at);
  }

  /** The offset that centres card i, picked from the copy nearest to hand so
   *  a click never sends the track across two whole sets. */
  function offsetFor(i) {
    let to = middle - centers[i];
    while (to - x > setWidth / 2) to -= setWidth;
    while (x - to > setWidth / 2) to += setWidth;
    return to;
  }

  on(root, 'keydown', (event) => {
    if (event.key === 'ArrowLeft')  { event.preventDefault(); glideTo(x + stepWidth); }
    if (event.key === 'ArrowRight') { event.preventDefault(); glideTo(x - stepWidth); }
  });

  on(root, 'pointerenter', (event) => {
    if (event.pointerType === 'mouse') hold('hover', true);
  });
  on(root, 'pointerleave', (event) => {
    if (event.pointerType === 'mouse') hold('hover', false);
  });

  on(root, 'focusin', (event) => {
    if (event.target?.matches?.(':focus-visible')) hold('focus', true);
  });
  on(root, 'focusout', (event) => {
    if (!root.contains(event.relatedTarget)) hold('focus', false);
  });

  observe(root, () => hold('offscreen', false), {
    once: false,
    threshold: CAROUSEL.threshold,
    onLeave: () => hold('offscreen', true),
  });

  const TAP_SLOP = 4;

  let dragging = false;
  let startX = 0;
  let from = 0;
  let moved = 0;

  on(track, 'pointerdown', (event) => {
    if (event.button) return;
    dragging = true;
    glide = null;
    speed = 0;
    startX = event.clientX;
    from = x;
    moved = 0;
    track.classList.add('is-dragging');
    track.setPointerCapture?.(event.pointerId);
    run();
  });

  on(track, 'pointermove', (event) => {
    if (!dragging) return;
    moved = event.clientX - startX;
    x = from + moved;
  });

  /** Released mid-track: the drift picks it up where the hand left it. A press
   *  that never travelled is a press ON a card, and centres it instead.
   *
   *  This cannot be a click listener on the cards: the pointer is captured by
   *  the track for the duration of a drag, which makes the track the target of
   *  the click that follows, so a card would never hear its own. Hit-testing
   *  the release point is true for a tap as well as a click. */
  function release(event) {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');

    if (Math.abs(moved) > TAP_SLOP) hold('hover', false);

    if (Math.abs(moved) <= TAP_SLOP && event?.clientX !== undefined) {
      const card = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest('.client-case-card');
      const i = card ? all.indexOf(card) : -1;
      if (i >= 0) { glideTo(offsetFor(i)); return; }
    }
    run();
  }

  on(track, 'pointerup', release);
  on(track, 'pointercancel', release);
  on(globalThis, 'blur', release);

  function relayout() {
    const centred = active < 0 ? home : active;
    measure();
    x = middle - centers[centred];
    painted.fill(null);
    wrap();
    paint();
  }

  on(globalThis, 'resize', debounce(relayout, 120), { passive: true });
  onLocaleChange(() => announce(active < 0 ? home : active));

  measure();
  x = origin;
  paint();
  announce(home);

  document.fonts?.ready.then(relayout);
}
