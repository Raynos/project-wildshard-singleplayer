/**
 * The entry road decks (G170; the catalogue row entryDeckSpecimen below), baked from their box rows (data/entryDeckBoxes.json): each box
 * merged non-indexed, its top face one colour and every other face another. Loaded as the fixed-model templates
 * `entry-deck-<world|deep|shallow>` through the shard's geometry intake.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { zlibSync } from 'fflate';
import * as v from 'valibot';
import { SpecimenCatalogueSchema } from '@wildshard/format/specimenCatalogue';
import rows from '../data/entryDeckBoxes.json' with { type: 'json' };
import deckRows from '../data/entryDecks.generated.json' with { type: 'json' };

function box([x0 = 0, x1 = 0, y0 = 0, y1 = 0, z0 = 0, z1 = 0, top = 0, sides = 0]: readonly number[]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).toNonIndexed().translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const normals = g.getAttribute('normal'), colour = new THREE.Color(), colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) colour.set(rows.colours[normals.getY(i) > 0.5 ? top : sides] ?? '#ffffff').toArray(colours, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colours, 3)).deleteAttribute('uv');
  return g;
}

/** the three baked decks: the world's (its four entries share one seabed) and the Explorer's deep and shallow */
export function entryDeckGeometries(): Record<keyof typeof rows.decks, THREE.BufferGeometry> {
  const merged = (boxes: readonly (readonly number[])[]): THREE.BufferGeometry => mergeGeometries(boxes.map(box), false);
  return { world: merged(rows.decks.world), deep: merged(rows.decks.deep), shallow: merged(rows.decks.shallow) };
}

const inline = (geometry: THREE.BufferGeometry) => {
  const attrs = Object.entries(geometry.attributes).map(([name, attribute]) => [name, 'f32', attribute.itemSize, attribute.normalized] as const);
  const lanes = Object.values(geometry.attributes).map(attribute => new Uint8Array(Float32Array.from(attribute.array).buffer));
  const bytes = new Uint8Array(lanes.reduce((sum, lane) => sum + lane.length, 0));
  lanes.reduce((at, lane) => { bytes.set(lane, at); return at + lane.length; }, 0);
  return { data: btoa(Array.from(zlibSync(bytes), byte => String.fromCodePoint(byte)).join('')), geometry: { attrs, count: geometry.getAttribute('position').count, index: null, indexCount: 0, box: true, expand: false } };
};

/** G532: the deck as a specimen catalogue row (boot/modelCatalogue.generated.json): one inline draw per seabed on the kit's
 *  still material. The Explorer's deep and shallow variants and the world's decks (their shared seabed) select their bake. */
export function entryDeckSpecimen(): v.InferOutput<typeof SpecimenCatalogueSchema>[number] {
  const decks = entryDeckGeometries(), worldBed = deckRows.rows[0]?.placement.params.bed;
  if (worldBed === undefined || deckRows.rows.some(row => row.placement.params.bed !== worldBed)) throw new Error('Entry decks share one seabed');
  const material = { id: 'driftwood-entry-deck', family: 'lowpoly', variant: 'still' } as const;
  const select = (bed: number, deck: keyof typeof decks) => ({ params: { run: 16.5, bed }, source: { kind: 'inline', representation: 'parts', ...inline(decks[deck]), material } });
  const [row] = v.parse(SpecimenCatalogueSchema, [{ key: 'entryDeck', model: { id: 'driftwood-isle/entry-deck', name: 'Entry road deck', category: 'buildings', pipeline: 'code',
    file: 'src/shards/driftwood-isle/generators/entryDeckGeometry.ts', surface: 'stone', defaults: { run: 16.5, bed: -6 },
    variants: [{ id: 'deep', label: 'Over deep water', params: {} }, { id: 'shallow', label: 'Over the shallows', params: { bed: -2.5 } }], seed: 0xdec4 },
  source: { kind: 'selection', variants: [select(-6, 'deep'), select(-2.5, 'shallow'), select(worldBed, 'world')] } }]);
  if (row === undefined) throw new Error('Missing entry deck row');
  return row;
}
