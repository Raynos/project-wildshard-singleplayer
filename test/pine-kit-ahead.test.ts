import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { riderArm, riderArmSteps } from '../src/engine/player/nalatiArms';
import { handGeometry, holdDef, prepareWeaponHands, withArmPalette, type HandGeometry } from '../src/shards/pine-hollow/runtime/viewmodel/gloveHands';
import { HUNTER_HANDS } from '../src/shards/pine-hollow/runtime/viewmodel/handsLook';
import { prepareStaveBowHands, staveBowView } from '../src/shards/pine-hollow/runtime/viewmodel/staveBow';
import { LONGBOW_LOOK } from '../src/shards/pine-hollow/runtime/viewmodel/longbowLook';
import { CROSSBOW_HAND_HOLDS } from '../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { LEVER_HAND_HOLDS } from '../src/shards/pine-hollow/runtime/weapons/LeverRifle';

// SF67 (sp-o114): Pine's kit builds its weapons' hands ahead, a slice at a time, and each constructor takes them. A sliced
// build must hand over exactly the bytes of the one-task build.
const b64 = (a: ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }): string => {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCodePoint(u8[i] ?? 0);
  return btoa(s);
};
const bytes = (g: THREE.BufferGeometry): string => {
  const parts: string[] = [];
  for (const name of Object.keys(g.attributes).sort()) { const a = g.getAttribute(name); if (a instanceof THREE.BufferAttribute) parts.push(name, String(a.itemSize), b64(a.array)); }
  const index = g.getIndex();
  if (index !== null) parts.push('index', b64(index.array));
  return parts.join('|');
};
const handBytes = (h: HandGeometry): string => [bytes(h.geometry), h.sleeve === null ? 'none' : bytes(h.sleeve), h.wrist.toArray().join(','), h.dir.toArray().join(',')].join('#');
const always = (): Promise<void> => Promise.resolve();

describe('Pine kit hands built ahead (SF67)', () => {
  test('a sleeve built in steps is the one-go sleeve, byte for byte', () => {
    for (const [len, seed] of [LONGBOW_LOOK.leftSleeve, LONGBOW_LOOK.rightSleeve, [0.9, 1] as const]) {
      const once = withArmPalette(LONGBOW_LOOK.hands, () => riderArm(len, seed));
      const steps = riderArmSteps(len, seed);
      let r = withArmPalette(LONGBOW_LOOK.hands, () => steps.next()), yields = 0;
      for (let i = 0; i < 4096 && r.done !== true; i++) { yields++; r = withArmPalette(LONGBOW_LOOK.hands, () => steps.next()); }
      if (r.done !== true) throw new Error('the sleeve never finished');
      expect(yields).toBeGreaterThan(2);
      expect(bytes(r.value)).toBe(bytes(once));
    }
  });

  test('the longbow view takes prepared hands with identical bytes', async () => {
    const mat = new THREE.MeshBasicMaterial();
    const once = staveBowView(LONGBOW_LOOK, mat);
    const ahead = await prepareStaveBowHands(LONGBOW_LOOK, always);
    const sliced = staveBowView(LONGBOW_LOOK, mat);
    expect(sliced.lSleeve.geometry).toBe(ahead.lArm); // taken, not rebuilt
    expect(sliced.rHand.geometry).toBe(ahead.rf.geometry);
    for (const k of ['rHand', 'lSleeve', 'rSleeve', 'nocked'] as const) expect(bytes(sliced[k].geometry)).toBe(bytes(once[k].geometry));
    expect(bytes(sliced.mesh.geometry)).toBe(bytes(once.mesh.geometry));
    for (const k of ['lWrist', 'rWrist', 'rHook', 'rWristDir'] as const) expect(sliced[k].toArray()).toEqual(once[k].toArray());
    // taken once: the next view builds its own again
    expect(bytes(staveBowView(LONGBOW_LOOK, mat).lSleeve.geometry)).toBe(bytes(once.lSleeve.geometry));
  });

  test('the crossbow and lever hands are taken prepared with identical bytes', async () => {
    for (const holds of [CROSSBOW_HAND_HOLDS, LEVER_HAND_HOLDS]) {
      const ask = (): HandGeometry[] => [holdDef(holds.left), holdDef(holds.right)].map((d, i) => handGeometry(HUNTER_HANDS, { ...d.spec, mirror: i === 0 }, d.spec.elbow !== undefined));
      const once = ask().map(handBytes);
      const ahead = await prepareWeaponHands(HUNTER_HANDS, holds.left, holds.right, always);
      const taken = ask();
      expect(taken).toEqual([...ahead]);
      expect(taken[0]).toBe(ahead[0]); expect(taken[1]).toBe(ahead[1]); // taken, not rebuilt
      expect(taken.map(handBytes)).toEqual(once);
    }
  });
});
