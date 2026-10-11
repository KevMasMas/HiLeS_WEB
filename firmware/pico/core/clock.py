"""Relojes intercambiables para MicroPython y pruebas de escritorio."""

import time


class SystemClock:
    """Adapta las funciones de tiempo sin exponerlas al scheduler."""

    def now_ms(self):
        ticks_ms = getattr(time, "ticks_ms", None)
        if ticks_ms is not None:
            return ticks_ms()
        return time.monotonic_ns() // 1_000_000

    def now_us(self):
        ticks_us = getattr(time, "ticks_us", None)
        if ticks_us is not None:
            return ticks_us()
        return time.monotonic_ns() // 1_000

    def add_ms(self, value, delta_ms):
        ticks_add = getattr(time, "ticks_add", None)
        if ticks_add is not None:
            return ticks_add(value, delta_ms)
        return value + delta_ms

    def diff_ms(self, later, earlier):
        ticks_diff = getattr(time, "ticks_diff", None)
        if ticks_diff is not None:
            return ticks_diff(later, earlier)
        return later - earlier

    def diff_us(self, later, earlier):
        ticks_diff = getattr(time, "ticks_diff", None)
        if ticks_diff is not None:
            return ticks_diff(later, earlier)
        return later - earlier

    def sleep_ms(self, duration_ms):
        sleep_ms = getattr(time, "sleep_ms", None)
        if sleep_ms is not None:
            sleep_ms(duration_ms)
            return
        time.sleep(duration_ms / 1_000)
