import * as v from 'valibot';
import { isJsonData } from '@wildshard/format/json';
import { EncounterScheduleSchema } from '@wildshard/format/encounterRows';
import { ProjectedState, ReturnProgram } from '../population/returnProgram';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimValue } from '@wildshard/engine/sim';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { canReach } from '@wildshard/engine/ai/reach';
import { StalkerBrain, type PouncerContext, type PouncerLedge, type PouncerSpec, type HowlerSpec, type HowlerPorts } from '@wildshard/engine/ai/stalker';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import { EliteCore, EliteCoreContinuationSchema, memoryElitePersistence, type EliteCoreDef, type EliteCoreScript } from '../eliteSystem';

const silent = (): void => undefined;
const finite = v.pipe(v.number(), v.finite());
const PackSave = v.strictObject({ animal: v.nullable(v.string()), phase2: v.boolean(), keeper: v.unknown(), pack: v.nullable(v.pipe(finite, v.integer(), v.minValue(0))) });

/** Manager-owned elite pins and decision bindings; the manager retains its single body-step installer. */
export interface EliteBindings {
  readonly pinned: Set<AnimalSim>;
  readonly absent: Set<AnimalSim>;
  readonly brains: Map<AnimalSim, { readonly think: (a: AnimalSim, c: PouncerContext<AnimalSim>) => void; readonly act: (a: AnimalSim) => void }>;
}
/** Allocate per simulation, never at module import. */
export function eliteBindings(): EliteBindings { return { pinned: new Set(), absent: new Set(), brains: new Map() }; }

interface Herd { readonly stallionState: string; readonly stallion: AnimalSim | null; readonly leadAway: (x: number, z: number) => void }
type HerdTaming = () => {readonly phase:string;readonly tulpar:AnimalSim|null}|null;
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
  readonly taming?: HerdTaming; readonly keepers: {readonly pouncer:PouncerSpec;readonly howler:HowlerSpec;readonly herd:{readonly rows:unknown;readonly program:unknown}};
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

const herdPoint=v.tuple([finite,finite,finite]);
const HerdProjectionRows=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({law:EncounterScheduleSchema,states:v.pipe(v.record(v.string(),finite),v.check(rows=>Object.keys(rows).length<=16))}));
const HerdProjectionSaved=v.strictObject({laneT:finite,runT:finite,lastState:v.string(),elapsed:v.optional(finite,0),laneFrom:herdPoint,laneTo:herdPoint});
/** Decode the historical native wire before mutating its existing numeric owner. */
function restoreProjected(law:ProjectedState,input:unknown):string{
  const {laneT,runT,lastState,elapsed,laneFrom:[fromX,fromY,fromZ],laneTo:[toX,toY,toZ]}=v.parse(HerdProjectionSaved,input);
  law.set({laneT,runT,fromX,fromY,fromZ,toX,toY,toZ});law.restoreSamplingTime(elapsed);return lastState;
}
function snapshotProjected(law:ProjectedState,lastState:string):v.InferOutput<typeof HerdProjectionSaved>{
  return{laneT:law.value('laneT'),runT:law.value('runT'),lastState,elapsed:law.samplingTime,laneFrom:[law.value('fromX'),law.value('fromY'),law.value('fromZ')],laneTo:[law.value('toX'),law.value('toY'),law.value('toZ')]};
}

interface Member { readonly row: EliteEncounterRow; animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null; adopted: boolean; detached: boolean; lastState:string;
  readonly controller: StalkerBrain<AnimalSim> | ProjectedState; readonly validate: (value: unknown) => void }

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
    const def = row.def,projected=row.keeper==='herd'?v.parse(HerdProjectionRows,ports.keepers.herd.rows):null;
    const live: { animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null; adopted: boolean; detached: boolean;lastState:string } = { animal: null, phase2: false, pack: null, adopted: false, detached: false,lastState:'' };
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
    const create = (): StalkerBrain<AnimalSim> | ProjectedState => {
      if (row.keeper === 'pouncer') return new StalkerBrain({ pattern: 'pouncer',spec: ports.keepers.pouncer,ports: pouncerPorts });
      if (row.keeper === 'howler') return new StalkerBrain({ pattern: 'howler',spec: ports.keepers.howler,ports: howlerPorts });
      if(projected===null)throw new Error('Missing projected encounter rows');return new ProjectedState({...projected.law,signals:{step:projected.law.signal}},ReturnProgram.native(host,ports.keepers.herd.program));
    };
    const controller = create();
    const member: Member = Object.assign(live, { row, controller, validate: (value: unknown): void => { const trial=create();if(trial instanceof ProjectedState)restoreProjected(trial,value);else trial.restore(value); } });
    members.push(member);
    const bind = (a: AnimalSim): void => {
      if (!('think' in controller)) return;
      ports.bindings.brains.set(a, { think: (body, c) => { if (row.keeper === 'pouncer') controller.decidePouncer(body,c); else controller.decideHowler(body,c); }, act: body => { controller.act(body); } });
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
      reset: () => { member.phase2 = false; if (controller instanceof StalkerBrain) controller.reset(member.animal); },
      enterPhase2: () => { member.phase2 = true; if (row.keeper === 'howler' && 'think' in controller) controller.enterPhase2(member.animal); },
      trophy: silent,
      ...(row.brokenState === undefined ? {} : { broken: () => ports.herd()?.stallionState === row.brokenState }),
      tick: (dt, t, engaged, leashing) => {
        pin(member.animal, engaged);
        if ('think' in controller) controller.advance(member.animal, dt, t, engaged, leashing);
        else {
          const animal=member.animal,herd=member.detached?null:ports.herd();if(animal===null||herd===null)return;
          const taming=ports.taming?.(),at=animal.position,player=host.player.position;
          const codec=projected?.states;if(codec===undefined)throw new Error('Missing projected encounter codec');
          const {dt:due,values:effects}=controller.step(dt,{state:codec[herd.stallionState]??0,previousState:codec[member.lastState]??0,phase2:Number(member.phase2),engaged:Number(engaged),bonded:Number(taming?.phase==='bonded'),same:Number(herd.stallion===animal),health:animal.hp/animal.maxHp,x:at.x,y:at.y,z:at.z,px:player.x,py:player.y,pz:player.z});
          if(due>0)member.lastState=herd.stallionState;
          if(effects['signature']===1)signature();if(effects['lead']===1)herd.leadAway(player.x,player.z);
          const adopted=taming?.tulpar;
          if(effects['adopt']===1&&adopted!==undefined&&adopted!==null){
            const action=row.onAdopted;if(action===undefined||member.detached||host.entities.get(adopted.entityId)!==adopted||adopted.variant!==action.variant)throw new Error('Adopted encounter reward has no native owner');
            adopted.scale=action.scale;core.won(def.id);member.detached=true;
          }
        }
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
  for (const row of rows) envelope[row.snapshot] = row.pack === undefined ? v.omit(PackSave, ['pack']) : PackSave;
  host.onStep(spec.step, dt => { core.update(dt, host.clock.now); }, {
    snapshot: () => {
      const saved: Record<string, SimValue> = { version: spec.version, ...core.snapshot() };
      if (wire.detached !== undefined && members.some(m => m.detached)) saved[wire.detached] = true;
      for (const m of members) saved[m.row.snapshot] = { animal: m.animal?.entityId ?? null, phase2: m.phase2, keeper: m.controller instanceof ProjectedState?snapshotProjected(m.controller,m.lastState):m.controller.snapshot(),
        ...(m.row.pack === undefined ? {} : { pack: m.pack === null ? null : ports?.packs().indexOf(m.pack) ?? -1 }) };
      return saved;
    },
    restore: value => {
      const saved = v.parse(v.strictObject(envelope), value);
      const continuation = v.parse(EliteCoreContinuationSchema, saved), commitCore = core.prepareRestore(continuation);
      const ids = scripts.map(s => s.def.id);
      if (Object.keys(continuation.records).length !== ids.length || ids.some(id => continuation.records[id] === undefined)) throw new Error('Incompatible encounter records');
      const bound = members.map((m, i) => {
        const s = v.parse(m.row.pack === undefined ? v.omit(PackSave, ['pack']) : PackSave, saved[m.row.snapshot]);
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
        if(m.controller instanceof ProjectedState)m.lastState=restoreProjected(m.controller,s.keeper);else m.controller.restore(s.keeper); m.animal = a; m.phase2 = s.phase2; m.pack = pack; m.adopted = true; m.detached = detached;
        pin(a, core.entry(m.row.def.id)?.state === 'engaged'); if (a !== null) rebinders.get(m)?.(a);
      }
    },
  });
  return { core, scripts, initialize: () => { core.initialize(); } };
}
