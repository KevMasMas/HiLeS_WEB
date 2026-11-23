import importlib.util
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch


REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "manage-pico-fleet.py"
SPEC = importlib.util.spec_from_file_location("manage_pico_fleet", SCRIPT)
fleet = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fleet)


class FleetToolingTests(unittest.TestCase):
    def test_manifest_excludes_local_secrets_and_examples(self):
        expected = fleet.expected_manifest(REPO / "firmware" / "pico")
        self.assertIn("main.py", expected)
        self.assertIn("hiles/distributed_worker.py", expected)
        self.assertNotIn("config_local.py", expected)
        self.assertFalse(any(path.startswith("examples/") for path in expected))

    def test_comparison_supports_a_third_identity_without_code_changes(self):
        expected = {"main.py": "abc", "core/task.py": "def"}
        inventory = {"files": [
            {"path": "main.py", "sha256": "abc"},
            {"path": "core/task.py", "sha256": "def"},
            {"path": "config_local.py", "sha256": "<redacted>"},
            {"path": "umqtt/simple.py", "sha256": "vendor"},
        ]}
        result = fleet.compare_runtime(inventory, expected)
        self.assertTrue(result["matches"])

    def test_obsolete_domain_files_are_reported(self):
        inventory = {"files": [{"path": fleet.OBSOLETE[0], "sha256": "abc"}]}
        result = fleet.compare_runtime(inventory, {})
        self.assertEqual(result["obsolete"], [fleet.OBSOLETE[0]])
        self.assertFalse(result["matches"])

    def test_dependency_fingerprints_only_include_umqtt(self):
        inventory = {"files": [
            {"path": "umqtt/simple.py", "sha256": "one"},
            {"path": "lib/umqtt/robust.py", "sha256": "two"},
            {"path": "config_local.py", "sha256": "<redacted>"},
            {"path": "main.py", "sha256": "runtime"},
        ]}
        self.assertEqual(fleet.dependency_fingerprints(inventory), {
            "umqtt/simple.py": "one",
            "lib/umqtt/robust.py": "two",
        })

    def test_mpremote_retries_a_temporarily_busy_port(self):
        busy = subprocess.CompletedProcess([], 1, stdout="", stderr="device is busy")
        success = subprocess.CompletedProcess([], 0, stdout="READY\n", stderr="")
        with patch.object(fleet.subprocess, "run", side_effect=[busy, success]) as run, \
             patch.object(fleet.time, "sleep"):
            output = fleet.run_mpremote(Path("python"), "COM8", "exec", "print('READY')")
        self.assertEqual(output, "READY\n")
        self.assertEqual(run.call_count, 2)

    def test_inventory_command_documents_runtime_restart(self):
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('entry["runtime_restarted"] = True', source)
        self.assertIn('run_mpremote(args.python, port, "reset")', source)


if __name__ == "__main__":
    unittest.main()
