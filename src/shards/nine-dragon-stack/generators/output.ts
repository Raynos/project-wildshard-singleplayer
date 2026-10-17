import { MeshStandardMaterial } from 'three';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
import { WORDS } from '../data/words';
import glyphs from '../data/glyphs.generated.json' with { type: 'json' };
import { buildHalo } from './jianHalo';
import { buildViewmodelParts } from './viewmodelParts';
import { TALISMAN, TASSEL } from '../data/cloth';
import { buildSword } from './jianSupport';
import { buildJianFallback } from './jianFallback';
import { headlessConstants } from './headless';
import headlessAssembly from '../data/headlessAssembly.json' with { type: 'json' };

// JSON numbers erase -0; the numeric reviver restores its original float32 sign bit.
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'number' && Object.is(entry, -0) ? '-0' : entry));
const halo = buildHalo(), support = buildSword('wood'), fallback = buildJianFallback();
const material = new MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
material.name = 'sword';
/** Original float32 channels and material settings; the live halo shaders stay in fpArms. */
const viewmodel = buildViewmodelParts();
const glyphBlobs = Object.entries(glyphs).flatMap(([tier, row]) => [
    nameBlob(`signs/glyphs-${tier}.json`, 'json', json({ size: row.size, layout: row.layout, rects: row.rects, words: WORDS, parts: row.packed.length })),
  ].concat(row.packed.map((part, index) => nameBlob(`signs/glyphs-${tier}-${index}.rg8`, 'bin', Uint8Array.from(atob(part), byte => byte.codePointAt(0) ?? 0), { decoded: 2_097_152, gpu: Math.ceil(2_097_152 * 4 / 3) }))));
const emitted = emitNamedBlobs(glyphBlobs.concat([
  nameBlob('weapons/jian-cloth.json', 'json', json({ rows: { tassel: TASSEL, sheet: TALISMAN }, ...Object.fromEntries(Object.entries(viewmodel).map(([name, geometry], i) => [name, { ...geometry.toJSON(), uuid: `96d3a000-0000-4000-8000-00000000002${i}` }])) })),
  nameBlob('sim/headless-assembly.json', 'json', json(headlessAssembly)),
  nameBlob('sim/headless-constants.json', 'json', json(headlessConstants)),
  nameBlob('weapons/jian-row.json', 'json', json({ portraitFov: 78 })),
  nameBlob('weapons/jian-fallback.json', 'json', json({ ...fallback,
    ...Object.fromEntries(['sword', 'arms', 'guard', 'gauntlet'].map((key, i) => {
      const geometry = key === 'sword' ? fallback.sword : key === 'arms' ? fallback.arms : key === 'guard' ? fallback.guard : fallback.gauntlet;
      return [key, { ...geometry.toJSON(), uuid: `96d3a000-0000-4000-8000-00000000001${i}` }];
    })),
  })),
  nameBlob('weapons/jian-halo.json', 'json', json({ geometry: { ...halo.geo.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000001' }, material: { ...halo.mat.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000002' } })),
  nameBlob('weapons/jian-support.json', 'json', json({ sword: { ...support.sword.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000003' }, arms: { ...support.arms.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000004' }, tipY: support.tipY, baseY: support.baseY, material: { ...material.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000005' } })),
]));

export const output = { namedFiles: emitted.files, assets: emitted.assets };
