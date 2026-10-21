/** Renderer-free story composition. Authored ids select existing native owners;
 * no executable shard ports cross the quest boundary. G474 platform quests. */
import * as v from 'valibot';
import { Vector3 } from 'three';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import { isJsonData } from '@wildshard/format/json';
import { parseChapterDirector, chapterObservations } from '@wildshard/format/chapterDirector';
import type { ShardProduct } from '../shardfile/shardProduct';
import type { NativeStoryRows, NativeStorySpots } from './nativeStoryRows';
import { prepareNativeQuestEntry } from './nativeEntry';
import { nativeHeldAmmunition, NativeAmmunitionSavedSchema } from '../loadout/nativeAmmunition';
import { readNativeRangedItem } from '../plugin/nativeItems';
import { takeNativeBossReward } from '../boss/native';
import { commitQuestEffects } from './effects';
import { cableModes } from '@wildshard/engine/player/modes';
import { NpcReading } from '@wildshard/engine/quest/dialogueClock';
import type { InteractionState } from '@wildshard/engine/world/interact/flags';
import { bindQuestDeathEffects, createReadingRoster } from '../plugin/quests';
import type { installDeclaredQuestHost } from '../plugin/simulation';
import { ReturnProgram } from '../population/returnProgram';
import { DirectorScriptStageLane, type readDirectorProduct } from '../plugin/director';
import { nativeInventorySchema, type NativeInventory } from '../inventoryLaw';
import { ContractBoard, CONTRACT_ACTION } from './contractBoard';
import { contractKill } from './contracts';
import { questBenchPose, questPhaseSpan, questPhaseAt } from './storyLaw';
import { Exchange } from '../loot/exchange';
import { QuestStepRunner } from './steps';

const finite = v.pipe(v.number(), v.finite());
interface Rule extends InteractionState { readonly spot: NativeStorySpots['rows'][number] }
const Fast = v.strictObject({ from: finite, span: finite, t: finite, dur: finite, to: finite });
const LeadSaved = v.strictObject({ i: v.pipe(finite, v.integer(), v.minValue(0)), mode: v.picklist(['none', 'stare', 'trot', 'gone']), t: v.pipe(finite, v.minValue(0)) });
const questSaved = (pack: ReturnType<typeof nativeInventorySchema<string>>, ids: readonly string[]) => v.strictObject({ lead: LeadSaved,
  clock: v.pipe(v.string(), v.maxLength(1000000)), fast: v.nullable(Fast), cable: v.nullable(v.strictObject({ s: finite, v: finite })), pickup: v.boolean(),
  counts: v.record(v.string(), v.pipe(finite, v.integer(), v.minValue(0))),
  pack: v.optional(pack, () => ({ counts: {}, order: [] })), dialogue: v.optional(v.unknown(), null), board: v.optional(v.unknown()), rewardOwned: v.optional(v.boolean(), false),
  trader: v.optional(v.strictObject({ modal: v.strictObject({ version: v.literal(1), open: v.boolean() }),
    skins: v.pipe(v.array(v.picklist(ids)), v.maxLength(ids.length), v.check(skins => new Set(skins).size === skins.length)) })), ammunition: v.optional(NativeAmmunitionSavedSchema) });


/** Existing native owners returned for equipment/modal observations. */
export interface NativeStory {
  readonly quests: ReturnType<typeof installDeclaredQuestHost>['quests'];
  readonly lead: v.InferOutput<typeof LeadSaved>;
  readonly pack: NativeInventory<string>; readonly cables: ReturnType<typeof cableModes>;
  readonly riding: () => boolean; readonly talking: () => boolean;
  readonly board: ContractBoard; readonly trader: Exchange;
  readonly ownsFinish: (skin: string) => boolean; readonly ownsBoardFinish: () => boolean;
  readonly takePickup: () => boolean;
}
/** Install story services around the admitted quest host shared by all entries. */
export function installNativeStory(host: SimHost, product: ShardProduct, rows: NativeStoryRows,
  director: Awaited<ReturnType<typeof readDirectorProduct>>): NativeStory {
  if (!isJsonData(rows)) throw new Error('Native story requires JSON rows');
  const policy = rows.policy, content = rows.content, spots = rows.spots, flags = host.flags;
  const clockRows = parseChapterDirector(policy.clock.director);
  if (Object.values(clockRows.actions).some(effects => effects.some(effect => effect.kind !== 'flag' && effect.kind !== 'phase')))
    throw new Error('Native chapter publications require flag or phase effects');
  const entry = prepareNativeQuestEntry(host, product.shardfile, content.table, spots.rows), { input, pack } = entry;
  const ammunition = nativeHeldAmmunition(host), launcher = readNativeRangedItem(host, policy.launcher);
  if (launcher.kind !== 'bolt') throw new Error('Story launcher requires a bolt item');
  const EYE = policy.eye, MAX_SETS = 16, TRADE_CLOSE = -1, QUEST_STEP = policy.step, PICKUP_FLAG = policy.pickup.flag,
    benchRows = policy.bench;
  const { touchCount: TOUCH_COUNT, readingDelay: READING_DELAY } = content.policy;
  const indexed = entry.rules, Saved = questSaved(nativeInventorySchema(entry.inventory), policy.finish.ids);
  const required = (id: string): Rule => {
    const row = indexed.get(id);
    if (row === undefined) throw new Error(`Missing story quest row ${id}`);
    return row;
  };
  const latch = required(policy.latch), benchRule = required(policy.benchRow), bench = benchRule.spot;
  if (benchRule.d.kind !== 'bench' || benchRule.spot.prompt === null) throw new Error('Story bench requires its prompt');
  const graph = entry.install(commandOwners());
  const quests = graph.quests;
  const chapter = quests.quests[0];
  if (chapter === undefined) throw new Error('Story requires its chapter');
  const eye = new Vector3(), at = new Vector3();
  const people = spots.people, boardPrompt = spots.board;
  let rewardOwned = false;
  let finishes = new Set<string>();
  const trader = new Exchange(rows.trades, new Map<string, unknown>([[policy.pack, pack],
    ['skins', { owns: (skin: string) => skin === policy.finish.id && rewardOwned || finishes.has(skin), own: (skin: string) => { finishes.add(skin); } }],
    ['ammo', { capacity: (kind: string, n: number) => ammunition.room(kind, n),
      addBolts: (n: number) => { launcher.item.addBolts(n); }, grant: (kind: string, n: number) => {
        ammunition.add(kind, n);
      } }]]));
  const initialTrader = trader.snapshot();
  const steps = new QuestStepRunner(content.steps);
  const dialogue = createReadingRoster(content.readings, people, (npc, head, radius) => new NpcReading(npc, flags, head, radius, READING_DELAY), kind => {
    commitQuestEffects(host, policy.pack, steps.signal({ kind: 'talk', target: kind }, { flags: flags.all, inventory: pack.snapshot().counts }));
    if (kind === policy.trader) trader.open();
  });

  const interact = (r: Rule): void => {
    const d = r.d;
    if (!graph.run(d.id).ok) return; // the shared table flag law; a locked row only toasts
    if (d.kind === 'bench') {
      const pose = questBenchPose(benchRows, bench, bench.yaw);
      at.set(pose.x, pose.y, pose.z); host.player.motor.resetAt(at); host.player.position.copy(at);
      host.player.yaw = pose.yaw; host.playerFall.vy = 0;
    }
  };
  const touchRows = Array.from({ length: TOUCH_COUNT }, (_unused, i) => {
    const row = required(`${policy.touch.prefix}${i + 1}`);
    if (row.d.kind !== 'pickup' || row.d.touch !== true || row.d.item !== policy.touch.item) throw new Error('Story needs its touchRows take law');
    return row;
  });
  const transitions = entry.transitions({ ids: [...touchRows, latch].map(row => row.d.id), rowLimit: TOUCH_COUNT + 1,
    flagLimit: MAX_SETS, touch: 'direct', pickup: 'walk-in' });

  const fast: { on: { from: number; span: number; t: number; dur: number; to: number } | null } = { on: null };
  const fastForward = (to: number, dur: number): void => {
    const day = host.dayClock ?? null; if (day === null) return;
    fast.on = { from: day.phase, span: questPhaseSpan(day.phase, to), t: 0, dur, to };
  };
  const publish = (event: string): void => {
    const effects = clockRows.actions[event]; if (effects === undefined) throw new Error('Unknown native chapter publication');
    for (const effect of effects) {
      if (effect.kind === 'phase') fastForward(effect.to, effect.seconds);
      else if (effect.kind === 'flag') commitQuestEffects(host, policy.pack, [effect]);
    }
  };
  const script = director.create();
  const clock = new DirectorScriptStageLane(director.stages, script, { scope: host.scope,
    observe: () => chapterObservations(clockRows.observations, { flags: flags.all, day: host.dayClock ?? null, player: host.player.position, reward: null }),
    emits: { source: clockRows.source, value: 'literal', actions: new Map(Object.keys(clockRows.actions)
      .filter(key => script.data.events.some(event => event.direction === 'output' && event.key === key)).map(key => [key, () => { publish(key); }])) },
  }, false, clockRows.initialDt);

  const cables = cableModes(host.scope), cableId = policy.cable;
  cables.state(cableId);
  const state = { pickup: false };

  const counterBook = entry.achievements(rows.counters), feats = counterBook.counters;
  const board = new ContractBoard({ contracts: rows.contracts, prompt: boardPrompt, radius: boardPrompt.radius });
  const useBoard = (value: number): void => {
    const claim = board.use(value, eye);
    if (claim === null) return;
    commitQuestEffects(host, policy.pack, claim.reward.items.map(item => ({ kind: 'item', item: item.id, count: item.n })));
    if (claim.reward.bolts > 0) launcher.item.addBolts(claim.reward.bolts);
    if (claim.reward.skin === policy.finish.id) rewardOwned = true;
    feats.event('streak', claim.streak); counterBook.flush();
  };
  const initialBoard = board.snapshot();

  // Construct the callbacks at the graph's original phase. They resolve live
  // owners only when command delivery starts, after preparation has completed.
  function commandOwners(): NonNullable<Parameters<typeof entry.install>[0]> {
    return { spots: { crack: [], interact: [
    ...[...indexed.values()].flatMap(row => row.spot.prompt === null ? [] : [{ id: row.d.id, ...row.spot.prompt, get radius() { return row.promptRadius(); } }]),
    ...spots.people.map(person => ({ id: `talk.${person.kind}`, ...person.prompt })),
    ...Object.entries(spots.signals).map(([id, prompt]) => ({ id: `signal.${id}`, x: prompt.x, y: prompt.y, z: prompt.z, radius: prompt.radius })),
    { id: 'quest.cable', ...spots.cable.prompt }, { id: 'quest.pickup', ...spots.pickup },
  ] }, observations: new Map([
    ['riding', () => cables.state(cableId).riding], ['trading', () => trader.active], ['boarding', () => board.active], ['reading', () => dialogue.active],
    ['selectable', () => launcher.frame.live.has(policy.launcher)], ['pickup', () => !flags.has(PICKUP_FLAG)],
  ]), actions: new Map<string, (value: number) => void>([
    ['quest.cancel', () => { dialogue.dismiss(); board.use(CONTRACT_ACTION.close, eye); trader.use(TRADE_CLOSE); }],
    ['quest.trade.close', () => { trader.use(TRADE_CLOSE); }], ['quest.board.close', () => { board.use(CONTRACT_ACTION.close, eye); }],
    ['quest.reading.next', () => { dialogue.press(policy.primary); }],
    ['quest.trade.use', value => { trader.use(value); }], ['quest.ammo.cycle', () => { ammunition.cycle(); }],
    ['quest.board.use', value => { eye.copy(host.player.position); eye.y += EYE; useBoard(value); }],
    ['quest.cable', () => { cables.start(cableId); }], ['quest.pickup', () => { flags.set(PICKUP_FLAG); state.pickup = true; }],
    ['quest.reward', () => { eye.copy(host.player.position); eye.y += EYE; takeNativeBossReward(host, policy.boss, eye); }],
    ...[...indexed.keys()].map(id => [id, () => { interact(required(id)); }] as const),
    ...spots.people.map(person => [`talk.${person.kind}`, () => { dialogue.press(person.kind); }] as const),
  ]) };
  }



  host.scope.onDispose(flags.onChange((flag, on) => { if (on && flag === policy.clock.wait) clock.request(policy.clock.nightRequest); }));
  counterBook.observe();
  const killed = bindQuestDeathEffects(content.deaths, { kill: feats.kill, event: feats.event,
    calls: new Map([['contracts', (body: SimHost['entities'] extends ReadonlyMap<string, infer Entity> ? Entity : never) => {
      board.killed(contractKill(rows.contracts, body));
    }]]) });
  host.events.on('actor.died', ({ actor }) => {
    const body = [...host.entities.values()].find(candidate => candidate.combatActor() === actor);
    if (body !== undefined) { killed(body); counterBook.flush(); }
  }, host.scope);
  counterBook.sync();

  const lead: v.InferOutput<typeof LeadSaved> = { i: 0, mode: 'none', t: 0 }, leadProgram = ReturnProgram.native(host, content.lead.program);
  const modes = ['none', 'stare', 'trot', 'gone'] as const;
  const envelope = (value: Record<string, SimValue>): Record<string, SimValue> => Object.fromEntries(Object.entries(value).map(([key, saved]) => [policy.savedNames[key] ?? key, saved]));
  const decoded = (value: unknown): Record<string, unknown> => {
    const source = v.parse(v.record(v.string(), v.unknown()), value);
    const names = new Map(Object.entries(policy.savedNames).map(([key, name]) => [name, key]));
    return Object.fromEntries(Object.entries(source).map(([key, saved]) => [names.get(key) ?? key, saved]));
  };
  const leadInput = { i: 0, mode: 0, elapsed: 0, begin: 0, dt: 0, on: 0, playerX: 0, playerZ: 0, atX: 0, atZ: 0 };
  const leadFailure = new Error('Stag projection omitted its continuation');
  const followed = { kind: 'follow', target: policy.lead.target } as const;
  const followedFrame: { flags: readonly string[] } = { flags: [] };
  host.onStep(QUEST_STEP, dt => {
    graph.dispatch(input.scripts());
    dialogue.advanceReading(dt, host.player.position);
    cables.updateNative(cableId, dt, host);
    transitions.step(touchRows);
    // the latch lifts on its own once both logs are off and latches open (Interactables.update's latching door)
    transitions.latch(latch);
    // the clock's fast-forward (a smoothstep over its span), then the clock, then the lead, as the page's quest frame
    const day = host.dayClock ?? null, ff = fast.on;
    if (ff !== null && day !== null) {
      ff.t += dt;
      day.phase = questPhaseAt(ff.from, ff.span, ff.t, ff.dur);
      if (ff.t / ff.dur >= 1) { day.phase = ff.to; fast.on = null; }
    }
    if (chapter.current?.id === policy.clock.step) clock.request(policy.clock.dawnRequest);
    clock.update(dt);
    // The fixed 60 Hz host tick is already saved; its six-tick phase needs
    // no new continuation wire. Only the elapsed clock advances between decisions.
    if (host.state.tick % 6 !== 0) { if (lead.mode !== 'none') lead.t += dt; return; }
    const bend = content.lead.path[lead.i], player = host.player.position;
    leadInput.i = lead.i; leadInput.mode = modes.indexOf(lead.mode); leadInput.elapsed = lead.t; leadInput.dt = dt;
    leadInput.on = Number(chapter.current?.id === policy.lead.step && (host.dayClock?.night ?? 0) > policy.lead.nightAbove);
    leadInput.playerX = player.x; leadInput.playerZ = player.z; leadInput.atX = bend?.[0] ?? 0; leadInput.atZ = bend?.[1] ?? 0;
    const answer = leadProgram.project('lead', leadInput), i = answer['i'], mode = modes[answer['mode'] ?? -1], elapsed = answer['elapsed'];
    if (i === undefined || mode === undefined || elapsed === undefined) throw leadFailure;
    lead.i = i; lead.mode = mode; lead.t = elapsed;
    if (answer['event'] === 5) { followedFrame.flags = flags.all; commitQuestEffects(host, policy.pack, steps.signal(followed, followedFrame)); }
  }, {
    snapshot: () => envelope({ lead: { ...lead }, clock: clock.snapshot(), fast: fast.on === null ? null : { ...fast.on }, cable: cables.state(cableId).riding ? { s: cables.snapshot(cableId).s, v: cables.snapshot(cableId).v } : null,
      pickup: state.pickup, counts: counterBook.snapshot(), pack: pack.snapshot(), ...(dialogue.active ? { dialogue: dialogue.snapshot() } : {}), board: board.snapshot(), ...(rewardOwned ? { rewardOwned } : {}),
      ...(trader.active || finishes.size > 0 ? { trader: { modal: trader.snapshot(), skins: [...finishes] } } : {}),
      ...(ammunition.changed ? { ammunition: ammunition.snapshot() } : {}) }),
    restore: value => {
      const saved = v.parse(Saved, decoded(value));
      if (saved.trader?.skins.some(id => !policy.finish.ids.includes(id)) === true) throw new RangeError('Unknown saved cosmetic finish');
      const restoreDialogue = dialogue.prepareRestore(saved.dialogue);
      const boardState = saved.board === undefined ? initialBoard : saved.board;
      const restoreBoard = board.prepareRestore(boardState);
      const restoreTrader = trader.prepareRestore(saved.trader?.modal ?? initialTrader);
      const restoreAmmo = ammunition.prepareRestore(saved.ammunition);
      const finish = v.parse(v.object({ board: v.object({ claimed: v.number() }), open: v.boolean() }), boardState);
      if (saved.rewardOwned !== (finish.board.claimed >= policy.finish.claims) || (finish.open && saved.dialogue !== null)) throw new RangeError('Invalid Story board/modal ownership');
      if (saved.trader?.modal.open === true && (finish.open || saved.dialogue !== null || saved.cable !== null)) throw new RangeError('Invalid Story trader/modal ownership');
      clock.restore(saved.clock); if (saved.lead.i >= content.lead.path.length) throw new RangeError('Invalid lead continuation');
      Object.assign(lead, saved.lead); fast.on = saved.fast; cables.restore(cableId, { riding: saved.cable !== null, s: saved.cable?.s ?? 0, v: saved.cable?.v ?? 0 }); state.pickup = saved.pickup;
      counterBook.restore(saved.counts);
      pack.restore(saved.pack);
      restoreDialogue(); restoreBoard(); restoreTrader(); restoreAmmo(); rewardOwned = saved.rewardOwned; finishes = new Set(saved.trader?.skins);
    },
  });
  return { quests, lead, pack, cables, riding: () => cables.state(cableId).riding || host.events.ask('player.carrying', false), talking: () => dialogue.active || board.active || trader.active, board, trader,
    ownsFinish: (skin: string) => finishes.has(skin) || skin === policy.finish.id && rewardOwned,
    ownsBoardFinish: () => rewardOwned, takePickup: () => { const took = state.pickup; state.pickup = false; return took; } };
}
