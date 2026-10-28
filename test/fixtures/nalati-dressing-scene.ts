import { zlibSync } from 'fflate';
import { dressingScene as scene, dressingSceneBlobs as blobs } from '../../src/shards/nalati-grasslands/generators/dressingScene';
import paint from './nalati-poi-paint-original.json' with { type: 'json' };
import { nalatiPredecessorCoverRows } from './nalati-cover';
import { nalatiCragRows } from './nalati-crags';
import { SceneDressingSchema, type SceneDressingRows } from '../../src/format/sceneDressing';
import { parse } from 'valibot';
import { nameBlob } from '../../src/sdk/blobs';
import { encodeCanonicalJson } from '../../src/sdk/immutable';

// Independent historical wire transport; production always publishes named byte loans.
const encoded = (raw: Uint8Array): string => {
  let text = ''; for (const byte of zlibSync(raw)) text += String.fromCodePoint(byte);
  return btoa(text);
};
/** Supply original paint/cover loans while retaining the actual defining producer provenance. */
export function currentDressingScene(tier: 'phone' | 'desktop', input: unknown, runtime: unknown, balbal: unknown, specimens: unknown): ReturnType<typeof scene> {
  return scene(tier, input, runtime, balbal, specimens, paint, nalatiPredecessorCoverRows, nalatiCragRows, {
    contact: raw => ({ data: encoded(raw) }), cloth: raw => ({ kind: 'inline', data: encoded(raw) }),
  });
}
/** The retired command path is a frozen before-control, never production provenance.
 * Only this one verified source pointer is reconstructed for the unchanged full-scene pins. */
function predecessorCragSource(rows: SceneDressingRows): SceneDressingRows {
  const models = rows.staticModels.filter(row => row.model.id === 'nalati-grasslands/crag-rock');
  const row = models[0];
  if (models.length !== 1 || row?.model.file !== 'src/shards/nalati-grasslands/generators/cragRockProgram.ts') throw new Error('Crag producer provenance differs');
  row.model.file = 'src/shards/nalati-grasslands/generators/bake-crag-rock.mjs';
  return rows;
}
/** Supply immutable predecessor inputs and the historical pointer to original complete-scene oracles. */
export function dressingScene(...args: Parameters<typeof currentDressingScene>): ReturnType<typeof scene> {
  return predecessorCragSource(currentDressingScene(...args));
}
/** Project only the verified defining crag source pointer for complete historical
 * scene comparisons. Production metadata and every other byte stay unchanged. */
export function originalDressingCragProvenance(input: readonly ReturnType<typeof nameBlob>[]): ReturnType<typeof blobs> {
  return input.map(blob => {
    const name = blob.file.name;
    if (name !== 'world/dressing-phone.json' && name !== 'world/dressing-desktop.json') return blob;
    const rows = predecessorCragSource(parse(SceneDressingSchema, JSON.parse(new TextDecoder().decode(blob.bytes))));
    return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(rows)), blob.file.jsonSchema === undefined ? {} : { jsonSchema: blob.file.jsonSchema });
  });
}

export function dressingSceneBlobs(input: unknown, runtime: unknown, balbal: unknown, specimens: unknown, cragFiles?: Readonly<Record<'phone'|'desktop',string>>): ReturnType<typeof blobs> {
  return originalDressingCragProvenance(blobs(input, runtime, balbal, specimens, paint, nalatiPredecessorCoverRows, nalatiCragRows, cragFiles));
}
