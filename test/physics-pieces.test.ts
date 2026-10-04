// PHYSICS.md P2b: the world registry and ColliderDesc. A registered piece's descs become Rapier colliders tagged with
// the piece and its material; a box desc from a legacy Collider sits where the old box did; treads are solid steps
// no taller than their rise, so the character motor climbs them.
import { describe, expect, it } from 'vitest';
import { Object3D } from 'three';
import { boxInFrame } from '../src/engine/physics/box';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { addPiece, treadBoxes } from '../src/engine/physics/pieces';
import { tagOf } from '../src/engine/physics/surface';
import { CharacterMotor } from '../src/engine/physics/CharacterMotor';
import { groups } from '../src/engine/physics/groups';
import { WorldRegistry, boxDesc, type Piece } from '../src/engine/world/registry';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

const rapier = async () => loadRapier(await (await fetch(wasmInline)).arrayBuffer());

describe('world registry', () => {
  it('hands every piece to every listener, earlier pieces included', () => {
    const reg = new WorldRegistry();
    const seen: string[] = [];
    reg.add({ id: 'a', name: 'A', category: 'props', file: 'x.ts' });
    reg.onAdd((p) => { seen.push(p.id); });
    reg.add({ id: 'b', name: 'B', category: 'props', file: 'x.ts' });
    expect(seen).toEqual(['a', 'b']);
    expect(reg.get('b')?.name).toBe('B');
  });
});

describe('pieces → Rapier', () => {
  it('keeps NPC collision boxes axis aligned while the figure turns and follows its translation', async () => {
    const ph = new Physics(await rapier()), figure = new Object3D();
    figure.position.set(4, 2, 1); figure.rotation.y = 1;
    const piece: Piece = { id: 'npc', name: 'NPC', category: 'people', file: 'x.ts', follows: figure, followRotation: false,
      colliders: [boxInFrame({ x: 4, z: 1, hw: 0.28, hd: 0.28, rot: 0, yTop: 3.8, yBottom: 1.7 }, figure, 'wood', false)] };
    const added = addPiece(ph, piece);
    figure.rotation.y = 2; figure.position.x = 5; added.sync(); ph.step();
    const c = added.colliders[0]; if (!c) throw new Error('Expected NPC box');
    expect(c.translation().x).toBeCloseTo(5); expect(c.translation().y).toBeCloseTo(2.75);
    expect(c.rotation()).toMatchObject({ x: 0, y: 0, z: 0, w: 1 });
    ph.dispose();
  });
  it('rebuilds state box dimensions without adding colliders and keeps hidden pieces disabled', async () => {
    const ph = new Physics(await rapier());
    let active = true;
    const piece: Piece = { id: 'lever', name: 'Lever', category: 'props', file: 'x.ts', active: () => active,
      colliders: [boxDesc({ x: 4, z: 1, hw: 0.22, hd: 0.18, rot: 0, yTop: 0.4, yBottom: -0.5 })] };
    const added = addPiece(ph, piece);
    active = false; added.sync();
    piece.colliders = [boxDesc({ x: 4, z: 1, hw: 0.22, hd: 0.18, rot: 0, yTop: 1.2, yBottom: -0.5 })];
    added.sync();
    expect(ph.world.colliders.len()).toBe(1); expect(added.colliders[0]?.isEnabled()).toBe(false);
    active = true; added.sync(); ph.step();
    let hit = false;
    ph.world.intersectionsWithPoint({ x: 4, y: 1, z: 1 }, () => { hit = true; return false; });
    const collider = added.colliders[0];
    if (!collider) throw new Error('Expected rebuilt collider');
    expect(hit).toBe(true); expect(tagOf(collider)).toEqual({ owner: piece, material: 'wood' });
    ph.dispose();
  });
  it('a legacy box becomes a cuboid in the same place, tagged with its piece and material', async () => {
    const R = await rapier();
    const ph = new Physics(R);
    const piece: Piece = { id: 'hut', name: 'Hut', category: 'buildings', file: 'src/shards/driftwood-isle/world/Hut.ts', surface: 'planks',
      colliders: [boxDesc({ x: 4, z: 1, hw: 2, hd: 0.2, rot: 0.7, yTop: 3, yBottom: 0 })] };
    const cs = addPiece(ph, piece).colliders;
    ph.step();
    expect(cs).toHaveLength(1);
    const c = cs[0];
    if (!c) throw new Error('no collider');
    expect(tagOf(c)).toEqual({ material: 'planks', owner: piece });
    // a point 1.5 m along the box's long axis (old convention: world = R2(rot)·local) is inside; 1.5 m across is not
    const along = { x: 4 + 1.5 * Math.cos(0.7), z: 1 + 1.5 * Math.sin(0.7) }, across = { x: 4 - 1.5 * Math.sin(0.7), z: 1 + 1.5 * Math.cos(0.7) };
    let a = false, b = false;
    ph.world.intersectionsWithPoint({ x: along.x, y: 1.5, z: along.z }, () => { a = true; return false; });
    ph.world.intersectionsWithPoint({ x: across.x, y: 1.5, z: across.z }, () => { b = true; return false; });
    expect([a, b]).toEqual([true, false]);
    ph.dispose();
  });

  it('treads: count solid steps of equal rise, and the motor walks up them', async () => {
    const stair = { kind: 'treads', from: { x: 0, y: 0, z: 2 }, to: { x: 0, y: 2.6, z: 5.3 }, width: 1.2, count: 8 } as const;
    const boxes = treadBoxes(stair);
    expect(boxes).toHaveLength(8);
    expect(boxes.map((b) => Number((b.y + b.hy).toFixed(3)))).toEqual([0.325, 0.65, 0.975, 1.3, 1.625, 1.95, 2.275, 2.6]);
    const R = await rapier();
    const ph = new Physics(R);
    ph.world.createCollider(R.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0).setCollisionGroups(groups('WORLD')));
    addPiece(ph, { id: 'stair', name: 'Stair', category: 'buildings', file: 'x.ts', colliders: [stair] });
    const motor = new CharacterMotor(ph, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'] });
    ph.step();
    const feet = { x: 0, y: 0.02, z: 0 };
    let vy = 0;
    for (let i = 0; i < 180; i++) {
      vy -= 22 / 60;
      if (motor.move(feet, { x: 0, y: vy / 60, z: 4.3 / 60 }).grounded && vy < 0) vy = 0;
      ph.step();
      if (feet.z > 5.1) break; // on the last tread (the stair ends in the air at z 5.3)
    }
    expect(feet.y).toBeGreaterThan(2.25); // 0.325 m treads, a 44° stair as a ramp — climbed as steps
    ph.dispose();
  });
});
