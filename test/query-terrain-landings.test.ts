import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { encodeTerrainTile } from '@wildshard/format/terrainTileBytes';
import { validateSocketLandings } from '@wildshard/format/entryLanding';
import type { ShardProps } from '@wildshard/format/props';

const base = emptyShardfile({ slug: 'query-landings', name: 'Query landings', author: 'Test', seed: 123, revision: 1 });
const entries = base.entryways.map(({ edge, at, width }) => ({ edge, at, width, kind: 'socketOverWater' as const }));
const ref = 'a'.repeat(64);
function props(): ShardProps {
  return { version: 1, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [],
    colliders: entries.map(({ edge }) => ({ id: `landing.${edge}`, panel: null, initialActive: true,
      shapes: [{ kind: 'box', x: edge === 'east' ? 233 : edge === 'west' ? -233 : 0,
        z: edge === 'north' ? 233 : edge === 'south' ? -233 : 0,
        y: -0.1, hy: 0.1, hx: edge === 'east' || edge === 'west' ? 2 : 4,
        hz: edge === 'east' || edge === 'west' ? 4 : 2 }] })) };
}
const flat = (resolution: 256 | 257, height = 0): Map<string, Uint8Array> => new Map([[ref,
  encodeTerrainTile({ resolution, x: -250, z: -250, size: 500, heights: new Float32Array(resolution ** 2).fill(height) })]]);

it('never lets zero-height query samples substitute for a collision landing', () => {
  const source = { entryways: entries, terrain: { form: 'query' as const, collider: ref }, props: null };
  expect(() => validateSocketLandings(source, flat(256))).toThrow(/full-width collision landing/u);
  expect(() => validateSocketLandings(source, new Map())).toThrow(/full-width collision landing/u);
});

it('retains every socket refusal with query terrain and requires real permanent full-width road-height collision', () => {
  const source = { entryways: entries, terrain: { form: 'query' as const, collider: ref }, props: props() };
  const assets = flat(256);
  expect(() => validateSocketLandings(source, assets)).not.toThrow();
  for (let socket = 0; socket < 4; socket++) {
    for (const refusal of ['missing', 'narrow', 'proud', 'inactive', 'panel'] as const) {
      const changed = props(); const row = changed.colliders[socket];
      if (row === undefined) throw new Error('Missing socket fixture');
      if (refusal === 'missing') changed.colliders.splice(socket, 1);
      else if (refusal === 'inactive') row.initialActive = false;
      else if (refusal === 'panel') row.panel = 'hidden';
      else {
        const box = row.shapes[0]; if (box?.kind !== 'box') throw new Error('Missing box fixture');
        if (refusal === 'proud') box.y += 0.01;
        else if (entries[socket]?.edge === 'north' || entries[socket]?.edge === 'south') box.x += 0.5; else box.z += 0.5;
      }
      expect(() => validateSocketLandings({ ...source, props: changed }, assets), `${socket}:${refusal}`).toThrow(/full-width collision landing/u);
    }
  }
});

it('keeps omitted and explicit rendered terrain collision landings unchanged', () => {
  for (const terrain of [{ collider: ref }, { form: 'render' as const, collider: ref }]) {
    const source = { entryways: entries, terrain, props: null };
    expect(() => validateSocketLandings(source, flat(257))).not.toThrow();
    expect(() => validateSocketLandings(source, flat(257, -1))).toThrow(/full-width collision landing/u);
    expect(() => validateSocketLandings({ ...source, props: props() }, flat(257, -1))).not.toThrow();
    expect(() => validateSocketLandings(source, new Map())).toThrow(/Missing socket landing terrain/u);
  }
});
