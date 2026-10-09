import * as v from 'valibot';
import { Vector3 } from 'three';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { canReach } from '@wildshard/engine/ai/reach';
import { EliteCore, memoryElitePersistence, type EliteCoreScript } from '@wildshard/game/eliteSystem';
import { KNOCKDOWN_TIME, knockdownDash } from '../creatures/knockdown';
import { NALATI_STRIKES, sampleStrike } from '../combat/strikes';
import { NALATI_ELITE_DEFS, eliteRuleHolds } from '../combat/eliteRoster';
import { AqbarsKeeper, type AqbarsContext, type AqbarsLedge } from './aqbarsKeeper';
import { ArgymaqKeeper, type ArgymaqHerd } from './argymaqKeeper';
import { KokboriKeeper, type KokboriPorts } from './kokboriKeeper';
import type { PackBrain } from '@wildshard/engine/ai/pack';

/** One per host: the manager keeps the sole body-step installer; elite callbacks and engaged pins are injected. */
export interface NalatiEliteBindings {
  readonly pinned: Set<AnimalSim>;
  /** Wildlife retains retired pack members; they own no active body or cadence. */
  readonly absent: Set<AnimalSim>;
  readonly brains: Map<AnimalSim, { readonly think: (a: AnimalSim, c: AqbarsContext<AnimalSim>) => void; readonly act: (a: AnimalSim) => void }>;
}
export function nalatiEliteBindings(): NalatiEliteBindings { return { pinned: new Set(), absent: new Set(), brains: new Map() }; }
const finite = v.pipe(v.number(), v.finite());
const RecordValue = v.strictObject({ timer: finite, discovered: v.boolean(), skinTaken: v.boolean(), kills: finite, retired: v.boolean() });
const Entry = v.strictObject({ id: v.picklist(['aqbars', 'kokbori', 'argymaq']), state: v.picklist(['absent', 'idle', 'aware', 'engaged', 'leash', 'dead', 'broken', 'retired']),
  timer: finite, waitDusk: v.boolean(), discovered: v.boolean(), bannerArmed: v.boolean(), farT: finite, phase2: v.boolean(), beatT: finite,
  lockHp: finite, seenSig: v.boolean(), leashT: finite, lastHit: v.nullable(finite), forced: v.boolean() });
const Script = v.strictObject({ animal: v.nullable(v.string()), phase2: v.boolean(), keeper: v.unknown() });
const PackScript = v.strictObject({ animal: v.nullable(v.string()), phase2: v.boolean(), keeper: v.unknown(), pack: v.nullable(v.pipe(finite, v.integer(), v.minValue(0))) });
const Saved = v.strictObject({ version: v.literal(1), clocks: v.strictObject({ saveT: finite, lastDusk: v.boolean() }),
  records: v.record(v.string(), RecordValue), entries: v.tuple([Entry, Entry, Entry]), aqbars: Script, kokbori: PackScript, argymaq: Script });
export const NALATI_ELITES_STEP = 'nalati.elites';
type NativeEliteScript = EliteCoreScript<AnimalSim>;
export interface NalatiNativeElites {
  readonly core: EliteCore<NativeEliteScript>;
  readonly aqbars: AqbarsKeeper<AnimalSim>; readonly argymaq: ArgymaqKeeper<AnimalSim>;
  readonly kokbori: KokboriKeeper<AnimalSim>;
  readonly initialize: () => void;
}
const installed = new WeakMap<SimHost, NalatiNativeElites>();
export function nalatiElitesOf(host: SimHost): NalatiNativeElites | undefined { return installed.get(host); }

/** The real load-time and dusk elites under the SAME page rules, before Wildlife and manager thinking. Other named elites,
 * the mounted reward and their declared facts still refuse qualification until their actual controllers are hosted. */
export function installNalatiElites(host: SimHost, ports: {
  readonly bindings: NalatiEliteBindings; readonly bodies: () => readonly AnimalSim[];
  readonly spawn: (kind: 'leopard' | 'kokbori', x: number, z: number, yaw: number, variant: string) => AnimalSim;
  readonly spawnPack: (x: number, z: number, variants: readonly string[]) => PackBrain<AnimalSim>;
  readonly retirePack: (pack: PackBrain<AnimalSim>) => void;
  readonly packs: () => readonly PackBrain<AnimalSim>[];
  readonly environment: KokboriPorts<AnimalSim>['environment'];
  readonly retire: (a: AnimalSim) => void; readonly herd: () => ArgymaqHerd<AnimalSim> | null;
  readonly heightAt: (x: number, z: number) => number; readonly ledges: readonly AqbarsLedge[];
  readonly phase: () => string; readonly storm: () => boolean;
}): NalatiNativeElites {
  const aqDef = NALATI_ELITE_DEFS['aqbars'], argDef = NALATI_ELITE_DEFS['argymaq'], kbDef = NALATI_ELITE_DEFS['kokbori'];
  if (aqDef === undefined || argDef === undefined || kbDef === undefined) throw new Error('Missing Nalati elite definitions');
  const silent = (): void => undefined, tell = { setTime: silent, ring: silent, lane: silent, hide: silent };
  const head = new Vector3(), dir = new Vector3(), knocked = { x: 0, z: 0 };
  let adopted = false;
  const aqState: { animal: AnimalSim | null; phase2: boolean } = { animal: null, phase2: false };
  const argState: { animal: AnimalSim | null; phase2: boolean } = { animal: null, phase2: false };
  const kbState: { animal: AnimalSim | null; phase2: boolean; pack: PackBrain<AnimalSim> | null } = { animal: null, phase2: false, pack: null };
  const core = new EliteCore<NativeEliteScript>({ player: host.player, condition: rule => eliteRuleHolds(rule, ports.phase(), ports.storm()) }, {}, host.level.id, memoryElitePersistence());
  const markAqSignature = (): void => { core.signature('aqbars'); };
  const markArgSignature = (): void => { core.signature('argymaq'); };
  const pin = (a: AnimalSim | null, engaged: boolean): void => { if (a !== null) { if (engaged) ports.bindings.pinned.add(a); else ports.bindings.pinned.delete(a); } };
  // A keeper can deliver two swipe contacts in a frame; reuse the request and its cover port for both.
  let striking: AnimalSim | null = null;
  const hit = { source: 'env' as const, sourceTags: ['elite.aqbars', 'feel.blow', 'cover.checked'] as const, target: host.player.health,
    amount: 0, point: head, dir, cause: { kind: 'leopard', label: '' } };
  const strikeReach = (): boolean => striking !== null && canReach(striking, host.player.position, host.physics);
  const strikePorts = { reach: strikeReach };
  const deliverStrike = (): void => { if (strikeReach()) host.combat.hit(hit); };
  const aqPorts = { player: host.player, lair: aqDef.lair, ledges: ports.ledges, heightAt: ports.heightAt,
    awareRadius: aqDef.awareR, phase2: () => aqState.phase2, ring: tell,
    isHead: (a: AnimalSim, p: Vector3): boolean => a.headWorld(head).distanceTo(p) < a.dims.headRadius * a.scale + 0.12,
    hurt: (a: AnimalSim, amount: number): void => {
      striking = a; hit.amount = amount; hit.point = a.position; hit.cause.kind = a.kind; hit.cause.label = a.label;
      sampleStrike(amount === 14 ? NALATI_STRIKES.swipe : NALATI_STRIKES.pounce, a, host.player.position, deliverStrike, strikePorts);
    },
    knock: (dx: number, dz: number): void => { const d = Math.hypot(dx, dz) || 1; knockdownDash(dx / d, dz / d, 1, knocked); host.dashPlayer(knocked.x, knocked.z, KNOCKDOWN_TIME); },
    feed: silent, sound: silent, signature: markAqSignature,
  };
  const aq = new AqbarsKeeper(aqPorts);
  const aqDecision = (body: AnimalSim, c: AqbarsContext<AnimalSim>): void => { aq.think(body, c); };
  const aqMotion = (body: AnimalSim): void => { aq.act(body); };
  function bindAq(a: AnimalSim): void {
    ports.bindings.brains.set(a, { think: aqDecision, act: aqMotion });
    a.combatActor().damageMul = req => aq.damage(a, req.point);
  }
  const argPorts = { player: host.player, phase2: () => argState.phase2, lane: tell,
    signature: markArgSignature,
    // No fake mount. The page ride/taming law is the next SF72 slice, so this path cannot grant the horse yet.
    taming: (): null => null, adopted: (): never => { throw new Error('Nalati mounted reward is not hosted yet'); } };
  const arg = new ArgymaqKeeper<AnimalSim>(argPorts);
  const aqFrame = (dt: number, t: number, engaged: boolean, leashing: boolean): void => { pin(aqState.animal, engaged); aq.tick(aqState.animal, dt, t, engaged, leashing); };
  const aqScript: NativeEliteScript = {
    def: aqDef, get animal() { return aqState.animal; },
    spawn: () => {
      const boot = adopted ? undefined : ports.bodies().find(a => a.kind === 'leopard' && a.variant === 'aqbars');
      adopted = true;
      const a = boot ?? ports.spawn('leopard', aqDef.lair.x, aqDef.lair.z, 0, 'aqbars');
      aqState.animal = a; a.herd = -1; a.mem['low'] = 0.3; aq.spawned(); bindAq(a);
    },
    despawn: () => { const a = aqScript.animal; pin(a, false); aq.disposeTell(); if (a !== null) { ports.bindings.brains.delete(a); ports.retire(a); } aqState.animal = null; },
    reset: () => { aqState.phase2 = false; aq.reset(aqScript.animal); },
    enterPhase2: () => { aqState.phase2 = true; }, trophy: silent,
    tick: aqFrame,
  };
  const kbHit = { ...hit, sourceTags: ['elite.kokbori', 'feel.blow', 'cover.checked'] as const, cause: { kind: 'kokbori', label: '' } };
  const deliverKbStrike = (): void => { if (strikeReach()) host.combat.hit(kbHit); };
  const kbPorts: KokboriPorts<AnimalSim> = { player: host.player, lair: kbDef.lair, phase2: () => kbState.phase2, pack: () => kbState.pack,
    environment: ports.environment, random: () => host.rng.stream('ai').next(), rings: tell, feed: silent, sound: silent,
    signature: () => { core.signature('kokbori'); },
    hurt: (a, amount) => {
      striking = a; kbHit.amount = amount; kbHit.point = a.position; kbHit.cause.kind = a.kind; kbHit.cause.label = a.label;
      sampleStrike(NALATI_STRIKES.bite, a, host.player.position, deliverKbStrike, strikePorts);
    } };
  const kb = new KokboriKeeper(kbPorts);
  const kbDecision = (body: AnimalSim, c: AqbarsContext<AnimalSim>): void => { kb.think(body, c); };
  const kbMotion = (body: AnimalSim): void => { kb.act(body); };
  const kbFrame = (dt: number, t: number, engaged: boolean, leashing: boolean): void => { pin(kbState.animal, engaged); kb.tick(kbState.animal, dt, t, engaged, leashing); };
  function bindKb(a: AnimalSim): void {
    ports.bindings.brains.set(a, { think: kbDecision, act: kbMotion });
    a.combatActor().damageMul = req => kb.damage(a, req.point);
  }
  const kbScript: NativeEliteScript = {
    def: kbDef, get animal() { return kbState.animal; },
    spawn: () => {
      const a = ports.spawn('kokbori', kbDef.lair.x, kbDef.lair.z, Math.PI, 'kokbori'); kbState.animal = a; a.herd = -1; kb.spawned(a); bindKb(a);
      kbState.pack = ports.spawnPack(kbDef.lair.x - 6, kbDef.lair.z + 4, ['grey', 'tawny', 'grey', 'dark', 'scout']);
      kbState.pack.homeX = kbDef.lair.x; kbState.pack.homeZ = kbDef.lair.z;
    },
    despawn: () => {
      kb.disposeTell(); if (kbState.pack !== null) ports.retirePack(kbState.pack); kbState.pack = null;
      const a = kbState.animal; pin(a, false); if (a !== null) { ports.bindings.brains.delete(a); ports.retire(a); } kbState.animal = null;
    },
    reset: () => { kbState.phase2 = false; kb.reset(kbState.animal); },
    enterPhase2: () => { kbState.phase2 = true; kb.enterPhase2(kbState.animal); }, trophy: silent,
    tick: kbFrame,
  };
  const argFrame = (dt: number, t: number, engaged: boolean): void => { pin(argState.animal, engaged); arg.tick(argState.animal, ports.herd(), dt, t, engaged); };
  const argScript: NativeEliteScript = {
    def: argDef, get animal() { return argState.animal; },
    spawn: () => {
      const a = ports.herd()?.stallion;
      if (a === undefined || a === null || !a.alive || argScript.animal !== null) throw new Error('Nalati Argymaq herd respawn is not hosted yet');
      argState.animal = a;
    },
    // The page's Argymaq stays on his pasture even when his lair is out of the fight.
    despawn: () => { pin(argScript.animal, false); }, reset: () => { argState.phase2 = false; },
    enterPhase2: () => { argState.phase2 = true; }, trophy: silent,
    broken: () => ports.herd()?.stallionState === 'beaten',
    tick: argFrame,
  };
  core.add(aqScript); core.add(kbScript); core.add(argScript);
  host.onStep(NALATI_ELITES_STEP, dt => { core.update(dt, host.clock.now); }, {
    snapshot: () => ({ version: 1, clocks: core.clocks(), records: Object.fromEntries(Object.entries(core.records()).map(([id, r]) => [id, { ...r }])), entries: core.entries.map(e => ({ id: e.script.def.id, state: e.state,
      timer: e.timer, waitDusk: e.waitDusk, discovered: e.discovered, bannerArmed: e.bannerArmed, farT: e.farT, phase2: e.phase2,
      beatT: e.beatT, lockHp: e.lockHp, seenSig: e.seenSig, leashT: e.leashT, lastHit: e.lastHit === -Infinity ? null : e.lastHit, forced: e.forced })),
      aqbars: { animal: aqScript.animal?.entityId ?? null, phase2: aqState.phase2, keeper: aq.snapshot() },
      kokbori: { animal: kbScript.animal?.entityId ?? null, phase2: kbState.phase2, keeper: kb.snapshot(), pack: kbState.pack === null ? null : ports.packs().indexOf(kbState.pack) },
      argymaq: { animal: argScript.animal?.entityId ?? null, phase2: argState.phase2, keeper: arg.snapshot() } }),
    restore: value => {
      const s = v.parse(Saved, value);
      if (s.entries[0].id !== 'aqbars' || s.entries[1].id !== 'kokbori' || s.entries[2].id !== 'argymaq' || Object.keys(s.records).length !== 3
        || s.records['aqbars'] === undefined || s.records['kokbori'] === undefined || s.records['argymaq'] === undefined) throw new Error('Incompatible Nalati elite identities');
      const body = (id: string | null, kind: string): AnimalSim | null => {
        if (id === null) return null;
        const a = host.entities.get(id);
        if (a === undefined || a.kind !== kind) throw new Error(`Incompatible Nalati elite body ${id}`);
        return a;
      };
      const a = body(s.aqbars.animal, 'leopard'), h = body(s.argymaq.animal, 'argymaq'), k = body(s.kokbori.animal, 'kokbori');
      const pack = s.kokbori.pack === null ? null : ports.packs()[s.kokbori.pack];
      if ((a !== null && a.variant !== 'aqbars') || (h !== null && h !== ports.herd()?.stallion)
        || (k !== null && k.variant !== 'kokbori') || (k === null) !== (pack === null) || pack === undefined
        || (pack !== null && (pack.members.length !== 5 || pack.members.some((m, i) => m.kind !== 'wolf' || m.entityId !== `creature:${String(Number(k?.entityId.slice(9)) + i + 1)}`)))
        || s.entries[0].phase2 !== s.aqbars.phase2 || s.entries[1].phase2 !== s.kokbori.phase2 || s.entries[2].phase2 !== s.argymaq.phase2) throw new Error('Incompatible Nalati elite binding');
      // Validate every keeper payload before changing the actual controllers or bindings.
      new AqbarsKeeper(aqPorts).restore(s.aqbars.keeper); new ArgymaqKeeper<AnimalSim>(argPorts).restore(s.argymaq.keeper);
      new KokboriKeeper(kbPorts).restore(s.kokbori.keeper);
      ports.bindings.brains.clear(); ports.bindings.pinned.clear();
      aq.restore(s.aqbars.keeper); arg.restore(s.argymaq.keeper); kb.restore(s.kokbori.keeper);
      aqState.animal = a; aqState.phase2 = s.aqbars.phase2; argState.animal = h; argState.phase2 = s.argymaq.phase2;
      kbState.animal = k; kbState.phase2 = s.kokbori.phase2; kbState.pack = pack;
      adopted = true;
      core.restoreClocks(s.clocks, s.records);
      s.entries.forEach((entry, i) => { const e = core.entries[i]; if (e === undefined) throw new Error('Missing Nalati elite entry');
        const { id: _id, lastHit, ...rest } = entry; Object.assign(e, rest, { lastHit: lastHit ?? -Infinity }); pin(e.script.animal, e.state === 'engaged'); });
      if (a !== null) bindAq(a);
      if (k !== null) bindKb(k);
    },
  });
  const out = { core, aqbars: aq, argymaq: arg, kokbori: kb, initialize: (): void => { core.initialize(); } };
  installed.set(host, out); return out;
}
