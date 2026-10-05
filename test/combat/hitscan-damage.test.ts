import { AR15 } from '../../src/kit/weapons/firearm/profiles';
import { LEVER_PROFILE, LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import type * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Rifle } from '../../src/shards/nalati-grasslands/runtime/weapons/Rifle';

import { app } from '../../src/engine/app/runtime';
import { setSetting } from '../../src/engine/ui/Settings';
import { setActivePhysics } from '../../src/engine/physics/active';
import { damageFor } from '../../src/engine/entities/AnimalView';
import { legacyActor, invokeLegacy, damageTarget } from '../fake/legacyActor';
import { fakeWorld } from '../fake/world';

beforeEach(() => { app.rng.seed(11); setActivePhysics(null); setSetting('tracers', false); });
afterEach(() => { setActivePhysics(null); });

describe('AR-15 and lever hitscan keep distinct damage, seeded spread and ranges', () => {
  for (const [name, prototype, scale, range] of [['AR-15', Rifle.prototype, 0.55, 300], ['lever', LeverRifle.prototype, 1.5, 320]] as const) {
    for (const headshot of [false, true]) for (const distance of [20, 60, 100]) {
      it(`${name} ${headshot ? 'head' : 'body'} at ${distance}m uses damageFor × ${scale} without rounding twice`, () => {
        const world = fakeWorld(), target = damageTarget(), point = (headshot ? target.head : target.body).clone(); point.z = -distance;
        app.rng.seed(11);
        // The hitscan consumes three direction draws and one spread radius before rolling body damage.
        for (let i = 0; i < 4; i++) app.rng.stream('gameplay').next();
        const roll = damageFor(headshot, distance); app.rng.seed(11); target.animal.damageFor = damageFor;
        let requestedRange = 0; const directions: number[][] = [];
        const weapon = legacyActor(prototype, {
          profile: name === 'lever' ? LEVER_PROFILE : AR15, game: world.game.asGame(), player: world.player, adsBlend: 0, bloom: 0,
          targets: { raycast: (_origin: THREE.Vector3, dir: THREE.Vector3, max: number) => {
            requestedRange = max; directions.push(dir.toArray()); return { animal: target.animal, point, distance, headshot };
          } }, onHit: undefined, onImpact: undefined, puffs: { emit: () => undefined },
        });
        invokeLegacy(weapon, 'hitscan');
        expect(requestedRange).toBe(range); expect(target.dealt).toEqual([roll * scale]);
        app.rng.seed(11); invokeLegacy(weapon, 'hitscan'); expect(directions[1]).toEqual(directions[0]);
      });
    }
  }
});
