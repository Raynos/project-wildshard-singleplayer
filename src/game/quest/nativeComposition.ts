import { NativeQuestCompositionSchema } from '@wildshard/format/nativeQuestComposition';
import { nativeQuestChannels } from './nativeInputs';
import { prepareNativeQuestEntry } from './nativeEntry';
import { nativeStageLane } from '../plugin/director';
import { mixedPopulation } from '../population/mixedRoster';
import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost } from '@wildshard/engine/sim';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { DeclaredQuests } from './declared';
import { QuestRewardController, installNativeQuestProps } from '../plugin/quests';
import type { AchievementCounterData } from '@wildshard/format/achievementCounters';
import type { NativeInventory } from '../inventoryLaw';
import { nativeMeleeItem } from '../plugin/nativeItems';
import { cableModes } from '@wildshard/engine/player/modes';
import { bindHeadlessPrompts, parsePromptRegistrations, type PromptRegistration } from './interactionRows';

const MAX_BODIES = 64; // Hard finite iteration bound; authored content does not widen it.

const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Row = v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.optional(v.strictObject(xyz)),
  collider: v.optional(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })) });
const Prompt = v.strictObject({ label: v.string(), ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1), rows: v.array(Row), talk: Prompt, sword: Prompt, reward: v.strictObject({ ...xyz, yaw: finite, pitch: finite, phase: finite }),
  promptRegistrations: v.unknown(),
  zipline: v.strictObject({ top: v.strictObject(xyz), bottom: v.strictObject(xyz), sag: finite, prompt: v.strictObject({ ...xyz, radius: finite }) }) });

export type NativeQuestSpots = Omit<v.InferOutput<typeof Spots>, 'promptRegistrations'> & { readonly promptRegistrations: readonly PromptRegistration[] };

export function readNativeQuestSpots(input: unknown): NativeQuestSpots {
  const spots = v.parse(Spots, input);
  return { ...spots, promptRegistrations: parsePromptRegistrations(spots.promptRegistrations) };
}

/** Native composition consumes only immutable declarations and service ids. */
export interface NativeQuestCompositionInput {
  readonly rows: unknown; readonly counters: AchievementCounterData;
  readonly source: Shardfile; readonly table: InteractTable;
  readonly spots: NativeQuestSpots;
  readonly props: unknown; readonly restoring: boolean;
}

const Watch = v.strictObject({ lost: finite, wedge: finite, from: v.strictObject(xyz) });
const Saved = v.strictObject({ key: v.nullable(v.strictObject(xyz)), finale: v.string(), iron: v.boolean(), counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))),
  pack: v.unknown(), zipline: v.unknown(), reward: v.unknown(),
  barrel: v.nullable(v.strictObject({ handle: v.pipe(finite, v.minValue(0)), watch: Watch })) });

/** Renderer-free quest step composition on existing prop, cable, input, roster,
 * equipment and director owners. The post-player phase owns live continuation. */
export function installNativeQuestComposition(host: SimHost, ports: NativeQuestCompositionInput): { quests: DeclaredQuests; pack: NativeInventory<string> } {
  const policy = v.parse(NativeQuestCompositionSchema, ports.rows);
  const population = mixedPopulation(host, policy.population), equipment = nativeMeleeItem(host, policy.equipment);
  const finale = nativeStageLane(host, policy.director), channels = nativeQuestChannels(host, policy.reward.channels);
  const { table, spots } = ports, flags = host.flags;
  const entry = prepareNativeQuestEntry(host, ports.source, table, spots.rows, { rows: policy.limits.rows, items: policy.limits.rows, ordered: true });
  const { input, pack } = entry, rules = [...entry.rules.values()];
  const props = installNativeQuestProps(host, ports.props, ports.restoring);
  const walked = { x: 0, z: 0 };

  const cables = cableModes(host.scope), cableId = policy.cable, rider = cables.nativeRider(cableId);
  const zipline = cables.declaration(cableId);
  if (JSON.stringify(zipline.top) !== JSON.stringify(spots.zipline.top) || JSON.stringify(zipline.bottom) !== JSON.stringify(spots.zipline.bottom) || zipline.sag !== spots.zipline.sag) throw new Error('Native quest cable row does not match the real native spots');
  host.usePlayerDriver({ input: command => {
    if (!rider.carried) return false;
    if (command !== undefined && !flags.has(policy.rewardFlag)) host.player.yaw = command.yaw;
    host.playerImpulse.set(0, 0, 0); rider.velocity.set(0, 0, 0); host.playerFall.grounded = false;
    return true;
  }, step: () => undefined });
  const reward = new QuestRewardController(rider, host.dayClock, {
    at: new Vector3(spots.reward.x, spots.reward.y, spots.reward.z), yaw: spots.reward.yaw, pitch: spots.reward.pitch, phase: spots.reward.phase,
    when: () => channels[policy.reward.field] === true || channels[policy.reward.field] === 1,
    finish: () => {

      if (flags.has(policy.reward.complete)) return false;
      flags.set(policy.reward.complete); return true;
    },
  });
  host.scope.onDispose(() => { reward.dispose(); });
  const keyPrompt = { x: 0, y: 0, z: 0 };
  const state = { iron: false };
  const feats=ports.counters.feats;
  if(feats.length>policy.limits.rows||feats.some(f=>f.count>policy.limits.rows))throw new RangeError('Native quest feats exceed their finite bound');
  const counterBook=entry.achievements(ports.counters,Object.fromEntries(feats.map(feat=>[feat.id,0])));

  const promptOf = (r: (typeof rules)[number]): { x: number; y: number; z: number } | undefined => {
    const key = props.dropAt(policy.keyDrop.id);
    if (r.d.kind !== 'key' || key === null) return r.spot.prompt;
    keyPrompt.x = key.x; keyPrompt.y = key.y + policy.promptHeight; keyPrompt.z = key.z;
    return keyPrompt;
  };
  const guarded = (): boolean => {
    const list = population.bodies();
    for (let i = 0; i < MAX_BODIES; i++) { const b = list[i]; if (b === undefined) break; if (b.kind === policy.guardKind && b.actor?.alive === true) return true; }
    return false;
  };
  const transitions = entry.transitions({ ids: rules.map(row => row.d.id), rowLimit: policy.limits.rows,
    flagLimit: policy.limits.rows, touch: 'graph', pickup: policy.touch, plate: policy.plate });
  const prompts = bindHeadlessPrompts(spots.promptRegistrations, id => {
    if (id === policy.talkId) return { act: policy.actions.talk, position: spots.talk, radius: policy.talkRadius };
    if (id === policy.heldId) return { act: policy.actions.sword, position: spots.sword, get radius() { return state.iron ? 0 : guarded() ? policy.guardRadius : policy.swordRadius; } };
    if (id === policy.cableId) return { act: policy.actions.zipline, position: spots.zipline.prompt, get radius() { return cables.state(cableId).riding ? 0 : spots.zipline.prompt.radius; } };
    const i = rules.findIndex(r => r.d.id === id), r = rules[i];
    if (r?.spot.prompt === undefined) return undefined;
    return { act: policy.actions.row + i, get position() { return promptOf(r) ?? r.spot; }, get radius() { return r.promptRadius(); } };
  });
  const graph = entry.install({ prompts, mechanics: { cables }, directorActions: new Map(),
    observations: new Map([[policy.heldObservation, () => !state.iron && !guarded()]]),
    actions: new Map<string, () => void>([
      [policy.heldId, () => { state.iron = true; equipment.equip(policy.heldSlot); }],
      ...rules.map(row => [row.d.id, () => { transitions.interact(row); }] as const),
    ]) });

  counterBook.observe();

  host.onStep(policy.step, dt => {
    const asked = input.walk(host.level.player.speed);
    walked.x = rider.carried ? 0 : asked.x; walked.z = rider.carried ? 0 : asked.z; props.step(dt, walked);
    transitions.step(); props.syncGates();

    cables.updateNative(cableId, dt, host);

    finale.update(dt);
    reward.update(dt, flags.has(policy.rewardFlag));
  }, {
    snapshot: () => ({ key: props.dropAt(policy.keyDrop.id), finale: finale.snapshot(), iron: state.iron, pack: pack.snapshot(), zipline: cables.snapshot(cableId), reward: reward.snapshot(), counts: counterBook.snapshot(),
      barrel: props.snapshot(policy.barrelOwner.id) }),
    restore: value => {
      const saved = v.parse(Saved, value);
      cables.restore(cableId, saved.zipline);
      reward.restore(saved.reward);
      pack.restore(saved.pack);
      finale.restore(saved.finale); props.restoreDrop(policy.keyDrop.id, saved.key); state.iron = saved.iron;
      counterBook.restore(Object.fromEntries(feats.map(f=>[f.id,saved.counts[f.id]??0])));
      props.restore(policy.barrelOwner.id, saved.barrel);
    },
    physicsRestored: () => { props.physicsRestored(); },
  });
  return { quests: graph.quests, pack };
}
