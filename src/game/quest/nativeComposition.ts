import { isJsonData } from '@wildshard/format/json';
import { parseNativeQuestComposition, type NativeQuestCompositionRows } from '@wildshard/format/nativeQuestComposition';
import { nativeQuestChannels } from './nativeInputs';
import { prepareNativeQuestEntry } from './nativeEntry';
import { nativeStageLane, type readDirectorProduct } from '../plugin/director';
import { mixedPopulation } from '../population/mixedRoster';
import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Shardfile } from '@wildshard/format/shardSchema';
import type { NpcDialogueRow } from '@wildshard/format/npcs';
import type { ContractCatalogue } from '@wildshard/format/contracts';
import type { AchievementCounterData } from '@wildshard/format/achievementCounters';
import { QuestRewardController, installNativeQuestProps, createReadingRoster, bindQuestDeathEffects, type QuestReadingRows } from '../plugin/quests';
import { nativeMeleeItem, readNativeRangedItem } from '../plugin/nativeItems';
import { nativeHeldAmmunition, NativeAmmunitionSavedSchema } from '../loadout/nativeAmmunition';
import { nativeInventorySchema, type NativeInventory } from '../inventoryLaw';
import { cableModes } from '@wildshard/engine/player/modes';
import { NpcReading } from '@wildshard/engine/quest/dialogueClock';
import { bindHeadlessPrompts, parsePromptRegistrations, type PromptRegistration } from './interactionRows';
import { ContractBoard, CONTRACT_ACTION } from './contractBoard';
import { contractKill } from './contracts';
import { Exchange } from '../loot/exchange';
import { QuestStepRunner } from './steps';
import { commitQuestEffects } from './effects';
import { questBenchPose } from './storyLaw';
import { installNativeChapterDirector } from './nativeChapter';
import { takeNativeBossReward } from '../boss/native';
import { ReturnProgram } from '../population/returnProgram';

const MAX_BODIES = 64;
const finite = v.pipe(v.number(), v.finite()), xyz = { x: finite, y: finite, z: finite };
const Row = v.strictObject({ id: v.string(), kind: v.string(), ...xyz, yaw: finite, prompt: v.optional(v.strictObject(xyz)),
  collider: v.optional(v.strictObject({ x: finite, z: finite, hw: finite, hd: finite, rot: finite, yTop: finite, yBottom: finite })) });
const Prompt = v.strictObject({ label: v.string(), ...xyz, radius: finite });
const Spots = v.object({ version: v.literal(1), rows: v.array(Row), talk: Prompt, sword: Prompt,
  reward: v.strictObject({ ...xyz, yaw: finite, pitch: finite, phase: finite }), promptRegistrations: v.unknown(),
  zipline: v.strictObject({ top: v.strictObject(xyz), bottom: v.strictObject(xyz), sag: finite, prompt: v.strictObject({ ...xyz, radius: finite }) }) });
const Fast = v.strictObject({ from: finite, span: finite, t: finite, dur: finite, to: finite });
const CableSaved = v.nullable(v.strictObject({ s: finite, v: finite }));
const Watch = v.strictObject({ lost: finite, wedge: finite, from: v.strictObject(xyz) });
const BarrelSaved = v.nullable(v.strictObject({ handle: v.pipe(finite, v.minValue(0)), watch: Watch, decision: v.exactOptional(v.string()) }));
const countsSaved = v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0)));

type Point = Readonly<{ x: number; y: number; z: number }>;
type QuestPrompt = Point & { readonly radius: number };
interface NativeQuestPlaces {
  readonly rows: readonly (Point & { readonly id: string; readonly kind: string; readonly yaw: number; readonly prompt?: Point | null | undefined })[];
  readonly people?: readonly { readonly kind: string; readonly at: Point; readonly prompt: QuestPrompt }[];
  readonly board?: QuestPrompt; readonly pickup?: QuestPrompt; readonly signals?: Readonly<Record<string, QuestPrompt>>;
  readonly talk?: QuestPrompt; readonly sword?: QuestPrompt;
  readonly reward?: Point & { readonly yaw: number; readonly pitch: number; readonly phase: number };
  readonly cable: { readonly top: Point; readonly bottom: Point; readonly sag?: number; readonly prompt: QuestPrompt };
  readonly promptRegistrations?: readonly PromptRegistration[];
}
export type NativeQuestSpots = Omit<v.InferOutput<typeof Spots>, 'promptRegistrations'> & NativeQuestPlaces;
/** Existing authored world placements, with one borrowed cable view for the shared frame. */
export function readNativeQuestSpots(input: unknown): NativeQuestSpots {
  const spots = v.parse(Spots, input);
  return { ...spots, cable: spots.zipline, promptRegistrations: parsePromptRegistrations(spots.promptRegistrations) };
}
/** All executable mechanics are native owners. Author input supplies only rows,
 * captured placements, admitted programs and a prepared platform director. */
export interface NativeQuestCompositionInput {
  readonly rows: NativeQuestCompositionRows; readonly counters: AchievementCounterData;
  readonly source: Shardfile; readonly table: InteractTable; readonly spots: NativeQuestPlaces;
  readonly props?: unknown; readonly restoring?: boolean;
  readonly steps?: unknown; readonly deaths?: unknown;
  readonly readings?: QuestReadingRows<NpcDialogueRow>; readonly contracts?: ContractCatalogue; readonly trades?: unknown;
  readonly lead?: { readonly program: unknown; readonly path: readonly (readonly [number, number])[] };
  readonly director?: Awaited<ReturnType<typeof readDirectorProduct>>;
}

/** One frame, command graph and saved adapter for the declared native facets.
 * State/scheduling rows keep the existing owner wire without a shard mode. */
export function installNativeQuestComposition(host: SimHost, ports: NativeQuestCompositionInput): {
  readonly quests: ReturnType<ReturnType<typeof prepareNativeQuestEntry>['install']>['quests'];
  readonly pack: NativeInventory<string>; readonly cables: ReturnType<typeof cableModes>;
  readonly lead: v.InferOutput<typeof LeadSaved> | null; readonly board: ContractBoard | null; readonly trader: Exchange | null;
  readonly riding: () => boolean; readonly talking: () => boolean;
  readonly ownsFinish: (skin: string) => boolean; readonly ownsBoardFinish: () => boolean; readonly takePickup: () => boolean;
} {
  if (!isJsonData({ rows: ports.rows, table: ports.table, spots: ports.spots, counters: ports.counters, props: ports.props ?? null,
    steps: ports.steps ?? null, deaths: ports.deaths ?? null, readings: ports.readings ?? null, contracts: ports.contracts ?? null, trades: ports.trades ?? null, lead: ports.lead ?? null }))
    throw new Error('Native quest composition requires JSON rows');
  const rows = parseNativeQuestComposition(ports.rows), spots = ports.spots, flags = host.flags;
  const need = <T>(value: T | undefined, name: string): T => { if (value === undefined) throw new Error(`Missing native quest ${name}`); return value; };
  const entry = prepareNativeQuestEntry(host, ports.source, ports.table, spots.rows, rows.bounds, rows.saved.names);
  const { input, pack } = entry, rules = [...entry.rules.values()], indexed = entry.rules;
  const state = { iron: false, pickup: false, rewardOwned: false }; let finishes = new Set<string>();
  const population = rows.acquisition === undefined ? null : mixedPopulation(host, rows.acquisition.population);
  const equipment = rows.acquisition === undefined ? null : nativeMeleeItem(host, rows.acquisition.equipment);
  const finale = rows.reward === undefined ? null : nativeStageLane(host, rows.reward.director);
  const channels = rows.reward === undefined ? null : nativeQuestChannels(host, rows.reward.channels);
  const props = rows.props === undefined ? null : installNativeQuestProps(host, ports.props, ports.restoring ?? false);
  const ammunition = rows.ammunition === undefined ? null : nativeHeldAmmunition(host);
  const launcher = rows.ammunition === undefined ? null : readNativeRangedItem(host, rows.ammunition.launcher);
  if (launcher !== null && launcher.kind !== 'bolt') throw new Error('Story launcher requires a bolt item');
  const bench = rows.bench === undefined ? null : need(indexed.get(rows.bench.id), 'bench');
  if (bench !== null && (bench.d.kind !== 'bench' || bench.spot.prompt === null || bench.spot.prompt === undefined)) throw new Error('Story bench requires its prompt');
  const cables = cableModes(host.scope), cableId = rows.cable;
  cables.state(cableId);
  const rider = rows.reward === undefined ? null : cables.nativeRider(cableId);
  if (rider !== null) {
    const cable = cables.declaration(cableId);
    if (JSON.stringify(cable.top) !== JSON.stringify(spots.cable.top) || JSON.stringify(cable.bottom) !== JSON.stringify(spots.cable.bottom) || cable.sag !== spots.cable.sag)
      throw new Error('Native quest cable row does not match the real native spots');
    const rewardFlag = need(rows.reward, 'reward').seen;
    host.usePlayerDriver({ input: command => {
      if (!rider.carried) return false;
      if (command !== undefined && !flags.has(rewardFlag)) host.player.yaw = command.yaw;
      host.playerImpulse.set(0, 0, 0); rider.velocity.set(0, 0, 0); host.playerFall.grounded = false; return true;
    }, step: () => undefined });
  }
  const reward = rows.reward === undefined || rider === null ? null : new QuestRewardController(rider, host.dayClock, {
    at: new Vector3(need(spots.reward, 'reward pose').x, need(spots.reward, 'reward pose').y, need(spots.reward, 'reward pose').z),
    yaw: need(spots.reward, 'reward pose').yaw, pitch: need(spots.reward, 'reward pose').pitch, phase: need(spots.reward, 'reward pose').phase,
    when: () => channels?.[need(rows.reward, 'reward').field] === true || channels?.[need(rows.reward, 'reward').field] === 1,
    finish: () => { const flag = need(rows.reward, 'reward').complete; if (flags.has(flag)) return false; flags.set(flag); return true; },
  });
  if (reward !== null) host.scope.onDispose(() => { reward.dispose(); });
  const keyPrompt = { x: 0, y: 0, z: 0 }, walked = { x: 0, z: 0 }, eye = new Vector3(), at = new Vector3();
  const promptOf = (rule: typeof rules[number]): Point | undefined => {
    const key = rows.props === undefined ? null : props?.dropAt(rows.props.drop.id);
    if (rule.d.kind !== 'key' || key === null || key === undefined) return rule.spot.prompt ?? undefined;
    keyPrompt.x = key.x; keyPrompt.y = key.y + need(rows.props, 'props').promptHeight; keyPrompt.z = key.z; return keyPrompt;
  };
  const guarded = (): boolean => {
    if (population === null || rows.acquisition === undefined) return false;
    const bodies = population.bodies();
    for (let i = 0; i < MAX_BODIES; i++) { const body = bodies[i]; if (body === undefined) break; if (body.kind === rows.acquisition.kind && body.actor?.alive === true) return true; }
    return false;
  };
  const bound = rows.bounds?.rows;
  if (bound !== undefined && (ports.counters.feats.length > bound || ports.counters.feats.some(feat => feat.count > bound))) throw new RangeError('Native quest feats exceed their finite bound');
  const earlyCounters = rows.counts === 'declared' ? entry.achievements(ports.counters, Object.fromEntries(ports.counters.feats.map(feat => [feat.id, 0]))) : null;
  const graph = entry.install(commandOwners());
  const quests = graph.quests, chapter = quests.quests[0];
  const trader = rows.trade === undefined ? null : new Exchange(ports.trades, new Map<string, unknown>([[rows.trade.pack, pack],
    ['skins', { owns: (skin: string) => skin === rows.trade?.finish && state.rewardOwned || finishes.has(skin), own: (skin: string) => { finishes.add(skin); } }],
    ['ammo', { capacity: (kind: string, n: number) => need(ammunition ?? undefined, 'ammunition').room(kind, n),
      addBolts: (n: number) => { if (launcher?.kind === 'bolt') launcher.item.addBolts(n); },
      grant: (kind: string, n: number) => { need(ammunition ?? undefined, 'ammunition').add(kind, n); } }]]));
  const initialTrader = trader?.snapshot();
  const steps = rows.effects === undefined ? null : new QuestStepRunner(ports.steps);
  const dialogue = rows.reading === undefined ? null : createReadingRoster(need(ports.readings, 'readings'), spots.people ?? [],
    (npc, head, radius) => new NpcReading(npc, flags, head, radius, need(rows.reading, 'reading').delay), kind => {
      commitQuestEffects(host, need(rows.effects, 'effects').pack, need(steps ?? undefined, 'steps').signal({ kind: 'talk', target: kind }, { flags: flags.all, inventory: pack.snapshot().counts }));
      if (kind === rows.trade?.speaker) trader?.open();
    });
  const transitions = entry.transitions(rows.transitions);
  const chapterClock = rows.chapter === undefined ? null : installNativeChapterDirector(host, need(ports.director, 'chapter director'), { id: `${rows.step}.chapter`, rows: rows.chapter });
  if (rows.chapter !== undefined && chapter === undefined) throw new Error('Story requires its chapter');
  const counterBook = earlyCounters ?? entry.achievements(ports.counters), feats = counterBook.counters;
  const board = rows.board === undefined ? null : new ContractBoard({ contracts: need(ports.contracts, 'contracts'), prompt: need(spots.board, 'board prompt'), radius: need(spots.board, 'board prompt').radius });
  const initialBoard = board?.snapshot();
  const useBoard = (value: number): void => {
    const claim = board?.use(value, eye); if (claim === null || claim === undefined) return;
    commitQuestEffects(host, need(rows.effects, 'effects').pack, claim.reward.items.map(item => ({ kind: 'item', item: item.id, count: item.n })));
    if (claim.reward.bolts > 0 && launcher?.kind === 'bolt') launcher.item.addBolts(claim.reward.bolts);
    if (claim.reward.skin === rows.board?.finish) state.rewardOwned = true;
    feats.event('streak', claim.streak); counterBook.flush();
  };
  counterBook.observe();
  if (rows.effects !== undefined) {
    const killed = bindQuestDeathEffects(ports.deaths, { kill: feats.kill, event: feats.event,
      calls: new Map([['contracts', (body: SimHost['entities'] extends ReadonlyMap<string, infer Entity> ? Entity : never) => {
        if (board !== null) board.killed(contractKill(need(ports.contracts, 'contracts'), body));
      }]]) });
    host.events.on('actor.died', ({ actor }) => {
      const body = [...host.entities.values()].find(candidate => candidate.combatActor() === actor);
      if (body !== undefined) { killed(body); counterBook.flush(); }
    }, host.scope);
    counterBook.sync();
  }

  const lead = rows.lead === undefined ? null : prepareNativeQuestLead(host, { ...need(ports.lead, 'lead program'), ...rows.lead });

  function commandOwners(): NonNullable<Parameters<typeof entry.install>[0]> {
    const actions = new Map<string, (value: number) => void>(), observations = new Map<string, () => boolean>();
    if (rows.acquisition !== undefined) {
      const acquisition = rows.acquisition;
      observations.set(acquisition.observation, () => !state.iron && !guarded());
      actions.set(acquisition.id, () => { state.iron = true; equipment?.equip(acquisition.slot); });
    }
    if (rows.prompts !== undefined) for (const rule of rules) actions.set(rule.d.id, () => { transitions.interact(rule); });
    if (rows.reading !== undefined) {
      observations.set('reading', () => dialogue?.active ?? false);
      actions.set('quest.reading.next', () => { dialogue?.press(need(rows.reading, 'reading').primary); });
      for (const person of spots.people ?? []) actions.set(`talk.${person.kind}`, () => { dialogue?.press(person.kind); });
    }
    if (rows.trade !== undefined) {
      observations.set('trading', () => trader?.active ?? false);
      actions.set('quest.trade.close', () => { trader?.use(-1); }); actions.set('quest.trade.use', value => { trader?.use(value); });
    }
    if (rows.board !== undefined) {
      observations.set('boarding', () => board?.active ?? false);
      actions.set('quest.board.close', () => { board?.use(CONTRACT_ACTION.close, eye); });
      actions.set('quest.board.use', value => { eye.copy(host.player.position); eye.y += rows.eye; useBoard(value); });
    }
    if (rows.reading !== undefined || rows.trade !== undefined || rows.board !== undefined)
      actions.set('quest.cancel', () => { dialogue?.dismiss(); board?.use(CONTRACT_ACTION.close, eye); trader?.use(-1); });
    if (rows.ammunition !== undefined) {
      observations.set('selectable', () => launcher?.frame.live.has(need(rows.ammunition, 'ammunition').launcher) ?? false);
      actions.set('quest.ammo.cycle', () => { ammunition?.cycle(); });
    }
    if (rows.pickup !== undefined) {
      const flag = rows.pickup.flag; observations.set('pickup', () => !flags.has(flag));
      actions.set('quest.pickup', () => { flags.set(flag); state.pickup = true; });
    }
    if (rows.boss !== undefined) actions.set('quest.reward', () => { eye.copy(host.player.position); eye.y += rows.eye; takeNativeBossReward(host, need(rows.boss, 'boss').id, eye); });
    if (rows.bench !== undefined && bench !== null) actions.set(rows.bench.id, () => {
      if (!graph.run(bench.d.id).ok) return;
      const pose = questBenchPose(need(rows.bench, 'bench').pose, bench.spot, bench.spot.yaw);
      at.set(pose.x, pose.y, pose.z); host.player.motor.resetAt(at); host.player.position.copy(at); host.player.yaw = pose.yaw; host.playerFall.vy = 0;
    });
    const prompts = rows.prompts === undefined ? undefined : bindHeadlessPrompts(spots.promptRegistrations ?? [], id => {
      const policy = need(rows.prompts, 'prompts');
      if (id === policy.talk.id) return { act: policy.talk.action, position: need(spots.talk, 'talk prompt'), radius: policy.talk.radius };
      if (id === rows.acquisition?.id) return { act: rows.acquisition.action, position: need(spots.sword, 'held prompt'), get radius() { return state.iron ? 0 : guarded() ? need(rows.acquisition, 'acquisition').guardRadius : need(rows.acquisition, 'acquisition').radius; } };
      if (id === policy.cable.id) return { act: policy.cable.action, position: spots.cable.prompt, get radius() { return cables.state(cableId).riding ? 0 : spots.cable.prompt.radius; } };
      const i = rules.findIndex(rule => rule.d.id === id), rule = rules[i];
      if (rule?.spot.prompt === undefined || rule.spot.prompt === null) return undefined;
      return { act: policy.rowBase + i, get position() { return promptOf(rule) ?? rule.spot; }, get radius() { return rule.promptRadius(); } };
    });
    return { mechanics: { cables }, observations, actions, ...(prompts === undefined ? {} : { prompts, directorActions: new Map() }),
      ...(prompts === undefined ? { spots: { crack: [], interact: [
        ...rules.flatMap(rule => rule.spot.prompt === null || rule.spot.prompt === undefined ? [] : [{ id: rule.d.id, ...rule.spot.prompt, get radius() { return rule.promptRadius(); } }]),
        ...(spots.people ?? []).map(person => ({ id: `talk.${person.kind}`, x: person.prompt.x, y: person.prompt.y, z: person.prompt.z, radius: person.prompt.radius })),
        ...Object.entries(spots.signals ?? {}).map(([id, prompt]) => ({ id: `signal.${id}`, x: prompt.x, y: prompt.y, z: prompt.z, radius: prompt.radius })),
        { id: 'quest.cable', ...spots.cable.prompt }, ...(spots.pickup === undefined ? [] : [{ id: 'quest.pickup', ...spots.pickup }]),
      ] } } : {}) };
  }

  const phases = new Map<string, (dt: number) => void>([
    ['commands', () => { graph.dispatch(input.scripts()); }], ['reading', dt => { dialogue?.advanceReading(dt, host.player.position); }],
    ['props', dt => { const asked = input.walk(host.level.player.speed); walked.x = rider?.carried === true ? 0 : asked.x; walked.z = rider?.carried === true ? 0 : asked.z; props?.step(dt, walked); }],
    ['transitions', () => { transitions.step(); props?.syncGates(); }], ['cable', dt => { cables.updateNative(cableId, dt, host); }],
    ['director', dt => { finale?.update(dt); }], ['reward', dt => { if (rows.reward !== undefined) reward?.update(dt, flags.has(rows.reward.seen)); }],
    ['chapter', dt => { chapterClock?.update(dt, chapter?.current?.id); }],
    ['lead', dt => { if (lead?.step(dt, chapter?.current?.id) === true && rows.lead !== undefined)
      commitQuestEffects(host, need(rows.effects, 'effects').pack, need(steps ?? undefined, 'steps').signal({ kind: 'follow', target: rows.lead.target }, { flags: flags.all })); }],
  ]);
  type SavedRole = NativeQuestCompositionRows['saved']['snapshot'][number];
  const parts = new Map<SavedRole, { capture: () => SimValue | undefined; prepare: (input: unknown) => () => void }>();
  const part = (id: SavedRole, capture: () => SimValue | undefined, prepare: (input: unknown) => () => void): void => { parts.set(id, { capture, prepare }); };
  part('counts', () => counterBook.snapshot(), value => { const saved = v.parse(countsSaved, value); return () => { counterBook.restore(rows.counts === 'declared' ? Object.fromEntries(ports.counters.feats.map(feat => [feat.id, saved[feat.id] ?? 0])) : saved); }; });
  part('pack', () => pack.snapshot(), value => { const saved = v.parse(nativeInventorySchema(entry.inventory), value === undefined && rows.saved.optional.includes('pack') ? { counts: {}, order: [] } : value); return () => { pack.restore(saved); }; });
  part('zipline', () => cables.snapshot(cableId), value => () => { cables.restore(cableId, value); });
  part('cable', () => cables.state(cableId).riding ? { s: cables.snapshot(cableId).s, v: cables.snapshot(cableId).v } : null,
    value => { const saved = v.parse(CableSaved, value); return () => { cables.restore(cableId, { riding: saved !== null, s: saved?.s ?? 0, v: saved?.v ?? 0 }); }; });
  if (props !== null && rows.props !== undefined) {
    const policy = rows.props;
    part('key', () => props.dropAt(policy.drop.id), value => { const saved = v.parse(v.nullable(v.strictObject(xyz)), value); return () => { props.restoreDrop(policy.drop.id, saved); }; });
    part('barrel', () => props.snapshot(policy.barrel.id), value => { const saved = v.parse(BarrelSaved, value); return () => { props.restore(policy.barrel.id, saved); }; });
  }
  if (finale !== null) part('finale', () => finale.snapshot(), value => { const saved = v.parse(v.string(), value); return () => { finale.restore(saved); }; });
  if (reward !== null) part('reward', () => reward.snapshot(), value => () => { reward.restore(value); });
  if (rows.acquisition !== undefined) part('iron', () => state.iron, value => { const saved = v.parse(v.boolean(), value); return () => { state.iron = saved; }; });
  if (rows.pickup !== undefined) part('pickup', () => state.pickup, value => { const saved = v.parse(v.boolean(), value); return () => { state.pickup = saved; }; });
  if (lead !== null) part('lead', lead.snapshot, lead.prepareRestore);
  if (chapterClock !== null) {
    part('clock', () => chapterClock.clock.snapshot(), value => { const saved = v.parse(v.pipe(v.string(), v.maxLength(1000000)), value); return () => { chapterClock.clock.restore(saved); }; });
    part('fast', () => chapterClock.fast.on === null ? null : { ...chapterClock.fast.on }, value => { const saved = v.parse(v.nullable(Fast), value); return () => { chapterClock.fast.on = saved; }; });
  }
  if (dialogue !== null) part('dialogue', () => dialogue.active ? dialogue.snapshot() : undefined, value => dialogue.prepareRestore(value ?? null));
  if (board !== null) {
    part('board', () => board.snapshot(), value => board.prepareRestore(value === undefined ? initialBoard : value));
    part('rewardOwned', () => state.rewardOwned ? true : undefined, value => { const saved = v.parse(v.optional(v.boolean(), false), value); return () => { state.rewardOwned = saved; }; });
  }
  if (trader !== null && rows.board !== undefined) {
    const ids = rows.board.ids;
    const schema = v.optional(v.strictObject({ modal: v.strictObject({ version: v.literal(1), open: v.boolean() }),
      skins: v.pipe(v.array(v.picklist(ids)), v.maxLength(ids.length), v.check(skins => new Set(skins).size === skins.length)) }));
    part('trader', () => trader.active || finishes.size > 0 ? { modal: trader.snapshot(), skins: [...finishes] } : undefined, value => {
      const saved = v.parse(schema, value), restore = trader.prepareRestore(saved?.modal ?? initialTrader);
      return () => { restore(); finishes = new Set(saved?.skins); };
    });
  }
  if (ammunition !== null) part('ammunition', () => ammunition.changed ? ammunition.snapshot() : undefined,
    value => ammunition.prepareRestore(v.parse(v.optional(NativeAmmunitionSavedSchema), value)));
  const keys = new Set<string>(rows.saved.snapshot);
  if (rows.saved.snapshot.some(key => !parts.has(key))) throw new Error('Native saved role has no mechanic');
  host.onStep(rows.step, dt => { for (const phase of rows.phases) need(phases.get(phase), 'phase')(dt); }, {
    snapshot: () => entry.saved.encode(Object.fromEntries(rows.saved.snapshot.flatMap(key => {
      const value = need(parts.get(key), 'saved role').capture(); return value === undefined ? [] : [[key, value]];
    }))),
    restore: value => {
      const saved = entry.saved.decode(value);
      if (Object.keys(saved).some(key => !keys.has(key))) throw new Error('Unexpected native saved key');
      if (rows.saved.snapshot.some(key => !rows.saved.optional.includes(key) && !Object.hasOwn(saved, key))) throw new Error('Missing native saved key');
      const pending = new Map(rows.saved.snapshot.map(key => [key, need(parts.get(key), 'saved role').prepare(saved[key])]));
      if (rows.board !== undefined) {
        const finish = v.parse(v.object({ board: v.object({ claimed: v.number() }), open: v.boolean() }), saved['board'] === undefined ? initialBoard : saved['board']);
        const owned = v.parse(v.optional(v.boolean(), false), saved['rewardOwned']);
        if (owned !== (finish.board.claimed >= rows.board.claims) || finish.open && saved['dialogue'] !== undefined && saved['dialogue'] !== null) throw new RangeError('Invalid Story board/modal ownership');
        const modal = v.parse(v.optional(v.object({ modal: v.object({ open: v.boolean() }) })), saved['trader']);
        if (modal?.modal.open === true && (finish.open || saved['dialogue'] !== undefined && saved['dialogue'] !== null || saved['cable'] !== null)) throw new RangeError('Invalid Story trader/modal ownership');
      }
      for (const key of rows.saved.restore) need(pending.get(key), 'restore role')();
    }, ...(props === null ? {} : { physicsRestored: () => { props.physicsRestored(); } }),
  });
  return { quests, pack, cables, lead: lead?.state ?? null, board, trader,
    riding: (): boolean => cables.state(cableId).riding || host.events.ask('player.carrying', false),
    talking: (): boolean => (dialogue?.active ?? false) || (board?.active ?? false) || (trader?.active ?? false),
    ownsFinish: (skin: string): boolean => finishes.has(skin) || skin === rows.board?.finish && state.rewardOwned,
    ownsBoardFinish: (): boolean => state.rewardOwned, takePickup: (): boolean => { const took = state.pickup; state.pickup = false; return took; } };
}

const LEAD_MODES = ['none', 'stare', 'trot', 'gone'] as const;
/** The guide's saved walk: the same {i, mode, t} bytes as Pine's questSaved envelope `lead` (nativeStory.ts LeadSaved). */
const LeadSaved = v.strictObject({ i: v.pipe(finite, v.integer(), v.minValue(0)), mode: v.picklist(LEAD_MODES), t: v.pipe(finite, v.minValue(0)) });

/**
 * The native composition's lead facet (G565 QC / QB): the guide's walk continuation. Its gate, its stare / trot / gone
 * walk and its event come from the shard's AS 'lead' signal (Pine's stag.as); this only carries the saved {i, mode, t}
 * and feeds the frame at the page quest frame's cadence: one decision every sixth fixed tick, elapsed accumulating on the
 * ticks between. `step` returns true only on the existing event 5 (the walk completed); the shared composition commits
 * the follow step's effects. No shard callbacks.
 */
function prepareNativeQuestLead(host: SimHost, rows: { readonly program: unknown; readonly path: readonly (readonly [number, number])[]; readonly step: string; readonly target: string }): {
  readonly state: { i: number; mode: (typeof LEAD_MODES)[number]; t: number };
  snapshot: () => v.InferOutput<typeof LeadSaved>; prepareRestore: (input: unknown) => () => void; step: (dt: number, chapterId: string | undefined) => boolean;
} {
  const state: { i: number; mode: (typeof LEAD_MODES)[number]; t: number } = { i: 0, mode: 'none', t: 0 }, program = ReturnProgram.native(host, rows.program);
  const input = { i: 0, mode: 0, elapsed: 0, begin: 0, dt: 0, leadStep: 0, night: 0, playerX: 0, playerZ: 0, atX: 0, atZ: 0 };
  return { state, snapshot: () => ({ ...state }),
    prepareRestore: value => {
      const saved = v.parse(LeadSaved, value);
      if (saved.i >= rows.path.length) throw new RangeError('Invalid lead continuation');
      return () => { Object.assign(state, saved); };
    },
    step: (dt, chapterId) => {
      if (host.state.tick % 6 !== 0) { if (state.mode !== 'none') state.t += dt; return false; }
      const bend = rows.path[state.i], player = host.player.position;
      Object.assign(input, { i: state.i, mode: LEAD_MODES.indexOf(state.mode), elapsed: state.t, dt, leadStep: Number(chapterId === rows.step),
        night: host.dayClock?.night ?? 0, playerX: player.x, playerZ: player.z, atX: bend?.[0] ?? 0, atZ: bend?.[1] ?? 0 });
      const answer = program.project('lead', input), i = answer['i'], mode = LEAD_MODES[answer['mode'] ?? -1], elapsed = answer['elapsed'];
      if (i === undefined || mode === undefined || elapsed === undefined) throw new Error('Stag projection omitted its continuation');
      state.i = i; state.mode = mode; state.t = elapsed;
      return answer['event'] === 5;
    } };
}
