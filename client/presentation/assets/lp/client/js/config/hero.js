export const SCENE = {
  planeSize: 500,
  planeSegments: 50,
  waveLength: Math.PI * 10,

  fieldY: 3.5,
};

export const PARAMS = {
  basePx: 1.5,
  gain: 1.5,
  camDistance: 200.0,
  baseOpacity: 1.0,
  amplitude: 15.0,
  speed: 0.1,
  color: '#3C5FBE',

  sizeRefW: 952,
  sizeRefH: 720,
  sizeScaleMin: 0.62,
  sizeScaleMax: 1.42,
};

export const CAMERA = {
  fov: 60,
  near: 1,
  far: 1000,
  position: [0, 15, 100],
  lookAt: [0, 0, 0],
};

export const RENDERER = {
  maxPixelRatio: 2,
  rotationPerSec: 0.05,

  resizeDebounceMs: 120,
  maxPixelRatioScale: 4,
};
