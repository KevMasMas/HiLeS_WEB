"""Dobles deterministas para probar el firmware sin hardware."""

from .fake_clock import FakeClock
from .fake_led import FakeLed

__all__ = ("FakeClock", "FakeLed")
