# Green Building simulator — Sundai Hack #140

A web simulator of the MIT Green Building's 17 × 9 window display. Every team gets its own
instance at **https://sundai.willsarg.com**, drives it with the same `Display` interface as the
real building, and anyone can watch it live in a browser.

## Get an instance

```
curl -X POST https://sundai.willsarg.com/api/instances \
  -H 'content-type: application/json' -d '{"password":"<event password>"}'
```

You get back an adjective-animal name, plus a `send_url` and a `view_url`. Open the
`view_url` in a browser: `https://sundai.willsarg.com/your-instance`. Add `?view=river` or
`?view=street` for the other camera angles.

**Every example below writes `your-instance`. Replace it with the exact name you were given; do not make up your
own.** The server only accepts names from its own pool, and rejects `your-instance` itself with a `400`.

## Quick start, step by step

From nothing to your own pixels on the building in about five minutes.

1. **Get the client.**
   ```
   git clone https://github.com/willsarg/sundai-greenbuilding-sim.git
   cd sundai-greenbuilding-sim/poc/python
   pip install -r requirements.txt      # or: uv pip install -r requirements.txt
   ```
2. **Get an instance.** Open https://sundai.willsarg.com in another tab, type the event password and press
   *Create*. You land on your instance's viewer. Note the adjective-animal name in the URL: that is what your code
   will target. **Every example below says `your-instance`; replace it with your real name.** The server rejects
   `your-instance` itself. Keep the viewer tab open.
3. **Light one window.** Save this as `hello.py` in `poc/python` and run `python3 hello.py your-instance`:
   ```python
   import sys, time
   from gbsim import WebDisplay, Color

   d = WebDisplay(sys.argv[1])          # your instance name
   f = d.makeframe()                    # 17 rows x 9 columns, all off
   f[0][0] = Color(255, 0, 0)           # top-left window, red
   d.send(f)
   time.sleep(1)                        # give the frame time to arrive before exiting
   ```
   The top-left window on the viewer turns red. Frames sit at `f[row][col]`, row 0 at the top. If nothing
   happens or you see a connection error, check that the name matches the viewer URL exactly. A `400 bad instance
   name` means the name is not one the server handed out, for example you left `your-instance` in.
4. **Animate.** Same thing in a loop: change the frame, send it, sleep a thirtieth of a second. Replace the last
   three lines of `hello.py` with this and run it again:
   ```python
   i = 0
   while True:
       f = d.makeframe()
       f[i % 17][i % 9] = Color(255, 0, 0)   # one red window walking down the building
       d.send(f)
       i += 1
       time.sleep(1 / 30)
   ```
   For a fuller example, from `poc/python` run `python3 demo.py your-instance https://sundai.willsarg.com/api`
   (a scrolling rainbow at 30 fps).
5. **Share it.** Send anyone `https://sundai.willsarg.com/your-instance`. Add `?view=street` or `?view=river`
   for other camera angles.
6. **Optional: leave a loop running without your laptop.** Render frames up front and upload them once as a
   clip; it plays forever, and live frames take over whenever you send them again:
   ```python
   from gbsim import Frame, Color, upload_clip
   frames = []
   for i in range(90):                  # 3 s at 30 fps
       f = Frame()
       f[i % 17][i % 9] = Color(0, 255, 0)
       frames.append(f)
   upload_clip("your-instance", frames, fps=30)
   ```
   From `poc/python`, `python3 clip_demo.py your-instance` does the same with a bouncing bar.
   **Keep this out of your game code.** `upload_clip`, `clear_clip` and `WebDisplay.flush()` / `close()` are
   simulator-only; the real building only has `makeframe()` and `send(frame)`. Put clip uploads in a separate script.

Two copies of your program aimed at one instance make the building flicker between them. Kill one.

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
d = WebDisplay("your-instance")
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
upload_clip("your-instance", frames, fps=30)         # fps 1..30
# clear_clip("your-instance")                        # run later to remove it
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
| `DELETE` | `/api/i/<name>` | header `Authorization: Bearer <admin password>` (the `ADMIN_PASSWORD` secret, not the event password) | `200 {ok, name}`: wipes frame, clip and reservation, returns the name to the pool; `401` bad password; `503` if `ADMIN_PASSWORD` is not configured |
| `WS` | `/api/i/<name>/view` | | binary stream: 459-byte messages are live frames; anything else is a clip snapshot (same header as above, count 0 = no clip) |
| `POST` | `/docs` | form field `password=<event password>` | the API docs page (this section as HTML), plus a 12 h cookie so `GET /docs` keeps working; wrong password bounces to `/?docs=denied` |
| `GET` | `/<name>` | | the viewer page; `?view=close\|street\|river`, `&real=1`, `&fit=1`, `&fx=0` |
| `GET` | `/demo/<slug>` | | the viewer playing a baked demo clip; no instance, password or socket. Same `?view=` toggles. Slugs listed in `/demos/demos.json`; unknown slug is `404` |

Notes:

- Names are `adjective-animal` pairs drawn from the server's fixed word pools; use the exact name *Create* gave
  you. Any other name, including `your-instance`, is a `400`.
- A name is reserved when it is handed out or when it receives its first frame. The pool has
  1296 names; the admin `DELETE` above releases one.
- Frames are applied on a 33 ms tick, so reading `/frame` immediately after posting one can
  return the previous frame.
- `frames`, `viewers` and `created_at` in the status are in-memory counters that reset whenever
  the instance goes idle or the service is redeployed. The frame and clip themselves persist.

## Demos

```
cd poc/python
python3 demo.py <name> https://sundai.willsarg.com/api   # live rainbow at 30 fps
python3 clip_demo.py <name>                              # 6 s bouncing bar, looped
```

The URL argument to `demo.py` is required: without it the script targets a local dev server. `clip_demo.py`
defaults to the hosted simulator.

## Demo pages

`https://sundai.willsarg.com/demo/sundai-sundae`, `/demo/sundai-critters`, `/demo/sundai-reveal` (the Sundai logo in its brand gradient), `/demo/rainbow` and `/demo/bouncing-bar` play pre-built clips straight from static
files, so they need no instance, no password and no server state: use them for QR codes, slides and the landing
page. The clips are baked by `poc/python/make_demos.py` into `poc/site/public/demos/` (one `.bin` in the clip
format above plus `demos.json`). To add one, write a function returning `(frames, fps)`, add it to `DEMOS`, run
`python3 make_demos.py`, then rebuild and deploy. `python3 test_make_demos.py` checks the baked files.

## Load check

```
cd poc/python && EVENT_PASSWORD=<event password> ADMIN_PASSWORD=<admin password> python3 load_test.py 50 60
```

Creates 50 instances, streams 30 fps to each for 60 s, reports accepted fps, then wipes every
instance it created.

## Running it yourself

```
cd poc && npm install && npm run dev        # http://localhost:8787, passwords from poc/.dev.vars
npm run build && npx wrangler deploy --config dist/gbsim_poc/wrangler.json
```

Cloudflare Workers + one Durable Object per instance. Rendering notes in `docs/RENDERING.md`,
image credits in `docs/IMAGE_SOURCES.md`.
