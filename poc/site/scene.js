// WebGL presentation layer. The Canvas 2D renderer in render.js paints the
// scene into an offscreen canvas; Three.js shows it as a texture on a full
// screen quad and adds a real bloom pass so lit windows glow into the haze.
// Stage 2 replaces the quad with a modelled tower; the frame path is unchanged.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { renderClose, renderStreet, renderRiver } from "/render.js";

const painters = { close: renderClose, street: renderStreet, river: renderRiver };

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
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.6, 0.72);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

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
    },
    draw(frame, view, opts) {
      if (!W || !H) return;
      painters[view](sctx, frame, W, H, opts);
      texture.needsUpdate = true;
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
    dispose() {},
  };
}
