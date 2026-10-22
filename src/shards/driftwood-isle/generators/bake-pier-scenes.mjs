import { CableLayout } from '@wildshard/engine/sim/cableTraversal';
import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { buildZiplineGeometry } from './lookout.ts';
import { STATIC_BOAT } from './staticWorld.ts';
import { BOAT_LAYOUT } from './boatLayout.ts';
// Four named pier placements and the same three Explorer variants, with no runtime parameter resolution.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { poseOf, placeCollider } from '@wildshard/engine/models/colliders';
import { pierDeckAt, pierHalfWidthAt } from './pierLayout.ts';
import { pierColliders } from './pierColliders.ts';
import { byteWriter, jsonBytes } from '../../../../scripts/bake-output.mjs';

const project = new URL('../', import.meta.url), read = name => JSON.parse(readFileSync(new URL(`data/${name}.json`, project), 'utf8'));
const rows = read('piers.generated'), authored = JSON.parse(readFileSync(new URL('pierRows.json', import.meta.url), 'utf8')), fixed = read('fixedGeometry');
const plain = descriptors => descriptors.map(shape => ({ ...shape, ...('points' in shape ? { points: [...shape.points] } : {}) }));
const placements = [], facts = [], slots = new Set();
const model = { key: 'pier', id: 'driftwood-isle/pier', name: 'Pier', category: 'buildings', pipeline: 'code', surface: 'planks',
  file: 'src/shards/driftwood-isle/generators/bake-pier-scenes.mjs', defaults: authored.PIER_DEFAULTS, variants: authored.PIER_VARIANTS, choices: [] };
for (const row of rows) {
  const p = row.params, draws = fixed.groups.piers[row.id];
  if (draws === undefined) throw new Error(`Missing pier draws: ${row.id}`);
  for (const slot of [draws.deck, draws.cloth]) if (slot !== null) slots.add(slot);
  model.choices.push({ id: row.id, params: p, size: [p.width+2, 10, p.length], colliders: plain(pierColliders(p)), draws: [
    { id: 'deck', library: 'cascade', model: draws.deck, material: 'still', castShadow: true, receiveShadow: true },
    ...(draws.cloth === null ? [] : [{ id: 'cloth', library: 'cascade', model: draws.cloth, material: 'pennant', castShadow: true }]),
  ] });
  if (row.world === null) continue;
  const w = row.world, pose = { x: w.x, y: w.deckY, z: w.z, ...(w.rot === 0 ? {} : { yaw: w.rot }), params: p }, id = `piers.${row.id}`;
  const knots = [...new Set([-0.2, 0, ...(p.seaRamp === undefined ? [] : [p.seaRamp.run]), ...(p.landing === null ? [] : [p.landing.rampFrom]), p.length, p.length+0.2])].sort((a,b) => a-b);
  const floor = { x: w.x, z: w.z, hw: Math.max(p.width, p.seaRamp?.flare ?? 0)/2+0.25, hd: p.length+0.2, y: w.deckY, rot: w.rot,
    profile: knots.map(along => [along, pierHalfWidthAt(p, along)+0.25, pierDeckAt(p, along)]) };
  placements.push({ id, model: 'pier', draw: 'single', poses: [{ x: pose.x, y: pose.y, z: pose.z, params: p, matrix: [...poseOf(pose).matrix.elements] }],
    piece: { id: row.id === 'world-0' ? 'pier' : `jetty-${Number(row.id.slice(6))-1}`, solidFloor: true, floors: [floor] },
    colliders: plain(pierColliders(p).map(shape => placeCollider(shape, poseOf(pose)))) });
  facts.push({ id, ...w });
}
const boat = { key: 'boat', id: 'driftwood-isle/boat', name: 'Sailboat', category: 'buildings', pipeline: 'code', surface: 'planks', file: 'src/shards/driftwood-isle/generators/bake-pier-scenes.mjs', defaults: {}, choices: [{ id: 'default', params: {}, size: [BOAT_LAYOUT.beam, 5.6, BOAT_LAYOUT.length], colliders: plain(STATIC_BOAT.colliders), draws: [
 { id: 'hull', library: 'cascade', model: 'boatHull', material: 'solid', castShadow: true, receiveShadow: true },
 { id: 'sail', library: 'cascade', model: 'boatSail', material: 'kit', castShadow: true },
 { id: 'gear', library: 'cascade', model: 'boatGear', material: 'still', receiveShadow: true },
] }] };
placements.push({ id: 'harbour.boat', model: 'boat', draw: 'single', poses: [{ ...STATIC_BOAT.placement, matrix: [...poseOf(STATIC_BOAT.placement).matrix.elements] }], piece: { id: 'boat', follows: 'copy', solidFloor: true, floors: STATIC_BOAT.floors } });
const zipRows = read('zipline.generated'), zipSpec = zipRows.layout, lay = new CableLayout({ top: new Vector3(zipSpec.top.x, zipSpec.top.y, zipSpec.top.z), bottom: new Vector3(zipSpec.bottom.x, zipSpec.bottom.y, zipSpec.bottom.z), sag: zipSpec.sag });
const d = lay.deck, hy = 0.1, c = Math.cos(d.yaw), s = Math.sin(d.yaw), step = 0.24, depth = 0.45, lx = d.hw + depth/2, bottom = d.y-1.6, th = (d.y-step-bottom)/2;
const colliders = [{ kind: 'box', x: d.x, y: d.y-hy, z: d.z, hx: d.hw, hy, hz: d.hd, yaw: d.yaw },
 { kind: 'box', x: d.x+lx*c, y: bottom+th, z: d.z-lx*s, hx: depth/2, hy: th, hz: d.hd, yaw: d.yaw }];
const zipGeometry = buildZiplineGeometry(lay), zipMaterial = new MeshStandardMaterial(), zipGroup = new Group(), carriage = new Mesh(zipGeometry.trolley, zipMaterial), at = new Vector3();
carriage.rotation.y = lay.park(at); carriage.position.copy(at); zipGroup.add(new Mesh(zipGeometry.rig, zipMaterial), carriage);
const box = new Box3().setFromObject(zipGroup), zipFloors = [{ x: d.x, z: d.z, hw: d.hw, hd: d.hd, y: d.y, rot: d.yaw }];
placements.push({ id: 'harbour.zipline', model: 'zipline', draw: 'merged', poses: [{ x: zipSpec.top.x, y: zipSpec.top.y, z: zipSpec.top.z, params: { top: zipSpec.top, bottom: zipSpec.bottom }, matrix: [...poseOf(zipSpec.top).matrix.elements] }], drawnInto: { part: 'zipline.root', boxes: [...box.min, ...box.max] }, colliders, piece: { id: 'zipline', floors: zipFloors, solidFloor: true } });
zipGeometry.rig.dispose(); zipGeometry.trolley.dispose(); zipMaterial.dispose();
const zipline = { key: 'zipline', id: 'driftwood-isle/zipline', name: 'Zipline', category: 'buildings', pipeline: 'code', surface: 'planks', file: 'src/shards/driftwood-isle/generators/bake-pier-scenes.mjs', defaults: zipRows.specimenLayout, choices: [{ id: 'specimen', params: zipRows.specimenLayout, size: [16, 7, 7], colliders: [], assembly: 'objects', draws: [
 { id: 'rig', library: 'cascade', model: 'zipline-specimen', material: 'still', castShadow: true, receiveShadow: true },
 { id: 'trolley', library: 'cascade', model: 'zipline-parked', material: 'still', castShadow: true },
] }] };
delete zipline.choices[0].assembly; zipline.assembly = 'parts';
const zipScene = { scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['rig', 'trolley'] },
 { kind: 'mesh', id: 'rig', name: 'zipline', geometry: 'rig', material: 'still', missing: 'empty', castShadow: true, receiveShadow: true },
 { kind: 'mesh', id: 'trolley', geometry: 'trolley', material: 'still', missing: 'empty', castShadow: true }], materials: [{ kind: 'port', id: 'still', source: 'still' }] }, imports: [] };
const zipBindings = { a: [...lay.a], b: [...lay.b], prompt: [lay.a.x-lay.flat.x*0.6, lay.deck.y+1, lay.a.z-lay.flat.z*0.6], anchor: [zipSpec.top.x, zipSpec.top.z] };
const writer = byteWriter(process.argv.includes('--check'), 'pier-scenes');
writer.put(fileURLToPath(new URL('data/pierScenes.generated.json', project)), jsonBytes({ model, boat, zipline, zipScene, zipBindings, placements, facts, slots: [...slots] }));
writer.finish();
