import { unzlibSync } from 'fflate';
import { SceneDressingSchema, type SceneDressingRows } from '../../src/format/sceneDressing';
import { nameBlob, type NamedBlob } from '../../src/sdk/blobs';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
import * as v from 'valibot';

/** Verify the complete selected phone lanes against the pinned full bank before
 * restoring only its transport name and the two declared catalogue schedules.
 * All original scene fields and full-wire assertions remain the final oracle. */
export function originalDressingEntryTransport(blobs: readonly NamedBlob[], originals: ReadonlyMap<string, SceneDressingRows>,
  original: { readonly bytes: Uint8Array; readonly hash: string }, phoneDecoded: number): NamedBlob[] {
  if (hashImmutableBytes(original.bytes) !== original.hash) throw new Error('Original complete crag bank differs');
  const phones = blobs.filter(blob => blob.file.name === 'world/crags-phone.bin'), phone = phones[0];
  if (phones.length !== 1 || phone === undefined || phone.file.decoded !== phoneDecoded || phone.file.compressed !== phone.bytes.byteLength
    || phone.file.hash !== hashImmutableBytes(phone.bytes)) throw new Error('Selected phone crag bank differs');
  const all = unzlibSync(original.bytes), selected = unzlibSync(phone.bytes);
  if (selected.byteLength !== phoneDecoded || all.length % 4 !== 0 || phoneDecoded % 4 !== 0 || phoneDecoded > all.length) throw new Error('Selected phone crag span differs');
  for (let lane = 0; lane < 4; lane++) {
    const start = lane * all.length / 4, part = selected.subarray(lane * phoneDecoded / 4, (lane + 1) * phoneDecoded / 4);
    if (!part.every((byte, index) => byte === all[start + index])) throw new Error('Selected phone crag words differ');
  }
  let changed = 0, schedules = 0;
  const result = blobs.map(blob => {
    const name = blob.file.name, before = name === undefined ? undefined : originals.get(name);
    if (before === undefined) return blob;
    const scene = v.parse(SceneDressingSchema, JSON.parse(new TextDecoder().decode(blob.bytes)));
    if (scene.catalogues.length !== before.catalogues.length) throw new Error('Original catalogue roster differs');
    for (const [index, book] of scene.catalogues.entries()) {
      if (book.load === undefined) continue;
      const previous = before.catalogues[index];
      const { load, ...body } = book;
      if (name !== 'world/dressing-phone.json' || previous === undefined || previous.load !== undefined || load !== 'after-control'
        || !(index === 0 && 'packed' in book || index === 2 && 'pack' in book && book.pack === 'cover')
        || encodeCanonicalJson(body) !== encodeCanonicalJson(previous)) throw new Error('Unproved catalogue scheduling change');
      delete book.load; schedules++;
    }
    for (const [key, geometry] of Object.entries(scene.geometry)) {
      if (geometry.kind !== 'baked-file' || geometry.file !== 'world/crags-phone.bin') continue;
      const previous = before.geometry[key];
      const { file: _file, ...body } = geometry;
      if (name !== 'world/dressing-phone.json' || previous?.kind !== 'baked-file' || previous.file !== 'world/crags.bin') throw new Error('Original phone crag row differs');
      const { file: _previousFile, ...expected } = previous;
      if (encodeCanonicalJson(body) !== encodeCanonicalJson(expected)) throw new Error('Original phone crag row differs');
      geometry.file = previous.file; changed++;
    }
    return nameBlob(name ?? '', 'json', new TextEncoder().encode(encodeCanonicalJson(scene)), blob.file.jsonSchema === undefined ? {} : { jsonSchema: blob.file.jsonSchema });
  });
  if (changed !== 4 || schedules !== 2) throw new Error('Incomplete phone crag or catalogue projection');
  return result;
}
