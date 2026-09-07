"""WebDisplay: a Display that sends frames to a hosted simulator instance."""
import http.client
import threading
from urllib.parse import urlsplit
from .display import Display, Frame


class WebDisplay(Display):
    """Display that POSTs each frame to the simulator as 459 raw RGB bytes.

    send() never blocks the game loop: it drops the frame into a one-slot mailbox
    (latest wins) and a background thread pushes it over a single keep-alive HTTPS
    connection. A round trip to Cloudflare is ~50 ms on a warm connection, so a
    30 fps game loop stays at 30 fps and the display gets ~20 fps of the latest frames.
    """

    def __init__(self, name, base_url="https://sundai.willsarg.com/api", timeout=2.0):
        u = urlsplit(base_url.rstrip("/"))
        self._host, self._https = u.netloc, u.scheme == "https"
        self._path = f"{u.path}/i/{name}/frame"
        self._timeout = timeout
        self._conn = None
        self._slot = None
        self._cv = threading.Condition()
        self._fails = 0
        threading.Thread(target=self._pump, daemon=True).start()

    def makeframe(self):
        return Frame()

    def send(self, frame):
        buf = bytearray()
        for i in range(frame.nrows()):
            for color in frame.row(i):
                buf += bytes((color.r, color.g, color.b))
        with self._cv:
            self._slot = bytes(buf)
            self._cv.notify()

    # -- background sender ---------------------------------------------------
    def _connect(self):
        cls = http.client.HTTPSConnection if self._https else http.client.HTTPConnection
        return cls(self._host, timeout=self._timeout)

    def _pump(self):
        while True:
            with self._cv:
                while self._slot is None:
                    self._cv.wait()
                buf, self._slot = self._slot, None
            try:
                if self._conn is None:
                    self._conn = self._connect()
                self._conn.request("POST", self._path, body=buf, headers={
                    "Content-Type": "application/octet-stream",
                    # Cloudflare's edge blocks the default "Python-urllib" UA (error 1010).
                    "User-Agent": "gbsim/1",
                })
                resp = self._conn.getresponse()
                resp.read()
                if resp.status >= 400:
                    raise RuntimeError(f"HTTP {resp.status}: {resp.reason}")
                self._fails = 0
            except Exception as e:  # fire-and-forget: log (not too often), never crash the game
                self._fails += 1
                if self._fails <= 3 or self._fails % 100 == 0:
                    print(f"gbsim: send failed: {e}")
                try:
                    self._conn.close()
                except Exception:
                    pass
                self._conn = None
