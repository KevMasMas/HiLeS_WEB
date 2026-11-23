import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlaceTokenView, StaleRuntimeBadge } from './PlaceTokenView';
import { describirMarcajePlace, esRuntimeObsoleto } from './nodeRuntimeView';

describe('Place multi-token and stale runtime visualization', () => {
  it('renders nothing when Place has 0 tokens', () => {
    expect(describirMarcajePlace(0)).toMatchObject({
      cantidad: 0,
      visible: false,
      modo: 'vacio',
      etiquetaContador: null,
    });
    expect(renderToStaticMarkup(<PlaceTokenView tokens={0} />)).toBe('');
  });

  it('renders a single central dot without counter badge for 1 token', () => {
    expect(describirMarcajePlace(1)).toMatchObject({
      cantidad: 1,
      visible: true,
      modo: 'unico',
      etiquetaContador: null,
    });
    const html = renderToStaticMarkup(<PlaceTokenView tokens={1} />);
    expect(html).toContain('aria-label="1 token"');
    expect(html).not.toContain('hiles-place-token-count');
  });

  it('renders arranged dots and ×3 badge for small multi-token counts', () => {
    const descripcion = describirMarcajePlace(3);
    expect(descripcion.modo).toBe('multiple_puntos');
    expect(descripcion.puntos).toHaveLength(3);
    expect(descripcion.etiquetaContador).toBe('×3');

    const html = renderToStaticMarkup(<PlaceTokenView tokens={3} />);
    expect(html).toContain('aria-label="3 tokens"');
    expect(html).toContain('>×3<');
    expect((html.match(/hiles-place-token is-compact/g) ?? []).length).toBe(3);
  });

  it('renders compact token core and ×12 badge for high token counts without overcrowding', () => {
    const descripcion = describirMarcajePlace(12);
    expect(descripcion.modo).toBe('contador');
    expect(descripcion.puntos).toHaveLength(1);
    expect(descripcion.etiquetaContador).toBe('×12');

    const html = renderToStaticMarkup(<PlaceTokenView tokens={12} />);
    expect(html).toContain('aria-label="12 tokens"');
    expect(html).toContain('>×12<');
  });

  it('marks stale tokens and elements distinctly when their executor goes offline', () => {
    expect(esRuntimeObsoleto(undefined)).toBe(false);
    expect(esRuntimeObsoleto({ tokens: 2 })).toBe(false);
    expect(esRuntimeObsoleto({ tokens: 2, stale: true })).toBe(true);

    const htmlTokens = renderToStaticMarkup(<PlaceTokenView tokens={2} stale />);
    expect(htmlTokens).toContain('is-stale');
    expect(htmlTokens).toContain('estado obsoleto');

    const htmlBadge = renderToStaticMarkup(<StaleRuntimeBadge />);
    expect(htmlBadge).toContain('Obsoleto');
  });
});
