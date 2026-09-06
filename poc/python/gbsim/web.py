"""WebDisplay: a Display that sends frames to a hosted simulator instance."""
import urllib.request
from .display import Display, Frame


class WebDisplay(Display):
    """Display that POSTs each frame to the simulator as 459 raw RGB bytes."""

    def __init__(self, name, base_url="https://sundai.willsarg.com/api", timeout=1.0):
        self._url = f"{base_url.rstrip('/')}/i/{name}/frame"
        self._timeout = timeout

    def makeframe(self):
        return Frame()

    def send(self, frame):
        buf = bytearray()
        for i in range(frame.nrows()):
            for color in frame.row(i):
                buf += bytes((color.r, color.g, color.b))
        req = urllib.request.Request(self._url, data=bytes(buf), method="POST",
                                     headers={"Content-Type": "application/octet-stream"})
        try:
            urllib.request.urlopen(req, timeout=self._timeout).close()
        except Exception as e:  # fire-and-forget: log, never crash the game
            print(f"gbsim: send failed: {e}")
