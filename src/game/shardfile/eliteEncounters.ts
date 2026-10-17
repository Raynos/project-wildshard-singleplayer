import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import { Rng } from '@wildshard/engine/core/rng';
import type { StrikeSpec, StrikeRunner } from '@wildshard/engine/ai/strikes';
import { canReach } from '@wildshard/engine/ai/reach';
import type { PouncerContext, PouncerLedge, PouncerPorts, HowlerPorts } from '@wildshard/engine/ai/stalker';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import { EliteCore, EliteCoreContinuationSchema, memoryElitePersistence, type EliteCoreDef, type EliteCoreScript } from '../eliteSystem';

const silent = (): void => undefined;
const finite = v.pipe(v.number(), v.finite());
const Root = v.strictObject({ t: v.pipe(finite, v.minValue(0)), x: finite, y: finite, z: finite });
const Stream = v.strictObject({ version: v.literal(1), state: finite, initial: finite, scrambledFork: v.boolean() });
const Runner = v.strictObject({ version: finite, phase: v.picklist(['idle', 'windup', 'active', 'recover', 'cooldown']), currentId: v.nullable(v.string()), hit: v.boolean(),
  elapsed: finite, speedMul: finite, clock: finite, deadlines: v.array(v.strictObject({ id: v.string(), at: finite })), scores: v.array(v.strictObject({ id: v.string(), score: finite })),
  x0: finite, z0: finite, x1: finite, z1: finite, yaw: finite, length: finite });
const ScriptSave = v.strictObject({ id: v.string(), animal: v.nullable(v.string()), mode: v.string(), fields: v.record(v.string(), v.union([finite, v.boolean(), v.null()])),
  lanes: v.array(v.strictObject({ tellT: finite, runner: Runner })), rngs: v.array(Stream) });
const KeeperSave = v.strictObject({ animal: v.nullable(v.string()), phase2: v.boolean(), keeper: v.unknown() });
const PackSave = v.strictObject({ ...KeeperSave.entries, pack: v.nullable(v.pipe(finite, v.integer(), v.minValue(0))) });

/** Manager-owned elite pins and decision bindings; the manager retains its single body-step installer. */
export interface EliteBindings {
  readonly pinned: Set<AnimalSim>;
  readonly absent: Set<AnimalSim>;
  readonly brains: Map<AnimalSim, { readonly think: (a: AnimalSim, c: PouncerContext<AnimalSim>) => void; readonly act: (a: AnimalSim) => void }>;
}
/** Allocate per simulation, never at module import. */
export function eliteBindings(): EliteBindings { return { pinned: new Set(), absent: new Set(), brains: new Map() }; }

/** Script lanes keep their own strike recipe and complete runner continuation. */
interface SavedLane { snapshot: () => { tellT: number; runner: ReturnType<StrikeRunner['snapshot']> }; restore: (value: v.InferOutput<typeof ScriptSave>['lanes'][number]) => void; validate: (value: v.InferOutput<typeof ScriptSave>['lanes'][number]) => void }
interface FieldScript extends EliteCoreScript<AnimalSim> {
  animal: AnimalSim | null; readonly brainState: string;
  fields: () => Record<string, number | boolean | null>;
  validateFields: (fields: Record<string, number | boolean | null>) => void;
  restoreFields: (mode: string, fields: Record<string, number | boolean | null>) => void;
  lanes: () => readonly SavedLane[]; rngs: () => readonly Rng[];
}
/** The body authority lent to a scripted fight. The roster owns IDs, spawn draws and retirement. */
interface ScriptWorldPorts<B extends AnimalSim, L> {
  readonly bodies: () => readonly { readonly id: string; readonly kind: string; readonly scripted: boolean; readonly actor: B }[];
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => B;
  readonly retire: (body: B) => void; readonly heightAt: (x: number, z: number) => number;
  readonly dusk?: () => number; readonly night?: () => number;
  readonly lane: new (row: StrikeSpec, reach: (a: B, p: { x: number; y: number; z: number }) => boolean) => L;
  readonly scriptedState: AnimalSim['state'];
}
/** Native script world: adopts boot bodies exactly once, keeps roar roots and cover-checked blows on the simulation.
 * Script/lane constructors remain trusted capabilities, while their author rows retain all combat policy. */
function nativeEliteWorld<B extends AnimalSim, L>(host: SimHost, ports: ScriptWorldPorts<B, L>): {
  readonly world: {
    player: SimHost['player']; reach: (a: B, p: { x: number; y: number; z: number }) => boolean; god: boolean;
    trauma: typeof silent; stun: (seconds: number) => void; dusk: () => number; night: () => number;
    hurt: (a: B, amount: number, throughWalls?: boolean) => void; voice: typeof silent;
    spawn: ScriptWorldPorts<B, L>['spawn']; find: (id: string) => B | null;
    own: (a: B) => void; release: (a: B) => void; retire: (a: B) => void; adopt: typeof silent;
    lane: (row: StrikeSpec) => L; ring: () => { setTime: typeof silent; ring: typeof silent; hide: typeof silent };
    heightAt: ScriptWorldPorts<B, L>['heightAt']; inChunk: (x: number, z: number, margin: number) => boolean;
    show: typeof silent; fx: { fade: typeof silent; reappear: typeof silent; burstOut: typeof silent; roar: typeof silent };
    signature: (id: string) => void; feed: typeof silent;
  };
  readonly bind: (core: EliteCore<EliteCoreScript<AnimalSim>>) => void;
  readonly advance: (dt: number) => void;
  readonly snapshot: () => v.InferOutput<typeof Root> | null;
  readonly restore: (root: v.InferOutput<typeof Root> | null) => void;
} {
  const player = host.player, half = host.level.ground.size / 2, adopted = new Set<string>(), held = new Vector3();
  let root: v.InferOutput<typeof Root> | null = null, core: EliteCore<EliteCoreScript<AnimalSim>> | null = null;
  const reach = (a: B, p: { x: number; y: number; z: number }): boolean => canReach(a, p, host.physics);
  return {
    bind: value => { core = value; }, snapshot: () => root === null ? null : { ...root }, restore: value => { root = value === null ? null : { ...value }; },
    advance: dt => { if (root === null) return; held.set(root.x, root.y, root.z); player.position.copy(held); player.motor.resetAt(held); root.t -= dt; if (root.t <= 0) root = null; },
    world: {
      player, reach, god: false, trauma: silent,
      stun: seconds => { const p = player.position; root = { t: seconds, x: root?.x ?? p.x, y: root?.y ?? p.y, z: root?.z ?? p.z }; },
      dusk: ports.dusk ?? (() => 0), night: ports.night ?? (() => 0),
      hurt: (a, amount, throughWalls = false) => {
        if (!throughWalls && !reach(a, player.position)) return;
        host.combat.hit({ source: a.combatActor(), sourceTags: [`creature.${a.kind}`, 'feel.blow', 'cover.checked'], target: player.health, amount,
          point: a.position.clone(), dir: new Vector3(), throughWalls, cause: { kind: a.kind, label: a.label } });
      },
      voice: silent,
      spawn: (kind, x, z, yaw, variant) => {
        const body = ports.bodies().find(b => b.scripted && b.kind === kind && b.actor.variant === variant && !adopted.has(b.id));
        if (body === undefined) return ports.spawn(kind, x, z, yaw, variant);
        adopted.add(body.id); return body.actor;
      },
      find: id => ports.bodies().find(b => b.id === id)?.actor ?? null,
      own: a => { a.herd = -1; a.state = ports.scriptedState; a.scripted = true; },
      release: a => { a.scripted = false; if (a.alive && a.state === ports.scriptedState) a.state = 'alert'; },
      retire: a => { ports.retire(a); }, adopt: silent,
      lane: row => { const Lane = ports.lane; return new Lane(row, reach); }, ring: () => ({ setTime: silent, ring: silent, hide: silent }), heightAt: ports.heightAt,
      inChunk: (x, z, margin) => Math.abs(x) <= half - margin && Math.abs(z) <= half - margin,
      show: silent, fx: { fade: silent, reappear: silent, burstOut: silent, roar: silent }, signature: id => { core?.signature(id); }, feed: silent,
    },
  };
}

interface Keeper {
  tick: (a: AnimalSim | null, dt: number, t: number, engaged: boolean, leashing: boolean) => void;
  think: (a: AnimalSim, c: PouncerContext<AnimalSim>) => void;
  act: (a: AnimalSim) => void; damage: (a: AnimalSim, p: Vector3) => number;
  enterPhase2?: (a: AnimalSim | null) => void;
  spawned: (a: AnimalSim) => void; reset: (a: AnimalSim | null) => void; disposeTell: () => void;
  snapshot: () => SimValue; restore: (value: unknown) => void;
}
interface Howler extends Keeper { enterPhase2: (a: AnimalSim | null) => void }
interface Herd { readonly stallionState: string; readonly stallion: AnimalSim | null; readonly leadAway: (x: number, z: number) => void }
interface HerdKeeper {
  tick: (a: AnimalSim | null, herd: Herd | null, dt: number, t: number, engaged: boolean) => void;
  snapshot: () => SimValue; restore: (value: unknown) => void;
}
interface HerdPorts {
  readonly player: SimHost['player']; readonly phase2: () => boolean;
  readonly lane: { setTime: typeof silent; lane: typeof silent; hide: typeof silent };
  readonly signature: () => void;
  readonly taming: () => { readonly phase: string; readonly tulpar: AnimalSim | null } | null;
  readonly adopted: (a: AnimalSim) => void;
}
/** Existing keeper classes implement these ports; the installer supplies the common native authority once. */
export interface EliteKeeperConstructors {
  readonly pouncer: new (ports: PouncerPorts<AnimalSim> & { feed: typeof silent; sound: typeof silent }) => Keeper;
  readonly howler: new (ports: HowlerPorts<AnimalSim> & { feed: typeof silent; sound: typeof silent }) => Howler;
  readonly herd: new (ports: HerdPorts) => HerdKeeper;
}
/** A member's identity, adoption and save key are author data. Pack ordering is checked against the owner's actor IDs. */
export interface EliteEncounterRow {
  readonly def: EliteCoreDef;
  readonly keeper: 'pouncer' | 'howler' | 'herd'; readonly snapshot: string;
  readonly member: { readonly kind: string; readonly variant: string; readonly source: 'boot' | 'spawn' | 'herd'; readonly yaw: number; readonly memory?: Readonly<Record<string, number>> };
  readonly pack?: { readonly offset: readonly [number, number]; readonly variants: readonly string[]; readonly kind: string; readonly idPrefix: string };
  readonly brokenState?: string;
  readonly onAdopted?: { readonly action: 'win-and-detach'; readonly variant: string; readonly scale: number };
}
/** The manager and group owner retain all allocation, RNG, environment and taming authority. */
export interface EliteEncounterPorts {
  readonly bindings: EliteBindings; readonly bodies: () => readonly AnimalSim[];
  readonly spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => AnimalSim;
  readonly retire: (a: AnimalSim) => void;
  readonly spawnPack: (x: number, z: number, variants: readonly string[]) => PackBrain<AnimalSim>;
  readonly retirePack: (pack: PackBrain<AnimalSim>) => void; readonly packs: () => readonly PackBrain<AnimalSim>[];
  readonly herd: () => Herd | null;
  readonly heightAt: (x: number, z: number) => number; readonly ledges: readonly PouncerLedge[];
  readonly environment: HowlerPorts<AnimalSim>['environment'];
  readonly taming?: HerdPorts['taming']; readonly keepers: EliteKeeperConstructors;
  /** Existing authored strike sampler and shove law. No new attack clock is installed. */
  readonly strike: (row: StrikeSpec, a: AnimalSim, target: Vector3, hit: () => void, ports: { reach: () => boolean }) => boolean;
  readonly strikes: { readonly swipe: StrikeSpec; readonly pounce: StrikeSpec; readonly bite: StrikeSpec };
  readonly swipeDamage: number;
  readonly knock: { readonly duration: number; readonly dash: (x: number, z: number, strength: number, out: { x: number; z: number }) => void };
}
/** Both wire layouts retain their existing adapter IDs, versions and field names. Upgrades explicitly name retired fields. */
export interface EliteEncounterSpec {
  readonly step: string; readonly version: number;
  readonly conditions: { readonly mode: 'weights'; readonly dusk: () => number; readonly night: () => number }
    | { readonly mode: 'phase'; readonly phase: () => string; readonly storm: () => boolean };
  readonly scripted?: { readonly create: (world: ReturnType<typeof nativeEliteWorld<AnimalSim, SavedLane>>['world'], seed: number) => readonly FieldScript[]; readonly ports: ScriptWorldPorts<AnimalSim, SavedLane> };
  readonly rows?: readonly EliteEncounterRow[];
  readonly ports?: EliteEncounterPorts;
  readonly wire: { readonly scripts?: string; readonly stun?: string; readonly detached?: string;
    readonly upgrades?: readonly { readonly version: number; readonly removeScriptFields: readonly string[]; readonly bindInstalledAnimals?: boolean; readonly fieldDefaults?: Readonly<Record<string, Record<string, number | boolean | null>>>; readonly clearStun?: boolean }[] };
}
interface Member { readonly row: EliteEncounterRow; animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null; adopted: boolean; detached: boolean;
  readonly controller: Keeper | HerdKeeper; readonly validate: (value: unknown) => void }

/** Install ordered named encounters on EliteCore. Shared ownership covers spawn/adoption, script/keeper continuation,
 * pack rebind, root effects and declared permanent detachment. Controllers retain fight decisions and clocks.
 * Restore validates the complete roster, all controller payloads and identity bindings before it commits any state. */
export function installEliteEncounters(host: SimHost, spec: EliteEncounterSpec): {
  readonly core: EliteCore<EliteCoreScript<AnimalSim>>; readonly scripts: readonly EliteCoreScript<AnimalSim>[];
  readonly initialize: () => void;
} {
  const conditions = spec.conditions;
  const core = new EliteCore<EliteCoreScript<AnimalSim>>({ player: host.player, condition: rule => {
    if (rule === 'always') return true;
    if (conditions.mode === 'weights') return rule === 'dusk' ? conditions.dusk() > 0.5 : rule === 'night' && conditions.night() > 0.5;
    const phase = conditions.phase();
    return rule === 'storm' ? conditions.storm() : rule === 'night' ? phase === 'night' : phase === 'dusk' || phase === 'night';
  } }, {}, host.level.id, memoryElitePersistence());
  const world = spec.scripted === undefined ? undefined : nativeEliteWorld(host, spec.scripted.ports);
  world?.bind(core);
  const fieldScripts = world === undefined ? undefined : spec.scripted?.create(world.world, host.level.seed);
  const rebinders = new WeakMap<Member, (a: AnimalSim) => void>();
  const ports = spec.ports, rows = spec.rows ?? [], members: Member[] = [], head = new Vector3(), dir = new Vector3(), knocked = { x: 0, z: 0 };
  const pin = (a: AnimalSim | null, engaged: boolean): void => { if (a === null || ports === undefined) return; if (engaged) ports.bindings.pinned.add(a); else ports.bindings.pinned.delete(a); };
  const tells = { setTime: silent, ring: silent, lane: silent, hide: silent };
  const nativeScripts: EliteCoreScript<AnimalSim>[] = [];
  for (const row of rows) {
    if (ports === undefined) throw new Error('Encounter rows need native body authority');
    const def = row.def;
    const live: { animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null; adopted: boolean; detached: boolean } = { animal: null, phase2: false, pack: null, adopted: false, detached: false };
    let striking: AnimalSim | null = null;
    const hit = { source: 'env' as const, sourceTags: [`elite.${def.id}`, 'feel.blow', 'cover.checked'] as `${string}.${string}`[], target: host.player.health,
      amount: 0, point: head, dir, cause: { kind: row.member.kind, label: '' } };
    const strikeReach = (): boolean => striking !== null && canReach(striking, host.player.position, host.physics);
    const deliver = (): void => { if (strikeReach()) host.combat.hit(hit); };
    const strikePorts = { reach: strikeReach };
    const hurt = (a: AnimalSim, amount: number): void => {
      striking = a; hit.amount = amount; hit.point = a.position; hit.cause.kind = a.kind; hit.cause.label = a.label;
      const strike = row.keeper === 'howler' ? ports.strikes.bite : amount === ports.swipeDamage ? ports.strikes.swipe : ports.strikes.pounce;
      ports.strike(strike, a, host.player.position, deliver, strikePorts);
    };
    const signature = (): void => { core.signature(def.id); };
    const common = { player: host.player, lair: def.lair, phase2: () => live.phase2, feed: silent, sound: silent, signature };
    const pouncerPorts = { ...common, ledges: ports.ledges, heightAt: ports.heightAt, awareRadius: def.awareR, ring: tells,
      isHead: (a: AnimalSim, p: Vector3): boolean => a.headWorld(head).distanceTo(p) < a.dims.headRadius * a.scale + 0.12,
      hurt, knock: (dx: number, dz: number): void => { const d = Math.hypot(dx, dz) || 1; ports.knock.dash(dx / d, dz / d, 1, knocked); host.dashPlayer(knocked.x, knocked.z, ports.knock.duration); },
      opened: silent, growl: silent };
    const howlerPorts = { ...common, pack: () => live.pack, environment: ports.environment, random: () => host.rng.stream('ai').next(), rings: tells,
      hurt, regrouped: silent, interrupted: silent, closed: silent, howl: silent };
    const herdPorts = { ...common, lane: tells, taming: () => ports.taming?.() ?? null, adopted: (a: AnimalSim): void => {
      const action = row.onAdopted;
      if (action === undefined || ports.taming === undefined || live.detached || host.entities.get(a.entityId) !== a || a.variant !== action.variant) throw new Error('Adopted encounter reward has no native owner');
      a.scale = action.scale; core.won(def.id); live.detached = true;
    } };
    const create = (): Keeper | HerdKeeper => {
      if (row.keeper === 'pouncer') { const Pouncer = ports.keepers.pouncer; return new Pouncer(pouncerPorts); }
      if (row.keeper === 'howler') { const Howler = ports.keepers.howler; return new Howler(howlerPorts); }
      const HerdController = ports.keepers.herd; return new HerdController(herdPorts);
    };
    const controller = create();
    const member: Member = Object.assign(live, { row, controller, validate: (value: unknown): void => { create().restore(value); } });
    members.push(member);
    const bind = (a: AnimalSim): void => {
      if (!('think' in controller)) return;
      ports.bindings.brains.set(a, { think: (body, c) => { controller.think(body, c); }, act: body => { controller.act(body); } });
      a.combatActor().damageMul = req => controller.damage(a, req.point);
    };
    const script: EliteCoreScript<AnimalSim> = {
      def, get animal() { return member.animal; },
      spawn: () => {
        if (row.member.source === 'herd') {
          const a = ports.herd()?.stallion;
          if (a === undefined || a === null || !a.alive || member.animal !== null) throw new Error('Encounter herd respawn is not hosted');
          member.animal = a; return;
        }
        const boot = row.member.source === 'boot' && !member.adopted ? ports.bodies().find(a => a.kind === row.member.kind && a.variant === row.member.variant) : undefined;
        member.adopted = true;
        const a = boot ?? ports.spawn(row.member.kind, def.lair.x, def.lair.z, row.member.yaw, row.member.variant);
        member.animal = a; a.herd = -1;
        for (const [key, value] of Object.entries(row.member.memory ?? {})) a.mem[key] = value;
        if ('spawned' in controller) controller.spawned(a);
        bind(a);
        if (row.pack !== undefined) { member.pack = ports.spawnPack(def.lair.x + row.pack.offset[0], def.lair.z + row.pack.offset[1], row.pack.variants); member.pack.homeX = def.lair.x; member.pack.homeZ = def.lair.z; }
      },
      despawn: () => {
        if ('disposeTell' in controller) controller.disposeTell();
        if (member.pack !== null) ports.retirePack(member.pack); member.pack = null;
        const a = member.animal; pin(a, false);
        if (row.member.source === 'herd') return;
        if (a !== null) { ports.bindings.brains.delete(a); ports.retire(a); } member.animal = null;
      },
      reset: () => { member.phase2 = false; if ('reset' in controller) controller.reset(member.animal); },
      enterPhase2: () => { member.phase2 = true; if (row.keeper === 'howler' && 'think' in controller) controller.enterPhase2?.(member.animal); },
      trophy: silent,
      ...(row.brokenState === undefined ? {} : { broken: () => ports.herd()?.stallionState === row.brokenState }),
      tick: (dt, t, engaged, leashing) => {
        pin(member.animal, engaged);
        if ('think' in controller) controller.tick(member.animal, dt, t, engaged, leashing);
        else controller.tick(member.animal, member.detached ? null : ports.herd(), dt, t, engaged);
      },
    };
    // Keep the rebind closure beside the member, without adding a second body step.
    rebinders.set(member, bind); nativeScripts.push(script);
  }
  const scripts = fieldScripts ?? nativeScripts;
  if (scripts.length === 0 || (fieldScripts !== undefined && rows.length > 0) || new Set(scripts.map(s => s.def.id)).size !== scripts.length) throw new Error('Invalid encounter roster');
  scripts.forEach(s => { core.add(s); });
  const wire = spec.wire;
  const scriptKey = wire.scripts;
  const envelope: v.ObjectEntries = { version: v.literal(spec.version), ...EliteCoreContinuationSchema.entries };
  if (scriptKey !== undefined) envelope[scriptKey] = v.array(ScriptSave);
  if (wire.stun !== undefined) envelope[wire.stun] = v.nullable(Root);
  if (wire.detached !== undefined) envelope[wire.detached] = v.exactOptional(v.literal(true));
  for (const row of rows) envelope[row.snapshot] = row.pack === undefined ? KeeperSave : PackSave;
  host.onStep(spec.step, dt => { world?.advance(dt); core.update(dt, host.clock.now); }, {
    snapshot: () => {
      const saved: Record<string, SimValue> = { version: spec.version, ...core.snapshot() };
      if (wire.detached !== undefined && members.some(m => m.detached)) saved[wire.detached] = true;
      if (wire.stun !== undefined) saved[wire.stun] = world?.snapshot() ?? null;
      if (scriptKey !== undefined) saved[scriptKey] = (fieldScripts ?? []).map(s => ({ id: s.def.id, animal: s.animal?.entityId ?? null, mode: s.brainState, fields: s.fields(),
        lanes: s.lanes().map(l => { const { tellT, runner } = l.snapshot(); return { tellT, runner: { ...runner, deadlines: runner.deadlines.map(d => ({ id: d.id, at: d.at })), scores: runner.scores.map(r => ({ id: r.id, score: r.score })) } }; }),
        rngs: s.rngs().map(r => { const x = r.snapshot(); return { version: x.version, state: x.state, initial: x.initial, scrambledFork: x.scrambledFork }; }) }));
      for (const m of members) saved[m.row.snapshot] = { animal: m.animal?.entityId ?? null, phase2: m.phase2, keeper: m.controller.snapshot(),
        ...(m.row.pack === undefined ? {} : { pack: m.pack === null ? null : ports?.packs().indexOf(m.pack) ?? -1 }) };
      return saved;
    },
    restore: value => {
      const input = upgradeEliteEncounterSave(value, { ...spec, scripts: fieldScripts });
      const saved = v.parse(v.strictObject(envelope), input);
      const continuation = v.parse(EliteCoreContinuationSchema, saved), commitCore = core.prepareRestore(continuation);
      const ids = scripts.map(s => s.def.id);
      if (Object.keys(continuation.records).length !== ids.length || ids.some(id => continuation.records[id] === undefined)) throw new Error('Incompatible encounter records');
      const restoredScripts = scriptKey === undefined ? [] : v.parse(v.array(ScriptSave), saved[scriptKey]);
      if (scriptKey !== undefined && (restoredScripts.length !== scripts.length || restoredScripts.some((s, i) => s.id !== scripts[i]?.def.id))) throw new Error('Incompatible encounter scripts');
      const scriptBodies = restoredScripts.map((s, i) => {
        const script = fieldScripts?.[i], a = s.animal === null ? null : host.entities.get(s.animal);
        if (script === undefined || a === undefined || s.lanes.length !== script.lanes().length || s.rngs.length !== script.rngs().length) throw new Error('Incompatible encounter script binding');
        script.validateFields(s.fields);
        s.lanes.forEach((lane, n) => { script.lanes()[n]?.validate(lane); });
        s.rngs.forEach(r => { new Rng(0).restore(r); });
        return a;
      });
      const bound = members.map((m, i) => {
        const s = v.parse(m.row.pack === undefined ? KeeperSave : PackSave, saved[m.row.snapshot]);
        const a = s.animal === null ? null : host.entities.get(s.animal);
        const detached = wire.detached !== undefined && saved[wire.detached] === true && m.row.onAdopted !== undefined;
        if (a === undefined || (a !== null && (a.kind !== m.row.member.kind || a.variant !== m.row.member.variant))
          || (m.row.member.source === 'herd' && a !== null && !detached && a !== ports?.herd()?.stallion)
          || continuation.entries[i]?.phase2 !== s.phase2
          || (detached && (continuation.entries[i].state !== 'retired' || continuation.records[m.row.def.id]?.retired !== true))) throw new Error('Incompatible encounter member binding');
        const index = 'pack' in s ? s.pack : null, pack = typeof index === 'number' ? ports?.packs()[index] : null;
        const row = m.row.pack, leader = a;
        if (row !== undefined && (pack === undefined || (a === null) !== (pack === null) || (pack !== null && (pack.members.length !== row.variants.length
          || (leader === null || pack.members.some((b, n) => b.kind !== row.kind || b.entityId !== `${row.idPrefix}${String(Number(leader.entityId.slice(row.idPrefix.length)) + n + 1)}`)))))) throw new Error('Incompatible encounter pack binding');
        m.validate(s.keeper); return { m, s, a, detached, pack: pack ?? null };
      });
      const root = wire.stun === undefined ? null : v.parse(v.nullable(Root), saved[wire.stun]);
      // Actor/keeper admission above never mutates live controllers, pins or core state.
      commitCore(); world?.restore(root);
      restoredScripts.forEach((s, i) => {
        const script = fieldScripts?.[i], a = scriptBodies[i];
        if (script === undefined || a === undefined) throw new Error('Missing admitted encounter script');
        script.animal = a; script.restoreFields(s.mode, s.fields);
        s.lanes.forEach((l, n) => { script.lanes()[n]?.restore(l); }); s.rngs.forEach((r, n) => { script.rngs()[n]?.restore(r); });
      });
      if (ports !== undefined) { ports.bindings.brains.clear(); ports.bindings.pinned.clear(); }
      for (const { m, s, a, detached, pack } of bound) {
        m.controller.restore(s.keeper); m.animal = a; m.phase2 = s.phase2; m.pack = pack; m.adopted = true; m.detached = detached;
        pin(a, core.entry(m.row.def.id)?.state === 'engaged'); if (a !== null) rebinders.get(m)?.(a);
      }
    },
  });
  return { core, scripts, initialize: () => { core.initialize(); } };
}

/** Explicit per-wire upgrades remove only retired metadata. Live state fields are never invented or reset. */
function upgradeEliteEncounterSave(input: unknown, spec: Pick<EliteEncounterSpec, 'version' | 'wire'> & { readonly scripts: readonly FieldScript[] | undefined }): unknown {
  if (input === null || typeof input !== 'object' || !('version' in input) || input.version === spec.version) return input;
  const upgrade = spec.wire.upgrades?.find(row => row.version === input.version), key = spec.wire.scripts;
  if (upgrade === undefined || key === undefined || !(key in input)) return input;
  const rows: unknown = Reflect.get(input, key);
  if (!Array.isArray(rows)) return input;
  return { ...input, version: spec.version, ...(upgrade.clearStun === true && spec.wire.stun !== undefined ? { [spec.wire.stun]: null } : {}), [key]: rows.map((row: unknown, i: number) => {
    if (row === null || typeof row !== 'object' || Array.isArray(row)) return row;
    const upgraded: Record<string, unknown> = Object.fromEntries(Object.entries(row).filter(([name]) => !upgrade.removeScriptFields.includes(name)));
    if (upgrade.bindInstalledAnimals === true) upgraded['animal'] = spec.scripts?.[i]?.animal?.entityId ?? null;
    const id = upgraded['id'], fields: unknown = upgraded['fields'];
    if (typeof id === 'string' && fields !== null && typeof fields === 'object' && !Array.isArray(fields) && upgrade.fieldDefaults?.[id] !== undefined) upgraded['fields'] = { ...upgrade.fieldDefaults[id], ...fields };
    return upgraded;
  }) };
}
