"""Inventaría, respalda y sincroniza varias Pico por mpremote sin revelar secretos."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


OBSOLETE = (
    "devices/traffic_controller.py",
    "devices/vehicle_sensor_task.py",
    "platform/traffic_io.py",
)
SENTINEL = "__HILES_INVENTORY__="
REMOTE_INVENTORY = r'''
import os, sys
try:
 import ujson as json
except ImportError:
 import json
try:
 import uhashlib as hashlib
except ImportError:
 import hashlib
try:
 import ubinascii as binascii
except ImportError:
 import binascii
def hx(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  while True:
   b=f.read(512)
   if not b: break
   h.update(b)
 d=getattr(h,'hexdigest',None)
 return d().lower() if callable(d) else binascii.hexlify(h.digest()).decode().lower()
def walk(base=''):
 out=[]
 for item in os.ilistdir('/'+base if base else '/'):
  name=item[0]; mode=item[1]; rel=(base+'/'+name) if base else name
  if mode & 0x4000:
   out.extend(walk(rel))
  else:
   size=item[3] if len(item)>3 else 0
   sensitive=(rel=='config_local.py' or any(x in rel.lower() for x in ('secret','credential','password')))
   out.append({'path':rel,'size_bytes':size,'sha256':'<redacted>' if sensitive else hx('/'+rel)})
 return out
cfg=hx('/config_local.py') if 'config_local.py' in os.listdir('/') else None
impl=getattr(sys,'implementation',None)
result={'files':walk(),'config_fingerprint':cfg,'board_model':getattr(impl,'_machine','desconocida'),'micropython_version':list(getattr(impl,'version',(0,0,0)))}
print('__HILES_INVENTORY__='+json.dumps(result))
'''


def run_mpremote(
    python: Path,
    port: str,
    *commands: str,
    timeout: int = 45,
    attempts: int = 3,
) -> str:
    """Ejecuta mpremote con reintentos acotados para resets y puertos ocupados."""

    last_error = "error desconocido"
    for attempt in range(1, attempts + 1):
        try:
            completed = subprocess.run(
                [str(python), "-m", "mpremote", "connect", port, *commands],
                check=False,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired:
            last_error = f"timeout después de {timeout} s"
        else:
            if completed.returncode == 0:
                return completed.stdout
            detail = (completed.stderr or completed.stdout).strip().splitlines()
            last_error = detail[-1] if detail else f"mpremote terminó con código {completed.returncode}"
        if attempt < attempts:
            time.sleep(1.5 * attempt)
    raise RuntimeError(
        f"{port}: {last_error}. Cierre Thonny/VS Code si alguno conserva el puerto y vuelva a intentar."
    )


def inventory(python: Path, port: str) -> dict:
    output = run_mpremote(python, port, "exec", REMOTE_INVENTORY)
    line = next((line for line in output.splitlines() if line.startswith(SENTINEL)), None)
    if line is None:
        raise RuntimeError("La Pico no devolvió el inventario esperado.")
    return json.loads(line[len(SENTINEL):])


def canonical_files(firmware_root: Path) -> list[Path]:
    roots = ("core", "devices", "hiles", "platform", "pubsub")
    files = [firmware_root / "main.py", firmware_root / "config_local.example.py"]
    for root in roots:
        files.extend(sorted((firmware_root / root).rglob("*.py")))
    return files


def expected_manifest(firmware_root: Path) -> dict[str, str]:
    result = {}
    for file in canonical_files(firmware_root):
        relative = file.relative_to(firmware_root).as_posix()
        result[relative] = hashlib.sha256(file.read_bytes()).hexdigest()
    return result


def backup_device(python: Path, port: str, data: dict, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=False)
    for item in data["files"]:
        relative = PurePosixPath(item["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise RuntimeError("La Pico publicó una ruta insegura.")
        target = destination.joinpath(*relative.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        run_mpremote(python, port, "fs", "cp", f":/{relative.as_posix()}", str(target))
    safe_manifest = {**data, "config_fingerprint": "<redacted>"}
    (destination / "backup-manifest.json").write_text(json.dumps(safe_manifest, indent=2) + "\n", encoding="utf-8")


def deploy_device(python: Path, port: str, firmware_root: Path) -> None:
    directories = sorted({path.parent.relative_to(firmware_root).as_posix() for path in canonical_files(firmware_root) if path.parent != firmware_root})
    setup = "import os\nfor p in " + repr(directories) + ":\n try: os.mkdir('/'+p)\n except OSError: pass\n"
    setup += "\nfor p in " + repr(list(OBSOLETE)) + ":\n try: os.remove('/'+p)\n except OSError: pass\n"
    run_mpremote(python, port, "exec", setup)
    for source in canonical_files(firmware_root):
        relative = source.relative_to(firmware_root).as_posix()
        run_mpremote(python, port, "fs", "-f", "cp", str(source), f":/{relative}")
    # El reset físico deja que boot.py/main.py arranquen después de que
    # mpremote suelte el puerto; soft-reset puede dejar la placa en el REPL.
    run_mpremote(python, port, "reset")
    time.sleep(3)


def compare_runtime(data: dict, expected: dict[str, str]) -> dict:
    actual = {item["path"]: item["sha256"] for item in data["files"]}
    missing = sorted(path for path in expected if path not in actual)
    different = sorted(path for path, digest in expected.items() if actual.get(path) not in (None, digest))
    obsolete = sorted(path for path in OBSOLETE if path in actual)
    return {"missing": missing, "different": different, "obsolete": obsolete, "matches": not (missing or different or obsolete)}


def dependency_fingerprints(data: dict) -> dict[str, str]:
    """Resume umqtt sin incluir contenidos ni credenciales en el informe."""

    return {
        item["path"]: item["sha256"]
        for item in data["files"]
        if item["path"].startswith(("umqtt/", "lib/umqtt/"))
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ports", nargs="+", required=True)
    parser.add_argument("--mode", choices=("inventory", "backup", "deploy"), default="inventory")
    parser.add_argument("--python", type=Path, default=Path(sys.executable))
    parser.add_argument("--firmware-root", type=Path, default=Path(__file__).resolve().parents[1] / "firmware" / "pico")
    parser.add_argument("--backup-root", type=Path, default=Path.home() / "hiles-pico-backups")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    expected = expected_manifest(args.firmware_root)
    run_id = datetime.now(timezone.utc).strftime("fleet-%Y%m%dT%H%M%SZ")
    report = {"run_id": run_id, "mode": args.mode, "devices": [], "secrets_redacted": True}
    for port in args.ports:
        entry = {"port": port, "ok": False}
        try:
            before = inventory(args.python, port)
            entry.update({
                "board_model": before["board_model"],
                "micropython_version": before["micropython_version"],
                "file_count_before": len(before["files"]),
                "comparison_before": compare_runtime(before, expected),
            })
            if args.mode in ("backup", "deploy"):
                backup_path = args.backup_root / run_id / port
                backup_device(args.python, port, before, backup_path)
                entry["backup_path"] = str(backup_path)
            if args.mode == "deploy":
                fingerprint = before.get("config_fingerprint")
                dependencies_before = dependency_fingerprints(before)
                deploy_device(args.python, port, args.firmware_root)
                after = inventory(args.python, port)
                entry["file_count_after"] = len(after["files"])
                entry["comparison_after"] = compare_runtime(after, expected)
                entry["config_local_preserved"] = fingerprint == after.get("config_fingerprint")
                entry["umqtt_preserved"] = dependencies_before == dependency_fingerprints(after)
                if (
                    not entry["comparison_after"]["matches"]
                    or not entry["config_local_preserved"]
                    or not entry["umqtt_preserved"]
                ):
                    raise RuntimeError("La verificación posterior al despliegue no coincidió.")
            # Cualquier sesión de inventario usa el REPL y detiene main.py.
            # El reset final devuelve la placa a ejecución autónoma.
            run_mpremote(args.python, port, "reset")
            time.sleep(2)
            entry["runtime_restarted"] = True
            entry["ok"] = True
        except Exception as exc:
            entry["error"] = str(exc)
        report["devices"].append(entry)
    report["ok"] = all(item["ok"] for item in report["devices"])
    encoded = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
