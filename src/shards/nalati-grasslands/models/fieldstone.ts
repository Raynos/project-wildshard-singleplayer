/**
 * The fieldstone (E306 / E315 M3): a loose lumpy granite stone lying in the grass, lichened on top, at a random turn —
 * the stones scattered round the kurgans, the blocks fallen from the watchtower. Painted into its place's one mesh
 * (src/shards/nalati-grasslands/world/painted.ts); every copy its own shape and turn, drawn from the place's rng stream. Walk-through.
 */
import * as THREE from 'three';
import { defineModel } from '@wildshard/engine/models/model';
import { M } from '../world/paint';
import { blob } from '@wildshard/engine/world/geometryKit';
import { painted, type Paint } from '../world/painted';

export type FieldstoneLook = 'kurgan' | 'rubble';

export interface FieldstoneParams {
  /** radius, metres */
  readonly s: number;
  /** height over width */
  readonly squash: number;
  /** how lumpy */
  readonly rough: number;
  /** how far its centre sits over the ground, × its radius (negative: sunk) */
  readonly lift: number;
  /** its stone and lichen */
  readonly look: FieldstoneLook;
}

const LOOK: Readonly<Record<FieldstoneLook, { stone: THREE.Color; lichen: THREE.Color; threshold: number; brush: number }>> = {
  kurgan: { stone: new THREE.Color('#77736c'), lichen: new THREE.Color('#b9a45a'), threshold: 0.5, brush: 0.07 },
  rubble: { stone: new THREE.Color('#948b7c'), lichen: new THREE.Color('#b3a35a'), threshold: 0.6, brush: 0.12 },
};

/** `at`: the point on the ground it lies on (it takes its own turn) */
const paint: Paint<FieldstoneParams> = (kit, at, p) => {
  const rng = kit.rng, look = LOOK[p.look];
  kit.add(blob(p.s, rng, 1, p.squash, p.rough), look.stone, { matrix: M(at.x, at.y + p.s * p.lift, at.z, rng.range(0, 6)), top: { color: look.lichen, threshold: look.threshold, amount: 0.4 }, brush: look.brush });
  return {};
};

export const fieldstone = defineModel<FieldstoneParams>({
  id: 'nalati-grasslands/fieldstone', name: 'Fieldstone', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/fieldstone.ts', surface: 'stone',
  defaults: { s: 0.3, squash: 0.55, rough: 0.22, lift: 0.1, look: 'kurgan' },
  variants: [
    { id: 'kurgan', label: 'Kurgan field', params: {} },
    { id: 'rubble', label: 'Tower rubble', params: { s: 0.6, squash: 0.7, rough: 0.25, lift: -0.2, look: 'rubble' } },
  ],
  build: painted(paint, { seed: 0x4b62 }),
});
