import { bakeProps } from '@wildshard/sdk/bake/props';
import { canonicalJson } from '@wildshard/sdk/project';
import { inkProps } from './props';
import { inkTerrain } from './terrain';

/**
 * Build-time only: the ink valley's terrain (bound to `ground`) and props (bound to `rock`) as their declaration files
 * and content-addressed bytes, keyed by project-relative path; `scripts/bake/ink-cel-valley.mjs` writes them.
 */
export function bakeInk(): Map<string, string | Uint8Array> {
  const out = new Map<string, string | Uint8Array>(), fixture = inkProps(20);
  try {
    const { assets: terrainAssets, ...terrain } = inkTerrain(), props = bakeProps(fixture.source);
    for (const [hash, bytes] of [...terrainAssets, ...props.assets]) out.set(`assets/${hash}`, bytes);
    out.set('data/terrain.json', `${JSON.stringify(terrain, null, 2)}\n`);
    out.set('data/props.json', canonicalJson({ props: props.props, tiles: props.tiles, files: props.files, library: props.library, far: props.far, report: props.report }));
    return out;
  } finally { fixture.dispose(); }
}
