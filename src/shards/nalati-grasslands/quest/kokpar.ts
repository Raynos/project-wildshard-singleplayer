import * as THREE from 'three';
import * as v from 'valibot';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import { poiMaterial } from '../world/modelView';
import { bakedActorGeometry } from '../world/places';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import { installChapterStory } from '@wildshard/game/quest/chapter';
import type { AdventurePersistence } from '@wildshard/game/quest/persistence';
import type { Nalati } from '../runtime/state';
import { enteredPeople } from '../models/people';

export interface KokparMount {
  readonly mounted: boolean;
  readonly gait: 'stand' | 'walk' | 'trot' | 'canter' | 'gallop';
  readonly horse: { position: THREE.Vector3; yaw: number } | null;
}
export interface KokparRound {
  readonly object: THREE.Object3D;
  readonly carrying: boolean;
  update: (dt: number, player: THREE.Vector3, mount: KokparMount | null) => void;
  win: () => void;
}

interface KokparViewWorld {
  ctx: Pick<ShardContext, 'scope'>;
  sky: SkyRig;
  hud: { toast: (text: string) => void };
  music: { sting: (name: 'pickup' | 'death' | 'chunk') => void };
  player: { position: THREE.Vector3; yaw: number };
  ride: { mount: KokparMount } | null;
  persistence: { flags: Pick<Flags, 'set'> };
}

export const KokparRows = v.object({ program: v.unknown(), home: v.object({ x: v.number(), z: v.number() }),
  goals: v.array(v.object({ x: v.number(), z: v.number() })), messages: v.record(v.string(), v.string()) });
/** The guest owns round rules; this binding only applies its published pose and service effects. */
export function kokparView(w: KokparViewWorld, floorAt: (x: number, z: number) => number, kokparRows: v.InferOutput<typeof KokparRows>,
goat: THREE.Mesh = new THREE.Mesh(bakedActorGeometry('goat'), poiMaterial(w.sky))): KokparRound {
  goat.castShadow = true; goat.receiveShadow = true; goat.name = 'nalati-kokpar-goat';
  const home = new THREE.Vector3(kokparRows.home.x, floorAt(kokparRows.home.x, kokparRows.home.z) + 0.16, kokparRows.home.z);
  const lie = (): void => { goat.position.copy(home); goat.rotation.set(0, 0.7, Math.PI / 2 - 0.25); };
  lie();
  const brain = ReturnProgram.page(kokparRows.program, w.ctx.scope), state = { carrying: 0, left: 0, slow: 0, cheer: 0, warned: 0 };
  const messages = new Map<string, string>(Object.entries(kokparRows.messages));
  const carryPose = (horse: NonNullable<KokparMount['horse']>): void => {
    goat.position.set(horse.position.x + Math.cos(horse.yaw) * 0.62, horse.position.y + 1.02, horse.position.z - Math.sin(horse.yaw) * 0.62);
    goat.rotation.set(0, horse.yaw + Math.PI / 2, 0.35);
  };
  const project = (signal: string, dt: number, player: THREE.Vector3, mount: KokparMount | null): void => {
    const horse = mount?.horse, out = brain.project(signal, { ...state, dt, playerX: player.x, playerZ: player.z,
      goatX: goat.position.x, goatZ: goat.position.z, mounted: Number(mount?.mounted === true), horse: Number(horse !== null && horse !== undefined),
      fast: Number(mount?.gait === 'canter' || mount?.gait === 'gallop'), practice: Number(practiceRoom.open), horseX: horse?.position.x ?? 0, horseZ: horse?.position.z ?? 0 });
    for (const key of ['carrying', 'left', 'slow', 'cheer', 'warned'] as const) {
      const value = out[key]; if (value === undefined) throw new Error('Missing kokpar state'); state[key] = value;
    }
    const notice = (id: string): void => { const text = messages.get(id); if (text === undefined) throw new Error('Missing kokpar notice'); w.hud.toast(text); };
    if (out['warning'] === 1) notice('6');
    if (out['pose'] === 1) lie();
    else if ((out['pose'] === 2 || out['pose'] === 3) && horse !== null && horse !== undefined) carryPose(horse);
    const event = out['event'];
    if (event !== undefined && event > 0) {
      notice(String(event)); w.music.sting(event === 1 ? 'pickup' : event === 7 ? 'chunk' : 'death');
      if (event === 7) w.persistence.flags.set('won:kokpar');
    }
    if (out['pose'] === 3) {
      const goal = kokparRows.goals[out['goal'] ?? -1]; if (goal === undefined) throw new Error('Missing kokpar goal');
      goat.position.set(goal.x, floorAt(goal.x, goal.z) + 0.9, goal.z); goat.rotation.set(0, 0.3, Math.PI / 2 - 0.2);
    }
  };
  let pending = 0;
  return { object: goat, get carrying() { return state.carrying !== 0; },
    win: () => { project('win', 0, w.player.position, w.ride?.mount ?? null); },
    update: (dt, player, mount) => {
      pending += dt;
      if (pending >= 0.1) { const elapsed = pending; pending = 0; project('step', elapsed, player, mount); }
      else if (state.carrying !== 0 && mount?.horse !== null && mount?.horse !== undefined) carryPose(mount.horse);
    } };
}


/** The remaining counted quest view: native resources feed the chapter, camp
 * and goat at their original phases; every story decision comes from AS. */
export async function installNalatiQuestView(ctx: ShardContext, rt: Pick<Nalati, 'ride' | 'boss' | 'titan'>,
  persistence: AdventurePersistence): Promise<Flags> {
  const alive = (): boolean => !ctx.scope.disposed;
  const world = ctx.game.runtime?.world, play = ctx.game.runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Quest view requires its entered world and play');
  const { game, sky, player, registry } = world, { hud, music, animals } = play, ride = rt.ride;
  const [storyBytes, contentBytes] = await Promise.all([ctx.product.file('quests/chapters.json'), ctx.product.file('quests/content.json')]);
  if (!alive()) throw new Error('The adventure left during story admission');
  const story: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(storyBytes));
  const content: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(contentBytes));
  const floorAt = (x: number, z: number): number => { const y = heightAt(x, z), deck = registry.floorAt(x, z); return deck !== undefined && deck > y && deck < y + 2 ? deck : y; };
  const people = enteredPeople({ ctx, sky, registry }, floorAt);
  const kokparRows = v.parse(v.object({ kokpar: KokparRows }), content).kokpar;
  const chapter = installChapterStory(ctx, story, { content, program: kokparRows.program }), { chip, markers, places, line } = chapter;
  if (places === null || line === null) throw new Error('The chapter requires its original discovery and quest line');
  const flags = chapter.quest.flags;
  const kokpar = kokparView({ ctx, sky, hud, music, player, ride, persistence }, floorAt, kokparRows);
  game.scene.add(kokpar.object);
  let now = 0, slowT = 0, eliteT = -1e9;
  const poll = (): void => { chapter.project('quest', { now, bonded: Number(ride?.taming.phase === 'bonded'), argymaq: Number(ride?.taming.isArgymaq === true),
    inside: Number(rt.boss.inside), tied: Number(rt.titan.fight.tied) });
    if (now - eliteT > 2) { eliteT = now; chapter.project('feathers', { now }); }
  };
  poll();
  const carving = (): void => { chapter.project('carving', { now }); };
  ctx.on('actor.died', ({ actor }) => {
    const body = animals.animals.find(candidate => candidate.combatActor() === actor);
    if (body === undefined) return;
    persistence.kill(body.kind, body.variant); if (body.kind === 'balbal') carving();
  });
  chapter.installFeats();
  ctx.system({ id: 'shard.nalati.quest', phase: 'update', after: ['main.6'], before: ['hud.combat', 'shard.nalati-grasslands.bind', 'first hints', 'main.world', 'main.frame'], run: (dt, t) => {
    now = t; const pp = player.position;
    chapter.update(dt, pp); people.update(dt, t, pp); kokpar.update(dt, pp, ride?.mount ?? null); chip.update(t, player);
    if (t - slowT > 0.5) { slowT = t; poll(); places.update(pp.x, pp.z); }
  } });
  ctx.debug.expose('nalati.quest', { flags, line, people, kokpar, places, chip, markers, get dialogue() { return chapter.dialogueBox(); }, kokparGoals: kokparRows.goals, carving, talk: chapter.talk });
  await people.ready;
  if (!alive()) throw new Error('Nalati was unloaded during the camp people model load');
  return flags;
}
