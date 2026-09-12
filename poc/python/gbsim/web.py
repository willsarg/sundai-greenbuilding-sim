"""WebDisplay: a Display that sends frames to a hosted simulator instance."""
import atexit
import http.client
import threading
import weakref
from urllib.parse import urlsplit
from .display import Display, Frame

DEFAULT_BASE_URL = "https://sundai.willsarg.com/api"

_UA_HEADERS = {
    "Content-Type": "application/octet-stream",
    # Cloudflare's edge blocks the default "Python-urllib" UA (error 1010).
    "User-Agent": "gbsim/1",
}


class _Sender:
    """Background frame pump. Owns the thread, the mailbox and the keep-alive connection.

    Deliberately holds no reference to the WebDisplay, so a dropped display can be
    garbage-collected; its finalizer stops the pump.
    """

    def __init__(self, host, https, path, timeout):
        self._host, self._https, self._path, self._timeout = host, https, path, timeout
        self._conn = None
        self._slot = None           # newest frame not yet sent (latest wins)
        self._busy = False          # a frame is in flight
        self._closing = False       # no new frames accepted
        self._stopped = False       # pump must exit
        self._cv = threading.Condition()
        self._thread = None
        self._fails = 0

    # -- called from the game thread ----------------------------------------
    def put(self, buf):
        with self._cv:
            if self._closing:
                return False
            self._slot = buf
            if self._thread is None:
                self._thread = threading.Thread(target=self._pump, name="gbsim-sender", daemon=True)
                self._thread.start()
            self._cv.notify()
            return True

    def flush(self, timeout):
        with self._cv:
            return self._cv.wait_for(lambda: self._slot is None and not self._busy, timeout=timeout)

    def close(self, timeout):
        """Stop accepting frames, deliver what is queued, then stop the thread.

        Returns True if the thread has exited. The pump always sends a still-queued frame
        before exiting, so a frame accepted before close() is only lost if its request
        cannot complete within roughly two timeouts; a wedged request is torn down.
        """
        with self._cv:
            self._closing = True      # from here on put() refuses: nothing can sneak in
        self.flush(timeout)
        with self._cv:
            self._stopped = True
            self._cv.notify_all()
        t = self._thread
        if t is None:
            return True
        t.join(timeout)
        if t.is_alive():
            self._drop_conn()         # unblocks a stuck request; the pump then sees _stopped
            t.join(timeout)
        return not t.is_alive()

    # -- pump thread ----------------------------------------------------------
    def _connect(self):
        cls = http.client.HTTPSConnection if self._https else http.client.HTTPConnection
        return cls(self._host, timeout=self._timeout)

    def _drop_conn(self):
        c, self._conn = self._conn, None
        if c is not None:
            try:
                c.close()
            except Exception:
                pass

    def _pump(self):
        while True:
            with self._cv:
                while self._slot is None and not self._stopped:
                    self._cv.wait()
                if self._slot is None:        # stopped and nothing left: exit. A queued frame is
                    break                     # always sent first, even after the stop deadline.
                buf, self._slot = self._slot, None
                self._busy = True
            try:
                if self._conn is None:
                    self._conn = self._connect()
                self._conn.request("POST", self._path, body=buf, headers=_UA_HEADERS)
                resp = self._conn.getresponse()
                resp.read()
                if resp.status >= 400:
                    raise RuntimeError(f"HTTP {resp.status}: {resp.reason}")
                self._fails = 0
            except Exception as e:  # fire-and-forget: log (not too often), never crash the game
                self._fails += 1
                if self._fails <= 3 or self._fails % 100 == 0:
                    print(f"gbsim: send failed: {e}")
                self._drop_conn()
            finally:
                with self._cv:
                    self._busy = False
                    self._cv.notify_all()
        self._drop_conn()


class WebDisplay(Display):
    """Display that POSTs each frame to the simulator as 459 raw RGB bytes.

    send() never blocks the game loop: it drops the frame into a one-slot mailbox
    (latest wins) and a background thread pushes it over a single keep-alive HTTPS
    connection. A round trip to Cloudflare is ~50 ms on a warm connection, so a
    30 fps game loop stays at 30 fps and the display gets ~20 fps of the latest frames.

    The newest frame is flushed automatically at interpreter exit, so one-shot scripts
    work. Call flush() to wait for it explicitly, close() (or use `with`) when done.
    """

    def __init__(self, name, base_url=DEFAULT_BASE_URL, timeout=2.0):
        if not isinstance(timeout, (int, float)) or isinstance(timeout, bool) or not timeout > 0:
            raise ValueError("timeout must be a positive number of seconds (None/blocking is not supported)")
        u = urlsplit(base_url.rstrip("/"))
        self._host, self._https = u.netloc, u.scheme == "https"
        self._timeout = timeout
        self._sender = _Sender(self._host, self._https, f"{u.path}/i/{name}/frame", timeout)
        # Stop the pump if the display is garbage-collected without close(); the finalizer
        # references only the sender, never the display, so no cycle keeps it alive.
        self._finalizer = weakref.finalize(self, _Sender.close, self._sender, timeout)
        atexit.register(_flush_at_exit, weakref.ref(self))

    def makeframe(self):
        return Frame()

    def send(self, frame):
        self._sender.put(self._pack(frame))

    def flush(self, timeout=None):
        """Block until the newest frame has been sent. Returns False on timeout."""
        return self._sender.flush(self._timeout + 1.0 if timeout is None else timeout)

    def close(self):
        """Flush, stop the sender thread and drop the connection. send() is a no-op after."""
        self._finalizer.detach()
        return self._sender.close(self._timeout + 1.0)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    @staticmethod
    def _pack(frame):
        return _pack(frame)


# --- simulator-only helpers: NOT part of the real building's Display interface -------------
# Keep these out of game code you intend to run on the real display; put clip uploads in a
# separate script. The real building only has Display.makeframe() and Display.send().



def upload_clip(name, frames, fps=30, base_url=DEFAULT_BASE_URL, timeout=10.0):
    """Upload an animation that the simulator instance loops on its own.

    frames: list of Frame (1..900); fps: 1..30. Returns True on success. Live send() frames
    take over while they arrive; the clip resumes ~2 s after the last one.
    """
    return _blocking("POST", name, encode_clip(frames, fps), base_url, timeout)


def encode_clip(frames, fps=30):
    """Encode frames as the simulator's binary clip: [0x43, fps, countLo, countHi] + 459 B/frame."""
    if not 1 <= fps <= 30:
        raise ValueError("fps must be 1..30")
    if not 1 <= len(frames) <= 900:
        raise ValueError("clip must have 1..900 frames")
    buf = bytearray((0x43, int(fps), len(frames) & 0xFF, len(frames) >> 8))
    for frame in frames:
        buf += _pack(frame)
    return bytes(buf)


def clear_clip(name, base_url=DEFAULT_BASE_URL, timeout=10.0):
    """Remove the instance's clip. Returns True on success."""
    return _blocking("DELETE", name, None, base_url, timeout)


def _pack(frame):
    buf = bytearray()
    for i in range(frame.nrows()):
        for color in frame.row(i):
            buf += bytes((color.r, color.g, color.b))
    return bytes(buf)


def _blocking(method, name, body, base_url, timeout):
    u = urlsplit(base_url.rstrip("/"))
    try:
        cls = http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
        c = cls(u.netloc, timeout=timeout)
        c.request(method, f"{u.path}/i/{name}/clip", body=body, headers=_UA_HEADERS)
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


def _flush_at_exit(ref):
    d = ref()
    if d is not None:
        d.flush()
