// src/engine/boot/shell.ts: index.html paints the loading panel from its first bytes and src/engine/ui/Loading.ts adopts it
// by its data-el hooks — the two copies of the markup must not drift apart.
import { describe, expect, it } from 'vitest';
import html from '../index.html?raw';
import { loadShellHtml } from '../src/engine/boot/shell';

const FONT_FILES = import.meta.glob('../public/fonts/*.woff2');
expect(Object.keys(FONT_FILES).length).toBeGreaterThan(0);
const fonts = new Set(Object.keys(FONT_FILES).map((k) => k.replace('../public', '')));

describe('loading shell', () => {
  it('index.html carries loadShellHtml() verbatim inside .ws-load[data-shell]', () => {
    expect(html).toContain(`<div class="ws-load" data-shell>${loadShellHtml()}</div>`);
  });

  it('has every hook Loading reads', () => {
    for (const key of ['slug', 'tier', 'clock', 'dlFact', 'dlPct', 'dlBar', 'suFact', 'suPct', 'suBar', 'rows', 'foot', 'bar', 'line', 'diagnostics']) {
      expect(loadShellHtml()).toContain(`data-el="${key}"`);
    }
  });

  it('loads its fonts from public/fonts, not a third-party origin', () => {
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    const urls = [...html.matchAll(/(?:url\(|href=")(\/fonts\/[\w-]+\.woff2)/g)].map((m) => m[1] ?? '');
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(fonts.has(u), u).toBe(true);
  });
});
