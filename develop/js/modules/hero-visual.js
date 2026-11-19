/**
 * Hero motion.
 *
 * The phone rises in and floats (CSS, css/components/hero-visual.css). The
 * cards never settle into a pattern, driven here:
 *
 *   intro  a few cards pop in one by one at uneven moments
 *   flow   from then on, one change at a time: a card appears or a card
 *          leaves, after an uneven pause. Which card, and whether it is an
 *          arrival or a departure, is picked at random each time, so some
 *          cards stay for a long while and others come and go quickly.
 *
 * The number of cards on screen is kept between a minimum and a maximum
 * (FLOW.visible), so the hero is never empty and never shows the full set.
 * Cards that are on keep floating (the CSS idle float).
 *
 * The card animations are Web Animations on opacity + scale + translate only,
 * so they sit on top of the CSS float (transform) without fighting it.
 *
 * The animation starts only once every visible image has decoded, so cards
 * never pop out as empty boxes on a slow connection. Reduced motion, or a
 * failed module, leaves the static Figma frame — nothing is hidden by default.
 */

import { $, $$, prefersReducedMotion } from '../core/dom.js';

/** Give up waiting for slow images after this long and play anyway. */
const MAX_WAIT_MS = 2500;

/** Card flow — tweak here. Ranges are [min, max] in ms, picked at random. */
const FLOW = {
  firstDelay: 650,        // after the phone starts rising, before the first card
  introGap: [110, 620],   // between two cards during the intro
  intro: { desktop: 4, mobile: 2 },             // cards brought in by the intro
  visible: { desktop: [2, 5], mobile: [1, 2] }, // fewest / most cards on at once (of 6 / of 3)
  gap: [500, 2600],       // pause between two changes
  lowGap: [350, 1100],    // shorter pause while only the fewest allowed are on
  quickChance: 0.25,      // how often the next change follows almost at once
  quickGap: [140, 420],
  showChance: 0.58,       // when both are possible: chance the change is an arrival
  stickyChance: 0.35,     // share of arrivals that settle in for a long stay
  stickyWeight: 5,        // a sticky card is this many times less likely to be the one leaving
  minOn: 2200,            // a card stays at least this long
  minOff: 1400,           // and stays away at least this long
  inMs: [520, 780],       // one card's pop-in
  outMs: [600, 950],      // one card's fade-out
  inFrom: { opacity: 0, scale: 0.86, translate: '0 12px' },
  outTo: { opacity: 0, scale: 0.95, translate: '0 0' },
};

const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';     // --ease-out
const EASE_STANDARD = 'cubic-bezier(.4, 0, .2, 1)';  // --ease-standard
const SHOWN = { opacity: 1, scale: 1, translate: '0 0' };

const rand = ([min, max]) => min + Math.random() * (max - min);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Random pick where each item's chance is proportional to weight(item). */
function pickWeighted(list, weight) {
  const total = list.reduce((sum, item) => sum + weight(item), 0);
  let r = Math.random() * total;
  for (const item of list) {
    r -= weight(item);
    if (r <= 0) return item;
  }
  return list[list.length - 1];
}

export function initHeroVisual() {
  const root = $('[data-hero-visual]');
  if (!root || prefersReducedMotion()) return;

  // Desktop-only cards are display:none + lazy on mobile and never load: skip them.
  const images = $$('img', root).filter((img) => img.offsetParent !== null);
  const decoded = images.map((img) => img.decode().catch(() => {}));
  const timeout = new Promise((resolve) => setTimeout(resolve, MAX_WAIT_MS));

  Promise.race([Promise.all(decoded), timeout]).then(() => {
    const canFlow = typeof Element.prototype.animate === 'function';
    // .is-looping hides the cards until the flow shows them; without the Web
    // Animations API the CSS-only pop-in (hv-pop) runs instead.
    root.classList.add('is-animated');
    if (canFlow) {
      root.classList.add('is-looping');
      runCardFlow(root);
    }
  });
}

async function runCardFlow(root) {
  // Hold while the hero is off screen or the tab is hidden.
  let onScreen = true;
  if ('IntersectionObserver' in globalThis) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }).observe(root);
  }
  const whenActive = async () => {
    while (!onScreen || document.hidden) await wait(400);
  };

  /** One animation per card at a time; fill keeps the end state. */
  const current = new Map();
  function play(card, from, to, duration, easing) {
    const anim = card.animate([from, to], { duration, easing, fill: 'forwards' });
    current.get(card)?.cancel();
    current.set(card, anim);
  }

  /** Per card: is it on, since when, and how reluctant it is to leave. */
  const state = new Map();
  const isOn = (card) => state.get(card)?.on === true;
  const since = (card, now) => now - (state.get(card)?.at ?? -Infinity);

  function show(card, now) {
    const sticky = Math.random() < FLOW.stickyChance;
    state.set(card, { on: true, at: now, weight: sticky ? FLOW.stickyWeight : 1 });
    play(card, FLOW.inFrom, SHOWN, rand(FLOW.inMs), EASE_OUT);
  }

  function hide(card, now) {
    state.set(card, { on: false, at: now, weight: 1 });
    play(card, SHOWN, FLOW.outTo, rand(FLOW.outMs), EASE_STANDARD);
  }

  await wait(FLOW.firstDelay);
  let intro = true;

  for (;;) {
    await whenActive();
    const now = performance.now();

    // Visible cards only: the desktop-only ones are display:none on mobile.
    const cards = $$('.hv-card', root).filter((c) => c.offsetParent !== null);
    const mobile = cards.length <= 3;
    const [lo, hi] = mobile ? FLOW.visible.mobile : FLOW.visible.desktop;
    const min = Math.max(1, Math.min(lo, cards.length - 1));
    const max = Math.max(min, Math.min(hi, cards.length - 1));

    const on = cards.filter(isOn);
    const off = cards.filter((c) => !isOn(c));

    // Intro: bring the first few in quickly, one by one.
    if (intro) {
      const target = Math.min(max, mobile ? FLOW.intro.mobile : FLOW.intro.desktop);
      if (on.length < target && off.length) {
        show(pick(off), now);
        await wait(rand(FLOW.introGap));
        continue;
      }
      intro = false;
      await wait(rand(FLOW.gap));
      continue;
    }

    // Flow: one arrival or one departure.
    const canShow = off.filter((c) => since(c, now) >= FLOW.minOff);
    const canHide = on.filter((c) => since(c, now) >= FLOW.minOn);

    let arrive;
    if (on.length <= min) arrive = true;
    else if (on.length >= max) arrive = false;
    else arrive = Math.random() < FLOW.showChance;

    // If the chosen kind is not possible right now, try the other one.
    if (arrive && !canShow.length) {
      arrive = on.length > min && canHide.length ? false : null;
    } else if (arrive === false && !canHide.length) {
      arrive = on.length < max && canShow.length ? true : null;
    }

    if (arrive === true) show(pick(canShow), now);
    else if (arrive === false) hide(pickWeighted(canHide, (c) => 1 / state.get(c).weight), now);

    // Down to the fewest allowed: the next arrival comes sooner.
    const atMin = on.length + (arrive === true ? 1 : arrive === false ? -1 : 0) <= min;
    const quick = arrive !== null && Math.random() < FLOW.quickChance;
    await wait(rand(quick ? FLOW.quickGap : atMin ? FLOW.lowGap : FLOW.gap));
  }
}
