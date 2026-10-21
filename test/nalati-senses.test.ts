import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { GrassField } from '../src/game/systems/looks/grassField';
import { TrampleField } from '../src/game/systems/looks/trample';
import { NativeWildEnvironment } from '../src/game/population/nativeManager';
import { PageWildEnvironment } from '../src/game/population/pageGroups';
import { ReturnProgram } from '../src/game/population/returnProgram';
import admission from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };
import brains from '../src/shards/nalati-grasslands/data/brains.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };
import { zlibSync } from 'fflate';

type Senses = Pick<NativeWildEnvironment, 'grassHeightAt' | 'grassStandingAt' | 'playerCrouched' | 'lastShotT' | 'light' | 'storm' | 'wind'>;
// Original native/page formulas, retained independently of the AS projection.
function priorVisibility(env: Senses, x: number, z: number, player: Vector3, speed: number, now: number): number {
  const cover = (height: number): number => Math.min(1,Math.max(0,(height-.15)/((env.playerCrouched ? 1.05 : 1.75)-.15)));
  const dx = x-player.x,dz = z-player.z,distance = Math.hypot(dx,dz) || 1;
  let screen = 0;
  for (const step of [1.5,3,5]) { if (step > distance) break; screen += cover(env.grassHeightAt(player.x+dx/distance*step,player.z+dz/distance*step))/3; }
  const motion = now-env.lastShotT < 1 ? 1.5 : speed < .4 ? .3 : speed <= 2.6 ? .7 : speed < 5.2 ? 1 : 1.5;
  return (1-.9*Math.max(cover(env.grassStandingAt(player.x,player.z)),.7*screen))*motion*env.light;
}
function priorHearing(env: Senses, radii: readonly [number,number,number,number], player: Vector3, speed: number): number {
  return (speed < .4 ? radii[0] : speed <= 2.6 ? radii[1] : speed < 5.2 ? radii[2] : radii[3])
    *(speed > .4 && env.grassStandingAt(player.x,player.z) >= .7 ? 1.25 : 1)*(env.storm ? .5 : 1);
}
function priorDownwind(env: Senses, x: number, z: number, player: Vector3): boolean {
  const dx = x-player.x,dz = z-player.z,distance = Math.hypot(dx,dz),wind = env.wind;
  return distance >= 1e-3 && wind.strength >= .05 && (dx*wind.x+dz*wind.z)/distance > .82;
}

test('native and page probes preserve the original sensory boundaries in Nalati AS', () => {
  const scope = new Scope('senses'), author = ReturnProgram.page(admission,scope);
  const field = new GrassField({ seed: 19, half: 16, heightAt: () => 0, normalAt: () => [0,1,0], splatAt: () => [1,0,0,0],
    trailDistance: () => Infinity, cabinMask: () => 0, pondMask: () => 0, waterLevel: () => -100, paint: () => false, layout: null });
  const native = new NativeWildEnvironment(field,new TrampleField(),{ wind: { x: -.8,z: .6,strength: .5 },flatten: .85 },author);
  const page = new PageWildEnvironment();
  const wet = btoa(String.fromCodePoint(...zlibSync(new Uint8Array(16))));
  page.enter(scope,{ pack: { ...brains.pack,members: ['probe'],home: [0,0] },herd: { ...brains.herd,members: ['probe'] },contacts: { pack: strikes.wolf,herd: strikes.stallion },
    world: { res: 2,size: 32,water: -1,wet,pond: wet },wind: native.wind,prey: 'senses',damage: admission },author);
  try {
    const player = new Vector3(2,0,-3), radii = [1.25,3.5,7,14] as const;
    for (const env of [native,page]) {
      let height = 0;
      vi.spyOn(env,'grassStandingAt').mockImplementation(() => height);
      vi.spyOn(env,'grassHeightAt').mockImplementation((x,z) => height*(.7+.2*Math.sin(x-z)));
      for (height of [0,.149999,.15,.699999,.7,1.05,1.75,3]) for (const crouched of [false,true])
        for (const speed of [0,.399999,.4,.400001,2.6,2.600001,5.199999,5.2,8]) {
          env.playerCrouched = crouched; env.storm = crouched; env.light = height/3; env.lastShotT = 4;
          expect(env.hearing(radii,player,speed)).toBe(priorHearing(env,radii,player,speed));
          for (const distance of [0,1.499999,1.5,2.999999,3,4.999999,5,10]) for (const now of [4.999999,5]) {
            expect(env.visibility(player.x+distance,player.z,player,speed,now)).toBe(priorVisibility(env,player.x+distance,player.z,player,speed,now));
          }
        }
      for (const distance of [0,.000999,.001,1,20]) for (const dot of [.819999,.82,.820001,1,-1])
        for (const strength of [0,.049999,.05,.5]) {
          Object.assign(env.wind,{ x: dot,z: Math.sqrt(1-dot*dot),strength });
          expect(env.downwind(player.x+distance,player.z,player)).toBe(priorDownwind(env,player.x+distance,player.z,player));
        }
    }
  } finally { vi.restoreAllMocks(); scope.dispose(); }
});
