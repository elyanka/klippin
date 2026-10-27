/**
 * Section 05 globe — tunables. Ported from a standalone prototype: FILL replaces
 * its reference-viewport maths because everything is measured from the host
 * element now, and three.js is the r128 already on the page.
 */

/** Reference frame the composition was authored against. */
export const REF = {
  width: 1138,
  height: 720,
  globeTop: 108,
  globeBottom: 566,
};

/**
 * Globe diameter as a fraction of the host's smaller side.
 *
 * Arcs lift to 1.29x the radius, so this cannot be 1.0 or the long routes
 * clip against the edges of the canvas. 0.74 keeps the tallest arc inside.
 */
export const FILL = 0.74;

export const CAMERA = { fov: 22, near: 0.02, far: 60 };

/** Point-sphere build. SPACING drives the vertex count — lower it with care. */
export const SPHERE = {
  spacing: 0.0066,
  meridians: 384,
  /** Longitude offset so the Atlantic faces the viewer at t=0. */
  lon0: 8,
  /** Seeds the per-point twinkle/size jitter. Any value; just not random. */
  jitterSeed: 7,
};

export const SHADING = {
  rimPow: 3.0,
  rimA: 0.5,
  rimB: 0.3,
  backMul: 0.11,

  gain: 1.2,
  light: [0.16, 0.22, 0.96],
  seaDim: 0.24,
  ptLand: 2.45,
  ptSea: 1.25,
  rimLight: 0.9,
  colDeep: [0.4, 0.5, 0.9],
  colHot: [0.5, 0.6, 0.9],
};

export const MOTION = {
  tiltZ: -0.25,
  tiltX: 0.5,
  tiltY: 0.0,

  spin: 0.21,
  maxDeltaSec: 0.05,
};

export const ARCS = {
  gain: 1.55,
  base: 0.40,
  tail: 5.5,
  speed: 0.34,
  dim: [0.2, 0.2, 0.2],
  lit: [0.0, 0.3, 1.0],
  segments: 48,
};

export const CITIES = {
  size: 6.0,
  gain: 8.0,
  count: 92,
  /** Fraction of nodes drawn near a dense hub rather than scattered. */
  hubBias: 0.65,
  hubRadiusDeg: 14.0,
};

export const POST = {
  exposure: 1.5,
  bloom: 0.8,
  bloomThreshold: 0.8,
  grain: 0.020,
  /** Bloom mip levels. Two is the prototype's setting. */
  mips: 2,
  maxPixelRatio: 2,
};

/** Category slug -> cluster seed. Mirrors the section's tablist. */
export const CLUSTER_BY_CATEGORY = {
  gaming: 1,
  entertainment: 2,
  beyond: 3,
};

export const DEFAULT_CLUSTER = 1;

/** Dense population centres the clusters are seeded around. */
export const DENSE_HUBS = [
  [-74.0, 40.7], [-118.2, 34.0], [-87.6, 41.9], [-122.4, 37.8], [-96.8, 32.8],
  [-80.2, 25.8], [-122.3, 47.6], [-79.4, 43.7], [-99.1, 19.4], [-71.1, 42.4],
  [-0.1, 51.5], [2.3, 48.9], [13.4, 52.5], [4.9, 52.4], [8.7, 50.1],
  [9.2, 45.5], [-3.7, 40.4], [18.1, 59.3], [21.0, 52.2], [14.4, 50.1],
  [139.7, 35.7], [127.0, 37.6], [121.5, 31.2], [114.2, 22.3], [103.8, 1.4],
  [72.9, 19.1], [77.2, 28.6], [55.3, 25.2], [151.2, -33.9], [144.9, -37.8],
  [-46.6, -23.5], [-58.4, -34.6], [-70.6, -33.4], [-74.1, 4.7],
  [28.0, -26.2], [31.2, 30.0], [36.8, -1.3], [3.4, 6.5],
];
