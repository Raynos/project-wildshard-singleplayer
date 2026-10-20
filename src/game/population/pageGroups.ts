import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import type { CrowdTargets } from '../shardfile/crowdRuntime';
import * as v from 'valibot';
import type { Rng } from '@wildshard/engine/core/rng';
import type { ReturnProgram } from './returnProgram';
import { createCreatureSpawner, type CreatureSpawnRow } from '../plugin/brain';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { terrainHeight, terrainNormal, terrainWaterLevel } from '@wildshard/engine/world/terrainHeight';
import { Vector3 } from 'three';
import { ReturnGate } from './respawn';

type Placement = CreatureSpawnRow & { readonly herd: number; readonly practice?: true };
interface Counts { readonly bodies: Map<string, number>; readonly groups: Map<string, number> }

/** Grouped page lifetimes over the existing manager. Bodies keep their own AI,
 * native identities and creature-stream order. The owner retires only what it
 * actually spawned. Authored rows select the training slot and leaning sites. */
export class PageActorGroups {
  private readonly owner: ReturnType<typeof createCreatureSpawner<Animal>>;
  readonly counts: Counts = { bodies: new Map(), groups: new Map() };
  private training: Animal | null = null;
  private trainingRow: Placement | null = null;
  private readonly clock = { dead: 0, fade: -1 };
  constructor(private readonly animals: AnimalManager) { this.owner = createCreatureSpawner(animals); }
  get practice(): Animal | null { return this.training; }
  count(kind: string, groups = false): number { return (groups ? this.counts.groups : this.counts.bodies).get(kind) ?? 0; }
  private countBody(kind: string): void { this.counts.bodies.set(kind, this.count(kind) + 1); }

  /** Group preflight happens before any draw; body/row joins use the returned
   * ordered batch rather than guessing the manager's array offsets. */
  place(centres: readonly { readonly x: number; readonly z: number }[], kinds: readonly string[], rows: readonly Placement[]): void {
    this.owner.place(centres, kinds, rows, (actor, row) => {
      this.countBody(row.kind);
      if (row.practice === true) { this.training = actor; this.trainingRow = row; this.clock.dead = 0; this.clock.fade = -1; }
    }, kind => { this.counts.groups.set(kind, this.count(kind, true) + 1); });
  }
  /** Ungrouped actors retain herd −1. Presentation attaches to the real body. */
  loose(row: CreatureSpawnRow): Animal { const actor = this.owner.spawn(row.kind, row.x, row.z, row.yaw, row.variant ?? undefined); actor.herd = -1; this.countBody(row.kind); return actor; }

  /** Authored training homes refill after their corpse is hidden. Ordinary
   * ecological returns stay independent and retain their own queue entry. */
  updatePractice(dt: number, player: { readonly x: number; readonly z: number }, row: {
    readonly delay: number; readonly away: number;
  }): void {
    const actor = this.training, placed = this.trainingRow;
    if (actor === null || placed === null) return;
    const action = ReturnGate.step(this.clock, { ...row, fade: 'hidden' }, dt, actor.alive, Math.hypot(player.x - placed.x, player.z - placed.z), actor.hidden);
    if (action === 'fade') actor.fadeOut();
    if (action !== 'replace') return;
    const [next] = this.owner.group(placed.kind, placed, [placed]);
    if (next === undefined) throw new Error('Missing training return');
    this.training = next; this.clock.dead = 0; this.clock.fade = -1; this.countBody(placed.kind);
  }

  /** Crown and base coordinates of leaning vertical sites, in source order.
   * Placement reads the installed page terrain, never a content callback. */
  perches(rows: readonly { readonly x: number; readonly z: number; readonly h: number; readonly lean: number; readonly leanDir: number }[],
    offsets: { readonly foot: number; readonly crown: number; readonly base: number }): void {
    if (rows.length === 0) return;
    const habitat = this.animals.habitat; habitat.perches = []; habitat.perchBases = [];
    for (const row of rows) {
      const base = terrainHeight(row.x, row.z) - offsets.foot;
      habitat.perches.push(new Vector3(row.x + Math.cos(row.leanDir) * row.lean * row.h, base + row.h + offsets.crown, row.z + Math.sin(row.leanDir) * row.lean * row.h));
      habitat.perchBases.push(new Vector3(row.x, base + offsets.base, row.z));
    }
  }
  dispose(): void { this.owner.dispose(); this.training = null; }
}

const point = v.object({ x: v.number(), z: v.number() });
const whole = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1024));
/** Ordered page placement on the population owner. The admitted event program
 * chooses retries, terrain admission, member variants and relative placements.
 * Inputs are data and existing authorities; no content callback crosses it. */
export class PagePopulationPlanner {
  constructor(private readonly animals: AnimalManager, private readonly program: ReturnProgram, private readonly random: Rng,
    private readonly signals: { readonly begin: string; readonly spot: string; readonly accept: string; readonly yaw: string }) {}
  spot(x: number, z: number, radius: number): { x: number; z: number } {
    const attempts = v.parse(whole, this.program.project(this.signals.begin, {})['attempts']);
    for (let i = 0; i < attempts; i++) {
      const at = v.parse(point, this.program.project(this.signals.spot, { x, z, radius }, this.random));
      const clash = this.animals.animals.some(a => Math.abs(a.position.x - at.x) < 2 && Math.abs(a.position.z - at.z) < 2);
      if (this.program.project(this.signals.accept, { ...at, normal: terrainNormal(at.x, at.z)[1], height: terrainHeight(at.x, at.z), water: terrainWaterLevel(),
        wet: Number(this.animals.wetAt?.(at.x, at.z) === true), clash: Number(clash) })['accept'] === 1) return at;
    }
    return { x, z };
  }
  place(kind: string, variant: string, x: number, z: number, radius: number): Animal {
    const at = this.spot(x, z, radius), yaw = v.parse(v.number(), this.program.project(this.signals.yaw, {}, this.random)['yaw']);
    return this.animals.spawn(kind, at.x, at.z, yaw, variant);
  }
  /** Scatter a known ordered roster into one manager-owned group. */
  scatter(row: { readonly kind: string; readonly variants: readonly string[]; readonly x: number; readonly z: number; readonly radius: number }): Animal[] {
    const herd = this.animals.addHerd(row.kind, row.x, row.z);
    return row.variants.map(variant => this.member(this.place(row.kind, variant, row.x, row.z, row.radius), herd));
  }
  /** A bounded guest plan selects each member and optional placement relative to
   * an earlier member or the group's origin. Allocation stays in source order. */
  planned(row: { readonly kind: string; readonly x: number; readonly z: number; readonly variants: readonly string[];
    readonly observations: Readonly<Record<string, number>>; readonly start: string; readonly member: string; readonly offset: string }): Animal[] {
    const herd = this.animals.addHerd(row.kind, row.x, row.z);
    const start = v.parse(v.object({ start: v.number(), count: whole }), this.program.project(row.start, row.observations, this.random));
    const members: Animal[] = [];
    for (let index = 0; index < start.count; index++) {
      const plan = this.program.project(row.member, { ...row.observations, ...start, index });
      const variant = row.variants[v.parse(whole, plan['variant'])]; if (variant === undefined) throw new Error('Missing population variant');
      const actor = this.member(this.place(row.kind, variant, row.x, row.z, v.parse(v.number(), plan['radius'])), herd); members.push(actor);
      if (plan['place'] === 1) {
        const parent = members[v.parse(whole, plan['mother'])];
        if (parent !== undefined && parent !== actor) { const offset = v.parse(point, this.program.project(row.offset, {}, this.random)); actor.place(parent.position.x + offset.x, parent.position.z + offset.z, parent.yaw); }
      } else if (plan['place'] === 2) actor.place(row.x + v.parse(v.number(), plan['x']), row.z + v.parse(v.number(), plan['z']), v.parse(v.number(), plan['yaw']));
    }
    return members;
  }
  private member(actor: Animal, herd: number): Animal { actor.herd = herd; this.animals.herds[herd]?.members.push(actor); return actor; }
}

/** Group effects use existing pack, herd and crowd owners. Content contributes
 * event-law ids and effect radii; no new brain or body clock is installed. */
export class PopulationRelations {
  constructor(private readonly program: ReturnProgram,
    private readonly groups: { readonly packs: readonly Pick<PackBrain<Animal>, 'members' | 'awareness' | 'scare'>[];
      readonly herds: readonly Pick<HerdBrain<Animal>, 'members' | 'cx' | 'cz' | 'stampeding' | 'disturb' | 'stampede'>[];
      readonly crowds: readonly CrowdTargets[] },
    private readonly row: { readonly alert: string; readonly range: string; readonly packRadius: number;
      readonly disturbRadius: number; readonly disturbSeconds: number; readonly scareSeconds: number }) {}
  alert(x: number, z: number): void {
    for (const herd of this.groups.herds) for (const actor of herd.members) {
      const result = this.program.project(this.row.alert, { x, z, px: actor.position.x, pz: actor.position.z, awareness: actor.mem['aw'] ?? 0 });
      if (result['accept'] === 1) actor.mem['aw'] = result['awareness'] ?? 0;
    }
    for (const pack of this.groups.packs) for (const actor of pack.members) if (actor.alive) {
      const result = this.program.project(this.row.alert, { x, z, px: actor.position.x, pz: actor.position.z, awareness: pack.awareness });
      if (result['accept'] === 1) { pack.awareness = result['awareness'] ?? 0; break; }
    }
  }
  disturb(x: number, z: number): void {
    for (const herd of this.groups.herds) herd.disturb(x, z);
    for (const view of this.groups.crowds) if (this.admitted(x, z, view.cx, view.cz, this.row.disturbRadius)) view.scare(x, z, this.row.disturbSeconds);
  }
  scare(x: number, z: number, radius: number): void {
    for (const pack of this.groups.packs) pack.scare(x, z, this.row.packRadius);
    for (const herd of this.groups.herds) if (this.admitted(x, z, herd.cx, herd.cz, radius)) herd.stampede(x, z);
    for (const view of this.groups.crowds) if (this.admitted(x, z, view.cx, view.cz, radius)) view.scare(x, z, this.row.scareSeconds);
  }
  ripple(): void { for (const herd of this.groups.herds) if (herd.stampeding) for (const pack of this.groups.packs) pack.scare(herd.cx, herd.cz, this.row.packRadius); }
  private admitted(x: number, z: number, px: number, pz: number, radius: number): boolean { return this.program.project(this.row.range, { x, z, px, pz, radius })['accept'] === 1; }
}

/** Nearest live body in a native ordered roster; ties preserve source order. */
export function nearestPopulationActor(actors: readonly Animal[], x: number, z: number, radius: number): Animal | null {
  let selected: Animal | null = null, distance = radius;
  for (const actor of actors) if (actor.alive) {
    const next = Math.hypot(actor.position.x - x, actor.position.z - z);
    if (next < distance) { distance = next; selected = actor; }
  }
  return selected;
}
