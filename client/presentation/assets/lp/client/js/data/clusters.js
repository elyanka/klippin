/**
 * Network cluster generation — the city nodes and the routes between them.
 *
 * Pure data: no THREE, no DOM. Deterministic for a given seed, so the same
 * category always draws the same network and the three tabs stay visually
 * distinct from each other.
 */

import { landAt } from './land-mask.js';
import { DENSE_HUBS, CITIES } from '../config/network-globe.js';

/** mulberry32 — small, fast, and stable across engines. */
export function createRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A point near `hub` that is actually on land.
 *
 * The land grid is 0.7 degrees per cell, so a coastal hub's exact coordinate
 * often reads as sea. Retrying is what keeps nodes off the water instead of
 * trusting one lookup.
 */
function sampleNearHub(hub, radiusDeg, rng) {
  for (let i = 0; i < 35; i++) {
    const r = Math.pow(rng(), 0.65) * radiusDeg;
    const ang = rng() * Math.PI * 2;
    let lon = hub[0] + r * Math.cos(ang);
    let lat = hub[1] + r * Math.sin(ang);
    if (lat > 75) lat = 75;
    if (lat < -55) lat = -55;
    if (lon > 180) lon -= 360;
    if (lon < -180) lon += 360;
    if (landAt(lon, lat) === 1) return [lon, lat];
  }
  return [hub[0], hub[1]];
}

/** A land point anywhere in the inhabited latitudes. */
function sampleContinentalLand(rng) {
  for (let i = 0; i < 90; i++) {
    const lon = rng() * 360 - 180;
    const lat = rng() * 128 - 54;
    if (landAt(lon, lat) === 1) return [lon, lat];
  }
  return [0, 25];
}

/** Great-circle distance in radians. */
function sphericalDist(c1, c2) {
  const lon1 = (c1[0] * Math.PI) / 180;
  const lat1 = (c1[1] * Math.PI) / 180;
  const lon2 = (c2[0] * Math.PI) / 180;
  const lat2 = (c2[1] * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Build one network.
 *
 * Routes are mostly short hops to a node's nearest neighbours, which is what
 * makes the result read as regional clusters rather than a hairball, plus an
 * occasional mid-range link so the continents are visibly connected.
 *
 * @param {number} seed
 * @returns {{cities: [number, number][], routes: [number, number][]}}
 */
export function generateCluster(seed) {
  const rng = createRng(seed * 48271 + 1013904223);
  const cities = [];

  for (let i = 0; i < CITIES.count; i++) {
    if (rng() < CITIES.hubBias) {
      const hub = DENSE_HUBS[Math.floor(rng() * DENSE_HUBS.length)];
      cities.push(sampleNearHub(hub, CITIES.hubRadiusDeg, rng));
    } else {
      cities.push(sampleContinentalLand(rng));
    }
  }

  const routes = [];
  const seen = new Set();
  const addRoute = (u, v) => {
    if (u === v) return;
    const key = u < v ? `${u}-${v}` : `${v}-${u}`;
    if (seen.has(key)) return;
    seen.add(key);
    routes.push([u, v]);
  };

  for (let u = 0; u < CITIES.count; u++) {
    const near = [];
    for (let v = 0; v < CITIES.count; v++) {
      if (u !== v) near.push({ idx: v, d: sphericalDist(cities[u], cities[v]) });
    }
    near.sort((a, b) => a.d - b.d);

    if (near.length > 0 && near[0].d < 0.65 && rng() > 0.15) addRoute(u, near[0].idx);
    if (near.length > 1 && near[1].d < 0.90 && rng() > 0.40) addRoute(u, near[1].idx);
    if (rng() < 0.08) {
      const mid = near.filter((x) => x.d > 1.2 && x.d < 2.3);
      if (mid.length) addRoute(u, mid[Math.floor(rng() * mid.length)].idx);
    }
  }

  return { cities, routes };
}

/** Clusters are generated on first use and cached — each costs ~92^2 distances. */
const cache = new Map();

export function getCluster(seed) {
  if (!cache.has(seed)) cache.set(seed, generateCluster(seed));
  return cache.get(seed);
}
