// WebGL presentation layer. The Canvas 2D renderer in render.js paints the
// scene into an offscreen canvas; Three.js shows it as a texture on a full
// screen quad and adds a real bloom pass so lit windows glow into the haze.
// Stage 2 replaces the quad with a modelled tower; the frame path is unchanged.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { renderClose, renderStreet, renderRiver } from "/render.js";

const painters = { close: renderClose, street: renderStreet, river: renderRiver };

// Atmosphere pass: animated water below the horizon, distance haze toward the
// skyline, film grain, and slight chromatic fringing at the edges. Runs on the
// GPU every frame; it never moves anything, it only shades what is there.
const AtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    horizon: { value: 0.32 },   // uv.y of the waterline (0 = bottom)
    water: { value: 0 },        // 1 in the river view
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float time, horizon, water; uniform vec2 resolution;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      float depth = horizon - uv.y;                 // >0 below the waterline
      if (water > 0.5 && depth > 0.0) {
        // Ripples: two crossing waves, stronger toward the near shore, faded
        // out in the first few pixels so the bank stays crisp.
        float px = 1.0 / resolution.y;
        float fade = smoothstep(0.0, 8.0 * px, depth);
        float amp = (0.0015 + depth * 0.004) * fade;
        float w = sin(uv.y * 140.0 + time * 1.3 + sin(uv.x * 30.0 + time * 0.7) * 2.0)
                + 0.6 * sin(uv.y * 310.0 - time * 2.1 + uv.x * 12.0);
        uv.x += w * amp;
        uv.y += 0.4 * w * amp;
      }
      // Chromatic fringing grows toward the frame edges.
      vec2 d = (uv - 0.5); float r2 = dot(d, d);
      vec2 ca = d * r2 * 0.012;
      vec3 col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      // Haze: thickest in a band just above the horizon, thinner high in the sky.
      float h = exp(-abs(uv.y - horizon) * 9.0) * 0.16 + max(0.0, uv.y - horizon) * 0.05;
      col = mix(col, vec3(0.42, 0.33, 0.27), h);
      // Water reflections are a touch darker and cooler than what they mirror.
      if (water > 0.5 && depth > 0.0) col *= vec3(0.86, 0.88, 0.92);
      // Film grain, animated, kept light and weighted toward the midtones so
      // shadows and the water stay clean.
      float g = hash(gl_FragCoord.xy + fract(time) * 100.0) - 0.5;
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col += g * 0.010 * (0.25 + luma * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

// Returns { resize(W,H), draw(frame, view) }. `target` is the visible canvas.
export function createPresenter(target) {
  const source = document.createElement("canvas");
  const sctx = source.getContext("2d");
  const renderer = new THREE.WebGLRenderer({ canvas: target, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(1); // the source canvas is already at device resolution
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: texture }));
  scene.add(quad);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // strength, radius, threshold: only the brightest pixels (lit windows,
  // lamps, lobby) bloom; the hazy sky stays below the threshold.
  // Two scales: a tight halo on each lit pane, and a wide glow into the haze.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.25, 0.70);
  const wide = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 1.1, 0.78);
  composer.addPass(bloom);
  composer.addPass(wide);
  const atmosphere = new ShaderPass(AtmosphereShader);
  composer.addPass(atmosphere);
  composer.addPass(new OutputPass());
  const t0 = performance.now();

  let W = 0, H = 0;
  return {
    bloom, source, texture, renderer,
    resize(w, h) {
      if (w === W && h === H) return;
      W = w; H = h;
      source.width = w; source.height = h;
      // Three.js allocates immutable GPU storage at the canvas's size on first
      // upload; after a resize the old allocation must be released or every
      // later upload fails with GL_INVALID_VALUE and the stale image stays.
      texture.dispose();
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      // Bloom at half resolution keeps phones comfortable.
      bloom.resolution.set(Math.round(w / 2), Math.round(h / 2));
      wide.resolution.set(Math.round(w / 4), Math.round(h / 4));
      atmosphere.uniforms.resolution.value.set(w, h);
    },
    draw(frame, view, opts) {
      if (!W || !H) return;
      painters[view](sctx, frame, W, H, opts);
      const last = painters[view].last || {};
      atmosphere.uniforms.horizon.value = 1 - (last.horizon ?? 0.68);
      atmosphere.uniforms.water.value = last.water ? 1 : 0;
      texture.needsUpdate = true;
      this.tick();
    },
    // Re-render the GPU passes without repainting the 2D scene (animation).
    tick() {
      if (!W || !H) return;
      atmosphere.uniforms.time.value = (performance.now() - t0) / 1000;
      composer.render();
    },
    dispose() { renderer.dispose(); },
  };
}

// Canvas 2D fallback with the same interface, for devices without WebGL.
export function createFallback(target) {
  const ctx = target.getContext("2d");
  let W = 0, H = 0;
  return {
    resize(w, h) { W = w; H = h; target.width = w; target.height = h; },
    draw(frame, view, opts) { if (W && H) painters[view](ctx, frame, W, H, opts); },
    tick() {},
    dispose() {},
  };
}
