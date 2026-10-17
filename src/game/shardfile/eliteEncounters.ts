import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { canReach } from '@wildshard/engine/ai/reach';
import type { PouncerContext, PouncerLedge, PouncerPorts, HowlerPorts } from '@wildshard/engine/ai/stalker';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import { EliteCore, EliteCoreContinuationSchema, memoryElitePersistence, type EliteCoreDef, type EliteCoreScript } from '../eliteSystem';

const silent = (): void => undefined;
const finite = v.pipe(v.number(), v.finite());
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
  readonly rows?: readonly EliteEncounterRow[];
  readonly ports?: EliteEncounterPorts;
  readonly wire: { readonly detached?: string };
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
  const scripts = nativeScripts;
  if (scripts.length === 0 || new Set(scripts.map(s => s.def.id)).size !== scripts.length) throw new Error('Invalid encounter roster');
  scripts.forEach(s => { core.add(s); });
  const wire = spec.wire;
  const envelope: v.ObjectEntries = { version: v.literal(spec.version), ...EliteCoreContinuationSchema.entries };
  if (wire.detached !== undefined) envelope[wire.detached] = v.exactOptional(v.literal(true));
  for (const row of rows) envelope[row.snapshot] = row.pack === undefined ? KeeperSave : PackSave;
  host.onStep(spec.step, dt => { core.update(dt, host.clock.now); }, {
    snapshot: () => {
      const saved: Record<string, SimValue> = { version: spec.version, ...core.snapshot() };
      if (wire.detached !== undefined && members.some(m => m.detached)) saved[wire.detached] = true;
      for (const m of members) saved[m.row.snapshot] = { animal: m.animal?.entityId ?? null, phase2: m.phase2, keeper: m.controller.snapshot(),
        ...(m.row.pack === undefined ? {} : { pack: m.pack === null ? null : ports?.packs().indexOf(m.pack) ?? -1 }) };
      return saved;
    },
    restore: value => {
      const saved = v.parse(v.strictObject(envelope), value);
      const continuation = v.parse(EliteCoreContinuationSchema, saved), commitCore = core.prepareRestore(continuation);
      const ids = scripts.map(s => s.def.id);
      if (Object.keys(continuation.records).length !== ids.length || ids.some(id => continuation.records[id] === undefined)) throw new Error('Incompatible encounter records');
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
      commitCore();
      if (ports !== undefined) { ports.bindings.brains.clear(); ports.bindings.pinned.clear(); }
      for (const { m, s, a, detached, pack } of bound) {
        m.controller.restore(s.keeper); m.animal = a; m.phase2 = s.phase2; m.pack = pack; m.adopted = true; m.detached = detached;
        pin(a, core.entry(m.row.def.id)?.state === 'engaged'); if (a !== null) rebinders.get(m)?.(a);
      }
    },
  });
  return { core, scripts, initialize: () => { core.initialize(); } };
}
