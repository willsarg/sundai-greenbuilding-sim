// The display. Holds one frame (latest wins), coalesces sends at 30 fps,
// fans each accepted frame out to viewer WebSockets as 459 raw RGB bytes.
import { DurableObject } from "cloudflare:workers";

export const ROWS = 17, COLS = 9, BYTES = ROWS * COLS * 3; // 459
const TICK_MS = 33;
const SAVE_MS = 3000;        // persist the frame at most this often (it only exists to survive a restart)
const MAX_POSTS_PER_S = 40;  // per instance; above this the sender gets 429 (protects the account budget)
const MAX_CLIP_FRAMES = 900; // 30 s at 30 fps (~400 KB binary)
const CLIP_MAGIC = 0x43;     // 'C' — clip message header: [magic, fps, countLo, countHi] + frames
const LIVE_GRACE_MS = 2000;  // a live frame this recent is sent to a new viewer even when a clip exists

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

// Build the wire message for a clip. `frames` is an array of Uint8Array(459).
export function packClip(fps, frames) {
  const out = new Uint8Array(4 + frames.length * BYTES);
  out[0] = CLIP_MAGIC; out[1] = fps; out[2] = frames.length & 0xff; out[3] = frames.length >> 8;
  frames.forEach((f, i) => out.set(f, 4 + i * BYTES));
  return out;
}
const EMPTY_CLIP = packClip(0, []);

// Validate an incoming clip (JSON or binary) -> packed message, or throws.
export async function parseClip(req) {
  const ct = req.headers.get("content-type") || "";
  let fps, frames;
  if (ct.startsWith("application/octet-stream")) {
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length < 4 || buf[0] !== CLIP_MAGIC) throw new Error("bad clip header");
    fps = buf[1];
    const n = buf[2] | (buf[3] << 8);
    if (buf.length !== 4 + n * BYTES) throw new Error(`expected ${4 + n * BYTES} bytes for ${n} frames, got ${buf.length}`);
    if (n < 1) throw new Error("clip must have at least one frame");
    if (n > MAX_CLIP_FRAMES) throw new Error(`max ${MAX_CLIP_FRAMES} frames`);
    if (!(fps >= 1 && fps <= 30)) throw new Error("fps must be 1..30");
    return buf;
  }
  const v = await req.json();
  fps = v.fps;
  if (!Number.isInteger(fps) || fps < 1 || fps > 30) throw new Error("fps must be an integer 1..30");
  if (!Array.isArray(v.frames) || v.frames.length < 1) throw new Error("frames must be a non-empty array");
  if (v.frames.length > MAX_CLIP_FRAMES) throw new Error(`max ${MAX_CLIP_FRAMES} frames`);
  frames = v.frames.map((f, i) => { try { return parseJsonFrame(f); } catch (e) { throw new Error(`frame ${i}: ${e.message}`); } });
  return packClip(fps, frames);
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
    this.clip = null;                          // packed clip message (Uint8Array) or null; viewers loop it locally
    ctx.blockConcurrencyWhile(async () => {
      const [saved, used, clip] = await Promise.all([ctx.storage.get("frame"), ctx.storage.get("used"), ctx.storage.get("clip")]);
      if (saved) this.frame = new Uint8Array(saved);
      if (clip) this.clip = new Uint8Array(clip);
      this.used = !!(used || saved || clip);
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

  setClip(packed) {
    this.clip = packed;
    this.markUsed();
    if (packed) this.ctx.storage.put("clip", packed.buffer.slice(0)); else this.ctx.storage.delete("clip");
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(packed || EMPTY_CLIP); } catch {}
    }
  }

  clipInfo() {
    if (!this.clip) return null;
    return { fps: this.clip[1], frames: this.clip[2] | (this.clip[3] << 8) };
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
      this.markUsed();
      this.accept(bytes);
      return new Response(null, { status: 204, headers: CORS });
    }

    if (sub === "/clip" && req.method === "POST") {
      if (this.overLimit()) return json({ error: `rate limit: max ${MAX_POSTS_PER_S} requests/s` }, 429);
      let packed;
      try { packed = await parseClip(req); } catch (e) { return json({ error: e.message }, 400); }
      this.setClip(packed);
      return json({ ok: true, clip: this.clipInfo() }, 201);
    }

    if (sub === "/clip" && req.method === "DELETE") {
      this.setClip(null);
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
        viewers: this.ctx.getWebSockets().length, frames: this.frames, used: this.used, clip: this.clipInfo(),
      });
    }

    if (sub === "/view" && req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);   // hibernatable; survives idle
      // Fill the viewer immediately: the clip if there is one, and the last live frame
      // unless a clip exists and the live sender has gone quiet.
      pair[1].send(this.clip || EMPTY_CLIP);
      if (!this.clip || (this.lastAt && Date.now() - this.lastAt < LIVE_GRACE_MS)) pair[1].send(this.frame);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    return json({ error: "not found" }, 404);
  }

  webSocketMessage() { /* read-only; ignore */ }
  webSocketClose(ws) { try { ws.close(); } catch {} }
}
