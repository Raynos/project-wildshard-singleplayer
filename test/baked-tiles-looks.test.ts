import { expect, test, vi } from 'vitest';
import { MeshBasicMaterial, Texture } from 'three';
import { Scope } from '../src/engine/app/scope';
import { ToonLook } from '../src/engine/render/families/toon';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import * as lookCompiler from '../src/game/shardfile/runtimeProduct';
import { lendLooks, lentLook, setLentTexture, type LentLooks } from '../src/game/shardfile/lentLooks';
import { lendBakedLooks } from '../src/game/shardfile/bakedTiles';
import { parseFamilyMaterial } from '../src/format/materialFamilies';
import type { BakedTilesRow } from '../src/format/bakedTiles';

const lend = (id: string, material: MeshBasicMaterial, setTexture: LentLooks['setTexture']): Awaited<ReturnType<typeof lookCompiler.runtimeLookMaterials>> => ({
  materials: new Map([[id, material]]), setParam: () => undefined, setTexture, bindMeshMap: () => material,
  toon: new ToonLook(), textures: new Map<string, never>(), compile: () => material, tick: () => undefined, outline: () => [], surfaces: null,
  graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } },
});

// A data client may lend a graph look's presentation fallback first (graphs off): it takes no lent textures. The baked
// tiles host lends its own graph-compiled looks for its resident, so its lightmaps never reach the fallback (G532).
test('baked tiles lend their graph looks over an earlier presentation fallback', async () => {
  const source = emptyShardfile({ slug: 'fixture-orchard', name: 'Orchard', author: 'Fixture', revision: 1, seed: 3 });
  source.look.materials['orchard-ground'] = parseFamilyMaterial({ family: 'pbr' });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('No fixture blob')) });
  const presentation = new Scope('presentation'), resident = new Scope('resident'), fallback = new MeshBasicMaterial(), compiled = new MeshBasicMaterial();
  const lent: string[] = [];
  lendLooks(presentation, lend('orchard-ground', fallback, () => { throw new Error('Material has no compiled graph textures'); }));
  const compile = vi.spyOn(lookCompiler, 'runtimeLookMaterials').mockResolvedValue(lend('orchard-ground', compiled, (_id, name) => { lent.push(name); }));
  const row = { look: 'orchard-ground', instances: null } as const satisfies Pick<BakedTilesRow, 'look' | 'instances'>;
  try {
    await lendBakedLooks({ game: {} as never, product }, [row as BakedTilesRow], resident);
    expect(compile).toHaveBeenCalledWith(expect.objectContaining({ scope: resident }), source, true, ['orchard-ground']);
    expect(lentLook('orchard-ground')).toBe(compiled);
    setLentTexture('orchard-ground', 'ao', new Texture());
    expect(lent).toEqual(['ao']);
    resident.dispose();
    expect(lentLook('orchard-ground')).toBe(fallback);
  } finally { compile.mockRestore(); presentation.dispose(); resident.dispose(); fallback.dispose(); compiled.dispose(); }
});
