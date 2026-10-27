import * as v from 'valibot';
import { nameBlob, type NamedBlob } from '../../src/sdk/blobs';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
import { SceneDressingSchema, type SceneDressingRows } from '../../src/format/sceneDressing';
import pins from './nalati-cover-files.json' with { type: 'json' };

/** Admit both complete original cover banks before restoring only their source
 * provenance and named-file transport for the unchanged full-scene oracle. */
export function originalDressingCoverTransport(blobs: readonly NamedBlob[], originals: ReadonlyMap<string, SceneDressingRows>): NamedBlob[] {
  const files = new Map(blobs.map(blob => [blob.file.name, blob])), used = new Set<string>();
  if (files.size !== blobs.length) throw new Error('Duplicate cover transport file');
  const output = blobs.map(blob => {
    const name = blob.file.name, before = name === undefined ? undefined : originals.get(name);
    if (before === undefined) return blob;
    const tier = name === 'world/dressing-phone.json' ? 'phone' : name === 'world/dressing-desktop.json' ? 'desktop' : undefined;
    if (tier === undefined) throw new Error('Unknown original cover scene');
    const scene = v.parse(SceneDressingSchema, JSON.parse(new TextDecoder().decode(blob.bytes)));
    const pack = scene.packs['cover'], oldPack = before.packs['cover'];
    const catalogue = scene.catalogues.find(row => 'pack' in row && row.pack === 'cover');
    const oldCatalogue = before.catalogues.find(row => 'pack' in row && row.pack === 'cover');
    if (pack === undefined || oldPack === undefined || catalogue === undefined || oldCatalogue === undefined
      || typeof oldPack.rows.bin !== 'string' || typeof pack.rows.bin === 'string') throw new Error('Missing original cover transport');
    const file = `models/cover-${tier}.bin`, loan = files.get(file);
    const pin = Object.entries(pins).find(([path]) => path === `public${oldPack.rows.bin}`)?.[1];
    if (loan === undefined || pin === undefined || pack.rows.bin.file !== file || pack.rows.bin.bytes !== pin.bytes
      || loan.bytes.byteLength !== pin.bytes || loan.file.compressed !== pin.bytes || loan.file.hash !== pin.hash
      || hashImmutableBytes(loan.bytes) !== pin.hash || loan.file.decoded !== oldPack.rows.bytes) {
      throw new Error('Original complete cover bank differs');
    }
    pack.rows.bin = oldPack.rows.bin;
    if (encodeCanonicalJson(pack) !== encodeCanonicalJson(oldPack) || catalogue.rows.length !== oldCatalogue.rows.length) {
      throw new Error('Original cover pack metadata differs');
    }
    for (const [index, row] of catalogue.rows.entries()) {
      const old = oldCatalogue.rows[index];
      if (old === undefined || row.model.file !== old.model.file.replace('/bake-cover.mjs', '/coverBake.mjs')) {
        throw new Error('Original cover source provenance differs');
      }
      row.model.file = old.model.file;
      if (encodeCanonicalJson(row) !== encodeCanonicalJson(old)) throw new Error('Original cover catalogue row differs');
    }
    used.add(file);
    return nameBlob(name ?? '', 'json', new TextEncoder().encode(encodeCanonicalJson(scene)),
      blob.file.jsonSchema === undefined ? {} : { jsonSchema: blob.file.jsonSchema });
  });
  if (used.size !== 2 || blobs.some(blob => /^models\/cover-(?:phone|desktop)\.bin$/u.test(blob.file.name ?? '') && !used.has(blob.file.name ?? ''))) {
    throw new Error('Unvisited original cover bank');
  }
  return output;
}
