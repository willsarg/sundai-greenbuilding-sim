// The display. Holds one frame (latest wins), coalesces sends at 30 fps,
// fans each accepted frame out to viewer WebSockets as 459 raw RGB bytes.
import { DurableObject } from "cloudflare:workers";

export const ROWS = 17, COLS = 9, BYTES = ROWS * COLS * 3; // 459
const TICK_MS = 33;
const SAVE_MS = 3000;        // persist the frame at most this often (it only exists to survive a restart)
const MAX_POSTS_PER_S = 40;  // per instance; above this the sender gets 429 (protects the account budget)

const CORS = { "Access-Control-Allow-Origin": "*" };
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });

// JSON frame -> Uint8Array(459) or throws with a one-line reason.
export function parseJsonFrame(v) {
  if (!Array.isArray(v) || v.length !== ROWS) throw new Error(`expected ${ROWS} rows`);
  const out = new Uint8Array(BYTES);
  let k = 0;
  for (let r = 0; r < ROWS; r++) {
    const row = v[r];
    if (!Array.isArray(row) || row.length !== COLS) throw new Error(`row ${r}: expected ${COLS} pixels`);
    for (let c = 0; c < COLS; c++) {
      const px = row[c];
      if (!Array.isArray(px) || px.length !== 3) throw new Error(`row ${r} col ${c}: expected [r,g,b]`);
      for (let i = 0; i < 3; i++) {
        const ch = px[i];
        if (!Number.isInteger(ch) || ch < 0 || ch > 255) throw new Error(`row ${r} col ${c}: channel ${i} must be int 0..255`);
        out[k++] = ch;
      }
    }
  }
  return out;
}

export class Instance extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.frame = new Uint8Array(BYTES);        // the one memory slot
    this.pending = null;                       // newest frame received inside the current tick
    this.tickTimer = null;
    this.frames = 0;
    this.created = Date.now();
    this.lastAt = null;
    this.savedAt = 0;
    this.saveTimer = null;
    this.win = 0;                              // POSTs in the current 1 s window
    this.winStart = 0;
    this.used = false;                         // claimed via POST /claim or has received a frame (persisted)
    ctx.blockConcurrencyWhile(async () => {
      const [saved, used] = await Promise.all([ctx.storage.get("frame"), ctx.storage.get("used")]);
      if (saved) this.frame = new Uint8Array(saved);
      this.used = !!(used || saved);
    });
  }

  // Latest-wins coalescing: at most one broadcast per 33 ms.
  accept(bytes) {
    this.pending = bytes;
    if (this.tickTimer) return;
    this.tickTimer = setTimeout(() => this.tick(), TICK_MS);
  }
  tick() {
    this.tickTimer = null;
    if (!this.pending) return;
    this.frame = this.pending;
    this.pending = null;
    this.frames++;
    this.lastAt = Date.now();
    this.markUsed();
    this.save();
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(this.frame); } catch {}
    }
  }

  // Debounced persistence: write now if it has been SAVE_MS, else schedule one trailing write.
  save() {
    const now = Date.now();
    if (now - this.savedAt >= SAVE_MS) {
      this.savedAt = now;
      this.ctx.storage.put("frame", this.frame.buffer.slice(0));
    } else if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => { this.saveTimer = null; this.save(); }, SAVE_MS - (now - this.savedAt));
    }
  }

  markUsed() {
    if (this.used) return false;
    this.used = true;
    this.ctx.storage.put("used", 1);
    return true;
  }

  overLimit() {
    const now = Date.now();
    if (now - this.winStart >= 1000) { this.winStart = now; this.win = 0; }
    return ++this.win > MAX_POSTS_PER_S;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const sub = url.pathname.replace(/^\/api\/i\/[^/]+/, "") || "/";

    if (sub === "/claim" && req.method === "POST") {
      return json({ used: true }, this.markUsed() ? 201 : 409);
    }

    if (sub === "/frame" && req.method === "POST") {
      if (this.overLimit()) return json({ error: `rate limit: max ${MAX_POSTS_PER_S} frames/s` }, 429);
      const ct = req.headers.get("content-type") || "";
      let bytes;
      try {
        if (ct.startsWith("application/octet-stream")) {
          const buf = new Uint8Array(await req.arrayBuffer());
          if (buf.length !== BYTES) throw new Error(`expected ${BYTES} bytes, got ${buf.length}`);
          bytes = buf;
        } else {
          bytes = parseJsonFrame(await req.json());
        }
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      this.accept(bytes);
      return new Response(null, { status: 204, headers: CORS });
    }

    if (sub === "/frame" && req.method === "GET") {
      const rows = [];
      for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
          const k = (r * COLS + c) * 3;
          row.push([this.frame[k], this.frame[k + 1], this.frame[k + 2]]);
        }
        rows.push(row);
      }
      return json(rows);
    }

    if (sub === "/" && req.method === "GET") {
      return json({
        created_at: this.created, last_frame_at: this.lastAt,
        viewers: this.ctx.getWebSockets().length, frames: this.frames, used: this.used,
      });
    }

    if (sub === "/view" && req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);   // hibernatable; survives idle
      pair[1].send(this.frame);            // fill the slot immediately
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return json({ error: "not found" }, 404);
  }

  webSocketMessage() { /* read-only; ignore */ }
  webSocketClose(ws) { try { ws.close(); } catch {} }
}
