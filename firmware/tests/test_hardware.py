import unittest

from firmware.pico.platform.hardware import resolve_board_model, resolve_device_id


class _Implementation:
    _machine = "Raspberry Pi Pico 2 W with RP2350"


class _System:
    implementation = _Implementation()


class _Machine:
    @staticmethod
    def unique_id():
        return bytes((1, 2, 10, 255))


class HardwareMetadataTests(unittest.TestCase):
    def test_reports_board_model_without_device_identifiers(self):
        self.assertEqual(
            resolve_board_model(os_module=object(), sys_module=_System()),
            "Raspberry Pi Pico 2 W with RP2350",
        )
        self.assertEqual(resolve_board_model(os_module=object(), sys_module=object()), "unknown")

    def test_device_identity_can_scale_without_code_changes(self):
        config = type("Config", (), {"DEVICE_ID": "pico03w"})()
        self.assertEqual(resolve_device_id(config=config, machine_module=_Machine()), "pico03w")
        self.assertEqual(resolve_device_id(machine_module=_Machine()), "pico-01020aff")


if __name__ == "__main__":
    unittest.main()
