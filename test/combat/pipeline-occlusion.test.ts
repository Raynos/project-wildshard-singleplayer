import { Vector3 } from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { App } from '#engine/app/app';
import type { CombatTag, DamageRequest } from '#engine/combat/pipeline';
import { Physics } from '#engine/physics/Physics';
import { loadRapier } from '#engine/physics/rapier';
import { groups, type GroupName } from '#engine/physics/groups';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';
import { legacyHurtFixture } from '../fake/legacyHurt';

let R: Awaited<ReturnType<typeof loadRapier>>;
const worlds: Physics[] = [];
beforeAll(async () => { R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer()); });
afterEach(() => { for (const world of worlds.splice(0)) world.dispose(); });
function setup(wall: boolean, group: GroupName = 'WORLD') {
  const f = legacyHurtFixture(), a = new App(), physics = new Physics(R); worlds.push(physics); a.physics = physics;
  if (wall) physics.world.createCollider(R.ColliderDesc.cuboid(3, 2, 0.1).setTranslation(0, 1, 2).setCollisionGroups(groups(group)));
  physics.step(); a.combat.playerRules(f.scope, { target: f.health });
  const req: DamageRequest = { source: 'env', sourceTags: ['creature.boar'], target: f.health, amount: 35,
    from: new Vector3(0, 1, 0), point: new Vector3(0, 1, 4), dir: new Vector3(0, 0, 1) };
  return { f, a, req };
}
describe('public combat.hit uses the actual shared physics occlusion query', () => {
  it('blocks an occluded contact before damage rules and feedback, while the open hit lands', () => {
    const wall = setup(true), open = setup(false);
    expect(wall.a.combat.hit(wall.req)).toBeNull(); expect(wall.f.api.health).toBe(100);
    expect(wall.f.api.lastHurt).toBe(0);
    expect(open.a.combat.hit(open.req)?.dealt).toBe(20); expect(open.f.api.health).toBe(80);
  });
  it.each(['cover.checked', 'through.walls'] as const)('%s preserves a source’s already-checked path or intentional AoE', (tag: CombatTag) => {
    const { a, req } = setup(true);
    expect(a.combat.hit({ ...req, sourceTags: [...req.sourceTags, tag] })?.dealt).toBe(20);
  });
  it('the explicit throughWalls field permits intentional AoE too', () => {
    const { a, req } = setup(true); expect(a.combat.hit({ ...req, throughWalls: true })?.dealt).toBe(20);
  });
  it.each(['PLAYER', 'CREATURE'] as const)('%s bodies never become world cover', (group) => {
    const { a, req } = setup(true, group); expect(a.combat.hit(req)?.dealt).toBe(20);
  });
});
