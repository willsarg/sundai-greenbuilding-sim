"""Load check: N instances x 30 fps for SECS seconds, then wipe every instance it created.
usage: python load_test.py [N=50] [SECS=60] [base_url]      (needs EVENT_PASSWORD and ADMIN_PASSWORD in the env)
"""
import sys, os, time, json, threading, urllib.request, colorsys
from gbsim import WebDisplay, Color, DEFAULT_BASE_URL

N = int(sys.argv[1]) if len(sys.argv) > 1 else 50
SECS = int(sys.argv[2]) if len(sys.argv) > 2 else 60
BASE = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_BASE_URL
PW = os.environ.get("EVENT_PASSWORD") or sys.exit("set EVENT_PASSWORD in the environment")
ADMIN_PW = os.environ.get("ADMIN_PASSWORD") or sys.exit("set ADMIN_PASSWORD in the environment")
H = {"content-type": "application/json", "User-Agent": "gbsim/1"}

def api(method, path, body=None, auth=False):
    hdr = dict(H, **({"Authorization": f"Bearer {ADMIN_PW}"} if auth else {}))
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=hdr, method=method)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.load(r) if r.status != 204 else None

names = [api("POST", "/instances", {"password": PW})["name"] for _ in range(N)]
print(f"created {len(names)} instances ({len(set(names))} unique)")
try:
    stop = time.time() + SECS
    def run(name, k):
        d = WebDisplay(name, BASE); f = d.makeframe(); t = 0
        while time.time() < stop:
            for r in range(17):
                for c in range(9):
                    rr, gg, bb = colorsys.hsv_to_rgb(((r + c) / 26 + t / 60 + k / N) % 1, 1, 1)
                    f[r][c] = Color(rr * 255, gg * 255, bb * 255)
            d.send(f); t += 1; time.sleep(1 / 30)
        d.close()
    ths = [threading.Thread(target=run, args=(n, k), daemon=True) for k, n in enumerate(names)]
    t0 = time.time()
    for th in ths: th.start()
    for th in ths: th.join()
    time.sleep(1)
    tot, lo = 0, 10**9
    for n in names:
        fr = api("GET", f"/i/{n}/")["frames"]; tot += fr; lo = min(lo, fr)
    el = time.time() - t0
    print(f"{len(names)} instances, {el:.0f}s: {tot} frames accepted, avg {tot/len(names)/el:.1f} fps/instance, slowest {lo/el:.1f} fps")
finally:
    ok = sum(1 for n in names if api("DELETE", f"/i/{n}", auth=True)["ok"])
    print(f"cleaned up {ok}/{len(names)} instances")
