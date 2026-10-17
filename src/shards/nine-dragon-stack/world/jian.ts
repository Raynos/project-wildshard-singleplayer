// Exact static Jian fallback from the shard product; its material and optional TRELLIS guard stay live.
import { type BufferGeometry, type Material, BufferGeometryLoader, Quaternion, Vector3 } from 'three';
import * as v from 'valibot';
import type { ShardSword } from '@wildshard/game/shard/manifest';
import { CHARGE, COMBO, HEAVY, SPRINT } from '@wildshard/game/weapons/starterMoves';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { glbBox, guardMatrix, loadGlb } from './hero/glb';
import { decalAtlas, vmMaterial, vmUniforms, weaveTexture } from './hero/vm-material';

const vec3 = v.tuple([v.number(), v.number(), v.number()]);
const quat = v.tuple([v.number(), v.number(), v.number(), v.number()]);
const fallbackRow = v.strictObject({
  sword: v.unknown(), arms: v.unknown(), guard: v.unknown(), gauntlet: v.unknown(),
  tipY: v.number(), baseY: v.number(), rest: v.strictObject({ t: v.number(), pos: vec3, q: quat }), wrist: vec3, armQ: quat,
});

interface FallbackSources {
  file: () => Promise<Uint8Array>; material: () => Material; guard: () => Promise<BufferGeometry>;
}
const OWN_LOADERS: FallbackSources = {
  file: async () => (await loadFirstPartyProduct('nine-dragon-stack')).file('weapons/jian-fallback.json'),
  material: () => vmMaterial(vmUniforms(weaveTexture(), decalAtlas())),
  guard: async () => {
    const url = '/assets/nine-dragon/lab/guard.glb';
    return loadGlb(url, { kind: 20, wash: 0xba9444, lumLo: 0.2, lumHi: 1.35, ao: 0.9, clipBack: 0.2,
      matrix: guardMatrix(await glbBox(url), 0.115, -0.004, 0.006, 0) });
  },
};

/** The fallback's external resources can be supplied by a renderer-free proof. */
export async function jianSword(load: FallbackSources = OWN_LOADERS): Promise<ShardSword> {
  const row = v.parse(fallbackRow, JSON.parse(new TextDecoder().decode(await load.file()),
    (_key, value: unknown) => value === '-0' ? -0 : value));
  const loader = new BufferGeometryLoader();
  const material = load.material();
  let guard: BufferGeometry;
  try {
    guard = (await load.guard()).translate(0, 0.2, 0);
  } catch {
    guard = loader.parse(row.guard);
  }
  return {
    rig: { sword: loader.parse(row.sword), arms: loader.parse(row.arms), material, tipY: row.tipY, baseY: row.baseY,
      extras: [{ geometry: guard, material }],
      left: { geometry: loader.parse(row.gauntlet), material, pos: new Vector3(...row.wrist), q: new Quaternion(...row.armQ) },
    },
    moves: { rest: { t: row.rest.t, pos: new Vector3(...row.rest.pos), q: new Quaternion(...row.rest.q) }, charge: CHARGE, sprint: SPRINT, combo: COMBO, heavy: HEAVY },
    framing: { shrink: 0, dx: 0, dy: 0, tilt: 0, yaw: 0 }, portraitPullX: 0,
  };
}
