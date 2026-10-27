/**
 * Section 04 "How it works" — the mechanism figure.
 *
 * Three things move, and one clock drives all three so they stay in step.
 *
 * 1. The six wires. Their ends are measured rather than drawn: every strand
 *    runs between a chip's edge and the single point where the outer orbit
 *    crosses the figure's centre line — the left one for everything flowing
 *    in, the right one for everything flowing out. That point is what the
 *    whole diagram converges on, and it moves with the layout, so the paths
 *    are rebuilt on resize instead of being baked into the markup.
 *
 * 2. The six clippers, which ride the outer orbit at the ring's own rate and
 *    stay upright while they do. JS owns their angle because (3) has to know
 *    where each avatar is on the same frame; a CSS animation would be a
 *    second clock, and the rings of light would slide off their avatars.
 *
 * 3. The particles, on a canvas rather than in the DOM — they are released in
 *    batches and burn out, so there is no stable set of elements to style.
 *    Each avatar carries a ring, and a fresh batch leaves it every time it
 *    passes the left contact point, where the source wires arrive. A dot
 *    cools from accent-primary to accent-deep over its life and then goes
 *    out, so a ring thins on the way round and fills again on the next pass.
 */

import { $, $$, on, rafThrottle, prefersReducedMotion } from '../core/dom.js';
import { observe } from '../core/observe.js';
import { MECH } from '../config/motion.js';

const TAU = Math.PI * 2;

const STAGE_W = 420;
const STAGE_H = 340;
const CX = 210;
const CY = 170;
/** Canvas margin past the stage on every side, in stage units — the dots round
 *  the top and bottom avatars overshoot 0..340. Matches --bleed on
 *  .netill__canvas. */
const BLEED = 40;

/** The outer ring — what the wires land on. */
const ORBIT_R = 127;
/** Where the clippers ride, five units outside it. See the note on
 *  .netill__avatar in components/network-illustration.css. */
const SEAT_R = 132;
const AVATAR_R = 24;
/** An avatar is over the left contact point at half a turn. */
const ENTRY_ANGLE = Math.PI;
/** CSS rotate() starts at twelve o'clock; cos/sin start at three. Everything
 *  the canvas computes is in the second system, and --a is written in the
 *  first, so the two have to be a quarter turn apart or the rings of light
 *  sit on the wrong side of the figure from the avatars they belong to. */
const QUARTER = Math.PI / 2;

const BEND_IN = 0.55;
const BEND_OUT = 0.45;

/** Steps in the colour ramp — one pre-rendered glow sprite each. */
const RAMP_STEPS = 16;

const round2 = (value) => Math.round(value * 100) / 100;

/** `#87A8ED` -> [135, 168, 237]. Falls back rather than throwing: the tokens
 *  are read off the cascade, and a renamed one must not stop the figure. */
function toRgb(value, fallback) {
  const hex = value.trim().replace('#', '');
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return fallback;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Did the angle pass `target` going forward, between these two samples?
 *  A crossing test and not "is it close enough to target": at 40s a
 *  revolution any window wide enough to be reliable is also wide enough to
 *  fire twice, and one long frame steps clean over a narrow one. */
function crossed(before, after, target) {
  return after >= before
    ? before < target && after >= target
    : before < target || after >= target;
}

export function initNetworkMech() {
  const mech = $('[data-mech]');
  if (!mech) return;

  const stage = $('.netill', mech);
  if (!stage) return;

  layoutWires(mech, stage);
  animate(mech, stage);
}

/**
 * The six strands. Everything is expressed in .mech's own pixel box, which is
 * also what the viewBox is set to — so a stroke length in CSS is a stroke
 * length on screen, and the dots stay square at any width.
 */
function layoutWires(mech, stage) {
  const svg = $('.mech__wires', mech);
  const wires = $$('.mech__wire', mech);
  const sources = $$('.mech__src-item', mech);
  const feeds = $$('.mech__platform', mech);
  if (!svg || wires.length < sources.length + feeds.length) return;

  function draw() {
    const box = mech.getBoundingClientRect();
    const figure = stage.getBoundingClientRect();
    if (!box.width || !figure.width) return;

    svg.setAttribute('viewBox', `0 0 ${round2(box.width)} ${round2(box.height)}`);

    const sx = figure.width / STAGE_W;
    const sy = figure.height / STAGE_H;
    const inX = (figure.left - box.left) + (CX - ORBIT_R) * sx;
    const outX = (figure.left - box.left) + (CX + ORBIT_R) * sx;
    const midY = (figure.top - box.top) + CY * sy;

    sources.forEach((chip, i) => {
      const rect = chip.getBoundingClientRect();
      const x = rect.right - box.left;
      const y = rect.top + rect.height / 2 - box.top;
      const cp = x + (inX - x) * BEND_IN;

      wires[i].setAttribute(
        'd',
        `M${round2(x)} ${round2(y)}C${round2(cp)} ${round2(y)},`
        + `${round2(cp)} ${round2(midY)},${round2(inX)} ${round2(midY)}`,
      );
    });

    feeds.forEach((chip, i) => {
      const rect = chip.getBoundingClientRect();
      const x = rect.left - box.left;
      const y = rect.top + rect.height / 2 - box.top;
      const cp = outX + (x - outX) * BEND_OUT;

      wires[sources.length + i].setAttribute(
        'd',
        `M${round2(outX)} ${round2(midY)}C${round2(cp)} ${round2(midY)},`
        + `${round2(cp)} ${round2(y)},${round2(x)} ${round2(y)}`,
      );
    });
  }

  const redraw = rafThrottle(draw);
  draw();
  on(globalThis, 'resize', redraw);
  if ('ResizeObserver' in globalThis) new ResizeObserver(redraw).observe(mech);

  document.fonts?.ready.then(redraw).catch(() => {});
}

/** The clippers and their particles. */
function animate(mech, stage) {
  const canvas = $('.netill__canvas', stage);
  const clippers = $$('.netill__clipper', stage);
  const ctx = canvas?.getContext('2d');
  if (!ctx || !clippers.length) return;

  const seats = clippers.length;
  const gap = TAU / seats;
  const lifeSec = MECH.orbitSec * MECH.lifetimeFactor;

  const reach = MECH.dotRadius + MECH.dotGlow * 1.5;

  const avatars = Array.from({ length: seats }, () => ({ x: CX, y: CY, r: AVATAR_R }));
  const wasAt = new Array(seats).fill(null);
  const dots = [];
  const queued = [];

  let scale = 1;
  let sprites = [];
  let spriteSize = 0;
  let clock = 0;
  let previous = 0;
  let raf = 0;

  const makeDot = (seat, age) => ({ seat, age, offset: Math.random() * TAU });

  /** The ramp, read off the cascade so the figure stays on the tokens. */
  function ramp() {
    const root = getComputedStyle(document.documentElement);
    const from = toRgb(root.getPropertyValue('--color-accent-primary'), [135, 168, 237]);
    const to = toRgb(root.getPropertyValue('--color-accent-deep'), [60, 95, 190]);
    return Array.from({ length: RAMP_STEPS }, (_, i) => {
      const k = i / (RAMP_STEPS - 1);
      const mix = from.map((c, j) => Math.round(c + (to[j] - c) * k));
      return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
    });
  }

  function buildSprites() {
    const px = Math.max(2, Math.round(reach * 2 * scale));
    spriteSize = px / scale;
    sprites = ramp().map((color) => {
      const sprite = document.createElement('canvas');
      sprite.width = px;
      sprite.height = px;
      const paint = sprite.getContext('2d');
      paint.setTransform(scale, 0, 0, scale, 0, 0);

      paint.shadowBlur = MECH.dotGlow * scale;
      paint.shadowColor = color;
      paint.fillStyle = color;
      paint.beginPath();
      paint.arc(spriteSize / 2, spriteSize / 2, MECH.dotRadius, 0, TAU);
      paint.fill();
      return sprite;
    });
  }

  function sizeCanvas() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return false;

    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const px = width * dpr;
    const next = Math.round(px * (STAGE_W + BLEED * 2) / STAGE_W);
    if (canvas.width !== next) {
      canvas.width = next;
      canvas.height = Math.round(height * dpr * (STAGE_H + BLEED * 2) / STAGE_H);
    }

    const nextScale = px / STAGE_W;
    if (nextScale !== scale || !sprites.length) {
      scale = nextScale;
      buildSprites();
    }
    return true;
  }

  function render(dt) {
    if (!sizeCanvas()) return;

    clock += dt;
    const spin = (clock / MECH.orbitSec) * TAU;

    for (let i = 0; i < seats; i++) {
      const phase = i * gap;

      const turn = spin + phase;
      const angle = turn - QUARTER;
      const pulse = 1 + MECH.pulseDepth * Math.sin((clock / MECH.pulseSec) * TAU + phase);

      const avatar = avatars[i];
      avatar.x = CX + Math.cos(angle) * SEAT_R;
      avatar.y = CY + Math.sin(angle) * SEAT_R;
      avatar.r = AVATAR_R * pulse;

      const clipper = clippers[i];
      clipper.style.setProperty('--a', `${round2(turn * (180 / Math.PI))}deg`);
      clipper.style.setProperty('--pulse', pulse.toFixed(3));

      const here = ((angle % TAU) + TAU) % TAU;
      if (wasAt[i] !== null && crossed(wasAt[i], here, ENTRY_ANGLE)) {
        for (let b = 0; b < MECH.batchSize; b++) {
          queued.push({ seat: i, at: clock + b * MECH.spawnDelaySec });
        }
      }
      wasAt[i] = here;
    }

    for (let i = queued.length - 1; i >= 0; i--) {
      if (clock < queued[i].at) continue;
      dots.push(makeDot(queued[i].seat, 0));
      queued.splice(i, 1);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, BLEED * scale, BLEED * scale);

    const half = spriteSize / 2;
    for (let i = dots.length - 1; i >= 0; i--) {
      const dot = dots[i];
      dot.age += dt;
      if (dot.age >= lifeSec) {
        dots.splice(i, 1);
        continue;
      }
      const avatar = avatars[dot.seat];
      const around = dot.offset + dot.age * MECH.spinRadPerSec;
      const radius = avatar.r + MECH.spreadRadius;
      const step = Math.min(RAMP_STEPS - 1, (dot.age / lifeSec * RAMP_STEPS) | 0);
      ctx.drawImage(
        sprites[step],
        avatar.x + Math.cos(around) * radius - half,
        avatar.y + Math.sin(around) * radius - half,
        spriteSize,
        spriteSize,
      );
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);

    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    render(dt);
  }

  function start() {
    mech.dataset.paused = 'false';
    if (raf) return;
    previous = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    mech.dataset.paused = 'true';
    cancelAnimationFrame(raf);
    raf = 0;
  }

  for (let i = 0; i < seats; i++) {
    for (let b = 0; b < MECH.batchSize; b++) {
      dots.push(makeDot(i, (b / MECH.batchSize) * lifeSec * 0.5));
    }
  }

  if (prefersReducedMotion()) {
    const redraw = rafThrottle(() => render(0));
    redraw();
    on(globalThis, 'resize', redraw);
    return;
  }

  observe(mech, start, { once: false, threshold: MECH.threshold, onLeave: stop });
}
