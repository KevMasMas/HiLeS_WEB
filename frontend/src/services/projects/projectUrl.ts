export const PROJECT_ID_POR_DEFECTO = 'default';
export const MIN_PROJECT_ID_LENGTH = 3;
export const MAX_PROJECT_ID_LENGTH = 48;

export interface ParametrosUrlProyecto {
  projectId: string;
  tieneProjectExplicito: boolean;
  modeloId: string | null;
  version: number | null;
  parametrosExtra: Record<string, string>;
}

/**
 * Verifica si un identificador de proyecto cumple el formato normativo v2:
 * `^[a-z0-9][a-z0-9_-]{2,47}$` (entre 3 y 48 caracteres, minúsculas ASCII, dígitos, `-` y `_`).
 */
export function esProjectIdValido(projectId: unknown): projectId is string {
  if (typeof projectId !== 'string') return false;
  const limpio = projectId.trim();
  if (
    limpio.length < MIN_PROJECT_ID_LENGTH ||
    limpio.length > MAX_PROJECT_ID_LENGTH
  ) {
    return false;
  }
  return /^[a-z0-9][a-z0-9_-]{2,47}$/.test(limpio);
}

/**
 * Normaliza cualquier cadena a un `projectId` seguro para URLs y topics MQTT.
 */
export function normalizarProjectId(
  rawId: unknown,
  fallback: string = PROJECT_ID_POR_DEFECTO,
): string {
  if (typeof rawId !== 'string') return fallback;
  const limpio = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_PROJECT_ID_LENGTH);
  return esProjectIdValido(limpio) ? limpio : fallback;
}

/**
 * Genera un identificador de proyecto único y válido con el prefijo indicado.
 */
export function generarProjectId(prefijo: string = 'proyecto'): string {
  const base = prefijo
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'proyecto';
  const sufijo = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return normalizarProjectId(`${base}-${sufijo}`);
}

function extraerSearchParams(
  entrada?: string | URL | { search?: string; href?: string },
): URLSearchParams {
  if (!entrada) {
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }
  if (entrada instanceof URL) {
    return new URLSearchParams(entrada.search);
  }
  if (typeof entrada === 'string') {
    const recortada = entrada.trim();
    if (recortada.startsWith('http://') || recortada.startsWith('https://')) {
      return new URL(recortada).searchParams;
    }
    const idxInterrogacion = recortada.indexOf('?');
    const query =
      idxInterrogacion >= 0 ? recortada.slice(idxInterrogacion + 1) : recortada;
    return new URLSearchParams(query);
  }
  if (typeof entrada.search === 'string') {
    return new URLSearchParams(entrada.search);
  }
  return new URLSearchParams();
}

/**
 * Extrae el parámetro `?project=<project_id>` si está presente y es válido;
 * retorna `null` si no existe o no cumple el patrón normativo.
 */
export function obtenerProjectIdDeSearch(
  entrada?: string | URL | { search?: string; href?: string },
): string | null {
  const params = extraerSearchParams(entrada);
  const rawProject = params.get('project') ?? params.get('proyecto');
  if (!rawProject) return null;
  const limpio = rawProject.trim();
  return esProjectIdValido(limpio) ? limpio : null;
}

/**
 * Construye una URL compartible con `?project=<project_id>` conservando los demás query params.
 */
export function construirUrlCompartibleProyecto(
  projectId: string,
  urlActual?: string | URL,
): string {
  const base =
    urlActual ??
    (typeof window !== 'undefined' && window.location
      ? window.location.href
      : 'https://hiles.local/');
  return construirUrlProyecto(base, {
    projectId: normalizarProjectId(projectId),
  });
}

/**
 * Asegura que la barra de direcciones contenga `?project=<project_id>` usando `history.replaceState`
 * sin recargar la página ni perder otros parámetros (`?modelo`, `?version`, etc.).
 */
export function asegurarProjectIdEnUrl(
  projectIdPreferido?: string | null,
  entorno?: {
    location?: Pick<Location, 'search' | 'href'>;
    history?: Pick<History, 'state' | 'replaceState'>;
  },
): string {
  const loc =
    entorno?.location ??
    (typeof window !== 'undefined' ? window.location : undefined);
  const hist =
    entorno?.history ??
    (typeof window !== 'undefined' ? window.history : undefined);

  const existente = loc ? obtenerProjectIdDeSearch(loc) : null;
  const elegido =
    projectIdPreferido && esProjectIdValido(projectIdPreferido.trim())
      ? projectIdPreferido.trim()
      : projectIdPreferido
        ? normalizarProjectId(projectIdPreferido, existente ?? generarProjectId())
        : existente ?? generarProjectId();

  if (loc && hist) {
    const nuevaUrl = construirUrlCompartibleProyecto(
      elegido,
      loc.href || 'https://hiles.local/',
    );
    hist.replaceState(hist.state ?? null, '', nuevaUrl);
  }

  return elegido;
}

/**
 * Lee `?project=<id>` de una URL o query string conservando íntegramente
 * la lectura de `?modelo=<id>` y `?version=<n>`.
 */
export function leerParametrosUrlProyecto(
  entrada?: string | URL | { search?: string; href?: string },
): ParametrosUrlProyecto {
  const params = extraerSearchParams(entrada);
  const rawProject = params.get('project') ?? params.get('proyecto');
  const rawModelo = params.get('modelo');
  const rawVersion = params.get('version');

  const modeloId =
    rawModelo && rawModelo.trim() !== '' ? rawModelo.trim() : null;

  let version: number | null = null;
  if (rawVersion !== null && rawVersion.trim() !== '') {
    const parsed = Number.parseInt(rawVersion.trim(), 10);
    if (Number.isInteger(parsed) && parsed >= 1) {
      version = parsed;
    }
  }

  const tieneProjectExplicito =
    rawProject !== null && rawProject.trim() !== '';
  const projectId = tieneProjectExplicito
    ? normalizarProjectId(rawProject)
    : modeloId
      ? normalizarProjectId(modeloId)
      : PROJECT_ID_POR_DEFECTO;

  const parametrosExtra: Record<string, string> = {};
  params.forEach((valor, clave) => {
    if (
      clave !== 'project' &&
      clave !== 'proyecto' &&
      clave !== 'modelo' &&
      clave !== 'version'
    ) {
      parametrosExtra[clave] = valor;
    }
  });

  return {
    projectId,
    tieneProjectExplicito,
    modeloId,
    version,
    parametrosExtra,
  };
}

/**
 * Construye una URL o query string estableciendo `?project=<id>` sin perder
 * `?modelo=<id>`, `?version=<n>` ni otros parámetros existentes.
 */
export function construirUrlProyecto(
  base: string | URL = '',
  opciones: {
    projectId?: string | null;
    modeloId?: string | null;
    version?: number | null;
  } = {},
): string {
  const esUrlCompleta =
    base instanceof URL ||
    (typeof base === 'string' &&
      (base.startsWith('http://') || base.startsWith('https://')));

  const urlObj = esUrlCompleta
    ? new URL(base.toString())
    : new URL(
        typeof base === 'string' && base.startsWith('/')
          ? `https://hiles.local${base}`
          : `https://hiles.local/${
              typeof base === 'string' && base.startsWith('?')
                ? base
                : typeof base === 'string' && base.length > 0
                  ? `?${base}`
                  : ''
            }`,
      );

  const params = urlObj.searchParams;

  if (opciones.projectId !== undefined) {
    if (opciones.projectId === null || opciones.projectId.trim() === '') {
      params.delete('project');
    } else {
      params.set('project', normalizarProjectId(opciones.projectId));
    }
  }

  if (opciones.modeloId !== undefined) {
    if (opciones.modeloId === null || opciones.modeloId.trim() === '') {
      params.delete('modelo');
    } else {
      params.set('modelo', opciones.modeloId.trim());
    }
  }

  if (opciones.version !== undefined) {
    if (
      opciones.version === null ||
      !Number.isInteger(opciones.version) ||
      opciones.version < 1
    ) {
      params.delete('version');
    } else {
      params.set('version', String(opciones.version));
    }
  }

  if (esUrlCompleta) {
    return urlObj.toString();
  }

  const queryStr = params.toString();
  if (typeof base === 'string' && base.startsWith('/')) {
    return `${urlObj.pathname}${queryStr ? `?${queryStr}` : ''}${urlObj.hash}`;
  }
  return queryStr ? `?${queryStr}` : '';
}

/**
 * Actualiza `?project=<id>` en `window.history` sin recargar la página ni romper
 * `?modelo` o `?version`.
 */
export function sincronizarProjectEnHistory(
  projectId: string,
  opciones: { reemplazar?: boolean } = {},
): string | null {
  if (typeof window === 'undefined' || !window.location || !window.history) {
    return null;
  }
  const nuevaUrl = construirUrlProyecto(window.location.href, { projectId });
  if (opciones.reemplazar ?? true) {
    window.history.replaceState(window.history.state, '', nuevaUrl);
  } else {
    window.history.pushState(window.history.state, '', nuevaUrl);
  }
  return nuevaUrl;
}
