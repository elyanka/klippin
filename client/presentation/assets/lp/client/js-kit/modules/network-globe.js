/**
 * Section 05 — the network globe.
 *
 * A point-sphere Earth with animated great-circle routes through a small bloom
 * chain. Ported from a standalone prototype, with three changes: it measures the
 * host element via ResizeObserver instead of the window, it uses the page's
 * self-hosted three.js r128 rather than a CDN copy, and cluster selection comes
 * from the section's tablist rather than its own HUD.
 *
 * It renders nothing when WebGL is unavailable or motion is reduced — the static
 * raster underneath simply stays.
 */

import { landSoft } from '../data/land-mask.js';
import { getCluster, createRng } from '../data/clusters.js';
import {
  REF, FILL, CAMERA, SPHERE, SHADING, MOTION, ARCS, CITIES, POST,
  CLUSTER_BY_CATEGORY, DEFAULT_CLUSTER,
} from '../config/network-globe.js';
import { prefersReducedMotion, debounce } from '../core/dom.js';

const COMMON = `
uniform float uStreak;
vec4 streak(vec4 mv, float amt){ mv.xy += mv.xy * amt; return mv; }
`;

const GLOBE_VERT = COMMON + `
attribute vec3 aN; attribute float aR; attribute float aL;
uniform float uSizeL,uSizeS,uCamD,uRimPow,uRimA,uRimB,uBackMul,uSeaDim,uRimLight,uTime;
uniform vec3 uLight;
varying float vI; varying float vR; varying float vLand;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vec3 nv = normalize(normalMatrix * aN);
  vec3 vd = normalize(-mv.xyz);
  float face = dot(nv,vd);
  if (face < -0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float rim  = clamp(1.0 - abs(face), 0.0, 1.0);
  float back = mix(uBackMul, 1.0, smoothstep(-0.06, 0.22, face));
  float lit  = 0.46 + 0.54*max(dot(nv,uLight),0.0);
  lit += uRimLight * pow(rim, 6.0);
  float tw   = 0.76 + 0.36*sin(aR*97.3 + uTime*0.85);
  vI = (uRimB + uRimA*pow(rim,uRimPow)) * lit * back * (0.52+0.96*aR) * tw;
  vI *= mix(uSeaDim, 1.0, aL);
  vI /= (1.0 + 0.85*uStreak);
  vLand = aL; vR = aR;
  float persp = pow(clamp(uCamD / max(-mv.z, 0.05), 0.15, 8.0), 0.35);
  gl_PointSize = clamp(mix(uSizeS, uSizeL, aL) * (0.82 + 0.40*aR) * persp, 0.8, 15.0);
  mv = streak(mv, uStreak);
  gl_Position = projectionMatrix * mv;
}`;

const GLOBE_FRAG = `
uniform float uGain,uAlpha; uniform vec3 uDeep,uHot;
varying float vI; varying float vR; varying float vLand;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = 1.0 - smoothstep(0.58, 1.0, d);
  float m = clamp(vR*0.30 + vI*1.35 + vLand*0.46, 0.0, 1.0);
  vec3 c = mix(uDeep,uHot,m);
  gl_FragColor = vec4(max(c * a * vI * uGain * uAlpha, 0.0), 1.0);
}`;

const ARC_VERT = COMMON + `
attribute float aT; attribute float aPh;
uniform float uTime,uBase,uTail,uSpeed;
varying float vI; varying float vHead;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vec3 cv = (modelViewMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
  float front = smoothstep(-0.18, 0.10, (mv.z - cv.z) / 0.5);
  float head = fract(uTime * uSpeed * (0.62 + 0.55*aPh) + aPh);
  float d = head - aT; d = d - floor(d);
  float trail = exp(-d * uTail);
  float ends = smoothstep(0.0, 0.05, aT) * smoothstep(1.0, 0.95, aT);
  float w = 0.45 + 0.85*fract(aPh*3.7);
  vHead = trail;
  vI = (uBase*w + trail) * ends * mix(0.06, 1.0, front);
  mv = streak(mv, uStreak);
  gl_Position = projectionMatrix * mv;
}`;

const ARC_FRAG = `
uniform float uGain,uAlpha; uniform vec3 uDim,uLit;
varying float vI; varying float vHead;
void main(){
  vec3 c = mix(uDim, uLit, clamp(vHead*1.6, 0.0, 1.0));
  gl_FragColor = vec4(max(c * vI * uGain * uAlpha, 0.0), 1.0);
}`;

const CITY_VERT = COMMON + `
attribute float aR;
uniform float uPx,uCamD,uTime;
varying float vI;
void main(){
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vec3 cv = (modelViewMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
  float front = smoothstep(-0.06, 0.14, (mv.z - cv.z) / 0.5);
  float puls = 0.62 + 0.38*sin(uTime*1.6 + aR*39.1);
  vI = puls * mix(0.0, 1.0, front);
  float persp = pow(clamp(uCamD / max(-mv.z, 0.05), 0.2, 8.0), 0.30);
  gl_PointSize = clamp(uPx * persp, 1.0, 20.0);
  mv = streak(mv, uStreak);
  gl_Position = projectionMatrix * mv;
}`;

const CITY_FRAG = `
uniform float uGain,uAlpha; uniform vec3 uLit;
varying float vI;
void main(){
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = 1.0 - smoothstep(0.34, 0.62, d);
  float ring = (1.0 - smoothstep(0.0, 1.0, d)) * 0.30;
  gl_FragColor = vec4(max(uLit * (core + ring) * vI * uGain * uAlpha, 0.0), 1.0);
}`;

const QUAD_VERT = 'varying vec2 vU; void main(){ vU=uv; gl_Position=vec4(position.xy,0.0,1.0); }';

const BRIGHT_FRAG = `
uniform sampler2D tD; uniform float uThr; uniform vec2 uTexel; varying vec2 vU;
void main(){
  vec3 s = texture2D(tD,vU+uTexel*vec2(-0.5,-0.5)).rgb + texture2D(tD,vU+uTexel*vec2(0.5,-0.5)).rgb
         + texture2D(tD,vU+uTexel*vec2(-0.5,0.5)).rgb  + texture2D(tD,vU+uTexel*vec2(0.5,0.5)).rgb;
  s *= 0.25;
  float l = max(s.r,max(s.g,s.b));
  float k = max(l-uThr,0.0)/max(l,1e-4); k = clamp(k,0.0,1.0);
  gl_FragColor = vec4(s*k,1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D tD; uniform vec2 uDir; varying vec2 vU;
void main(){
  vec3 c = texture2D(tD,vU).rgb*0.2270270;
  c += (texture2D(tD,vU+uDir*1.3846153).rgb + texture2D(tD,vU-uDir*1.3846153).rgb)*0.3162162;
  c += (texture2D(tD,vU+uDir*3.2307692).rgb + texture2D(tD,vU-uDir*3.2307692).rgb)*0.0702702;
  gl_FragColor = vec4(c,1.0);
}`;

const DOWN_FRAG = `
uniform sampler2D tD; uniform vec2 uTexel; varying vec2 vU;
void main(){
  vec3 s = texture2D(tD,vU+uTexel*vec2(-0.5,-0.5)).rgb + texture2D(tD,vU+uTexel*vec2(0.5,-0.5)).rgb
         + texture2D(tD,vU+uTexel*vec2(-0.5,0.5)).rgb  + texture2D(tD,vU+uTexel*vec2(0.5,0.5)).rgb;
  gl_FragColor = vec4(s*0.25,1.0);
}`;

const COMP_FRAG = `
uniform sampler2D tScene,tB0,tB1; uniform float uBloom,uExp,uGrain,uTime;
varying vec2 vU;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec3 c = texture2D(tScene,vU).rgb;
  vec3 b = texture2D(tB0,vU).rgb*0.65 + texture2D(tB1,vU).rgb*1.15;
  c += b * uBloom;
  c = vec3(1.0) - exp(-c*uExp);
  c = pow(max(c,0.0), vec3(0.95));
  float g = hash(vU*vec2(1920.0,1080.0)+fract(uTime)*vec2(17.3,29.7))-0.5;
  c += g * uGrain * (0.35 + 1.0*length(c));
  c = max(c,0.0);
  gl_FragColor = vec4(c, max(c.r,max(c.g,c.b)));
}`;

/**
 * Unit-diameter point sphere, denser rings near the equator.
 *
 * The prototype pushed every position TWICE with an `aTip` of 0 and 1 — a
 * leftover from a line-segment version. The point shader never reads aTip, so
 * the second copy drew an identical point on top of the first: 144k draws for
 * 72k positions. Blending is additive into an HDR target, so one point at
 * double gain is the same result for half the work (SHADING.gain carries the
 * x2, and the random sequence is untouched so the twinkle pattern is stable).
 */
function buildSphere(THREE) {
  const R = 0.5;
  const SP = SPHERE.spacing;
  const rings = Math.max(24, Math.round((Math.PI * R) / SP));
  const rng = createRng(SPHERE.jitterSeed);
  const pos = [], nor = [], rnd = [], lnd = [];

  for (let j = 0; j < rings; j++) {
    const th = ((j + 0.5) / rings) * Math.PI;
    const sT = Math.sin(th), cT = Math.cos(th);
    const circ = 2 * Math.PI * R * sT;
    let nu = SPHERE.meridians;

    while (nu > 12 && circ / nu < SP * 0.6) nu >>= 1;
    const lat = 90 - (th * 180) / Math.PI;

    for (let k = 0; k < nu; k++) {
      const ph = (k / nu) * Math.PI * 2;
      const x = R * sT * Math.sin(ph);
      const y = R * cT;
      const z = R * sT * Math.cos(ph);
      let lon = (ph * 180) / Math.PI + SPHERE.lon0;
      if (lon > 180) lon -= 360;
      const L = landSoft(lon, lat);
      const r = rng();
      pos.push(x, y, z);
      nor.push(x / R, y / R, z / R);
      rnd.push(r);
      lnd.push(L);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aN', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 1));
  g.setAttribute('aL', new THREE.Float32BufferAttribute(lnd, 1));
  return g;
}

/** lon/lat -> unit vector, with the sphere's longitude offset applied. */
function cityVec(c) {
  const lon = ((c[0] - SPHERE.lon0) * Math.PI) / 180;
  const lat = (c[1] * Math.PI) / 180;
  const cl = Math.cos(lat);
  return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)];
}

/** Great-circle arcs, lifted off the surface in proportion to their length. */
function buildArcs(THREE, cities, routes) {
  const R = 0.5, SEG = ARCS.segments;
  const pos = [], tt = [], ph = [];

  for (let i = 0; i < routes.length; i++) {
    const a = cityVec(cities[routes[i][0]]);
    const b = cityVec(cities[routes[i][1]]);
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const ang = Math.acos(dot);
    const sa = Math.sin(ang);
    const lift = 0.055 + 0.235 * (ang / Math.PI);
    const phase = i / routes.length + ((i * 0.37) % 1);
    let prev = null;

    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      const w1 = sa < 1e-4 ? 1 - t : Math.sin((1 - t) * ang) / sa;
      const w2 = sa < 1e-4 ? t : Math.sin(t * ang) / sa;
      const h = R * (1 + lift * Math.sin(Math.PI * t));
      const p = [
        (a[0] * w1 + b[0] * w2) * h,
        (a[1] * w1 + b[1] * w2) * h,
        (a[2] * w1 + b[2] * w2) * h,
      ];
      if (prev) {
        pos.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
        tt.push(prev[3], t);
        ph.push(phase, phase);
      }
      prev = [p[0], p[1], p[2], t];
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
  g.setAttribute('aPh', new THREE.Float32BufferAttribute(ph, 1));
  return g;
}

function buildCityGeo(THREE, cities) {
  const pos = new Float32Array(cities.length * 3);
  const rr = new Float32Array(cities.length);
  for (let i = 0; i < cities.length; i++) {
    const v = cityVec(cities[i]);

    pos[i * 3] = v[0] * 0.503;
    pos[i * 3 + 1] = v[1] * 0.503;
    pos[i * 3 + 2] = v[2] * 0.503;
    rr[i] = i / cities.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aR', new THREE.BufferAttribute(rr, 1));
  return g;
}

const EXPO_KF = [
  [0.0, 0.86], [0.30, 0.94], [0.60, 1.06],
  [0.95, 1.12], [1.30, 1.06], [1.80, 1.00],
];

function keyframe(table, t) {
  const n = table.length;
  if (t <= table[0][0]) return table[0][1];
  if (t >= table[n - 1][0]) return table[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    if (t < table[i + 1][0]) {
      const a = table[i], b = table[i + 1];
      let f = (t - a[0]) / (b[0] - a[0]);
      f = f * f * (3 - 2 * f);
      return a[1] + (b[1] - a[1]) * f;
    }
  }
  return table[n - 1][1];
}

/** Fade-in envelope with a slight overshoot, so it arrives rather than appears. */
function alphaAt(t) {
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  return clamp01(t / 0.3) * (0.7 + 0.3 * clamp01((t - 0.25) / 0.75)) * keyframe(EXPO_KF, t);
}

const GLOBE_SPAN = REF.globeBottom - REF.globeTop;

export function initNetworkGlobe() {
  const host = document.getElementById('network-globe');
  if (!host) return null;

  const THREE = globalThis.THREE;
  if (!THREE) return null;

  if (prefersReducedMotion()) return null;

  const canvas = document.createElement('canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  host.appendChild(canvas);

  const HALF =
    renderer.capabilities.isWebGL2 || renderer.extensions.get('OES_texture_half_float')
      ? THREE.HalfFloatType
      : THREE.UnsignedByteType;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  const globe = new THREE.Group();
  const spinner = new THREE.Group();
  globe.rotation.z = MOTION.tiltZ;
  globe.rotation.x = MOTION.tiltX;
  globe.add(spinner);
  scene.add(globe);

  const vec3 = (arr) => new THREE.Vector3().fromArray(arr);
  const col = (arr) => new THREE.Color().fromArray(arr);

  const globeMat = new THREE.ShaderMaterial({
    uniforms: {
      uSizeL: { value: 4 }, uSizeS: { value: 2 }, uCamD: { value: 4 },
      uRimPow: { value: SHADING.rimPow },
      uRimA: { value: SHADING.rimA }, uRimB: { value: SHADING.rimB },
      uBackMul: { value: SHADING.backMul },
      uSeaDim: { value: SHADING.seaDim },
      uRimLight: { value: SHADING.rimLight },
      uGain: { value: SHADING.gain },
      uStreak: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0 },
      uLight: { value: vec3(SHADING.light).normalize() },
      uDeep: { value: col(SHADING.colDeep) },
      uHot: { value: col(SHADING.colHot) },
    },
    vertexShader: GLOBE_VERT,
    fragmentShader: GLOBE_FRAG,
    blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, transparent: true,
  });

  const arcMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAlpha: { value: 0 }, uGain: { value: ARCS.gain },
      uBase: { value: ARCS.base }, uTail: { value: ARCS.tail },
      uSpeed: { value: ARCS.speed }, uStreak: { value: 0 },
      uDim: { value: col(ARCS.dim) }, uLit: { value: col(ARCS.lit) },
    },
    vertexShader: ARC_VERT,
    fragmentShader: ARC_FRAG,
    blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, transparent: true,
  });

  const cityMat = new THREE.ShaderMaterial({
    uniforms: {
      uPx: { value: CITIES.size }, uCamD: { value: 4 }, uTime: { value: 0 },
      uAlpha: { value: 0 }, uGain: { value: CITIES.gain }, uStreak: { value: 0 },
      uLit: { value: col(ARCS.lit) },
    },
    vertexShader: CITY_VERT,
    fragmentShader: CITY_FRAG,
    blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false, transparent: true,
  });

  const sphere = new THREE.Points(buildSphere(THREE), globeMat);
  sphere.frustumCulled = false;
  spinner.add(sphere);

  let cluster = getCluster(DEFAULT_CLUSTER);
  const arcs = new THREE.LineSegments(buildArcs(THREE, cluster.cities, cluster.routes), arcMat);
  arcs.frustumCulled = false;
  spinner.add(arcs);

  const cityDots = new THREE.Points(buildCityGeo(THREE, cluster.cities), cityMat);
  cityDots.frustumCulled = false;
  spinner.add(cityDots);

  let activeSeed = DEFAULT_CLUSTER;

  function setCluster(seed) {
    if (!Number.isFinite(seed) || seed === activeSeed) return;
    activeSeed = seed;
    cluster = getCluster(seed);
    arcs.geometry.dispose();
    arcs.geometry = buildArcs(THREE, cluster.cities, cluster.routes);
    cityDots.geometry.dispose();
    cityDots.geometry = buildCityGeo(THREE, cluster.cities);
  }

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
  quadScene.add(quadMesh);

  const makeQuadMat = (fragmentShader, uniforms) =>
    new THREE.ShaderMaterial({ uniforms, vertexShader: QUAD_VERT, fragmentShader,
      depthTest: false, depthWrite: false });

  const brightMat = makeQuadMat(BRIGHT_FRAG, {
    tD: { value: null }, uThr: { value: POST.bloomThreshold },
    uTexel: { value: new THREE.Vector2() },
  });
  const blurMat = makeQuadMat(BLUR_FRAG, {
    tD: { value: null }, uDir: { value: new THREE.Vector2() },
  });
  const downMat = makeQuadMat(DOWN_FRAG, {
    tD: { value: null }, uTexel: { value: new THREE.Vector2() },
  });
  const compMat = makeQuadMat(COMP_FRAG, {
    tScene: { value: null }, tB0: { value: null }, tB1: { value: null },
    uBloom: { value: POST.bloom }, uExp: { value: POST.exposure },
    uGrain: { value: POST.grain }, uTime: { value: 0 },
  });

  function pass(material, target) {
    quadMesh.material = material;
    renderer.setRenderTarget(target || null);
    renderer.clear(true, false, false);
    renderer.render(quadScene, quadCam);
  }

  const makeRT = (w, h) =>
    new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: HALF,
      depthBuffer: false, stencilBuffer: false,
    });

  let rtScene = null;
  let mips = [];

  function allocTargets(w, h) {
    if (rtScene) {
      rtScene.dispose();
      mips.forEach((m) => { m.a.dispose(); m.b.dispose(); });
    }
    rtScene = makeRT(w, h);

    if (renderer.capabilities.isWebGL2 && 'samples' in rtScene) rtScene.samples = 2;
    mips = [];
    let mw = Math.floor(w / 2), mh = Math.floor(h / 2);
    for (let i = 0; i < POST.mips; i++) {
      mw = Math.max(2, Math.floor(mw / 2));
      mh = Math.max(2, Math.floor(mh / 2));
      mips.push({ a: makeRT(mw, mh), b: makeRT(mw, mh), w: mw, h: mh });
    }
  }

  let vw = 0, vh = 0, dpr = 1, scale = 1, camD = 0;

  function layout() {
    const rect = host.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 2 || h < 2) return false;

    vw = w; vh = h;
    dpr = Math.min(globalThis.devicePixelRatio || 1, POST.maxPixelRatio);

    scale = (FILL * Math.min(w, h)) / GLOBE_SPAN;

    renderer.setPixelRatio(dpr);
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;

    const visible = vh / (GLOBE_SPAN * scale);
    camD = visible / (2 * Math.tan((CAMERA.fov * Math.PI) / 360));
    camera.updateProjectionMatrix();

    allocTargets(Math.round(vw * dpr), Math.round(vh * dpr));

    globeMat.uniforms.uSizeL.value = SHADING.ptLand * scale * dpr;
    globeMat.uniforms.uSizeS.value = SHADING.ptSea * scale * dpr;
    globeMat.uniforms.uCamD.value = camD;
    cityMat.uniforms.uPx.value = CITIES.size * scale * dpr;
    cityMat.uniforms.uCamD.value = camD;
    return true;
  }

  const clock = new THREE.Clock();
  let elapsed = 0;
  let running = false;
  let inViewport = false;

  function draw(t) {
    if (!camD && !layout()) return;

    camera.position.set(0, 0, camD);
    camera.lookAt(0, 0, 0);

    spinner.rotation.y = t * MOTION.spin;
    globe.rotation.z = MOTION.tiltZ;
    globe.rotation.y = MOTION.tiltY;
    globe.rotation.x = MOTION.tiltX;

    const a = alphaAt(t);
    globeMat.uniforms.uAlpha.value = a;
    globeMat.uniforms.uTime.value = t;
    arcMat.uniforms.uAlpha.value = a;
    arcMat.uniforms.uTime.value = t;
    cityMat.uniforms.uAlpha.value = a;
    cityMat.uniforms.uTime.value = t;
    compMat.uniforms.uTime.value = t;

    renderer.setRenderTarget(rtScene);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    brightMat.uniforms.tD.value = rtScene.texture;
    brightMat.uniforms.uTexel.value.set(2 / rtScene.width, 2 / rtScene.height);
    pass(brightMat, mips[0].a);

    for (let i = 0; i < mips.length; i++) {
      if (i > 0) {
        downMat.uniforms.tD.value = mips[i - 1].a.texture;
        downMat.uniforms.uTexel.value.set(1 / mips[i - 1].w, 1 / mips[i - 1].h);
        pass(downMat, mips[i].a);
      }
      blurMat.uniforms.tD.value = mips[i].a.texture;
      blurMat.uniforms.uDir.value.set(1 / mips[i].w, 0);
      pass(blurMat, mips[i].b);
      blurMat.uniforms.tD.value = mips[i].b.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / mips[i].h);
      pass(blurMat, mips[i].a);
    }

    compMat.uniforms.tScene.value = rtScene.texture;
    compMat.uniforms.tB0.value = mips[0].a.texture;
    compMat.uniforms.tB1.value = mips[mips.length - 1].a.texture;
    pass(compMat, null);
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    elapsed += Math.min(clock.getDelta(), MOTION.maxDeltaSec);
    draw(elapsed);
  }

  function start() {
    if (running) return;
    running = true;
    clock.getDelta();
    requestAnimationFrame(frame);
  }

  function stop() { running = false; }

  layout();
  host.dataset.globe = 'ready';

  const onResize = debounce(() => { if (layout() && !running) draw(elapsed); }, 150);
  if ('ResizeObserver' in globalThis) new ResizeObserver(onResize).observe(host);
  else globalThis.addEventListener('resize', onResize, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (inViewport) start();
  });

  if ('IntersectionObserver' in globalThis) {
    new IntersectionObserver((entries) => {
      inViewport = entries[0].isIntersecting;
      if (inViewport && !document.hidden) start();
      else stop();
    }, { threshold: 0 }).observe(host);
  } else {
    inViewport = true;
    start();
  }

  const api = {
    setCluster,
    setCategory(slug) { setCluster(CLUSTER_BY_CATEGORY[slug] ?? DEFAULT_CLUSTER); },
    start, stop,
    isRunning: () => running,
    /** Freeze at a fixed time. For deterministic screenshots — the scene is
     *  time-driven, so visual comparisons are meaningless without it. */
    seek(t) {
      stop();
      elapsed = t;
      draw(t);
    },
  };
  globalThis.__networkGlobe = api;
  return api;
}
