/**
 * Hero WebGL scene — the particle grid from the design prototype ("Three.js
 * Point Grid"), ported as is: the shaders, uniforms, camera, point sizing and
 * render loop below are the prototype's, unchanged. What surrounds them is
 * only what the page needs — mounting into #hero-canvas instead of <body>,
 * a reduced-motion path, and pausing while the hero is off screen.
 * Tunables live in config/hero.js.
 *
 * `window.__heroScene` is a contract, not an accident: js/dev/perf-hud.js is a
 * classic script that reaches for that global and drives
 * start/stop/isRunning/setPixelRatioScale from it.
 */

import { SCENE, PARAMS, CAMERA, RENDERER } from '../config/hero.js';
import { prefersReducedMotion } from '../core/dom.js';

const VERTEX_SHADER = /* glsl */ `
uniform float uPx;
uniform float uCamD;
uniform float time;
uniform float amplitude;
uniform float waveLength;

varying float vI;

float rand(vec2 co){
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 p = position;
  float wLength = 1.0 / waveLength;

  p.y = sin(position.x * wLength + time) * cos(position.z * wLength + time) * amplitude;

  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);

  float n = rand(position.xz);
  float puls = 0.62 + 0.38 * sin(time * 1.6 + n * 39.1);

  vI = puls;

  float persp = pow(clamp(uCamD / max(-mv.z, 0.05), 0.2, 8.0), 0.30);
  gl_PointSize = clamp(uPx * persp, 1.0, 40.0);

  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 color;
uniform float baseOpacity;
uniform float uGain;

varying float vI;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;

  // 1. Tight, bright white core
  float core = smoothstep(0.15, 0.0, d);

  // 2. Wide, soft colored halo
  float halo = smoothstep(1.0, 0.1, d) * 0.7;

  // Mix the explicit white core with the colored halo
  vec3 finalColor = (color * halo) + (vec3(1.0) * core);

  gl_FragColor = vec4(finalColor * vI * uGain * baseOpacity, 1.0);
}
`;

export function initHeroScene() {
  const holder = document.getElementById('hero-canvas');
  if (!holder) return null;

  const THREE = globalThis.THREE;
  if (!THREE) {
    console.warn('[hero] three.js unavailable — no particle field');
    return null;
  }

  const reducedMotion = prefersReducedMotion();
  const PlaneGeom = THREE.PlaneGeometry || THREE.PlaneBufferGeometry;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  } catch {
    return null;
  }

  renderer.setClearColor(0x010619, 1);
  holder.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  camera.position.set(...CAMERA.position);
  camera.lookAt(new THREE.Vector3(...CAMERA.lookAt));

  const geometry = new PlaneGeom(
    SCENE.planeSize, SCENE.planeSize, SCENE.planeSegments, SCENE.planeSegments,
  );
  geometry.rotateX(-Math.PI * 0.5);

  const uniforms = {
    uPx:         { value: PARAMS.basePx },
    uCamD:       { value: PARAMS.camDistance },
    uGain:       { value: PARAMS.gain },
    baseOpacity: { value: PARAMS.baseOpacity },
    amplitude:   { value: PARAMS.amplitude },
    color:       { value: new THREE.Color(PARAMS.color) },
    time:        { value: 0 },
    waveLength:  { value: SCENE.waveLength },
  };

  const particleField = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));

  particleField.position.y = SCENE.fieldY;
  scene.add(particleField);

  let pixelRatioScale = 1;

  function resize() {
    const w = holder.clientWidth  || globalThis.innerWidth  || 0;
    const h = holder.clientHeight || globalThis.innerHeight || 0;
    if (w < 2 || h < 2) return;

    const uPx = Math.min(Math.max(Math.min(w / PARAMS.sizeRefW, h / PARAMS.sizeRefH), PARAMS.sizeScaleMin), PARAMS.sizeScaleMax);
    const dpr = Math.min(globalThis.devicePixelRatio || 1, RENDERER.maxPixelRatio);

    renderer.setPixelRatio(Math.min(dpr * pixelRatioScale, RENDERER.maxPixelRatioScale));
    renderer.setSize(w, h, false);

    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    uniforms.uPx.value = PARAMS.basePx * uPx * dpr;
    uniforms.uCamD.value = PARAMS.camDistance;
    uniforms.uGain.value = PARAMS.gain;
  }

  const clock = new THREE.Clock();
  let t = 0;
  let running = false;
  let inViewport = true;
  let manualPause = false;

  function render() {
    if (!running) return;
    requestAnimationFrame(render);

    const delta = clock.getDelta();
    t += delta * PARAMS.speed;

    uniforms.time.value = t;
    scene.rotation.y += delta * RENDERER.rotationPerSec * PARAMS.speed;

    const perf = globalThis.__PERF_HUD__;
    if (perf) {
      const t0 = performance.now();
      renderer.render(scene, camera);
      perf.renderMs = performance.now() - t0;
      perf.info = renderer.info.render;
    } else {
      renderer.render(scene, camera);
    }
  }

  function start() {
    if (running || reducedMotion || manualPause) return;
    running = true;
    clock.getDelta();
    requestAnimationFrame(render);
  }

  function stop() { running = false; }

  globalThis.__heroScene = {
    start()      { manualPause = false; start(); },
    stop()       { manualPause = true;  stop();  },
    isRunning()  { return running; },
    reducedMotion,
    setPixelRatioScale(k) {
      pixelRatioScale = k;
      resize();
    },
  };

  resize();
  renderer.render(scene, camera);
  holder.classList.add('is-ready');
  holder.closest('.client-hero')?.setAttribute('data-scene', 'ready');

  let resizeTimer;
  globalThis.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      if (!running) renderer.render(scene, camera);
    }, RENDERER.resizeDebounceMs);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (inViewport) start();
  });

  if ('IntersectionObserver' in globalThis) {
    new IntersectionObserver((entries) => {
      inViewport = entries[0].isIntersecting;
      if (inViewport && !document.hidden) start();
      else stop();
    }, { threshold: 0 }).observe(holder);
  } else {
    start();
  }

  return globalThis.__heroScene;
}
