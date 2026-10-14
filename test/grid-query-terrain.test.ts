import { expect, it } from 'vitest';
import { Group, MeshStandardMaterial, WebGLRenderer } from 'three';
import { Scope } from '../src/engine/app/scope';
import { clientMaterials } from '../src/game/shardfile/clientMaterials';
import { clientTileViews } from '../src/game/shardfile/clientViews';
import driftwood from '../src/shards/driftwood-isle/shard.config';
import nalati from '../src/shards/nalati-grasslands/shard.config';
import sky from '../src/shards/far-reach/shard.config';
import signal from '../src/shards/sunscar-dunes/shard.config';
import pine from '../src/shards/pine-hollow/shard.config';

for (const source of [driftwood, nalati]) {
  it(`${source.identity.slug}: admits query-only ground without an unused terrain material`, async () => {
    const scope = new Scope('grid-query-terrain'), renderer: unknown = Object.create(WebGLRenderer.prototype);
    if (!(renderer instanceof WebGLRenderer)) throw new Error('Missing renderer');
    try {
      const presentation = await clientMaterials(source, new Map(), renderer, scope, { graphs: false });
      expect(source.terrain?.form).toBe('query');
      expect(source.terrain?.tiles).toHaveLength(0);
      if (source.terrain === null) throw new Error('Missing query declaration');
      expect(presentation.materials.has(source.terrain.family)).toBe(false);
      expect(() => clientTileViews({ terrain: source.terrain, ...presentation })).not.toThrow();
    } finally { scope.dispose(); }
  });
}

it('still refuses unresolved rendered declarations and legacy family strings', () => {
  const terrain = driftwood.terrain;
  if (terrain === null) throw new Error('Missing terrain declaration');
  expect(() => clientTileViews({ terrain: { ...terrain, form: 'render' }, materials: new Map(), textures: new Map() }))
    .toThrow('terrain family has no resolved material');
  expect(() => clientTileViews({ terrain: 'unresolved-rendered-ground', materials: new Map(), textures: new Map() }))
    .toThrow('terrain family has no resolved material');
});

for (const source of [sky, signal, pine]) {
  it(`${source.identity.slug}: retains declared terrain admission`, () => {
    const terrain = source.terrain;
    const material = new MeshStandardMaterial();
    try {
      const materials = new Map(terrain === null ? [] : [[terrain.family, material]]);
      expect(() => clientTileViews({ terrain, materials, textures: new Map() })).not.toThrow();
      if (terrain !== null && terrain.form !== 'query') {
        expect(() => clientTileViews({ terrain, materials: new Map(), textures: new Map() }))
          .toThrow('terrain family has no resolved material');
      }
    } finally { material.dispose(); }
  });
}

it('refuses drawing query-only terrain even when its family material exists', () => {
  const terrain = driftwood.terrain;
  if (terrain === null) throw new Error('Missing query terrain');
  const scope = new Scope('query-no-draw'), material = new MeshStandardMaterial();
  try {
    const views = clientTileViews({ terrain, materials: new Map([[terrain.family, material]]), textures: new Map() });
    expect(() => views.terrain(new Uint8Array(), new Group(), scope, true)).toThrow('a terrain tile in a shard without terrain');
  } finally { scope.dispose(); material.dispose(); }
});
