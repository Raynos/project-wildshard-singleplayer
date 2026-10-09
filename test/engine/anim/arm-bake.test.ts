// oxlint-disable-next-line import/no-nodejs-modules -- Validate committed bake metadata against the actual GLB JSON chunk.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARM_CLIPS, SWIM_CLIPS } from '../../../src/game/systems/viewmodel/armClips';

interface Glb {
  nodes: { name?: string; extras?: { rig?: string; clips?: Record<string, { loop: boolean }> } }[];
  animations: { name: string }[];
  skins: { joints: number[] }[];
}
function json(path: string): Glb {
  const file = readFileSync(path), length = file.readUInt32LE(12);
  return JSON.parse(file.subarray(20, 20 + length).toString('utf8')) as Glb;
}
describe('authored viewmodel clip aliases', () => {
  it.each([
    { file: 'public/assets/nine-dragon/viewmodel/fp-rig.glb', skeleton: 'nine-dragon-fp', fingers: false },
    { file: 'public/assets/models/driftwood-fp/fp-arms.glb', skeleton: 'driftwood-fp', fingers: true },
  ])('$skeleton covers every shipped clip and actual ordered skin', ({ file, skeleton, fingers }) => {
    const glb = json(file), metadata = glb.nodes.find((node) => node.name === 'vm_root')?.extras;
    const aliases = fingers ? { ...ARM_CLIPS, ...SWIM_CLIPS } : ARM_CLIPS;
    expect(metadata?.rig).toBe(skeleton);
    expect(Object.values(aliases)).toEqual(glb.animations.map((clip) => clip.name));
    for (const [canonical, source] of Object.entries(aliases)) {
      if (source === undefined) throw new Error(`undefined clip alias ${canonical}`);
      expect(canonical).toMatch(/^(idle|walk|run|attack|hit|die|turn|swim|fly)(\..+)?$/);
      expect(metadata?.clips?.[source]).toBeDefined();
    }
    for (const socket of fingers ? ['R_weapon', 'L_hand'] : ['R_weapon', 'L_claw']) expect(glb.nodes.some((node) => node.name === socket)).toBe(true);
    const arm = (side: string): string[] => ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'].map((name) => `${side}_${name}`);
    const expected = fingers ? [['R', 'L'].flatMap((side) => arm(side).concat(
      ['thumb', 'index', 'middle', 'ring', 'pinky'].flatMap((finger) => [1, 2, 3].map((n) => `${side}_${finger}${n}`)),
    ))] : [arm('R'), arm('L')];
    const actual = [...new Map(glb.skins.map((skin) => { const names = skin.joints.map((i) => glb.nodes[i]?.name); return [JSON.stringify(names), names]; })).values()];
    expect(actual).toEqual(expected);
  });
});
