import { ROWS, COLS } from "/render.js";
import { createPresenter, createFallback, webglAvailable } from "/scene.js";
const $ = (id) => document.getElementById(id);
const name = location.pathname.slice(1);
$("name").textContent = name;
const sendUrl = `${location.origin}/api/i/${name}/frame`;
$("send").textContent = sendUrl;
$("curl").textContent = `curl -X POST ${sendUrl} -H 'Content-Type: application/json' -d @frame.json`;
$("py").textContent = `from gbsim import WebDisplay, Color\nd = WebDisplay("${name}", "${location.origin}/api")\nf = d.makeframe(); f[0][0] = Color(255,0,0); d.send(f)`;
$("toggle").onclick = () => { const h = $("conn").style.display === "none"; $("conn").style.display = h ? "" : "none"; $("toggle").textContent = h ? "hide connection info" : "show connection info"; };

// View state lives in the URL so any link reproduces exactly what it shows:
//   /{name}?view=close|street|river&real=1&fit=1&fx=0
const VIEWS = ["close", "street", "river"];
const params = new URLSearchParams(location.search);
let view = VIEWS.includes(params.get("view")) ? params.get("view") : "close";
$("view").value = view;
$("real").checked = params.get("real") === "1";
$("fit").checked = params.get("fit") === "1";
$("fx").checked = params.get("fx") !== "0";
const isRiver = () => view === "river";
$("realRow").hidden = !isRiver(); $("fitRow").hidden = !isRiver();
function syncUrl() {
  const u = new URL(location);
  u.searchParams.set("view", view);
  if (isRiver() && $("real").checked) u.searchParams.set("real", "1"); else u.searchParams.delete("real");
  if (isRiver() && $("fit").checked) u.searchParams.set("fit", "1"); else u.searchParams.delete("fit");
  if ($("fx").checked) u.searchParams.delete("fx"); else u.searchParams.set("fx", "0");
  history.replaceState(null, "", u);
}
$("view").onchange = () => { view = $("view").value; $("realRow").hidden = !isRiver(); $("fitRow").hidden = !isRiver(); syncUrl(); dirty = true; };
$("real").onchange = () => { syncUrl(); dirty = true; };
$("fit").onchange = () => { syncUrl(); dirty = true; };
$("fx").onchange = () => { presenter.setEffects($("fx").checked); syncUrl(); dirty = true; };
const opts = () => ({ realistic: isRiver() && $("real").checked, fit: isRiver() && $("fit").checked });
syncUrl();

const c = $("c");
const presenter = webglAvailable() ? createPresenter(c) : createFallback(c);
presenter.setEffects($("fx").checked);
let dirty = true;
const fit = () => {
  const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  presenter.resize(Math.round(r.width * d), Math.round(r.height * d)); dirty = true; if (window.__gb) window.__gb.resizes++;
};
addEventListener("resize", fit); fit();

// Ring buffer of 3 live frames; paint on rAF; latest-wins if behind.
let frame = new Uint8Array(ROWS * COLS * 3);
const ring = [];
// Clip mode: the instance can hold an uploaded animation that every viewer loops locally.
// A live frame always paints immediately and pauses the clip; the clip resumes when the
// live sender has been quiet for LIVE_GRACE_MS.
const BYTES = ROWS * COLS * 3, CLIP_MAGIC = 0x43, LIVE_GRACE_MS = 2000;
let clip = null;          // { fps, n, data: Uint8Array } or null
let clipIdx = 0, clipNext = 0, lastLive = -Infinity, wsOpen = false, wasLive = false;
function setStatus() {
  const s = $("status");
  const liveNow = performance.now() - lastLive < LIVE_GRACE_MS;
  if (!wsOpen) return;
  if (clip && liveNow) s.textContent = "live (clip paused)";
  else if (clip) s.textContent = `clip · ${clip.n} frames @ ${clip.fps} fps, looping`;
  else s.textContent = liveNow ? "live" : "live · waiting for frames";
}
function onMessage(buf) {
  const u8 = new Uint8Array(buf);
  if (u8.length === BYTES) { ring.push(u8); if (ring.length > 3) ring.splice(0, ring.length - 1); return; }
  if (u8.length >= 4 && u8[0] === CLIP_MAGIC) {
    const n = u8[2] | (u8[3] << 8);
    clip = n ? { fps: u8[1], n, data: u8.subarray(4) } : null;
    clipIdx = 0; clipNext = 0;
    if (clip && performance.now() - lastLive >= LIVE_GRACE_MS) { frame = clip.data.subarray(0, BYTES); dirty = true; }
    setStatus();
  }
}
const debug = (window.__gb = { paints: 0, draws: 0, resizes: 0, view, error: null, presenter, redraw: () => { dirty = true; }, clip: () => clip && { fps: clip.fps, n: clip.n, idx: clipIdx } });
// The display itself is capped at 30 fps, so the viewer renders at 30 too:
// nothing on screen can change faster, and it keeps phones cool.
const FRAME_MS = 1000 / 30;
let lastPaint = 0;
function paint(now) {
  if (now - lastPaint < FRAME_MS - 1) { requestAnimationFrame(paint); return; }
  lastPaint = now;
  debug.paints++; debug.view = view;
  if (ring.length) { frame = ring.shift(); dirty = true; lastLive = now; clipNext = 0; }
  else if (clip && now - lastLive >= LIVE_GRACE_MS && now >= clipNext) {
    if (clipNext) clipIdx = (clipIdx + 1) % clip.n;   // first tick after (re)start re-shows the current frame
    clipNext = (clipNext || now) + 1000 / clip.fps;
    frame = clip.data.subarray(clipIdx * BYTES, (clipIdx + 1) * BYTES); dirty = true;
  }
  const liveNow = now - lastLive < LIVE_GRACE_MS;
  if (liveNow !== wasLive) { wasLive = liveNow; setStatus(); }
  if (dirty) {
    try { presenter.draw(frame, view, opts()); debug.draws++; } catch (e) { debug.error = String(e); console.error("draw failed", e); }
    dirty = false;
  } else {
    presenter.tick();
  }
  requestAnimationFrame(paint);
}
requestAnimationFrame(paint);

function connect() {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/i/${name}/view`);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => { wsOpen = true; setStatus(); };
  ws.onmessage = (e) => onMessage(e.data);
  ws.onclose = () => { wsOpen = false; $("status").textContent = "reconnecting…"; setTimeout(connect, 1000); };
}
connect();

