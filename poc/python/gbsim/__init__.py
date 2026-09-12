"""gbsim: drive a hosted Green Building simulator with the real 2026 Display interface."""
from .display import Color, Frame, Display, BLACK
from .web import WebDisplay, upload_clip, clear_clip, encode_clip, DEFAULT_BASE_URL
__all__ = ["Color", "Frame", "Display", "BLACK", "WebDisplay", "upload_clip", "clear_clip", "encode_clip", "DEFAULT_BASE_URL"]
