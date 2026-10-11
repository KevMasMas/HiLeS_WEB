"""Reloj controlable para pruebas del scheduler."""


class FakeClock:
    def __init__(self, initial_ms=0):
        self._now_us = initial_ms * 1_000

    def now_ms(self):
        return self._now_us // 1_000

    def now_us(self):
        return self._now_us

    def add_ms(self, value, delta_ms):
        return value + delta_ms

    def diff_ms(self, later, earlier):
        return later - earlier

    def diff_us(self, later, earlier):
        return later - earlier

    def sleep_ms(self, duration_ms):
        self.advance_ms(duration_ms)

    def advance_ms(self, duration_ms):
        if duration_ms < 0:
            raise ValueError("No se puede retroceder el reloj")
        self._now_us += duration_ms * 1_000

    def advance_us(self, duration_us):
        if duration_us < 0:
            raise ValueError("No se puede retroceder el reloj")
        self._now_us += duration_us
