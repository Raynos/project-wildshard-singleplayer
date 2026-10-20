/**
 * G532: the entry road deck as a specimen catalogue row (boot/modelCatalogue.generated.json, bake-specimens.mjs): one inline
 * draw per baked deck (entryDeckGeometry.ts) on the kit's still material, selected by its `deck`: the world's four entries
 * share `world`, the Explorer shows `deep` and `shallow`. Only the specimen catalogue job imports this file.
 */
import type * as THREE from 'three';
import { zlibSync } from 'fflate';
import * as v from 'valibot';
import { SpecimenCatalogueSchema } from '@wildshard/format/specimenCatalogue';
import { entryDeckGeometries } from './entryDeckGeometry';

const inline = (geometry: THREE.BufferGeometry) => {
  const attrs = Object.entries(geometry.attributes).map(([name, attribute]) => [name, 'f32', attribute.itemSize, attribute.normalized] as const);
  const lanes = Object.values(geometry.attributes).map(attribute => new Uint8Array(Float32Array.from(attribute.array).buffer));
  const bytes = new Uint8Array(lanes.reduce((sum, lane) => sum + lane.length, 0));
  lanes.reduce((at, lane) => { bytes.set(lane, at); return at + lane.length; }, 0);
  return { data: btoa(Array.from(zlibSync(bytes), byte => String.fromCodePoint(byte)).join('')),
    geometry: { attrs, count: geometry.getAttribute('position').count, index: null, indexCount: 0, box: true, expand: false } };
};

export function entryDeckSpecimen(): v.InferOutput<typeof SpecimenCatalogueSchema>[number] {
  const decks = entryDeckGeometries(), material = { id: 'driftwood-entry-deck', family: 'lowpoly', variant: 'still' } as const;
  const select = (deck: keyof typeof decks) => ({ params: { deck }, source: { kind: 'inline', representation: 'parts', ...inline(decks[deck]), material } });
  const [row] = v.parse(SpecimenCatalogueSchema, [{ key: 'entryDeck', model: { id: 'driftwood-isle/entry-deck', name: 'Entry road deck', category: 'buildings', pipeline: 'code',
    file: 'src/shards/driftwood-isle/generators/entryDeckSpecimen.ts', surface: 'stone', defaults: { deck: 'deep' },
    variants: [{ id: 'deep', label: 'Over deep water', params: {} }, { id: 'shallow', label: 'Over the shallows', params: { deck: 'shallow' } }], seed: 0xdec4 },
  source: { kind: 'selection', variants: [select('deep'), select('shallow'), select('world')] } }]);
  if (row === undefined) throw new Error('Missing entry deck row');
  return row;
}
