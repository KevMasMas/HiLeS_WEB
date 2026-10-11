import unittest

from firmware.pico.core.scheduler import Scheduler
from firmware.pico.core.task import Task
from firmware.pico.main import build_application
from firmware.tests.fakes import FakeClock


class RecordingTask(Task):
    def __init__(self, scheduler, events, label, **kwargs):
        self.events = events
        self.label = label
        super().__init__(scheduler=scheduler, name=label, **kwargs)

    def update(self):
        self.events.append((self.label, self.scheduler.clock.now_ms()))


class FailingTask(Task):
    def update(self):
        raise RuntimeError("fallo controlado")


class SlowTask(Task):
    def update(self):
        self.scheduler.clock.advance_ms(6)


class StopTask(Task):
    def update(self):
        self.scheduler.stop()


class SchedulerTests(unittest.TestCase):
    def test_runs_due_tasks_by_priority_and_preserves_registration_order(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        events = []

        RecordingTask(scheduler, events, "normal-1", period_ms=100, priority=2)
        RecordingTask(scheduler, events, "urgent", period_ms=100, priority=1)
        RecordingTask(scheduler, events, "normal-2", period_ms=100, priority=2)

        self.assertEqual(
            scheduler.run_pending(),
            ["urgent", "normal-1", "normal-2"],
        )
        self.assertEqual([event[0] for event in events], ["urgent", "normal-1", "normal-2"])

    def test_waits_until_period_and_does_not_catch_up_in_bursts(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        events = []
        task = RecordingTask(scheduler, events, "periodic", period_ms=100)

        scheduler.run_pending()
        clock.advance_ms(99)
        self.assertEqual(scheduler.run_pending(), [])
        clock.advance_ms(1)
        self.assertEqual(scheduler.run_pending(), ["periodic"])

        clock.advance_ms(450)
        self.assertEqual(scheduler.run_pending(), ["periodic"])
        self.assertEqual(task.next_run, 650)
        self.assertEqual(len(events), 3)

    def test_failure_is_reported_without_stopping_other_tasks(self):
        clock = FakeClock()
        errors = []
        scheduler = Scheduler(clock=clock, error_handler=lambda task, error: errors.append((task.name, error)))
        events = []
        failing = FailingTask(scheduler, period_ms=50, priority=1, name="failing")
        RecordingTask(scheduler, events, "healthy", period_ms=50, priority=2)

        self.assertEqual(scheduler.run_pending(), ["failing", "healthy"])
        self.assertEqual(events, [("healthy", 0)])
        self.assertEqual(errors[0][0], "failing")
        self.assertIsInstance(errors[0][1], RuntimeError)
        self.assertEqual(failing.error_count, 1)
        self.assertEqual(failing.run_count, 1)

    def test_detects_update_that_exceeds_its_budget(self):
        clock = FakeClock()
        overruns = []
        scheduler = Scheduler(clock=clock, overrun_handler=lambda task: overruns.append(task.name))
        task = SlowTask(scheduler, period_ms=100, max_update_ms=5, name="slow")

        scheduler.run_pending()

        self.assertEqual(overruns, ["slow"])
        self.assertEqual(task.overrun_count, 1)
        self.assertEqual(task.last_duration_us, 6_000)
        self.assertEqual(task.next_run, 106)

    def test_disable_and_enable_reschedule_a_task(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        events = []
        task = RecordingTask(scheduler, events, "switchable", period_ms=100)

        task.disable()
        self.assertEqual(scheduler.run_pending(), [])
        task.enable(run_immediately=False)
        self.assertEqual(scheduler.run_pending(), [])
        clock.advance_ms(100)
        self.assertEqual(scheduler.run_pending(), ["switchable"])

    def test_base_task_requires_update_implementation(self):
        clock = FakeClock()
        errors = []
        scheduler = Scheduler(clock=clock, error_handler=lambda task, error: errors.append(error))
        task = Task(scheduler, period_ms=100, name="incomplete")

        scheduler.run_pending()

        self.assertIsInstance(errors[0], NotImplementedError)
        self.assertEqual(task.error_count, 1)

    def test_validates_task_configuration_and_duplicate_registration(self):
        scheduler = Scheduler(clock=FakeClock())
        with self.assertRaises(ValueError):
            Task(scheduler, period_ms=0)
        with self.assertRaises(ValueError):
            Task(scheduler, period_ms=True)

        task = Task(scheduler, period_ms=10)
        with self.assertRaises(ValueError):
            scheduler.add(task)

    def test_main_builds_scheduler_from_factories(self):
        clock = FakeClock()
        events = []

        def create_task(scheduler):
            return RecordingTask(scheduler, events, "composed", period_ms=25)

        scheduler = build_application(task_factories=(create_task,), clock=clock)
        self.assertEqual(scheduler.run_pending(), ["composed"])
        self.assertEqual(events, [("composed", 0)])

    def test_run_forever_can_be_stopped_by_a_task(self):
        clock = FakeClock()
        scheduler = Scheduler(clock=clock)
        task = StopTask(scheduler, period_ms=10, name="stop")

        scheduler.run_forever(idle_sleep_ms=0)

        self.assertFalse(scheduler.running)
        self.assertEqual(task.run_count, 1)

    def test_failure_in_error_handler_does_not_stop_next_task(self):
        clock = FakeClock()

        def broken_handler(_task, _error):
            raise RuntimeError("falló el manejador")

        scheduler = Scheduler(clock=clock, error_handler=broken_handler)
        events = []
        FailingTask(scheduler, period_ms=50, priority=1, name="failing")
        RecordingTask(scheduler, events, "healthy", period_ms=50, priority=2)

        scheduler.run_pending()

        self.assertEqual(events, [("healthy", 0)])


if __name__ == "__main__":
    unittest.main()
