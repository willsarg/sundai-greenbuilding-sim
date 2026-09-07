# Green Building simulator — Sundai Hack #140

A web simulator of the MIT Green Building's 17 × 9 window display. Every team gets its own
instance at **https://sundai.willsarg.com**, drives it with the same `Display` interface as the
real building, and anyone can watch it live in a browser.

## Get an instance

```
curl -X POST https://sundai.willsarg.com/api/instances \
  -H 'content-type: application/json' -d '{"password":"<event password>"}'
```

You get back a name like `brave-otter`, plus a `send_url` and a `view_url`. Open the
`view_url` in a browser: `https://sundai.willsarg.com/brave-otter`. Add `?view=river` or
`?view=street` for the other camera angles.

## Python setup

The client is the `gbsim` package in `poc/python`. It needs numpy (the upstream `Frame` is a
numpy array); the demos also use only the standard library.

```
cd poc/python
pip install -r requirements.txt      # or: uv pip install -r requirements.txt
python3 -c "import gbsim; print('ok')"
```

Run scripts from `poc/python`, or add it to `PYTHONPATH`, so `from gbsim import ...` resolves.

## Two ways to drive it

**Compatibility rule.** The real building's display interface is exactly two methods,
`makeframe()` and `send(frame)`, plus `Frame` and `Color` (`poc/python/gbsim/display.py` is a
verbatim copy of the upstream file). Game code that only uses those runs unchanged on the real
building. Everything else in `gbsim` is simulator-only: `upload_clip`, `clear_clip`, and
`WebDisplay.flush()` / `close()` / `with`. Keep those out of your game code; put clip uploads in
a separate script.

### Live — your code streams frames

Best for interactive things (a playable game). Your program runs the whole time.

```python
from gbsim import WebDisplay, Color          # poc/python/gbsim
d = WebDisplay("brave-otter")
f = d.makeframe()
f[0][0] = Color(255, 0, 0)
d.send(f)                                    # non-blocking; call it up to 30 times a second
```

`send()` never blocks your loop: it hands the frame to a background sender, and if a frame is
still in flight the newer one replaces it (latest wins). So the instance's `frames` count is
normally lower than your number of `send()` calls; that is dropped-by-design, not an error.
The display shows the newest frame that reached it, so if two
copies of your program run at once the building flickers between them: that is the signal to
kill one. Each instance accepts at most 40 frames per second in total.

### Clip — upload an animation once, it loops forever

Best for pre-rendered animations. Upload, close your laptop, the building keeps playing.

```python
from gbsim import Frame, upload_clip, clear_clip   # simulator-only helpers
frames = [Frame() for _ in range(180)]             # 1..900 frames
# ...draw into each frame...
upload_clip("brave-otter", frames, fps=30)         # fps 1..30
clear_clip("brave-otter")                          # remove it
```

The clip wraps straight from the last frame to the first, so make its length a whole number
of your animation's cycles or the loop will jump at the seam.

Live frames always take over while they arrive. Two seconds after the last live frame, the clip
resumes where it paused. The status line under the instance name tells you which mode you are
seeing.

## API reference

Base URL `https://sundai.willsarg.com`. All responses are JSON unless noted; CORS is open.
Send a real `User-Agent` header: Cloudflare rejects the default `Python-urllib` one with a 403
(the `gbsim` client already does).

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/api/instances` | `{"password": "..."}` | `201 {name, send_url, view_url, ws_url}`; `401` bad password; `503` no free names |
| `POST` | `/api/i/<name>/frame` | JSON `[[[r,g,b] × 9] × 17]` or `application/octet-stream` 459 bytes (row-major RGB) | `204`; `400` with `{error}` on a malformed frame; `429` above 40 posts/s |
| `GET` | `/api/i/<name>/frame` | | `200` current frame as `[[[r,g,b] × 9] × 17]` |
| `POST` | `/api/i/<name>/clip` | JSON `{"fps": 1..30, "frames": [<frame>, ...]}` (1..900 frames) or binary `[0x43, fps, countLo, countHi]` + frames | `201 {ok, clip: {fps, frames}}`; `400` with `{error}` |
| `DELETE` | `/api/i/<name>/clip` | | `204` |
| `GET` | `/api/i/<name>/` | | `200 {created_at, last_frame_at, viewers, frames, used, clip}` |
| `DELETE` | `/api/i/<name>` | header `Authorization: Bearer <event password>` | `200 {ok, name}`: wipes frame, clip and reservation, returns the name to the pool; `401` bad password |
| `WS` | `/api/i/<name>/view` | | binary stream: 459-byte messages are live frames; anything else is a clip snapshot (same header as above, count 0 = no clip) |
| `GET` | `/<name>` | | the viewer page; `?view=close\|street\|river`, `&real=1`, `&fit=1`, `&fx=0` |

Notes:

- Names are `adjective-animal`, lower-case ASCII. Anything else is a `400`.
- A name is reserved when it is handed out or when it receives its first frame. The pool has
  1296 names; the admin `DELETE` above releases one.
- Frames are applied on a 33 ms tick, so reading `/frame` immediately after posting one can
  return the previous frame.
- `frames`, `viewers` and `created_at` in the status are in-memory counters that reset whenever
  the instance goes idle or the service is redeployed. The frame and clip themselves persist.

## Demos

```
cd poc
python3 python/demo.py <name>       https://sundai.willsarg.com/api   # live rainbow at 30 fps
python3 python/clip_demo.py <name>                                     # 6 s bouncing bar, looped
```

## Load check

```
cd poc/python && EVENT_PASSWORD=<event password> python3 load_test.py 50 60
```

Creates 50 instances, streams 30 fps to each for 60 s, reports accepted fps, then wipes every
instance it created.

## Running it yourself

```
cd poc && npm install && npm run dev        # http://localhost:8787, password from poc/.dev.vars
npm run build && npx wrangler deploy --config dist/gbsim_poc/wrangler.json
```

Cloudflare Workers + one Durable Object per instance. Rendering notes in `docs/RENDERING.md`,
image credits in `docs/IMAGE_SOURCES.md`.
