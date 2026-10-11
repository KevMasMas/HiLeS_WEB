# Frontend de HiLeS Web

Aplicación React + TypeScript que contiene el editor gráfico, el motor local de simulación y el cliente MQTT de HiLeS Web.

La descripción completa del proyecto, instalación, ejemplos, Mosquitto y Raspberry Pi Pico W se encuentra en el [README de la raíz](../README.md).

## Ejecutar

```powershell
npm ci
npm run dev
```

Vite sirve la aplicación normalmente en `http://localhost:5173/`.

Para exponerla a otros equipos de la red:

```powershell
npm run dev -- --host 0.0.0.0
```

## Scripts

| Comando | Función |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | TypeScript y build de producción |
| `npm run preview` | Vista previa del build |
| `npm run test:run` | Suite completa de Vitest |
| `npm test` | Vitest en modo interactivo |
| `npm run lint` | ESLint |

## Configuración MQTT opcional

```powershell
Copy-Item .env.example .env.local
```

Editar `.env.local` con el host, puerto WebSocket y credenciales del broker. Este archivo es local y no debe versionarse.

```env
VITE_MQTT_HOST=localhost
VITE_MQTT_WS_PORT=9001
VITE_MQTT_WS_PATH=/mqtt
VITE_MQTT_WS_PROTOCOL=ws
VITE_MQTT_USERNAME=usuario_local
VITE_MQTT_PASSWORD=contraseña_local
```

La simulación local y el editor funcionan sin Mosquitto.

## Directorios principales

```text
src/
├── domain/          Formato y migración del documento
├── engine/          Motor TypeScript y pruebas
├── features/        Editor, simulación y panel MQTT
├── services/mqtt/   Cliente, mensajes y puente con Services
├── stores/          Estado Zustand
├── types/           Tipos HiLeS
└── workers/         JavaScript y Python aislados
```

Python se ejecuta mediante el runtime Pyodide incluido en `public/pyodide`; no requiere una instalación local de Python.
