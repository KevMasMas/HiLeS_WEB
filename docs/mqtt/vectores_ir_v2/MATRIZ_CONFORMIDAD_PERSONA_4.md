# Matriz de conformidad — Juan David Romero (Persona 4)

**Fecha de verificación:** 6 de noviembre de 2026

**Rama:** `multi-pico`

**Base recibida:** `c61dbad`
**Alcance:** equivalencia Browser/MicroPython, canales, Petri, ejecución distribuida y preparación de la demostración.

## 1. Fuente de verdad compartida

Los motores web y MicroPython consumen los mismos archivos de
`docs/mqtt/vectores_ir_v2/ejecucion/`:

| Vector | Comportamiento |
|---|---|
| `01_python_vector_custom.json` | Python, vector, custom y varias salidas |
| `02_sample_hold_dch_lch.json` | Sample, Hold, CCH, DCH, LCH y Petri |
| `03_retardos_y_cancelacion.json` | Retardo no bloqueante y cancelación |
| `04_tokens_pesos_capacidad_conflicto.json` | 0/1/N tokens, pesos, capacidad y conflicto atómico |
| `05_services_expresiones_tipos.json` | Services booleano, numérico y texto; Functional Blocks de expresión |

En el frontend, `ConformidadIrV2.test.ts` ejecuta cada entrada y compara cada
snapshot. Después reinicia el motor y repite el vector completo para detectar
colas, temporizadores o valores residuales. En firmware,
`test_hiles_engine_v2.py` recorre automáticamente la misma carpeta y aplica las
mismas expectativas.

## 2. Matriz de elementos y canales

| Componente | Browser | MicroPython | Distribuido | Evidencia |
|---|---:|---:|---:|---|
| Service booleano | Aprobado | Aprobado | Aprobado en software | Vector 05 y entrada distribuida |
| Service numérico | Aprobado | Aprobado | Aprobado en software | Vectores 02 y 05 |
| Service texto | Aprobado | Aprobado | Contrato validado | Vector 05 |
| Functional Block expresión | Aprobado | Aprobado | Aprobado en software | Vector 05 |
| Functional Block Python | Aprobado | Aprobado | Aprobado en software | Vector 01, varias salidas y paridad worker |
| Sample | Aprobado | Aprobado | Fragmento local aprobado | Vector 02 |
| Hold | Aprobado | Aprobado | Aprobado como receptor remoto | Vector 02 y pruebas de canales |
| Place | Aprobado | Aprobado | Local al fragmento Petri | Vectores 02, 03 y 04 |
| Transition | Aprobado | Aprobado | Local al fragmento Petri | Vectores 02, 03 y 04 |
| Structural Block | Aprobado por compilador | No se ejecuta como elemento | Herencia de destino aprobada | `particionarIr.test.ts` |
| CCH | Aprobado | Aprobado | Aprobado en software | Vectores 03/05, BrowserWorker y firmware channels |
| DCH | Aprobado | Aprobado | Aprobado en software | Vector 02, FIFO, capacidad y overflow |
| LCH | Aprobado | Aprobado | Aprobado en software con restricción Petri | Vector 02 y canales remotos |

“Aprobado en software” no equivale a una prueba con Pico física. Significa que
el motor real, los workers o los dobles de protocolo deterministas aprobaron el
contrato correspondiente.

## 3. Tokens y atomicidad

| Caso | Resultado |
|---|---|
| Place con 0 tokens | Conserva 0 sin valores negativos |
| Place con 1 token | Movimiento único y reinicio exacto |
| Place con más de 1 token | Movimiento ponderado 3 → 1 y 0 → 2 |
| Peso mayor que uno | Consume y produce dos tokens atómicamente |
| Capacidad insuficiente | No dispara ni mueve parcialmente tokens |
| Dos transiciones en conflicto | No dispara ninguna y conserva el token origen |
| Reinicio | Restaura marcado, valores, colas y temporizadores iniciales |
| Mensaje remoto duplicado | Se descarta por `message_id`/secuencia y no reutiliza el token |

## 4. Restricciones de Places, Transitions y LCH

1. Un Place y una Transition unidos por una conexión `arco` deben pertenecer al
   mismo fragmento. El particionador rechaza una separación con
   `DISTRIBUCION_ARCO_REMOTO`.
2. Los arcos Petri mueven tokens localmente y nunca se convierten directamente
   en tópicos MQTT.
3. LCH sí puede cruzar ejecutores como pulso de control tipado. El receptor lo
   consume una sola vez y lo limpia en el paso siguiente.
4. Un token remoto se modela mediante una conexión LCH y estado local explícito;
   no se comparte una instancia de Place entre dispositivos.
5. CCH conserva el último valor y reemplaza una entrega diferida pendiente.
   DCH conserva orden FIFO, capacidad acotada y diagnóstico de overflow.

## 5. Matrices de ejecutores

| Matriz | Estado | Evidencia y límite |
|---|---|---|
| Browser ↔ Browser | Aprobada en software y broker real | `BrowserWorker.test.ts`, colaboración con cuatro clientes MQTT, retained, presencia, cursor y aislamiento de proyectos |
| Pico simulada ↔ Browser | Aprobada | Runner distribuido con broker real, cuatro ACK, entrada `5`, salida `6`, 20 snapshots y deduplicación |
| Pico simulada ↔ Pico simulada | Aprobada | Pipeline de tres workers MicroPython y runner de cuatro ejecutores |
| Pico física ↔ Browser | Pendiente | No se detectó ninguna placa |
| Pico física ↔ Pico física | Pendiente | No se detectó ninguna placa; no se sustituye por dobles |

El runner MQTT real utiliza el broker real, pero sus ejecutores `pico:*` son
dobles de protocolo en Node.js. Por ello valida tópicos, retained, ACK,
deduplicación, caída y liberación, pero no Wi-Fi, MicroPython, memoria, GPIO ni
puertos seriales de una placa.

## 6. Resultados reproducibles

```powershell
cd frontend
npm.cmd run test:run
npm.cmd run lint
npm.cmd run build

cd ..
& 'C:\Program Files\PostgreSQL\18\pgAdmin 4\python\python.exe' `
  -m unittest discover -s firmware/tests -t . -v
node .\scripts\test-project-collaboration.mjs
node .\scripts\test-distributed-mqtt.mjs --mode=memory
node .\scripts\test-distributed-mqtt.mjs --mode=mqtt --timeout=12000
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\test-distributed-physical.ps1 -Mode DryRun -AllowNoDevice
```

Resultados previos al cierre definitivo:

- frontend final: 32 archivos y 187 pruebas aprobadas;
- conformidad añadida: dos pruebas que recorren cinco vectores compartidos y
  tres pruebas Browser ↔ Browser para CCH, DCH y LCH;
- firmware: 169 pruebas aprobadas;
- paquete canónico: 33 archivos y aprovisionamiento simulado aprobado;
- colaboración MQTT: cuatro clientes, snapshot retenido, presencia, cursor y
  aislamiento entre proyectos aprobados;
- ejecución MQTT: seis etapas aprobadas, cuatro ACK, 20 snapshots, dos mensajes
  descartados y caída de `browser:c` observada;
- inventario físico: sin placas detectadas, sin escritura ni despliegue.

Estos números corresponden a la regresión completa ejecutada sobre el árbol de
trabajo de Juan David Romero (Persona 4) antes del commit de integración.

## 7. Verificación visual y tutorial

Persona 3 registró seis viewports y el tutorial actualizado. Juan David Romero
(Persona 4) repitió la entrada desde un segundo navegador conectado por LAN,
confirmó dos colaboradores simultáneos y publicó un cambio de nombre que llegó
al otro navegador por Mosquitto. Durante la prueba se corrigieron el robo de
foco entre identidad y tutorial y un ciclo de renderizado del panel. La prueba
formal del tutorial con una persona externa permanece pendiente.

## 8. Guion técnico de demostración — máximo diez minutos

1. **0:00–1:00:** abrir el proyecto y explicar conexión frente a destino.
2. **1:00–2:00:** mostrar dos navegadores y, si están disponibles, dos Picos con
   identidades distintas.
3. **2:00–3:00:** importar el ejemplo pequeño y asignar Structural Blocks.
4. **3:00–4:00:** desplegar; mostrar manifiesto, fragmentos y ACK.
5. **4:00–5:30:** inyectar una entrada y mostrar CCH/DCH cruzando MQTT.
6. **5:30–6:30:** ejecutar Paso, Iniciar, Detener y Reiniciar.
7. **6:30–7:30:** mostrar varios tokens, peso, capacidad y conflicto atómico.
8. **7:30–8:30:** abrir otro navegador y mostrar estado agregado.
9. **8:30–9:15:** desconectar un ejecutor y mostrar diagnóstico/reconexión.
10. **9:15–10:00:** mostrar configuración de una nueva Pico y declarar límites
    físicos que no hayan sido probados.

Sin dos placas disponibles, los pasos físicos se reemplazan por la matriz
Browser ↔ Browser y se declara explícitamente que la evidencia es de software.
