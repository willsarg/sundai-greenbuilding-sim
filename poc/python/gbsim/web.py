"""WebDisplay: a Display that sends frames to a hosted simulator instance."""
import atexit
import http.client
import threading
import weakref
from urllib.parse import urlsplit
from .display import Display, Frame


class WebDisplay(Display):
    """Display that POSTs each frame to the simulator as 459 raw RGB bytes.

    send() never blocks the game loop: it drops the frame into a one-slot mailbox
    (latest wins) and a background thread pushes it over a single keep-alive HTTPS
    connection. A round trip to Cloudflare is ~50 ms on a warm connection, so a
    30 fps game loop stays at 30 fps and the display gets ~20 fps of the latest frames.

    The last frame is flushed automatically at interpreter exit, so one-shot scripts work.
    Call flush() to wait for the newest frame to land, close() (or use `with`) when done.
    """

    def __init__(self, name, base_url="https://sundai.willsarg.com/api", timeout=2.0):
        u = urlsplit(base_url.rstrip("/"))
        self._host, self._https = u.netloc, u.scheme == "https"
        self._path = f"{u.path}/i/{name}/frame"
        self._clip_path = f"{u.path}/i/{name}/clip"
        self._timeout = timeout
        self._conn = None
        self._slot = None
        self._cv = threading.Condition()
        self._fails = 0
        self._busy = False          # a frame is in flight
        self._closed = False
        self._thread = None         # started on first send(); clip-only clients never need it
        atexit.register(_flush_at_exit, weakref.ref(self))

    def makeframe(self):
        return Frame()

    def upload_clip(self, frames, fps=10):
        """Upload an animation the display loops on its own (no live connection needed).

        frames: list of Frame (1..900); fps: 1..30. Blocks until the server answers and
        returns True on success. Live send() frames take over while they arrive; the clip
        resumes ~2 s after the last one. clear_clip() removes it.
        """
        if not 1 <= fps <= 30:
            raise ValueError("fps must be 1..30")
        if not 1 <= len(frames) <= 900:
            raise ValueError("clip must have 1..900 frames")
        buf = bytearray((0x43, int(fps), len(frames) & 0xFF, len(frames) >> 8))
        for frame in frames:
            buf += self._pack(frame)
        return self._blocking("POST", self._clip_path, bytes(buf))

    def clear_clip(self):
        return self._blocking("DELETE", self._clip_path, None)

    @staticmethod
    def _pack(frame):
        buf = bytearray()
        for i in range(frame.nrows()):
            for color in frame.row(i):
                buf += bytes((color.r, color.g, color.b))
        return bytes(buf)

    def _blocking(self, method, path, body):
        try:
            c = self._connect()
            c.request(method, path, body=body, headers=self._headers())
            resp = c.getresponse()
            data = resp.read()
            c.close()
            if resp.status >= 400:
                print(f"gbsim: {method} clip failed: HTTP {resp.status} {data[:200].decode(errors='replace')}")
                return False
            return True
        except Exception as e:
            print(f"gbsim: {method} clip failed: {e}")
            return False

    def send(self, frame):
        buf = self._pack(frame)
        with self._cv:
            if self._closed:
                return
            self._slot = buf
            if self._thread is None:
                self._thread = threading.Thread(target=self._pump, daemon=True)
                self._thread.start()
            self._cv.notify()

    def flush(self, timeout=5.0):
        """Block until the newest frame has been sent (or timeout seconds pass)."""
        with self._cv:
            self._cv.wait_for(lambda: self._slot is None and not self._busy, timeout=timeout)

    def close(self):
        """Flush, stop the sender thread and drop the connection. The display is unusable after."""
        self.flush()
        with self._cv:
            self._closed = True
            self._cv.notify_all()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self._thread = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # -- background sender ---------------------------------------------------
    def _connect(self):
        cls = http.client.HTTPSConnection if self._https else http.client.HTTPConnection
        return cls(self._host, timeout=self._timeout)

    @staticmethod
    def _headers():
        return {
            "Content-Type": "application/octet-stream",
            # Cloudflare's edge blocks the default "Python-urllib" UA (error 1010).
            "User-Agent": "gbsim/1",
        }

    def _pump(self):
        while True:
            with self._cv:
                while self._slot is None and not self._closed:
                    self._cv.wait()
                if self._closed:
                    break
                buf, self._slot = self._slot, None
                self._busy = True
            try:
                if self._conn is None:
                    self._conn = self._connect()
                self._conn.request("POST", self._path, body=buf, headers=self._headers())
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
            finally:
                with self._cv:
                    self._busy = False
                    self._cv.notify_all()
        try:
            if self._conn is not None:
                self._conn.close()
        except Exception:
            pass
        self._conn = None


def _flush_at_exit(ref):
    d = ref()
    if d is not None:
        d.flush(timeout=2.0)
