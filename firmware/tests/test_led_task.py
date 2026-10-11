import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.core.task import Task
from firmware.pico.devices.led_task import APAGADO, ENCENDIDO, TITILANDO, LedTask
from firmware.tests.fakes import FakeClock, FakeLed


class HeartbeatTask(Task):
    def __init__(self, scheduler, events):
        self.events = events
        super().__init__(scheduler, period_ms=100, name="heartbeat")

    def update(self):
        self.events.append(self.scheduler.clock.now_ms())


class OutputWithoutValue:
    """Salida mínima compatible que no expone el estado mediante value()."""

    def __init__(self):
        self.transitions = []

    def on(self):
        self.transitions.append(True)

    def off(self):
        self.transitions.append(False)


class LedTaskTests(unittest.TestCase):
    def create(self, **kwargs):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        led = FakeLed()
        task = LedTask(scheduler, led, period_ms=50, blink_interval_ms=300, **kwargs)
        return clock, scheduler, led, task

    def test_states_encender_and_apagar(self):
        _clock, _scheduler, led, task = self.create()
        self.assertEqual(task.state, APAGADO)
        self.assertEqual(task.command("encender"), ENCENDIDO)
        self.assertEqual(led.value(), 1)
        self.assertEqual(task.command("apagar"), APAGADO)
        self.assertEqual(led.value(), 0)

    def test_invalid_command_is_rejected_without_hardware_change(self):
        _clock, _scheduler, led, task = self.create()
        with self.assertRaises(ValueError):
            task.command("parpadear")
        self.assertEqual(task.state, APAGADO)
        self.assertEqual(led.transitions, [False])

    def test_blink_uses_fake_clock_and_finishes_after_configured_cycles(self):
        clock, scheduler, led, task = self.create(blink_count=2)
        task.command("titilar", "cmd-1")
        self.assertEqual(task.state, TITILANDO)
        self.assertEqual(led.transitions, [False, True])

        for _ in range(4):
            clock.advance_ms(300)
            scheduler.run_pending()

        self.assertEqual(task.state, APAGADO)
        self.assertEqual(led.value(), 0)
        self.assertEqual(led.transitions, [False, True, False, True, False, True, False])

    def test_blink_toggles_output_without_value_method(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        output = OutputWithoutValue()
        task = LedTask(scheduler, output, period_ms=1, blink_interval_ms=1, blink_count=1)

        task.command("titilar")
        for _ in range(2):
            clock.advance_ms(1)
            scheduler.run_pending()

        self.assertEqual(task.state, APAGADO)
        self.assertEqual(output.transitions, [False, True, False, True, False])

    def test_other_task_runs_while_led_blinks(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        led = FakeLed()
        events = []
        LedTask(scheduler, led, period_ms=50, blink_interval_ms=300, name="led")
        heartbeat = HeartbeatTask(scheduler, events)
        led_task = scheduler.tasks[0]
        led_task.command("titilar")

        for _ in range(40):
            clock.advance_ms(50)
            scheduler.run_pending()

        self.assertGreaterEqual(len(events), 19)
        self.assertGreaterEqual(heartbeat.run_count, 19)
        self.assertEqual(led_task.state, APAGADO)


if __name__ == "__main__":
    unittest.main()
