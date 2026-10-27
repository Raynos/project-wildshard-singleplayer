import { MeshBasicMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { buildSabre, SABRE_MOVES, PASS_LEFT, PASS_RIGHT } from './sabre';

type SabreKey = typeof SABRE_MOVES.rest;
type SabreMove = typeof PASS_LEFT;

/** The sabre's rest pool's product name: the held blade reads it through `product.url` (GR6; it was a hashed public GLB). */
export const SABRE_POOL_NAME = 'models/held/sabre.glb';

interface KeyRow { t: number; pos: number[]; q: number[] }
type MoveRow = Omit<SabreMove, 'keys' | 'trail'> & { keys: KeyRow[]; trail: Omit<SabreMove['trail'], 'color'> & { color: number[] } };
/** The blade page's rows (`weapons/sabre.json` before its program and power join it). */
export interface SabrePoolRows {
  pool: { url: string; parts: string[] };
  blade: { length: number; curve: number };
  rig: { tipY: number; baseY: number; tipX: number };
  moves: { rest: KeyRow; charge: KeyRow; sprint: KeyRow; combo: MoveRow[]; heavy: MoveRow; passes: { left: MoveRow; right: MoveRow } };
}

const key = ({ t, pos, q }: SabreKey): KeyRow => ({ t, pos: pos.toArray(), q: q.toArray() });
const move = (row: SabreMove): MoveRow =>
  ({ ...row, keys: row.keys.map(key), trail: { ...row.trail, color: row.trail.color.toArray() } });

/**
 * GR6: Nalati's sabre at build time (the retired nalati-sabre-pool job's bytes): the sword, arms and steel guard as one rest
 * pool GLB, and the blade page rows (`weapons/sabre.json`): the pool by its product name, the blade's reach and the moves.
 */
export function nalatiSabrePool(): { glb: Uint8Array; rows: SabrePoolRows } {
  const material = new MeshBasicMaterial(), rig = buildSabre(material, material), steel = rig.extras?.[0]?.geometry;
  if (steel === undefined) throw new Error('Sabre requires its steel guard');
  const parts = [['sword', rig.sword], ['arms', rig.arms], ['steel', steel]] as const;
  try {
    const glb = staticGlb(parts.map(([name, geometry]) => ({ name, geometry, material, compactIndex: true,
      extras: { restGroups: geometry.groups.map(group => [group.start, group.count, group.materialIndex ?? 0]), restBox: null, restSphere: null } })), 'nalati-sabre');
    return { glb, rows: { pool: { url: SABRE_POOL_NAME, parts: parts.map(([name]): string => name) },
      blade: { length: 0.62, curve: 0.12 }, rig: { tipY: rig.tipY, baseY: rig.baseY, tipX: rig.tipX },
      moves: { rest: key(SABRE_MOVES.rest), charge: key(SABRE_MOVES.charge), sprint: key(SABRE_MOVES.sprint),
        combo: SABRE_MOVES.combo.map(move), heavy: move(SABRE_MOVES.heavy), passes: { left: move(PASS_LEFT), right: move(PASS_RIGHT) } } } };
  } finally {
    for (const [, geometry] of parts) geometry.dispose();
    material.dispose();
  }
}
