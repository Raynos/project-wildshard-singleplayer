import { Mesh, type Material } from 'three';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { decodeFoliageWorld, readFoliageWorld } from '../../boot/foliageGeometry';
import { REEF_FILES } from '../../data/reefFiles';
import { REEF_SPECIMENS, type ReefKind } from '../../data/reefSpecimenRows';
import type { ReefParams } from '../../models/reef';

const key = (value: object): string => JSON.stringify(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
/** Explorer loads only its selected authored rest shape, with the existing graph material. */
export function reefSpecimen(kind: ReefKind, params: ReefParams, material: Material): ReturnType<typeof loadingSpecimen> {
  const row = REEF_SPECIMENS[kind], urls: Readonly<Record<string, string>> = REEF_FILES[kind];
  const choice = [{id: 'default', params: row.defaults}, ...row.variants.map(variant => ({id: variant.id, params: {...row.defaults, ...variant.params}}))].find(variant => key(variant.params) === key(params));
  const url = choice === undefined ? undefined : urls[choice.id];
  if (url === undefined) throw new Error('Reef specimen has no authored geometry');
  const id = kind === 'weed' ? 'seaweed' : kind === 'star' ? 'reef-starfish' : 'coral';
  return loadingSpecimen(`driftwood-isle/${id}`, row.size, async () => {
    const intake = modelGeometry(url, {_sway: 'aSway'}); await intake.load();
    const mesh = new Mesh(intake.take(), material); mesh.receiveShadow = true; return mesh;
  });
}
const layout = {magic: 0x31464552, channels: [['position', 3], ['color', 3], ['aSway', 2]]} as const;
/** Retain the original full-copy boxes and independently disposable native wind channels. */
export function decodeReefWorld(input: Uint8Array, copies: number): ReturnType<typeof decodeFoliageWorld> { return decodeFoliageWorld(input, copies, layout); }
/** A one-to-one owned replacement, with no retained geometry template. */
export function loadReefWorld(copies: number): ReturnType<typeof readFoliageWorld> { return readFoliageWorld(REEF_FILES.world, copies, layout); }
