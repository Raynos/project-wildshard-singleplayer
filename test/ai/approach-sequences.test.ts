import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as Heightfield from '#engine/world/Heightfield';
import { getActiveChunk, setActiveChunk } from '#game/shard/registry';
import { activePhysics, setActivePhysics } from '#engine/physics/active';
import { manager } from '../fake/manager';
import { creature } from '../fake/creature';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
const originalChunk = getActiveChunk().slug;
const originalPhysics = activePhysics();
afterEach(() => { setActiveChunk(originalChunk); setActivePhysics(originalPhysics); });
describe('scripted approach and departure through current manager brains', () => {
  it.each([['boar', 'boar'], ['bear', 'black'], ['deer', 'doe'], ['elk', 'cow']] as const)('%s/%s keeps its seeded states and damage contacts', (kind, variant) => {
    setActiveChunk('pine-hollow'); setActivePhysics(null); const f = manager(), animal = f.manager.spawn(kind, 0, 0, 0, variant);
    const states: { frame: number; state: string }[] = [], hits: number[] = [];
    f.manager.onCharge = (_a, amount) => { hits.push(amount); };
    let frame = 0;
    f.game.onLate(() => { frame++; if (states.at(-1)?.state !== animal.state) states.push({ frame, state: animal.state }); }, 'state trace', true);
    for (const [distance, frames] of [[120, 120], [30, 180], [5, 300], [200, 600]] as const) {
      f.player.position.set(0, 0, distance); f.advance(frames);
    }
    expect(states.length).toBeGreaterThan(1); expect({ states, hits }).toMatchSnapshot(`${kind} approach and leave`);
  });
  it('a ground monkey returns to its palm and climbs when the player leaves', () => {
    const f = creature('monkey', 'monkey', { perches: [new THREE.Vector3(0, 5, 0)] });
    f.advance(7); Object.assign(f.animal.mem, { st: 4, cd: 0, gt: 0, onGround: 1, perch: 0 });
    f.ctx.player.z = 50; f.advance(360); expect(f.states).toMatchSnapshot('monkey returns and climbs');
    expect(f.states).toContain('perch');
  });
});
