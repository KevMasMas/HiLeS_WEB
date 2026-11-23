"""Verifica que el vector 02 coincide con el motor MicroPython de la Pico.

El mismo archivo lo reproduce ``frontend/src/services/distributed/BrowserWorker.test.ts``
con el worker de navegador: si ambos pasan, un fragmento produce el mismo
resultado observable en una Pico y en un navegador (Persona 3, entrega 7).
"""

import json
import unittest
from pathlib import Path

from firmware.pico.hiles.engine_v2 import HilesEngineV2
from firmware.pico.hiles.model_v2 import validate_ir_v2

VECTORES = Path(__file__).resolve().parents[2] / "docs" / "mqtt" / "vectores_v3"


class ParidadWorkerNavegadorTests(unittest.TestCase):
    def test_vector_02_matches_pico_engine(self):
        fuente = json.loads((VECTORES / "01_fixtures_distribucion_v3.json").read_text(encoding="utf-8"))
        vector = json.loads((VECTORES / "02_paridad_worker_navegador.json").read_text(encoding="utf-8"))
        escenarios = dict((item["nombre"], item) for item in fuente["escenarios"])
        self.assertGreaterEqual(len(vector["casos"]), 2)

        for caso in vector["casos"]:
            with self.subTest(escenario=caso["escenario"]):
                fragmento = [
                    item for item in escenarios[caso["escenario"]]["fragments"]
                    if item["executor_id"] == caso["executor_id"]
                ][0]
                salidas = []
                motor = HilesEngineV2(
                    validate_ir_v2(fragmento["modelo"]),
                    inbound_routes=fragmento["inbound_routes"],
                    outbound_routes=fragmento["outbound_routes"],
                    remote_sink=lambda conexion, valor: salidas.append({"connection_id": conexion, "value": valor}),
                )
                propios = [elemento["id"] for elemento in fragmento["modelo"]["elementos"]]

                def snapshot():
                    completo = motor.snapshot()
                    return dict((clave, completo[clave]) for clave in propios if clave in completo)

                self.assertEqual(snapshot(), caso["estado_inicial"])
                for indice, paso in enumerate(caso["pasos"], start=1):
                    for conexion, valor in paso["remotos"].items():
                        motor.inject_remote_channel(conexion, valor)
                    del salidas[:]
                    motor.step(paso["avance_tiempo_ms"])
                    self.assertEqual(snapshot(), paso["elementos_esperados"], "paso {}".format(indice))
                    self.assertEqual(salidas, paso["salidas_remotas"], "salidas paso {}".format(indice))


if __name__ == "__main__":
    unittest.main()
