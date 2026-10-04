import { expect, it } from 'vitest';
import { Vector3, Quaternion, Group } from 'three';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { EntityIds } from '../../src/engine/entities/ids';
import { fnv1a32 } from '../../src/engine/core/rng';
import type { FightCommand } from '../../src/engine/input/commands';
import type { Actor } from '../../src/engine/combat/pipeline';
import type { TargetAnimal, Targets } from '../../src/engine/combat/types';
import { TemplateWhip } from '../../src/shards/_template/weapons/TemplateWhip';

function fixture() {
  const app = new App(), scope = new Scope('recorded-fight'), ids = new EntityIds('creature');
  const actor: Actor = {
    id: ids.allocate(), tags: ['actor.creature', 'creature.boar'], state: [],
    attributes: { health: 100, maxHealth: 100 }, get alive() { return this.attributes.health > 0; },
    applyDamage(req) { this.attributes.health = Math.max(0, this.attributes.health - req.amount); return !this.alive; },
  };
  const body: TargetAnimal = { position: new Vector3(0, 0, -3), kind: 'boar', get alive() { return actor.alive; },
    damageFor: () => 18, applyDamage: () => false };
  const hits: string[] = [];
  const targets: Targets = { raycast: (origin, dir) => {
    if (!actor.alive || dir.z > -0.9) return null;
    return { animal: body, point: origin.clone().addScaledVector(dir, 3), distance: 3, headshot: false };
  } };
  app.events.on('damage.dealt', (hit) => { hits.push(`${hit.req.target.id}:${String(hit.dealt)}`); }, scope);
  const weapon = new TemplateWhip(app, targets, () => actor);
  // An attached view with an unrelated transform cannot influence command-driven hits.
  const presentation = new Group(); presentation.position.set(500, 80, 900); presentation.rotation.y = Math.PI; presentation.add(weapon.model); presentation.updateMatrixWorld();
  return { app, actor, weapon, hits, presentation,
    hash: () => fnv1a32(JSON.stringify({ id: actor.id, hp: actor.attributes.health, hits })),
    dispose: () => { scope.dispose(); app.engineScope.dispose(); } };
}

it('replays a recorded fight through the real weapon and combat pipeline to an identical Node hash', () => {
  const commands: FightCommand[] = Array.from({ length: 7 }, (_, i) => ({
    action: 'attack', aim: { origin: { x: 0, y: 1.68, z: 0 }, direction: { x: 0, y: 0, z: i === 1 ? 1 : -1 } },
  }));
  const first = fixture(), replay = fixture();
  try {
    for (const command of commands) {
      first.weapon.executeCommand(command); first.weapon.update(0.4); first.app.events.flush('fixed.post');
      replay.presentation.position.addScalar(100); replay.presentation.updateMatrixWorld();
      replay.weapon.executeCommand(command); replay.weapon.update(0.4); replay.app.events.flush('fixed.post');
    }
    expect(first.hits).toHaveLength(6); expect(first.actor.alive).toBe(false);
    expect(replay.hash()).toBe(first.hash()); expect(replay.hits).toEqual(first.hits);
  } finally { first.dispose(); replay.dispose(); }
});

it('keeps commanded aim through quaternion sweep transforms without a camera', () => {
  const f = fixture();
  try {
    f.weapon.setAimCommand({ origin: { x: 8, y: 2, z: 3 }, direction: { x: -1, y: 0, z: 0 } });
    const origin = new Vector3(), q = new Quaternion(), direction = new Vector3();
    f.weapon.aimPose(origin, q); f.weapon.aimRay(origin, direction);
    expect(origin.toArray()).toEqual([8, 2, 3]); expect(new Vector3(0, 0, -1).applyQuaternion(q).distanceTo(direction)).toBeLessThan(1e-12);
  } finally { f.dispose(); }
});

it('allocates stable entity ids without positions or LOD and restores the spawn ordinal', () => {
  const first = new EntityIds('actor');
  expect(first.allocate('boss')).toBe('boss'); expect(first.allocate()).toBe('actor:0');
  const snapshot = first.snapshot(), replay = new EntityIds('actor'); replay.restore(snapshot);
  expect(first.allocate()).toBe(replay.allocate()); expect(() => replay.allocate('boss')).toThrow('Duplicate');
});
