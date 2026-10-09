// oxlint-disable-next-line import/no-nodejs-modules -- The Well rail test builds a native physics world.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Physics } from '../../../src/engine/physics/Physics';
import { CharacterMotor } from '../../../src/engine/physics/CharacterMotor';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { groups } from '../../../src/engine/physics/groups';
import { tagCollider } from '../../../src/engine/physics/surface';
import type { GrapplePorts } from '../../../src/shards/nine-dragon-stack/grapple/course';
import { hookVisible, wellCourse } from '../../../src/shards/nine-dragon-stack/grapple/sim';
import { RIM_Z } from '../../../src/shards/nine-dragon-stack/runtime/grapple';

let R: Rapier;
beforeAll(async () => { R = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

/** The south rim's rail at z = RIM_Z across the Well (x −28…0), tagged with `owner`, the claw's eye on the rim behind it. */
function rail(owner: unknown): { ports: GrapplePorts; physics: Physics } {
  const physics = new Physics(R);
  const collider = physics.world.createCollider(R.ColliderDesc.cuboid(2, 1, 0.1).setTranslation(-5, 126.7, RIM_Z).setCollisionGroups(groups('WORLD')));
  tagCollider(collider, 'stone', owner);
  const motor = new CharacterMotor(physics, { radius: 0.38, height: 1.8, step: 0.35, maxClimbDeg: 40, snap: 0.3, group: 'PLAYER', blockedBy: ['WORLD'], owner: {}, weight: 80 });
  physics.step();
  return { physics, ports: { physics, body: { position: new Vector3(-5, 125, 13.5), velocity: new Vector3(), onGround: true, motor } } };
}
const eye = new Vector3(-5, 126.7, 13.5), hook = new Vector3(-5, 126, -10);
const course = wellCourse([hook], RIM_Z, () => undefined);

it.each([
  ['the page\'s piece object', { id: 'nds-floors' }, true],
  ['the host\'s piece id', 'nds-floors', true],
  ['the page\'s safety cap object', { id: 'nds-grapple-guard' }, true],
  ['the host\'s safety cap id', 'nds-grapple-guard', true],
  ['another piece object', { id: 'nds-fronts' }, false],
  ['another piece id', 'nds-fronts', false],
  ['no owner', null, false],
] as const)('sees a hook past the Well rail when the rail is tagged with %s', (_label, owner, seen) => {
  const { ports, physics } = rail(owner);
  try { expect(hookVisible(ports, course, eye, hook)).toBe(seen); } finally { physics.world.free(); }
});
