import type { SpeciesDef, ThinkCtx } from '@wildshard/engine/entities/species/registry';
import { NO_FUR } from '@wildshard/engine/entities/species/rigs';
import { engineString } from '@wildshard/engine/strings';



import { nalatiBody, poseNalatiCreature } from './presentation';
import type { ReturnProgram } from '@wildshard/game/population/returnProgram';
import type { Rng } from '@wildshard/engine/core/rng';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { FlockThreat } from '@wildshard/engine/ai/flock';
import { Vector3 } from 'three';

interface DogFlock {
  readonly flock: { readonly cx: number; readonly cz: number; straggler: (minimum: number) => number; positions: (index: number, out: Vector3) => Vector3 };
  readonly wolves: readonly FlockThreat[]; readonly rng: Rng; bark: (x: number, z: number) => void;
}
const dogs = new WeakMap<object, DogFlock & { readonly author: ReturnProgram }>();
/** Bind the real flock, stream and bark; decision policy lives only in admission.as. */
export function setDogFlock(dog: object, flock: DogFlock, author: ReturnProgram): void { dogs.set(dog, { ...flock, author }); }
const sheep = new Vector3();
/** Apply the guest's 10 Hz decision on the existing body scheduler. */
export function thinkSheepdog<A extends AnimalSim>(a: A, c: Pick<ThinkCtx, 'dt' | 't' | 'player'> & {
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
  pathYaw: (actor: A, x: number, z: number, every?: number) => number; confine: (actor: A) => void;
}): void {
  const bound = dogs.get(a);
  if (bound === undefined || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  const { flock: f, author } = bound, p = a.position, m = a.mem;
  const previous = m['dogThinkAt'], dt = previous === undefined ? c.dt : c.t - previous;
  if (previous !== undefined && dt < 0.1 - 1e-9) return;
  m['dogThinkAt'] = c.t;
  let wolf: FlockThreat | null = null, distance = Infinity;
  for (const candidate of bound.wolves) {
    const d = Math.hypot(candidate.position.x - f.cx, candidate.position.z - f.cz);
    if (candidate.alive && d < distance) { wolf = candidate; distance = d; }
  }
  const straggler = f.straggler(12); if (straggler >= 0) f.positions(straggler, sheep);
  const answer = author.project('dog', { px: p.x, py: p.y, pz: p.z, cx: f.cx, cz: f.cz, dt,
    bark: m['barkT'] ?? 0, rest: m['rest'] ?? 0, wolf: Number(wolf !== null), distance: wolf === null ? 0 : distance,
    wx: wolf?.position.x ?? 0, wy: wolf?.position.y ?? 0, wz: wolf?.position.z ?? 0,
    straggler: Number(straggler >= 0), sx: sheep.x, sy: sheep.y, sz: sheep.z,
    playerX: c.player.x, playerY: c.player.y, playerZ: c.player.z }, bound.rng);
  const n = (key: string): number => { const value = answer[key]; if (value === undefined) throw new Error('Missing sheepdog decision'); return value; };
  m['barkT'] = n('bark'); m['snarl'] = n('snarl'); m['low'] = n('low');
  if (answer['rest'] !== undefined) m['rest'] = n('rest');
  const state = (['idle', 'alert', 'stalk', 'wander'] as const)[n('state')]; if (state === undefined) throw new Error('Invalid sheepdog state');
  a.state = state; a.lookTarget.set(n('lookX'), n('lookY'), n('lookZ')); a.lookWeight = n('look');
  const path = n('path'), yaw = path > 0 ? c.pathYaw(a, n('x'), n('z'), path) : n('yaw');
  if (path < 0) a.setMotion(yaw, n('speed'), n('turn')); else c.steer(a, yaw, n('speed'), n('turn'));
  if (n('emit') !== 0) bound.bark(p.x, p.z); c.confine(a);
}


/**
 * The camp's sheepdog (Nalati, row B4): a black-and-white collie on the wolf's canid build (species/wolf.ts, trait
 * `dog`: softer ears, shorter muzzle, a feathered white-tipped tail), 0.55 m at the shoulder. Its AI is the flock's
 * (`thinkSheepdog` here, policy in behaviour/admission.as — `flock.setDog(dog)`): circles the flock, fetches stragglers, stands
 * between the sheep and a wolf barking. Not hostile; not a quarry.
 */
export const SHEEPDOG_SPECIES: SpeciesDef = {
  rigContract: { skeleton: 'sheepdog.v1', clips: [], sockets: ['body', 'head'] },
  kind: 'sheepdog',
  label: engineString('s_062ffea0e911'),
  fur: NO_FUR,
  aggressive: false,
  tick: 'ai',
  walkSpeed: 1.4,
  sounds: { call: 'dog_bark', hurt: 'dog_yelp', callEvery: [40, 120] },
  pose: { grazeNeck: 0.5, gallopTail: 0.2 },
  gait: { trot: 1.6, gallop: 5.0 },
  variants: [{ id: 'collie', label: engineString('s_062ffea0e911'), weight: 1, rarity: 'common', scale: [.7, .72], hp: 60 }],
  build: variant => nalatiBody('canid', variant),
  postPose: context => { poseNalatiCreature(context.alive ? 'canid' : 'canidDead', context); },
  think: thinkSheepdog,
};
