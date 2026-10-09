import { PackBrain, type PackPorts } from '@wildshard/engine/ai/pack';
import { HerdBrain } from '@wildshard/engine/ai/herd';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost } from '@wildshard/engine/sim';
import { groupBrain } from '@wildshard/sdk/groupBrains';
import { NALATI_PACK_BRAIN, NALATI_HERD_BRAIN } from '../data/brains';
import { NALATI_WILDLIFE } from '../creatures/wildPlacement';
import { wildEnv, type WildEnv } from '../creatures/env';
import { ARGYMAQ } from '../combat/eliteRoster';
import { nativeHerdPorts, nativePackPorts, type NativeGroupHost, type NativeGroupWorld } from './groupPorts';
import type { NalatiBody } from './headless';

/** The declared groups of a renderer-free host: Wildlife's pack and wild herd, and Argymaq's herd with him as its stallion. */
export interface NalatiGroups {
  readonly packs: readonly PackBrain<AnimalSim>[];
  readonly herds: readonly HerdBrain<AnimalSim>[];
  /** the aggression director's registrations (the page's `app.aggression`): an attack token's claim and check for an actor */
  readonly claim: (actor: AnimalSim) => boolean;
  readonly mayAttack: (actor: AnimalSim) => boolean;
  /** the wild view the groups' senses read (runtime/groups.ts nalatiHeadlessEnv) */
  readonly env: WildEnv;
  /** the host's grass under that view: the page's field and the host's trample map (runtime/headless.ts) */
  readonly grass: NalatiGrassView;
}

const installed = new WeakMap<SimHost, NalatiGroups>();
/** The declared groups installed into `host` (its tests and, next, its decisions read them), or undefined. */
export function nalatiGroupsOf(host: SimHost): NalatiGroups | undefined { return installed.get(host); }

const unbound = (what: string) => (): never => { throw new Error(`Nalati headless ${what} is not modelled yet (sf72-nalati5 handoff)`); };

/** The host's own grass (SF72): the page's field over the same baked grid and terrain field (game/systems/looks/grassField.ts
 *  GrassField) and a trample map of its own (game/systems/looks/trample.ts TrampleField); runtime/headless.ts builds them. */
export interface NalatiGrassView {
  readonly field: { baseHeightAt: (x: number, z: number) => number };
  readonly trample: { amountAt: (x: number, z: number) => number; push: (x: number, z: number, radius: number, strength?: number, vx?: number, vz?: number) => void };
}

/**
 * The wild view a renderer-free host's groups read: the page's defaults for the data fields (the boot's wind and full day
 * light, no storm, the player standing, unhurt, on foot; the host's weather step rewrites the light, the storm and the wind
 * every tick, runtime/headless.ts installNalatiWeather), the host's own grass (`grassStandingAt` = the field before
 * trampling, `grassHeightAt` = it × (1 − 0.85 × trample), as the page's GrassTrample `grassHeightAt`; pushes stamp the host's
 * map), and refusals for the event and knock-down routes: nothing decides until the groups tick, so nothing reads a refusal.
 */
export function nalatiHeadlessEnv(grass: NalatiGrassView): WildEnv {
  const { field, trample } = grass;
  return { ...wildEnv, wind: { ...wildEnv.wind }, light: 1, storm: false, playerFwdX: 0, playerFwdZ: -1, playerCrouched: false, playerMounted: false, playerHealth01: 1, lastShotT: -1e9,
    grassHeightAt: (x, z) => field.baseHeightAt(x, z) * (1 - 0.85 * trample.amountAt(x, z)), grassStandingAt: (x, z) => field.baseHeightAt(x, z),
    trample: (x, z, r, s, vx, vz) => { trample.push(x, z, r, s, vx, vz); }, onEvent: unbound('creature signal'), onKnockdown: unbound('knock-down') };
}

/**
 * Nalati's declared groups in a renderer-free host (SF72), built and seeded exactly as the page builds them: Wildlife's pack
 * (`PackBrain` over NALATI_PACK_BRAIN, home at its layout spot) and its wild herd (`HerdBrain` over NALATI_HERD_BRAIN), each
 * initialized right after its placement on the host's 'ai' stream (the pack's three draws a wolf, the herd's one), then the
 * raid director's first-raid draw and the Golden King's `reset(0)` draw (both systems not modelled yet), then Argymaq's herd (its mares and
 * foal, one draw) adopting him as its stallion (combat/elites.ts `Argymaq.spawn`). The packs see the herds' foals as prey and
 * the herds see the living wolves as threats (Wildlife's `nearestFoal` / `nearestWolf`); prey is an actor (`actor:<id>`), the
 * flock's sheep are not modelled. Checked against the bake's tick-0 continuations
 * (test/shards/nalati-grasslands/headless-runtime.test.ts). Their wild view is `env` when given (the host's, which its
 * weather step keeps current), else a fresh one (nalatiHeadlessEnv). Not yet: their decisions (the groups never tick here).
 */
export function installNalatiGroups(host: SimHost, ports: { bodies: readonly NalatiBody[]; herds: readonly { readonly kind: string; readonly members: readonly string[] }[]; normalY: (x: number, z: number) => number; grass: NalatiGrassView; env?: WildEnv }): NalatiGroups {
  const byId = new Map(ports.bodies.map(b => [b.boot.id, b.actor] as const));
  const actor = (id: string): AnimalSim => { const a = byId.get(id); if (a === undefined) throw new Error(`Nalati group member ${id} has no body`); return a; };
  const policies = new WeakMap<AnimalSim, Parameters<PackPorts<AnimalSim>['register']>[1]>();
  const group: NativeGroupHost<AnimalSim> = { sharedRng: () => host.rng.stream('ai'), register: (a, director) => { policies.set(a, director); } };
  const packOf = new WeakMap<AnimalSim, PackBrain<AnimalSim>>();
  const world: NativeGroupWorld<AnimalSim> = { env: ports.env ?? nalatiHeadlessEnv(ports.grass), normalY: ports.normalY, passThrough: unbound('stampede pass-through'), packOf: a => packOf.get(a) ?? null };
  const identity = {
    preyIdentity: (prey: unknown): string => {
      const found = ports.bodies.find(b => b.actor === prey);
      if (found === undefined) throw new Error('Unbound Nalati headless prey (the flock is not modelled)');
      return `actor:${found.boot.id}`;
    },
    resolvePrey: (id: string): AnimalSim | null => {
      if (!id.startsWith('actor:')) throw new Error(`Nalati headless prey ${id} is not modelled`);
      return byId.get(id.slice(6)) ?? null;
    },
    resolveActor: (id: string): AnimalSim | null => byId.get(id) ?? null,
  };
  const packs: PackBrain<AnimalSim>[] = [], herds: HerdBrain<AnimalSim>[] = [], wolves: AnimalSim[] = [];
  const herdOf = (index: number, kind: string): AnimalSim[] => {
    const row = ports.herds[index];
    if (row?.kind !== kind) throw new Error(`Nalati herd ${String(index)} is not a ${kind} herd`);
    return row.members.map(actor);
  };
  /** the nearest living body of `list` within r (strictly nearer wins: the first of a tie, as Wildlife's loops) */
  const nearest = (list: readonly AnimalSim[], x: number, z: number, r: number): AnimalSim | null => list.reduce<{ best: AnimalSim | null; d: number }>((acc, a) => {
    const d = Math.hypot(a.position.x - x, a.position.z - z);
    return a.alive && d < acc.d ? { best: a, d } : acc;
  }, { best: null, d: r }).best;
  const nearestFoal = (x: number, z: number, r: number): AnimalSim | null => nearest(herds.flatMap(h => h.foals), x, z, r);
  const nearestWolf = (x: number, z: number, r: number): AnimalSim | null => nearest(wolves, x, z, r);
  const herd = (members: AnimalSim[]): HerdBrain<AnimalSim> => {
    const data = groupBrain({ ...NALATI_HERD_BRAIN, members: members.map(a => a.entityId) });
    if (data.kind !== 'herd') throw new Error('Invalid herd declaration');
    const policy = new HerdBrain(members, data, { ...nativeHerdPorts(group, world), resolveActor: identity.resolveActor });
    policy.findThreat = nearestWolf;
    policy.initialize(); herds.push(policy);
    return policy;
  };
  // the saddled horses are owned (no herd AI, can't die): the camp's two at the rail (ride.ts, Mount.addMountable) and the
  // shepherd's (creatures/sheepRaid.ts), the horses outside any herd
  ports.bodies.forEach(b => { if (b.boot.kind === 'horse' && b.boot.herd === -1) b.actor.mem['owned'] = 1; });
  // Wildlife.build: its one pack, then its one wild herd
  const den = NALATI_WILDLIFE.packs[0];
  if (den === undefined || NALATI_WILDLIFE.packs.length !== 1 || NALATI_WILDLIFE.herds.length !== 1) throw new Error('Nalati headless models one pack and one wild herd');
  const pack = herdOf(0, 'wolf');
  wolves.push(...pack);
  const data = groupBrain({ ...NALATI_PACK_BRAIN, home: [den.x, den.z], members: pack.map(a => a.entityId) });
  if (data.kind !== 'pack') throw new Error('Invalid pack declaration');
  const policy = new PackBrain(pack, den.x, den.z, data, { ...nativePackPorts(group, world), preyIdentity: identity.preyIdentity, resolvePrey: identity.resolvePrey });
  policy.findPrey = nearestFoal;
  policy.initialize(); packs.push(policy);
  pack.forEach(w => { packOf.set(w, policy); });
  herd(herdOf(1, 'horse'));
  // two load-time draws the page takes before Argymaq's herd, from systems not modelled yet: the raid director's first raid
  // clock (creatures/sheepRaid.ts `raidT = rand(FIRST_RAID)`, as ride.ts builds the shepherd), then the Golden King's
  // reset(0) burst cooldown (combat/goldenKing.ts, his body parked)
  host.rng.stream('ai').next(); host.rng.stream('ai').next();
  // Argymaq's herd: the mares and foal Wildlife places for him, then him as its stallion
  const lair = herdOf(3, 'horse'), argymaq = lair.find(a => a.kind === ARGYMAQ);
  if (argymaq === undefined || lair[lair.length - 1] !== argymaq) throw new Error('Argymaq\'s herd has no Argymaq');
  herd(lair.slice(0, -1)).adoptStallion(argymaq);
  const groups: NalatiGroups = { packs, herds, env: world.env, grass: ports.grass, claim: a => policies.get(a)?.take(a) ?? true, mayAttack: a => policies.get(a)?.free(a) ?? true };
  installed.set(host, groups);
  return groups;
}
