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

## Two ways to drive it

### Live — your code streams frames

Best for interactive things (a playable game). Your program runs the whole time.

```python
from gbsim import WebDisplay, Color          # poc/python/gbsim
d = WebDisplay("brave-otter")
f = d.makeframe()
f[0][0] = Color(255, 0, 0)
d.send(f)                                    # non-blocking; call it up to 30 times a second
```

`send()` never blocks your loop. The display shows the newest frame that reached it, so if two
copies of your program run at once the building flickers between them: that is the signal to
kill one. Each instance accepts at most 40 frames per second in total.

### Clip — upload an animation once, it loops forever

Best for pre-rendered animations. Upload, close your laptop, the building keeps playing.

```python
frames = [d.makeframe() for _ in range(90)]  # 1..900 frames
# ...draw into each frame...
d.upload_clip(frames, fps=30)                # fps 1..30
d.clear_clip()                               # remove it
```

Live frames always take over while they arrive. Two seconds after the last live frame, the clip
resumes where it paused. The status line under the instance name tells you which mode you are
seeing.

Raw HTTP: `POST /api/i/<name>/clip` with JSON `{"fps": 30, "frames": [<17×9×[r,g,b]>, ...]}`,
`DELETE` the same URL to clear.

## Demos

```
cd poc
python3 python/demo.py <name>       https://sundai.willsarg.com/api   # live rainbow at 30 fps
python3 python/clip_demo.py <name>                                     # 6 s bouncing bar, looped
```

## Running it yourself

```
cd poc && npm install && npm run dev        # http://localhost:8787, password from poc/.dev.vars
npm run build && npx wrangler deploy --config dist/gbsim_poc/wrangler.json
```

Cloudflare Workers + one Durable Object per instance. Rendering notes in `docs/RENDERING.md`,
image credits in `docs/IMAGE_SOURCES.md`.
