import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import { Bodies, Body } from '@wildshard/engine/physics/bodies';
import type { Collider } from '@dimforge/rapier3d-simd';
import { BARREL_BODY, BARREL_HALF, BarrelWatch, barrelAtPlate, plateOverlap, type BarrelEnv } from '@wildshard/engine/world/interact/barrel';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import { bindInteractionTransitions, type InteractionState } from '@wildshard/engine/world/interact/flags';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { DeclaredQuests } from '@wildshard/game/quest/declared';
import { bindQuestTableSpots, QuestRewardController } from '@wildshard/game/plugin/quests';
import { installDeclaredQuestHost } from '@wildshard/game/plugin/simulation';
import { createAchievementCounters } from '@wildshard/game/achievements';
import { DRIFTWOOD_FEAT_COUNTERS, DRIFTWOOD_NATIVE_PACK } from '../data/questInventory';
import baked from '../data/spots.generated.json' with { type: 'json' };
import { NativeInventory } from '@wildshard/game/inventoryLaw';
import { ZiplineDriver } from '@wildshard/sdk/movers';
import type { DirectorScriptStageLane } from '@wildshard/game/plugin/director';
import { bindHeadlessPrompts, createHeadlessPromptPicker, parsePromptRegistrations, type PromptRegistration, type HeadlessPrompt } from '@wildshard/sdk/runtime/prompts';

/** Native command IDs, prompt/contact thresholds and limits are authored JSON. */
import policy from '../data/nativeQuest.json' with { type: 'json' };

const MAX_BODIES = 64; // Hard finite iteration bound; authored content does not widen it.

const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Row = v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.optional(v.strictObject(xyz)),
  collider: v.optional(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })) });
const Prompt = v.strictObject({ label: v.string(), ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1), rows: v.array(Row), talk: Prompt, sword: Prompt, reward: v.strictObject({ ...xyz, yaw: finite, pitch: finite, phase: finite }),
  promptRegistrations: v.unknown(),
  zipline: v.strictObject({ top: v.strictObject(xyz), bottom: v.strictObject(xyz), sag: finite, prompt: v.strictObject({ ...xyz, radius: finite }) }) });
/** The quest placements (generators/spots.ts, G350-DW), strictly. */
export type DriftwoodSpots = Omit<v.InferOutput<typeof Spots>, 'promptRegistrations'> & { readonly promptRegistrations: readonly PromptRegistration[] };
/** Driftwood's baked interactable spots, parsed strictly. */
export function driftwoodSpots(): DriftwoodSpots {
  const spots = v.parse(Spots, baked);
  return { ...spots, promptRegistrations: parsePromptRegistrations(spots.promptRegistrations) };
}

/** One body of the island as the quest reads it: its kind and its live actor (the sailor's guard and his fall). */
export interface QuestBody { readonly kind: string; readonly actor: { readonly alive: boolean; readonly position: { readonly x: number; readonly z: number }; readonly combatActor: () => unknown } | null }
/** What the quest keeper is lent. */
export interface DriftwoodQuestPorts {
  readonly source: Shardfile;
  readonly table: InteractTable;
  readonly spots: DriftwoodSpots;
  /** The admitted cable row; the native quest remains the sole carry owner. */
  readonly zipline: ConstructorParameters<typeof ZiplineDriver>[0];
  /** the flag feats (quest/Feats.ts; the kill feats are quest/kills.ts's) */
  readonly feats: Parameters<typeof createAchievementCounters>[0]['feats'];
  readonly commands: () => readonly { readonly actorId: string; readonly value: number }[];
  readonly fact: (name: string, entity: string) => void;
  readonly coins: (amount: number, entity: string) => void;
  readonly bodies: () => readonly QuestBody[];
  /** the floor a dropped key lies on (the adventure's floorAt: the ground, else the wreck's deck) */
  readonly floorAt: (x: number, z: number) => number;
  /** the iron sword taken: it goes into the hand (EquipmentService's pickup selects it) */
  readonly ironTaken: () => void;
  /** the still sea the barrel's watch reads (the island's lowered sea) */
  readonly waterLevel: number;
  /** the walk velocity the player asks for this tick (m/s; the page's Player.velocity, which BarrelWatch reads) */
  readonly walk: () => { readonly x: number; readonly z: number };
  /** a restoring install: the barrel's native body comes back with the saved world, never spawned again */
  readonly restoring: boolean;
  /** The admitted finale, stepped at this keeper's existing post-player/ride phase. */
  readonly finale: DirectorScriptStageLane;
  /** Events from the same admitted director, consumed at the native post-player reward phase. */
  readonly reward: { readonly started: boolean };
}

/** The fixed cuboid the page baked for a kit collider box (its centre and half extents), or throws: the world lacks it. */
function bakedBox(physics: SimHost['physics'], c: { x: number; z: number; hw: number; hd: number; yTop: number; yBottom: number }): Collider {
  const cy = (c.yTop + c.yBottom) / 2, hy = (c.yTop - c.yBottom) / 2, hits: Collider[] = [];
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-3;
  physics.world.forEachCollider(collider => {
    const t = collider.translation(), h = collider.halfExtents();
    if (h !== null && collider.parent() === null && near(t.x, c.x) && near(t.y, cy) && near(t.z, c.z) && near(h.x, c.hw) && near(h.y, hy) && near(h.z, c.hd)) hits.push(collider);
  });
  const found = hits[0];
  if (found === undefined) throw new Error('Driftwood\'s baked world has no collider for a kit box');
  return found;
}

/** One table row with its flag spellings made once (the step reads them every tick). */
interface Rule extends InteractionState { readonly spot:DriftwoodSpots['rows'][number] }

const Watch = v.strictObject({ lost: finite, wedge: finite, from: v.strictObject(xyz) });
const Saved = v.strictObject({ key: v.nullable(v.strictObject(xyz)), finale: v.string(), iron: v.boolean(), counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))),
  pack: v.unknown(), zipline: v.unknown(), reward: v.unknown(),
  barrel: v.nullable(v.strictObject({ handle: v.pipe(finite, v.integer(), v.minValue(0)), watch: Watch })) });


/**
 * "The Sealed Ring" in the renderer-free host (SF72): the declared quest rows through the game's declared quest path
 * (`DeclaredQuests` on `host.flags`, its `driftwood.quest` fact through the platform's fact port), and the island's
 * interactables table (quest/interactables.ts) with the engine kit's own rules (world/interact/Interactables.ts: shown /
 * locked / prompt radius / interact, the walk-in sea glass, the plates' slab overlap against the player and items, the
 * sluice's latch), each at the point the page placed it (baked), driven by `script` commands at the kit's prompt radii from
 * the player's eye. Wendell's talk sets `talked:castaway` (his first dialogue's end); the drowned sailor's death drops the
 * hold key where he fell (quest/Spine.ts `kit.moveTo`); the iron sword is taken once no drowned sailor stands
 * (quest/guards.ts) and goes into the hand; the reward beat starts within 7 m of the finale's spot once the captain is dead
 * and sets `seen:reward` 7 s later. The flag feats (quest/Feats.ts) emit their stable ledger facts from the flags.
 * Chest contents enter the actual authored pack through the page's inventory law, in table order, after the row's
 * automatic and explicit flags. The pack is part of the quest continuation; opening an already open chest adds nothing.
 * Explicit script acts answer only the nearest visible live page prompt, with actual registration order and sight
 * metadata. Not modelled: the completion card's freeze/resume controls; travel to the zipline launch; the shown strongbox's collider (the
 * baked world keeps the load-time set). The puzzle barrel is the kit's own body (world/interact/barrel.ts BARREL_BODY) at
 * its baked home in the host's world, which the player's capsule pushes on the page's law (PLAYER_BODY), with the kit's
 * never-jam rule (BarrelWatch, each tick on the walk the player asks for); the open sluice drops its baked collider (on the
 * page it parks the tick its gate starts to lift, here in the tick it opens).
 */
export function installDriftwoodQuest(host: SimHost, ports: DriftwoodQuestPorts): { quests: DeclaredQuests; pack: NativeInventory<string> } {
  const { table, spots } = ports, flags = host.flags;
  const rules: Rule[] = [...bindQuestTableSpots(table, spots.rows, flags, { rows: policy.limits.rows, items: policy.limits.rows, ordered: true }).values()];

  const pack = new NativeInventory<string>(DRIFTWOOD_NATIVE_PACK);
  // The page's carried branch leaves the motor alone and clears impulse/velocity before the ride's post-player update.
  // This one player owner will also host the reward carry; an inactive ride retains the ordinary host motion law.
  const rider = { position: host.player.position, velocity: new Vector3(), pitch: 0, carried: false,
    get yaw(): number { return host.player.yaw; }, set yaw(value: number) { host.player.yaw = value; } };
  if (JSON.stringify(ports.zipline.top) !== JSON.stringify(spots.zipline.top) || JSON.stringify(ports.zipline.bottom) !== JSON.stringify(spots.zipline.bottom) || ports.zipline.sag !== spots.zipline.sag) throw new Error('Driftwood cable row does not match the real native spots');
  const zipline = new ZiplineDriver(ports.zipline, on => {
    rider.carried = on;
    if (!on) flags.set('used:zipline');
  });
  host.usePlayerDriver({ input: command => {
    if (!rider.carried) return false;
    if (command !== undefined && !flags.has(policy.rewardFlag)) host.player.yaw = command.yaw;
    host.playerImpulse.set(0, 0, 0); rider.velocity.set(0, 0, 0); host.playerFall.grounded = false;
    return true;
  }, step: () => undefined });
  const reward = new QuestRewardController(rider, host.dayClock, {
    at: new Vector3(spots.reward.x, spots.reward.y, spots.reward.z), yaw: spots.reward.yaw, pitch: spots.reward.pitch, phase: spots.reward.phase,
    when: () => ports.reward.started,
    finish: () => {
      // Complete.showAfterReward takes carry ownership on its first showing. The card's world freeze and menu
      // choices remain outside this host; preserve its actual carry/seen fence rather than inventing a release.
      if (flags.has('seen:complete')) return false;
      flags.set('seen:complete'); return true;
    },
  });
  host.scope.onDispose(() => { reward.dispose(); });
  const keyPrompt = { x: 0, y: 0, z: 0 };
  const state: { key: { x: number; y: number; z: number } | null; iron: boolean } = { key: null, iron: false };
  const feats=ports.feats.filter(f=>f.kind===undefined);
  if(feats.length>policy.limits.rows||feats.some(f=>f.count>policy.limits.rows))throw new RangeError('Driftwood feats exceed their finite bound');
  let counts=Object.fromEntries(feats.map(feat=>[feat.id,0]));
  const flagRows=feats.map(feat=>DRIFTWOOD_FEAT_COUNTERS.flags.find(row=>row.id===feat.id)??{id:feat.id,method:'count' as const,value:{constant:0 as const}});
  const counter=createAchievementCounters({...DRIFTWOOD_FEAT_COUNTERS,feats,flags:flagRows,write:'each'},
    {read:()=>({...counts}),write:current=>{counts=current;},emit:ports.fact});
  /** the row's prompt point: the hold key's follows where the sailor fell (Interactables.moveTo, 1 m over the key) */
  const promptOf = (r: Rule): { x: number; y: number; z: number } | undefined => {
    if (r.d.kind !== 'key' || state.key === null) return r.spot.prompt;
    keyPrompt.x = state.key.x; keyPrompt.y = state.key.y + 1.0; keyPrompt.z = state.key.z;
    return keyPrompt;
  };
  const guarded = (): boolean => {
    const list = ports.bodies();
    for (let i = 0; i < MAX_BODIES; i++) { const b = list[i]; if (b === undefined) break; if (b.kind === 'sailor' && b.actor?.alive === true) return true; }
    return false;
  };
  let commit: ReturnType<typeof installDeclaredQuestHost>['run'] = () => { throw new Error('Native quest graph is not installed'); };
  const transitions=bindInteractionTransitions(rules,flags,{rowLimit:policy.limits.rows,flagLimit:policy.limits.rows,
    commit:id=>commit(id),item:(id,n)=>{pack.add(id,n);},plate:(row,size)=>plateOverlap(host.physics,row.spot,row.spot.yaw,size,policy.plate),
    touched:r=>{const feet=host.player.position,dx=feet.x-r.spot.x,dz=feet.z-r.spot.z;
      return dx*dx+dz*dz<policy.touch.radius*policy.touch.radius&&Math.abs(feet.y-r.spot.y)<policy.touch.height;}});
  const picker = createHeadlessPromptPicker(host);
  const prompts = bindHeadlessPrompts(spots.promptRegistrations, id => {
    if (id === 'castaway.talk') return { act: policy.actions.talk, position: spots.talk, radius: policy.talkRadius };
    if (id === 'iron-sword') return { act: policy.actions.sword, position: spots.sword, get radius() { return state.iron ? 0 : guarded() ? 1.4 : policy.swordRadius; } };
    if (id === 'zipline') return { act: policy.actions.zipline, position: spots.zipline.prompt, get radius() { return zipline.isRiding ? 0 : spots.zipline.prompt.radius; } };
    const i = rules.findIndex(r => r.d.id === id), r = rules[i];
    if (r?.spot.prompt === undefined) return undefined;
    const prompt: HeadlessPrompt = { act: policy.actions.row + i, get position() { return promptOf(r) ?? r.spot; }, get radius() { return r.promptRadius(); } };
    return prompt;
  });
  const interact = spots.promptRegistrations.flatMap((registration, index) => {
    const prompt = prompts[index];
    if (registration.id === null || prompt === undefined) return [];
    return prompt.act === null ? [] : [{ id: registration.id,
      get x() { return prompt.position.x; }, get y() { return prompt.position.y; }, get z() { return prompt.position.z; },
      get radius() { return picker.pick(prompts)?.act === prompt.act ? prompt.radius : 0; } }];
  });
  const graph = installDeclaredQuestHost(host, ports.source, { spots: { interact, crack: [] }, commands: ports.commands,
    fact: ports.fact, coins: ports.coins, directorActions: new Map(),
    observations: new Map([['sword-free', () => !state.iron && !guarded()], ['zipline-idle', () => !zipline.isRiding]]),
    actions: new Map<string, () => void>([
      ['iron-sword', () => { state.iron = true; ports.ironTaken(); }], ['zipline', () => { zipline.start(); }],
      ...rules.map(row => [row.d.id, () => { transitions.interact(row); }] as const),
    ]) });
  commit = graph.run;

  // the sailor's fall drops the hold key on the floor there (quest/Spine.ts's kill hook, order 10)
  host.events.on('actor.died', ({ actor }) => {
    const body = ports.bodies().find(b => b.actor?.combatActor() === actor);
    if (body?.kind !== 'sailor' || body.actor === null) return;
    const { x, z } = body.actor.position;
    state.key = { x, y: ports.floorAt(x, z), z };
  }, host.scope);

  const syncFeats=():void=>{counter.syncFlags(flags);};
  const offFlags = flags.onChange((f, on) => { if (on && !f.startsWith('plate:') && !f.startsWith('lever:')) syncFeats(); });
  host.scope.onDispose(offFlags);

  // the puzzle barrel (Interactables.placeLive's 'barrel'): the kit's body at its home, upright on the row's yaw, in its
  // own body service over the host's world (pre / post around the host's world step, as the page's fixed phases)
  const barrelRule = rules.find(r => r.d.kind === 'barrel'), plates = rules.filter(r => r.d.kind === 'plate');
  const leash = barrelRule?.d.kind === 'barrel' ? barrelRule.d.leash : 0;
  const home = barrelRule === undefined ? null : { x: barrelRule.spot.x, y: barrelRule.spot.y, z: barrelRule.spot.z };
  const upright = { x: 0, y: Math.sin((barrelRule?.spot.yaw ?? 0) / 2), z: 0, w: Math.cos((barrelRule?.spot.yaw ?? 0) / 2) };
  const walked = { x: 0, y: 0, z: 0 }, player = { position: host.player.position, velocity: walked };
  let service = new Bodies(host.physics, host.player.position), barrel: Body | null = null, watch: BarrelWatch | null = null, adopt: number | null = null;
  const env: BarrelEnv = {
    player, floorAt: ports.floorAt, water: () => ports.waterLevel,
    onPlate: c => plates.some(p => p.d.kind === 'plate' && p.shown() && barrelAtPlate(c, p.spot, p.d.size)),
  };
  const lifted = { x: 0, y: 0, z: 0 };
  const lift = (p: { x: number; y: number; z: number }): { x: number; y: number; z: number } => { lifted.x = p.x; lifted.y = p.y + BARREL_HALF + 0.01; lifted.z = p.z; return lifted; };
  const spawnBarrel = (): void => {
    if (home === null) return;
    barrel = service.spawn({ ...BARREL_BODY, owner: policy.barrelOwner }, lift(home), undefined, upright);
    watch = new BarrelWatch(home, leash);
  };
  /** the barrel back at its start, upright, at rest (Interactables.sendHome) */
  const sendHome = (b: Body): void => { if (home !== null) b.teleport(lift(home), upright); watch?.clear(); };
  // the sluice's baked collider (the gate as the page loaded it, shut): it leaves the world once the gate opens
  const sluiceRule = rules.find(r => r.d.kind === 'door' && r.d.latch === true && r.d.opensWhen !== undefined && r.spot.collider !== undefined);
  let sluice: Collider | null = null;
  const findSluice = (): void => { sluice = sluiceRule?.spot.collider === undefined ? null : bakedBox(host.physics, sluiceRule.spot.collider); };
  host.onStep(policy.step, dt => {
    // the barrel first (Interactables.update: its pose from the body, then the never-jam rule; plates feel the body itself)
    const b = barrel;
    if (b !== null) {
      service.post(dt);
      const asked = ports.walk(); walked.x = rider.carried ? 0 : asked.x; walked.z = rider.carried ? 0 : asked.z;
      if (watch?.check(b.curr, dt, env) === true) sendHome(b);
      service.pre(dt);
    }
    transitions.step();
    // the open gate's collider leaves the world (Interactables.syncDoor parks it; the sluice latches open)
    if (sluiceRule !== undefined && flags.has(sluiceRule.open) && sluice?.isEnabled() === true) sluice.setEnabled(false);
    // Adventure's zipline update is after the player/kit and before the finale's reward beat.
    zipline.update(dt, rider);
    // Only the admitted script owns finale timing; the native quest/body clock keeps its original phase.
    ports.finale.update(dt);
    reward.update(dt, flags.has(policy.rewardFlag));
  }, {
    snapshot: () => ({ key: state.key, finale: ports.finale.snapshot(), iron: state.iron, pack: pack.snapshot(), zipline: zipline.snapshot(), reward: reward.snapshot(), counts: { ...counts },
      barrel: barrel === null || watch === null ? null : { handle: barrel.rb.handle, watch: watch.state() } }),
    restore: value => {
      const saved = v.parse(Saved, value);
      zipline.restore(saved.zipline);
      reward.restore(saved.reward);
      pack.restore(saved.pack);
      ports.finale.restore(saved.finale); state.key = saved.key; state.iron = saved.iron;
      counts=Object.fromEntries(feats.map(f=>[f.id,saved.counts[f.id]??0]));
      if ((saved.barrel === null) !== (home === null)) throw new Error('Incompatible Driftwood barrel continuation');
      if (saved.barrel !== null && home !== null) { watch = new BarrelWatch(home, leash); watch.restore(saved.barrel.watch); adopt = saved.barrel.handle; }
    },
    // the restored world holds the barrel's native body: a body service over it adopts it by handle (its pose and last
    // velocity read back off the body, as a step leaves them); the sluice's collider is found again in the new world
    physicsRestored: () => {
      service = new Bodies(host.physics, host.player.position); findSluice();
      if (adopt === null) return;
      const world = host.physics.world;
      if (!world.bodies.contains(adopt)) throw new Error('Saved Driftwood barrel has no native body');
      const rb = world.getRigidBody(adopt), b = new Body(rb, rb.collider(0), { ...BARREL_BODY, owner: policy.barrelOwner }, 0);
      service.list.push(b); barrel = b; adopt = null;
    },
  });
  if (!ports.restoring) { spawnBarrel(); findSluice(); }
  return { quests: graph.quests, pack };
}
