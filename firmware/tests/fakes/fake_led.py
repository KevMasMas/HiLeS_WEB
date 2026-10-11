"""Doble determinista de una salida LED para pruebas sin hardware."""


class FakeLed:
    def __init__(self):
        self._value = False
        self.transitions = []

    def on(self):
        self._value = True
        self.transitions.append(True)

    def off(self):
        self._value = False
        self.transitions.append(False)

    def value(self):
        return int(self._value)
