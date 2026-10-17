/** Native boss shell: roster lifetime, ordered presence/brain/room steps,
 * damage ownership, reward flags and save continuation are shared platform law. */
import { nativeDecisions } from '../shardfile/borrowedDecisions';
import { populationRoster, type NativePopulationActor } from '../population/roster';
import { nativeCreaturePose } from '../plugin/animation';
import { grantNativeInventory } from '../inventoryLaw';
import type { SpeciesProgramData } from '@wildshard/format/speciesPrograms';
import * as v from 'valibot';
import { Vector3 } from 'three';
import { canReach } from '@wildshard/engine/ai/reach';
import type { SimHost } from '@wildshard/engine/sim';
import { bossFlagRecord, installBossRow } from '@wildshard/game/shardfile/bossRow';
import { parseRoamingEncounter, NativeBossBindingSchema, type NativeBossBinding, type RoamingEncounterRow } from '@wildshard/format/bossEncounter';
import { groundBossDormant, createGroundBossFight, groundBossPresence, type GroundBossEnv, type GroundBossFight } from './roaming';
import { roamingFightState, restoreRoamingFight } from './continuation';
import { Lane } from './lane';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { itemPickupFloor, ITEM_PICKUP_HOVER } from '@wildshard/engine/world/interact/pickup';
import { pickPrompt } from '@wildshard/engine/world/interact/prompts';

/** The actual native body remains owned by its installed population service. */
export type NativeGroundBossBody = NativePopulationActor;
type BossBrain = ReturnType<typeof installBossRow>['boss'];
/** Data references to built-in services; arbitrary ports are not admitted. */
const RIB_POINT = new Vector3();
const silentTell = { setTime: (): void => undefined, ring: (): void => undefined, hide: (): void => undefined };


function nativeGroundFight(host: SimHost, row: RoamingEncounterRow, program: SpeciesProgramData, binding: NativeBossBinding): { fight: GroundBossFight<NativeGroundBossBody>; own: { first: boolean; light: boolean } } {
  const own = { first: false, light: false }, roster = () => populationRoster(host, binding.population);
  const ribs = (body: NativeGroundBossBody, out: Vector3): Vector3 => {
    const pose = nativeCreaturePose(body); pose.publish(binding.weakPoint.joint); return pose.jointPoint(binding.weakPoint.joint, binding.weakPoint.at, out);
  };
  const reach = (a: NativeGroundBossBody, target: { x: number; y: number; z: number }): boolean => canReach(a, target, host.physics);
  const player = host.player;
  const env: GroundBossEnv<NativeGroundBossBody> = {
    reach,
    player: { position: player.position, get onGround(): boolean { return host.playerFall.grounded; }, shove: (x, z, speed) => { host.shovePlayer(x, z, speed); } },
    // ctx.hurt: blocked unless it reaches (or the move goes through walls), a blow the host knocks the player back from
    hurt: (a, amount, throughWalls = false) => {
      if (!throughWalls && !reach(a, player.position)) return;
      host.combat.hit({ source: a.combatActor(), sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'], target: player.health, amount,
        point: a.position.clone(), dir: new Vector3(), throughWalls, cause: { kind: a.kind, label: a.label } });
    },
    trauma: () => undefined, shot: () => undefined,
  };
  const profiles = new Map(program.strikes.map(strike => [strike.id, strikeFromData(strike)]));
  const bossLane = profiles.get(row.lanes.boss), addLane = profiles.get(row.lanes.add);
  if (bossLane === undefined || addLane === undefined) throw new Error('Missing admitted boss lanes');
  const lane = new Lane<NativeGroundBossBody>(bossLane, reach), waves = Array.from({ length: Math.max(...row.profile.fight.phases.map(phase => phase.rings)) }, () => ({ r: 0, on: false, hit: false, delay: 0 }));
  const addLanes = Array.from({ length: row.lanes.count }, () => new Lane<NativeGroundBossBody>(addLane, reach));
  const fight: GroundBossFight<NativeGroundBossBody> = createGroundBossFight(row, env, {
    groundAt: (x, z) => host.groundHeightAt(x, z),
    body: {
      make: () => {
        const parked = roster().parked().find(candidate => candidate.kind === row.kind);
        if (parked === undefined) throw new Error('Missing parked boss body');
        // Adopt the prewarm once; later appearances consume normal roster draws.
        const a = own.first ? roster().spawnLoose(parked.kind, row.profile.fight.origin.x, row.profile.fight.origin.z, 0, parked.variant)
          : roster().adoptParked(parked.id, row.profile.fight.origin.x, row.profile.fight.origin.z, 0);
        own.first = true;
        a.scripted = true;
        return a;
      },
      retire: k => { roster().retire(k); }, park: k => { k.hidden = true; }, unpark: k => { k.hidden = false; },
    },
    adds: {
      spawn: (kind, x, z, yaw) => {
        const a = roster().spawn(kind, x, z, yaw, row.adds.variant);
        // combat/ctx.ts own: out of its herd, under the fight's control
        a.herd = -1; a.state = row.adds.state; a.scripted = true;
        return a;
      },
      retire: a => { roster().retire(a); }, lanes: () => addLanes,
    },
    lane: () => lane, rings: () => waves,
    // the same forced chest-chain read as the page's cage getter, with its admitted radius
    weakPoint: p => { const k = fight.body; return k !== null && p.distanceTo(ribs(k, RIB_POINT)) < binding.weakPoint.radius * k.scale; },
    views: {
      glow: () => undefined, hung: () => undefined, focus: (k, out) => ribs(k, out),
      // the page's light samples the chest only before the final darkness phase moves it to the camera
      room: () => { if (own.light && fight.darkK <= 0.5 && fight.body !== null) ribs(fight.body, RIB_POINT); },
      light: on => { own.light = on; },
      action: (k, move) => { k.mem[row.actionField] = row.actions[move] ?? 0; }, roar: () => undefined, burst: () => undefined,
      // a dropped lantern's getWorldPosition forces the head's parent chain, even though its view is silent here
      hazard: (_i, _f, _t, event) => { if (event === 'drop' && fight.body !== null) nativeCreaturePose(fight.body).publish(); },
      add: () => undefined, ring: () => undefined, tell: silentTell,
    },
  }, host.level.seed, program, nativeDecisions(host));
  return { fight, own };
}

const finite = v.pipe(v.number(), v.finite());
/** Install from rows without allocating a body or consuming a random draw. */
export function installGroundBoss(host: SimHost, input: unknown, profile: unknown, program: SpeciesProgramData, bindingInput: unknown): { boss: BossBrain; fight: GroundBossFight<NativeGroundBossBody>; locked: () => boolean;
  rewardPoint: () => { x: number; y: number; z: number } | null; takeReward: (eye: { x: number; y: number; z: number }) => boolean } {
  const row = parseRoamingEncounter(input, profile), binding = v.parse(NativeBossBindingSchema, bindingInput), roster = () => populationRoster(host, binding.population);
  const { fight, own } = nativeGroundFight(host, row, program, binding), player = host.player.position, brain: { boss: BossBrain | null } = { boss: null };
  host.onStep(row.steps.presence, () => { if (brain.boss !== null) groundBossPresence(row, brain.boss, fight, player, (host.dayClock?.night ?? 0) > 0.5); });
  // read at install (a restoring install's record is the brain's continuation, which restores over it)
  const record = bossFlagRecord(host.flags, row.record), saved = record.saved;
  let reward: { x: number; y: number; z: number } | null = null;
  const owner = installBossRow(host, { step: row.steps.fight, definition: { ...row.definition, reward: { trophy: () => { grantNativeInventory(host, binding.reward.inventory, binding.reward.grants); } } }, script: fight, body: () => fight.body, shielded: () => fight.shielded,
    fight: {
      // Parked visibility belongs to the fight, outside the body's entity record.
      snapshot: () => ({ first: own.first, lightActive: own.light, hidden: fight.body?.hidden === true, ...roamingFightState(row, fight) }),
      restore: value => {
        const { first, lightActive, hidden } = v.parse(v.object({ first: v.boolean(), lightActive: v.boolean(), hidden: v.boolean() }), value);
        own.first = first;
        own.light = lightActive;
        const actors = new Map<string, NativeGroundBossBody>();
        for (const id of host.entities.keys()) { const actor = roster().actor(id); if (actor !== null) actors.set(id, actor); }
        restoreRoamingFight(row, fight, value, actors);
        if (fight.body !== null) fight.body.hidden = hidden;
      },
    }, saved, persist: record.persist,
    spawnReward: () => { const at = itemPickupFloor(host.physics, fight.rewardPoint()); reward = { x: at.x, y: at.y + ITEM_PICKUP_HOVER + row.reward.hover, z: at.z }; } });
  const Reward = v.strictObject({ version: v.literal(1), point: v.nullable(v.strictObject({ x: finite, y: finite, z: finite })) });
  host.onStep(row.steps.reward, () => undefined, {
    snapshot: () => ({ version: 1, point: reward === null ? null : { ...reward } }),
    restore: value => { const state = v.parse(Reward, value); if (state.point !== null && (!saved.defeated || saved.rewardTaken)) throw new RangeError('Incompatible boss reward'); reward = state.point; },
  });
  brain.boss = owner.boss;
  // The script's damage rule at pipeline order 50: beats and dormant bodies shrug a hit
  // off (×0.01), the open ribcage takes ×3 (shut ×0.6), the bark ×0.25
  host.events.answer('damage.modify', req => {
    const k = fight.body;
    if (req === null || k === null || req.target !== k.combatActor()) return req;
    return { ...req, amount: Math.max(1, Math.round(req.amount * fight.damageMul(k, req.point))) };
  }, host.scope, { order: 50 });
  host.onStep(row.steps.dormant, dt => { groundBossDormant(owner.boss, fight, dt, host.clock.now); });
  return { boss: owner.boss, fight, locked: owner.locked,
    rewardPoint: () => reward === null ? null : { ...reward },
    takeReward: eye => {
      if (reward === null || saved.rewardTaken || pickPrompt([{ position: reward, radius: row.reward.radius }], eye, host.physics) === undefined) return false;
      reward = null; saved.rewardTaken = true; record.persist(saved); return true;
    } };
}
