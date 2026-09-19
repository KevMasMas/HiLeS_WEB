# HiLeS Web

Editor web para modelar circuitos HiLeS y ejecutar una demostración inicial conectada a un backend NestJS.

## Estructura

```text
HiLeS_WEB/
├── backend/                    API NestJS + Prisma + motor de simulación
├── frontend/                   React + Vite + editor visual HiLeS
└── entregas/
    └── entrega-2-18-septiembre/  Plan, criterios y registro de la entrega
```

Documentos de la entrega actual:

- [Plan de trabajo](entregas/entrega-2-18-septiembre/PLAN_PRESENTACION_MANANA.md)
- [Registro de cambios](entregas/entrega-2-18-septiembre/REGISTRO_CAMBIOS_PRESENTACION.md)

## Requisitos previos

Instalar antes de clonar o ejecutar el proyecto:

1. [Git](https://git-scm.com/) 2.40 o superior.
2. Node.js 22 LTS y npm. Verificar con:

   ```powershell
   node --version
   npm --version
   ```

3. PostgreSQL 16 o compatible, encendido y accesible localmente.
4. Una base de datos llamada `hiles`. El ejemplo usa el puerto `5433`; si tu PostgreSQL usa el puerto estándar `5432`, se debe cambiar en `backend/.env`.
5. Identidad de Git configurada para poder hacer commits:

   ```powershell
   git config --global user.name "Tu Nombre"
   git config --global user.email "tu-correo@ejemplo.com"
   ```

No subir `node_modules`, `dist`, archivos `.env`, contraseñas ni claves al repositorio.

## Traer el proyecto desde cero

Reemplaza `<URL_DEL_REPOSITORIO>` por la URL real del remoto:

```powershell
git clone <URL_DEL_REPOSITORIO> HiLeS_WEB
cd HiLeS_WEB
git status
```

Si el proyecto ya está clonado, antes de empezar cualquier tarea:

```powershell
git status
git switch main
git pull --ff-only origin main
```

Si `git status` muestra archivos modificados que no son tuyos, no los borres ni ejecutes `git reset`. Consulta primero con el responsable de esos cambios.

> El repositorio tiene dos proyectos Node independientes. Por eso `npm ci` se ejecuta una vez dentro de `backend` y otra dentro de `frontend`; no se ejecuta en la raíz.

## Configurar base de datos y backend

El backend debe iniciarse primero, porque el frontend redirige las peticiones `/api` hacia él.

1. Crear la base de datos si todavía no existe. Puedes hacerlo desde pgAdmin o mediante PostgreSQL:

   ```sql
   CREATE DATABASE hiles;
   ```

2. Ir al backend e instalar las dependencias exactas del `package-lock.json`:

   ```powershell
   cd backend
   npm ci
   ```

3. Crear el archivo local de configuración y editar la URL con tus credenciales. Nunca comitear este archivo:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

   Ejemplo para PostgreSQL local en el puerto 5433:

   ```env
   DATABASE_URL="postgresql://postgres:TU_CONTRASENA@localhost:5433/hiles?schema=public"
   ```

4. Generar el cliente Prisma y aplicar las migraciones ya incluidas:

   ```powershell
   npm run prisma:generate
   npx prisma migrate deploy
   ```

   > `npm run prisma:generate` es obligatorio aunque no vayas a usar la base de datos: sin el cliente generado el backend no compila y `npm run start:dev` falla con `Cannot find module '../../generated/prisma/client.js'`.

5. Iniciar el backend en modo desarrollo. Por defecto queda disponible en `http://localhost:3000`:

   ```powershell
   npm run start:dev
   ```

Mantén esta terminal abierta mientras trabajas. Si el backend no inicia, revisa primero que PostgreSQL esté encendido y que `DATABASE_URL` sea correcta.

### Sólo para la demostración del circuito

El circuito demo no toca la base de datos: su estado vive en memoria dentro del backend. Para probarlo basta con un `.env` que tenga cualquier `DATABASE_URL` con formato válido, `npm run prisma:generate` y `npm run start:dev`; no hace falta que PostgreSQL esté encendido ni ejecutar `npx prisma migrate deploy`. Esos dos pasos sí son necesarios para el resto del backend.

## Configurar e iniciar el frontend

Abrir una segunda terminal desde la raíz del repositorio:

```powershell
cd frontend
npm ci
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`. Ábrela en el navegador sólo después de tener el backend encendido.

Para probar el circuito demo:

1. Pulsar **Cargar circuito demo**.
2. Pulsar **Enviar 1**: el token pasa de `Espera` a `Activo` y la salida queda `ON`.
3. Pulsar **Enviar 0**: el token vuelve a `Espera` y la salida queda `OFF`.

## Validaciones antes de entregar

En una tercera terminal, o deteniendo antes los servidores si es necesario:

```powershell
# Backend
cd backend
npm test
npm run lint
npm run build

# Frontend
cd ../frontend
npm run lint
npm run build
```

Además de los comandos, se debe completar el checklist de la entrega y probar manualmente el circuito desde un lienzo vacío.

## Flujo Git obligatorio

No se trabaja directamente sobre `main`.

### Crear la rama de la entrega

Desde la raíz del proyecto, y después de actualizar `main`:

```powershell
git switch main
git pull --ff-only origin main
git switch -c presentacion-circuito
```

Si la rama ya existe localmente:

```powershell
git switch presentacion-circuito
git pull --ff-only origin presentacion-circuito
```

Si ya existe en el remoto pero todavía no aparece localmente:

```powershell
git fetch origin
git switch --track origin/presentacion-circuito
```

### Trabajar y revisar cambios

Antes de modificar archivos:

```powershell
git status
```

Después de una unidad de trabajo terminada:

```powershell
git diff
git status
```

Registrar la tarea y la prueba en `entregas/entrega-2-18-septiembre/REGISTRO_CAMBIOS_PRESENTACION.md` antes de solicitar revisión.

### Commit y push

Agregar sólo los archivos de la tarea; evitar `git add .` si hay cambios ajenos en el directorio:

```powershell
git add ruta/del/archivo1 ruta/del/archivo2
git commit -m "fix: descripcion corta y verificable"
git push -u origin presentacion-circuito
```

Los siguientes pushes de la misma rama se hacen con:

```powershell
git push
```

El encargado de pruebas debe recibir el hash del commit, evidencia y el registro actualizado. Sólo después de aprobar el checklist se solicita revisión y se hace merge de `presentacion-circuito` a `main`.

## Resolver cambios remotos en la rama de entrega

Antes de subir cambios propios, traer los cambios que otro integrante ya haya subido a la misma rama:

```powershell
git pull --ff-only origin presentacion-circuito
```

Si Git indica que no puede avanzar de forma lineal, no fuerces un push ni uses `reset`. Coordina con el equipo, revisa los cambios y resuelve el conflicto en la rama de entrega antes de continuar.

## Comandos útiles

```powershell
# Estado del repositorio y rama actual
git status
git branch --show-current

# Restaurar dependencias exactas tras cambiar de equipo o clonar de cero
npm ci

# Abrir Prisma Studio, opcional
cd backend
npx prisma studio
```
