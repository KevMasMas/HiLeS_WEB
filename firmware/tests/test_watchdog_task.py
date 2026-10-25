import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.core.task import Task
from firmware.pico.devices.watchdog_task import WatchdogTask
from firmware.pico.pubsub.node import Node
from firmware.pico.pubsub.topics import TELEMETRIA
from firmware.tests.fakes import FakeClock


class FakeGc:
    @staticmethod
    def mem_free():
        return 12345

    @staticmethod
    def mem_alloc():
        return 6789


class CounterTask(Task):
    def __init__(self, scheduler):
        self.count = 0
        super().__init__(scheduler, period_ms=10, priority=1, name="contador")

    def update(self):
        self.count += 1


class WatchdogTaskTests(unittest.TestCase):
    def test_publishes_memory_sensors_and_task_statistics(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        node = Node()
        payloads = []
        node.subscribe(TELEMETRIA, payloads.append)
        CounterTask(scheduler)
        watchdog = WatchdogTask(
            scheduler,
            node,
            device_id="pico-prueba",
            period_ms=100,
            rssi_reader=lambda: -51,
            temperature_reader=lambda: 27.5,
            gc_module=FakeGc,
        )

        scheduler.run_pending()

        self.assertEqual(len(payloads), 1)
        payload = payloads[0]
        self.assertEqual(payload["dispositivo"], "pico-prueba")
        self.assertEqual(payload["memoria_libre"], 12345)
        self.assertEqual(payload["rssi"], -51)
        self.assertEqual(payload["tiempo_activo"], 0)
        self.assertEqual(payload["memoria"], {"mem_free": 12345, "mem_alloc": 6789})
        self.assertEqual(payload["rssi_dbm"], -51)
        self.assertEqual(payload["temperatura_c"], 27.5)
        self.assertIn("contador", payload["tareas"])
        self.assertIn("watchdog", payload["tareas"])
        self.assertEqual(watchdog.publish_count, 1)

    def test_sensor_failure_is_diagnostic_and_does_not_stop_publication(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        node = Node()
        payloads = []
        node.subscribe(TELEMETRIA, payloads.append)

        def broken_sensor():
            raise OSError("sensor ausente")

        watchdog = WatchdogTask(
            scheduler,
            node,
            period_ms=100,
            rssi_reader=broken_sensor,
            gc_module=FakeGc,
        )
        scheduler.run_pending()

        self.assertEqual(len(payloads), 1)
        self.assertEqual(payloads[0]["diagnosticos"][0]["fuente"], "rssi")
        self.assertEqual(watchdog.sensor_error_count, 1)
        self.assertEqual(watchdog.error_count, 0)

    def test_watchdog_respects_period_and_other_task_keeps_running(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        node = Node()
        counter = CounterTask(scheduler)
        watchdog = WatchdogTask(scheduler, node, period_ms=100, gc_module=FakeGc)

        for _ in range(21):
            scheduler.run_pending()
            clock.advance_ms(10)

        self.assertEqual(counter.count, 21)
        self.assertEqual(watchdog.publish_count, 3)


if __name__ == "__main__":
    unittest.main()
