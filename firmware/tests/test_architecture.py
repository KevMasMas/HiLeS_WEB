import ast
import unittest
from pathlib import Path


CORE_DIRECTORY = Path(__file__).resolve().parents[1] / "pico" / "core"
PUBSUB_DIRECTORY = Path(__file__).resolve().parents[1] / "pico" / "pubsub"
FORBIDDEN_CORE_ROOTS = {"devices", "hiles", "platform", "pubsub"}
FORBIDDEN_PUBSUB_ROOTS = {"devices", "hiles", "platform"}


def _collect_import_violations(directory, forbidden_roots):
    violations = []

    for path in sorted(directory.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                roots = {alias.name.split(".")[0] for alias in node.names}
            elif isinstance(node, ast.ImportFrom) and node.module:
                roots = {node.module.split(".")[0]}
            else:
                continue
            forbidden = roots & forbidden_roots
            if forbidden:
                violations.append("{} importa {}".format(path.name, sorted(forbidden)))

    return violations


class ArchitectureTests(unittest.TestCase):
    def test_core_does_not_depend_on_outer_modules(self):
        violations = _collect_import_violations(CORE_DIRECTORY, FORBIDDEN_CORE_ROOTS)
        self.assertEqual(violations, [])

    def test_pubsub_does_not_depend_on_devices_hiles_or_platform(self):
        violations = _collect_import_violations(PUBSUB_DIRECTORY, FORBIDDEN_PUBSUB_ROOTS)
        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
