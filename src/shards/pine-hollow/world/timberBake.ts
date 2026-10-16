/**
 * Pine Hollow's timber landmarks from their offline bakes (G285, SF72 "bake the code-built worlds"). A timber's builder runs
 * at build time (`../generators/timberBake.ts` records what it leaves: each material's parts and the glass as float32
 * attribute blocks in a binary, the colliders, deck floors and anchors as a row); here a row and its blocks become the
 * timber's library draws again (./timberSites.ts `timberDraw`, ./timber.ts `timberModel`), exactly as the builder left them.
 */
import type * as THREE from 'three';
import * as v from 'valibot';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import type { MatKey } from './homestead';

/** a baked draw's `moss` hint (the roof's and the stone's), named as the moss graphs read it (`aMoss`, ../generators/cabinGraphs.ts) */
export function mossHint(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.hasAttribute('moss')) return g;
  const moss = g.getAttribute('moss'); g.deleteAttribute('moss');
  return g.setAttribute('aMoss', moss);
}

const num = v.pipe(v.number(), v.finite());
const Floor = v.strictObject({ x: num, z: num, rot: num, hw: num, hd: num, y: num });
/** the timber kit's materials (homestead.ts `MatKey`) */
const MAT_KEYS = ['log', 'endGrain', 'chink', 'roof', 'beam', 'deck', 'door', 'stone', 'bark', 'iron', 'cloth', 'char'] as const satisfies readonly MatKey[];
const Part = v.strictObject({ key: v.picklist(MAT_KEYS), counts: v.array(num) });
/** a baked timber's row: its parts' vertex counts per material (in the builder's order), the glass's, its facts */
export const TIMBER_ROW = { parts: v.array(Part), glass: v.array(num), colliders: v.pipe(v.array(v.unknown()), v.transform(rows => readColliderRows(rows, { kinds: ['box', 'treads'], surfaces: ['wood', 'stone'] }))), floors: v.array(Floor), anchors: v.record(v.string(), v.tuple([num, num, num])) };
export const TimberRowSchema = v.strictObject(TIMBER_ROW);
export type TimberRow = v.InferOutput<typeof TimberRowSchema>;
