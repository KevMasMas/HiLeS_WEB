import ast
import unittest
from pathlib import Path


CORE_DIRECTORY = Path(__file__).resolve().parents[1] / "pico" / "core"
FORBIDDEN_ROOTS = {"devices", "hiles", "platform", "pubsub"}


class ArchitectureTests(unittest.TestCase):
    def test_core_does_not_depend_on_outer_modules(self):
        violations = []

        for path in sorted(CORE_DIRECTORY.glob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    roots = {alias.name.split(".")[0] for alias in node.names}
                elif isinstance(node, ast.ImportFrom) and node.module:
                    roots = {node.module.split(".")[0]}
                else:
                    continue
                forbidden = roots & FORBIDDEN_ROOTS
                if forbidden:
                    violations.append("{} importa {}".format(path.name, sorted(forbidden)))

        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
