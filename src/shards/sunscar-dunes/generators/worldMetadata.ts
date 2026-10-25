import type { BakedKind } from '@wildshard/sdk/bake/kinds';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { SignalBox } from './kinds';

interface WorldPiece { glb: string; kinds: BakedKind[]; colliders: SignalBox[] }
/** The existing world bake's seven metadata documents, with no published file dependency. */
export interface SignalWorldMetadata {
  rocks: WorldPiece; dressing: WorldPiece;
  tower: WorldPiece & { anchors: { deckY: number; lampY: number } };
  caravan: WorldPiece & { anchors: { y: number; logbook: [number, number, number]; lamp: [number, number, number] } };
  well: WorldPiece & { anchors: { y: number } };
  lash: WorldPiece & { tip: [number, number, number]; along: number };
  braziers: WorldPiece & { braziers: { y: number; colliders: SignalBox[] }[] };
}

function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function keys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
function list<T>(value: unknown, maximum: number, guard: (row: unknown) => row is T): value is T[] {
  return Array.isArray(value) && value.length <= maximum && value.every(guard);
}
function vector(value: unknown): value is [number, number, number] { return list(value, 3, finite) && value.length === 3; }
const numbers = ['color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity'];
const flags = ['flat', 'vertexColors', 'doubleSided'];
const extraNumbers = ['colorR', 'colorG', 'colorB', 'emissiveR', 'emissiveG', 'emissiveB', 'brazier'];
const extraFlags = ['mesh', 'unlit', 'warm'];
function kind(value: unknown): value is BakedKind {
  return record(value) && keys(value, ['name', 'count', ...numbers, ...flags], [...extraNumbers, ...extraFlags])
    && typeof value['name'] === 'string' && value['name'].length > 0 && value['name'].length <= 128
    && finite(value['count']) && Number.isSafeInteger(value['count']) && value['count'] > 0
    && numbers.every(key => finite(value[key])) && flags.every(key => typeof value[key] === 'boolean')
    && extraNumbers.every(key => !Object.hasOwn(value, key) || finite(value[key]))
    && extraFlags.every(key => !Object.hasOwn(value, key) || typeof value[key] === 'boolean');
}
function box(value: unknown): value is SignalBox {
  return record(value) && keys(value, ['kind', 'x', 'y', 'z', 'hx', 'hy', 'hz'], ['yaw', 'surface']) && value['kind'] === 'box'
    && ['x', 'y', 'z', 'hx', 'hy', 'hz'].every(key => finite(value[key]))
    && (!Object.hasOwn(value, 'yaw') || finite(value['yaw']))
    && (!Object.hasOwn(value, 'surface') || (typeof value['surface'] === 'string' && ['rock', 'stone', 'wood', 'metal', 'felt', 'flesh'].includes(value['surface'])));
}
function brazier(value: unknown): value is { y: number; colliders: SignalBox[] } {
  return record(value) && keys(value, ['y', 'colliders']) && finite(value['y']) && list(value['colliders'], 65536, box);
}
function piece(files: ReadonlyMap<string, Uint8Array>, name: string, extra: readonly string[] = []): { rows: WorldPiece; value: Record<string, unknown> } {
  const bytes = files.get(`${name}.json`), glb = files.get(`${name}.glb`);
  if (bytes === undefined || bytes.length === 0 || bytes.length > 1_000_000 || glb === undefined || glb.length === 0 || glb.length > 25_000_000) throw new Error('Missing or oversized world metadata');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!record(value) || !keys(value, ['glb', 'kinds', 'colliders', ...extra])
    || typeof value['glb'] !== 'string' || value['glb'] !== hashImmutableBytes(glb)
    || !list(value['kinds'], 4096, kind) || !list(value['colliders'], 65536, box)) throw new Error('Invalid world piece metadata');
  return { rows: { glb: value['glb'], kinds: value['kinds'], colliders: value['colliders'] }, value };
}

/** Decode only the original cached metadata, binding each document to its exact
 * GLB. Every call owns its rows; neither cache bytes nor prior results mutate. */
export function signalWorldMetadata(files: ReadonlyMap<string, Uint8Array>): SignalWorldMetadata {
  const rocks = piece(files, 'rocks'), dressing = piece(files, 'dressing'), tower = piece(files, 'tower', ['anchors']),
    caravan = piece(files, 'caravan', ['anchors']), well = piece(files, 'well', ['anchors']),
    lash = piece(files, 'lash', ['tip', 'along']), braziers = piece(files, 'braziers', ['braziers']);
  const towerAt = tower.value['anchors'], caravanAt = caravan.value['anchors'], wellAt = well.value['anchors'];
  if (!record(towerAt) || !keys(towerAt, ['deckY', 'lampY']) || !finite(towerAt['deckY']) || !finite(towerAt['lampY'])
    || !record(caravanAt) || !keys(caravanAt, ['y', 'logbook', 'lamp']) || !finite(caravanAt['y']) || !vector(caravanAt['logbook']) || !vector(caravanAt['lamp'])
    || !record(wellAt) || !keys(wellAt, ['y']) || !finite(wellAt['y']) || !vector(lash.value['tip']) || !finite(lash.value['along'])
    || !list(braziers.value['braziers'], 256, brazier)) throw new Error('Invalid world anchors');
  return { rocks: rocks.rows, dressing: dressing.rows,
    tower: { ...tower.rows, anchors: { deckY: towerAt['deckY'], lampY: towerAt['lampY'] } },
    caravan: { ...caravan.rows, anchors: { y: caravanAt['y'], logbook: caravanAt['logbook'], lamp: caravanAt['lamp'] } },
    well: { ...well.rows, anchors: { y: wellAt['y'] } }, lash: { ...lash.rows, tip: lash.value['tip'], along: lash.value['along'] },
    braziers: { ...braziers.rows, braziers: braziers.value['braziers'] } };
}
