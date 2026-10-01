import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Rifle } from '#engine/player/Rifle';
import { LeverRifle } from '#shards/pine-hollow/weapons/LeverRifle';
import { app } from '#engine/app/runtime';
import { setSetting } from '#engine/ui/Settings';
import { setActivePhysics } from '#engine/physics/active';
import { damageFor } from '#engine/entities/Animal';
import { legacyActor, invokeLegacy, damageTarget } from '../fake/legacyActor';
import { seedRandom } from '../fake/FakeGame';
import { fakeWorld } from '../fake/world';

let restore: () => void = () => undefined;
beforeEach(() => { restore = seedRandom(11); app.rng.seed(11); setActivePhysics(null); setSetting('tracers', false); });
afterEach(() => { restore(); setActivePhysics(null); });

describe('AR-15 and lever hitscan keep distinct damage, seeded spread and ranges', () => {
  for (const [name, prototype, scale, range] of [['AR-15', Rifle.prototype, 0.55, 300], ['lever', LeverRifle.prototype, 1.5, 320]] as const) {
    for (const headshot of [false, true]) for (const distance of [20, 60, 100]) {
      it(`${name} ${headshot ? 'head' : 'body'} at ${distance}m uses damageFor × ${scale} without rounding twice`, () => {
        const world = fakeWorld(), target = damageTarget(), point = (headshot ? target.head : target.body).clone(); point.z = -distance;
        const expectedRestore = seedRandom(11); const roll = damageFor(headshot, distance); expectedRestore();
        const rollRestore = seedRandom(11); target.animal.damageFor = damageFor;
        let requestedRange = 0; const directions: number[][] = [];
        const weapon = legacyActor(prototype, {
          game: world.game.asGame(), player: world.player, adsBlend: 0, bloom: 0,
          targets: { raycast: (_origin: THREE.Vector3, dir: THREE.Vector3, max: number) => {
            requestedRange = max; directions.push(dir.toArray()); return { animal: target.animal, point, distance, headshot };
          } }, onHit: undefined, onImpact: undefined, puffs: { emit: () => undefined },
        });
        try { invokeLegacy(weapon, 'hitscan'); } finally { rollRestore(); }
        expect(requestedRange).toBe(range); expect(target.dealt).toEqual([roll * scale]);
        app.rng.seed(11); invokeLegacy(weapon, 'hitscan'); expect(directions[1]).toEqual(directions[0]);
      });
    }
  }
});
