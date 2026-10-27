import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import fixed from '../data/fixedGeometry.json' with { type: 'json' };
import authored from './pierRows.json' with { type: 'json' };
import { driftwoodPierRows } from './fixedFacts';
import { buildZiplineGeometry } from './lookout';
import { driftwoodZiplineBank } from './ziplineBank';
import { ZiplineCable } from './ziplineCable';
import { STATIC_BOAT } from './staticWorld';
import { BOAT_LAYOUT } from './boatLayout';
import { foliagePose, placeFoliageCollider, type FoliagePlacement } from './foliageModels';
import { pierDeckAt, pierHalfWidthAt } from './pierLayout';
import { pierColliders } from './pierColliders';
import { plainJson } from './jsonRows';

const FILE = 'src/shards/driftwood-isle/generators/pierScenesBank.ts';
type Vec3 = [number, number, number];
type PierRow = ReturnType<typeof driftwoodPierRows>[number];
type PierWorld = NonNullable<PierRow['world']>;
/** One pier Explorer choice: a world pier or a specimen variant, its params, size, own-space colliders and draws. */
export interface PierModelChoice { readonly id: string; readonly params: PierRow['params']; readonly size: number[]; readonly colliders: unknown[]; readonly draws: unknown[] }
/** The piers', the boat's and the zipline's scene rows (GR7: the `driftwood-pier-scenes` job's JSON): their Explorer models,
 *  the zipline's scene and cable bindings, the world placements, each world pier's facts and the cascade slots the pier
 *  draws name. */
export interface DriftwoodPierScenes {
  readonly model: Readonly<Record<string, unknown>> & { readonly choices: readonly PierModelChoice[] };
  readonly boat: Readonly<Record<string, unknown>>;
  readonly zipline: Readonly<Record<string, unknown>>;
  readonly zipScene: unknown;
  readonly zipBindings: { readonly a: Vec3; readonly b: Vec3; readonly prompt: Vec3; readonly anchor: [number, number] };
  readonly placements: readonly (Readonly<Record<string, unknown>> & { readonly id: string })[];
  readonly facts: readonly (PierWorld & { readonly id: string })[];
  readonly slots: readonly string[];
}

/** Rows as the job's JSON held them: hull points as arrays, no negative zero (jsonRows.ts). */
const plain = (rows: readonly object[]): unknown[] => rows.map(plainJson);
const matrix = (pose: FoliagePlacement): number[] => [...foliagePose(pose).matrix.elements];

function buildPierScenes(): DriftwoodPierScenes {
  const rows = driftwoodPierRows(), placements: (Readonly<Record<string, unknown>> & { readonly id: string })[] = [], facts: (PierWorld & { readonly id: string })[] = [], slots = new Set<string>();
  const choices: PierModelChoice[] = [];
  const model = { key: 'pier', id: 'driftwood-isle/pier', name: 'Pier', category: 'buildings', pipeline: 'code', surface: 'planks',
    file: FILE, defaults: authored.PIER_DEFAULTS, variants: authored.PIER_VARIANTS, choices };
  const piers: Readonly<Record<string, { readonly deck: string; readonly cloth: string | null } | undefined>> = fixed.groups.piers;
  for (const row of rows) {
    const p = row.params, draws = piers[row.id];
    if (draws === undefined) throw new Error(`Missing pier draws: ${row.id}`);
    for (const slot of [draws.deck, draws.cloth]) if (slot !== null) slots.add(slot);
    choices.push({ id: row.id, params: p, size: [p.width + 2, 10, p.length], colliders: plain(pierColliders(p)), draws: [
      { id: 'deck', library: 'cascade', model: draws.deck, material: 'still', castShadow: true, receiveShadow: true },
      ...(draws.cloth === null ? [] : [{ id: 'cloth', library: 'cascade', model: draws.cloth, material: 'pennant', castShadow: true }]),
    ] });
    if (row.world === null) continue;
    const w = row.world, pose = { x: w.x, y: w.deckY, z: w.z, ...(w.rot === 0 ? {} : { yaw: w.rot }), params: p }, id = `piers.${row.id}`;
    const knots = [...new Set([-0.2, 0, ...(p.seaRamp === undefined ? [] : [p.seaRamp.run]), ...(p.landing === null ? [] : [p.landing.rampFrom]), p.length, p.length + 0.2])].sort((a, b) => a - b);
    const floor = { x: w.x, z: w.z, hw: Math.max(p.width, p.seaRamp?.flare ?? 0) / 2 + 0.25, hd: p.length + 0.2, y: w.deckY, rot: w.rot,
      profile: knots.map(along => [along, pierHalfWidthAt(p, along) + 0.25, pierDeckAt(p, along)]) };
    placements.push({ id, model: 'pier', draw: 'single', poses: [{ x: pose.x, y: pose.y, z: pose.z, params: p, matrix: matrix(pose) }],
      piece: { id: row.id === 'world-0' ? 'pier' : `jetty-${Number(row.id.slice(6)) - 1}`, solidFloor: true, floors: [floor] },
      colliders: plain(pierColliders(p).map(shape => placeFoliageCollider(shape, foliagePose(pose)))) });
    facts.push({ id, ...w });
  }
  const boat = { key: 'boat', id: 'driftwood-isle/boat', name: 'Sailboat', category: 'buildings', pipeline: 'code', surface: 'planks', file: FILE, defaults: {},
    choices: [{ id: 'default', params: {}, size: [BOAT_LAYOUT.beam, 5.6, BOAT_LAYOUT.length], colliders: plain(STATIC_BOAT.colliders), draws: [
      { id: 'hull', library: 'cascade', model: 'boatHull', material: 'solid', castShadow: true, receiveShadow: true },
      { id: 'sail', library: 'cascade', model: 'boatSail', material: 'kit', castShadow: true },
      { id: 'gear', library: 'cascade', model: 'boatGear', material: 'still', receiveShadow: true },
    ] }] };
  placements.push({ id: 'harbour.boat', model: 'boat', draw: 'single', poses: [{ ...STATIC_BOAT.placement, matrix: matrix(STATIC_BOAT.placement) }], piece: { id: 'boat', follows: 'copy', solidFloor: true, floors: STATIC_BOAT.floors } });
  const zipRows = driftwoodZiplineBank().rows, zipSpec = zipRows.layout;
  const lay = new ZiplineCable({ top: new Vector3(zipSpec.top.x, zipSpec.top.y, zipSpec.top.z), bottom: new Vector3(zipSpec.bottom.x, zipSpec.bottom.y, zipSpec.bottom.z), ...('sag' in zipSpec ? { sag: zipSpec.sag } : {}) });
  const d = lay.deck, hy = 0.1, c = Math.cos(d.yaw), s = Math.sin(d.yaw), step = 0.24, depth = 0.45, lx = d.hw + depth / 2, bottom = d.y - 1.6, th = (d.y - step - bottom) / 2;
  const colliders = [{ kind: 'box', x: d.x, y: d.y - hy, z: d.z, hx: d.hw, hy, hz: d.hd, yaw: d.yaw },
    { kind: 'box', x: d.x + lx * c, y: bottom + th, z: d.z - lx * s, hx: depth / 2, hy: th, hz: d.hd, yaw: d.yaw }];
  const zipGeometry = buildZiplineGeometry(lay), zipMaterial = new MeshStandardMaterial(), zipGroup = new Group(), carriage = new Mesh(zipGeometry.trolley, zipMaterial), at = new Vector3();
  try {
    carriage.rotation.y = lay.park(at); carriage.position.copy(at); zipGroup.add(new Mesh(zipGeometry.rig, zipMaterial), carriage);
    const box = new Box3().setFromObject(zipGroup), zipFloors = [{ x: d.x, z: d.z, hw: d.hw, hd: d.hd, y: d.y, rot: d.yaw }];
    placements.push({ id: 'harbour.zipline', model: 'zipline', draw: 'merged', poses: [{ x: zipSpec.top.x, y: zipSpec.top.y, z: zipSpec.top.z, params: { top: zipSpec.top, bottom: zipSpec.bottom }, matrix: matrix(zipSpec.top) }],
      drawnInto: { part: 'zipline.root', boxes: [...box.min.toArray(), ...box.max.toArray()] }, colliders, piece: { id: 'zipline', floors: zipFloors, solidFloor: true } });
  } finally { zipGeometry.rig.dispose(); zipGeometry.trolley.dispose(); zipMaterial.dispose(); }
  const zipline = { key: 'zipline', id: 'driftwood-isle/zipline', name: 'Zipline', category: 'buildings', pipeline: 'code', surface: 'planks', file: FILE, defaults: zipRows.specimenLayout,
    choices: [{ id: 'specimen', params: zipRows.specimenLayout, size: [16, 7, 7], colliders: [], draws: [
      { id: 'rig', library: 'cascade', model: 'zipline-specimen', material: 'still', castShadow: true, receiveShadow: true },
      { id: 'trolley', library: 'cascade', model: 'zipline-parked', material: 'still', castShadow: true },
    ] }], assembly: 'parts' };
  const zipScene = { scene: { version: 1, root: 'root', nodes: [{ kind: 'group', id: 'root', children: ['rig', 'trolley'] },
    { kind: 'mesh', id: 'rig', name: 'zipline', geometry: 'rig', material: 'still', missing: 'empty', castShadow: true, receiveShadow: true },
    { kind: 'mesh', id: 'trolley', geometry: 'trolley', material: 'still', missing: 'empty', castShadow: true }], materials: [{ kind: 'port', id: 'still', source: 'still' }] }, imports: [] };
  const zipBindings = { a: lay.a.toArray(), b: lay.b.toArray(), prompt: [lay.a.x - lay.flat.x * 0.6, lay.deck.y + 1, lay.a.z - lay.flat.z * 0.6] satisfies Vec3,
    anchor: [zipSpec.top.x, zipSpec.top.z] satisfies [number, number] };
  return { model, boat, zipline, zipScene, zipBindings, placements, facts, slots: [...slots] };
}

let scenes: DriftwoodPierScenes | undefined;
/** Built once per build process (no file is read); every reader treats it as read-only. */
export function driftwoodPierScenes(): DriftwoodPierScenes { scenes ??= buildPierScenes(); return scenes; }
