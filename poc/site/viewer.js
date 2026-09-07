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
//   /{name}?view=close|street|river|riverAngle&real=1
const VIEWS = ["close", "street", "river", "riverAngle"];
const params = new URLSearchParams(location.search);
let view = VIEWS.includes(params.get("view")) ? params.get("view") : "close";
$("view").value = view;
$("real").checked = params.get("real") === "1";
const isRiver = () => view.startsWith("river");
$("realRow").hidden = !isRiver();
function syncUrl() {
  const u = new URL(location);
  u.searchParams.set("view", view);
  if (isRiver() && $("real").checked) u.searchParams.set("real", "1"); else u.searchParams.delete("real");
  history.replaceState(null, "", u);
}
$("view").onchange = () => { view = $("view").value; $("realRow").hidden = !isRiver(); syncUrl(); dirty = true; };
$("real").onchange = () => { syncUrl(); dirty = true; };
const opts = () => ({ realistic: isRiver() && $("real").checked });
syncUrl();

const c = $("c");
const presenter = webglAvailable() ? createPresenter(c) : createFallback(c);
let dirty = true;
const fit = () => {
  const r = c.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
  presenter.resize(Math.round(r.width * d), Math.round(r.height * d)); dirty = true; if (window.__gb) window.__gb.resizes++;
};
addEventListener("resize", fit); fit();

// Ring buffer of 3 frames; paint on rAF; latest-wins if behind.
let frame = new Uint8Array(ROWS * COLS * 3);
const ring = [];
const debug = (window.__gb = { paints: 0, draws: 0, resizes: 0, view, error: null, presenter, redraw: () => { dirty = true; } });
function paint() {
  debug.paints++; debug.view = view;
  if (ring.length) { frame = ring.shift(); dirty = true; }
  if (dirty) {
    try { presenter.draw(frame, view, opts()); debug.draws++; } catch (e) { debug.error = String(e); console.error("draw failed", e); }
    dirty = false;
  }
  requestAnimationFrame(paint);
}
requestAnimationFrame(paint);

function connect() {
  const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/i/${name}/view`);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => $("status").textContent = "live";
  ws.onmessage = (e) => { ring.push(new Uint8Array(e.data)); if (ring.length > 3) ring.splice(0, ring.length - 1); };
  ws.onclose = () => { $("status").textContent = "reconnecting…"; setTimeout(connect, 1000); };
}
connect();

