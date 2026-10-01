import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, BoxGeometry, Group, MeshBasicMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh } from 'three';
import { bindRig } from '../../../src/engine/anim/rig';
import { AnimMachine } from '../../../src/engine/anim/machine';
import { Scope } from '../../../src/engine/app/scope';

function fixture(): { root: Group; idle: AnimationClip; attack: AnimationClip } {
  const root = new Group(), hand = new Bone(); hand.name = 'hand'; root.add(hand);
  return { root, idle: new AnimationClip('old-idle', 1, [new NumberKeyframeTrack('hand.position[x]', [0, 1], [0, 0])]),
    attack: new AnimationClip('old-cut', 1, [new NumberKeyframeTrack('hand.position[x]', [0, 1], [0, 1])]) };
}
const contract = { skeleton: 'test', clips: ['idle', 'attack.cut'], sockets: ['weapon'] } as const;
const bake = { skeleton: 'test', clips: { idle: 'old-idle', 'attack.cut': 'old-cut' }, sockets: { weapon: 'hand' } } as const;
describe('rig contract', () => {
  it('maps metadata without renaming GLB clips or changing the bind pose', () => {
    const f = fixture(), rig = bindRig(f.root, [f.idle, f.attack], contract, bake);
    expect(rig.clips.get('attack.cut')).toBe(f.attack); expect(f.attack.name).toBe('old-cut');
    expect(rig.sockets.get('weapon')?.position.x).toBe(0);
  });
  it('fails loudly on missing clips, sockets and incompatible skeletons', () => {
    const f = fixture();
    expect(() => bindRig(f.root, [f.idle], contract, bake)).toThrow('missing clip attack.cut');
    expect(() => bindRig(new Group(), [f.idle, f.attack], contract, bake)).toThrow('missing socket weapon');
    expect(() => bindRig(f.root, [], contract, { ...bake, skeleton: 'wrong' })).toThrow('skeleton mismatch');
  });
  it('checks joint order from the skin instead of traversal order', () => {
    const f = fixture(), a = new Bone(), b = new Bone(); a.name = 'a'; b.name = 'b'; f.root.add(a, b);
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.bind(new Skeleton([b, a])); f.root.add(mesh);
    expect(() => bindRig(f.root, [], { skeleton: 'skin', clips: [], sockets: [] }, { skeleton: 'skin', joints: [['a', 'b']] })).toThrow('joint order');
    expect(() => bindRig(f.root, [], { skeleton: 'skin', clips: [], sockets: [] }, { skeleton: 'skin', joints: [['b', 'a']] })).not.toThrow();
  });
  it('accepts declared procedural poses without inventing clips', () => {
    const rig = bindRig(new Group(), [], { skeleton: 'procedural', clips: ['idle'], sockets: [] }, { skeleton: 'procedural', procedural: ['idle'] });
    expect(rig.clips.size).toBe(0);
  });
});
describe('animation machine', () => {
  it('crossfades at authored times, holds poses, and releases on scope disposal', () => {
    const f = fixture(), rig = bindRig(f.root, [f.idle, f.attack], contract, bake), scope = new Scope('rig');
    const machine = new AnimMachine({ loops: ['idle'], states: { cut: { clip: 'attack.cut', fade: 0.1, hold: true } } }, rig, scope);
    const channel = machine.base('idle'); machine.transition('cut');
    channel.update(0.05, 0, undefined); machine.update(0.05);
    expect(machine.action('attack.cut').getEffectiveWeight()).toBe(0.5);
    expect(rig.sockets.get('weapon')?.position.x).toBeCloseTo(0.025);
    machine.transition('cut'); expect(channel.layers).toHaveLength(1);
    channel.update(1, 0, undefined); machine.update(1); expect(channel.top?.hold).toBe(true);
    scope.dispose(); expect(() => machine.action('idle')).toThrow('no playable clip');
  });
});
