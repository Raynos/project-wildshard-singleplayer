import * as v from 'valibot';
import type { HuntHerd, HuntBody } from '@wildshard/engine/ai/hunt';
import type { SimHost } from '@wildshard/engine/sim';
import { PINE_HERD_SHELTER as look } from '../data/weatherLook';

/** Actual page tree position, trunk radius, height and RainFx crown-cover reading, in forest order. */
export type PineShelterTree = readonly [x: number, z: number, radius: number, height: number, cover: number];
type Herd = Pick<HuntHerd<HuntBody>, 'kind' | 'cx' | 'cz'>;
const finite = v.pipe(v.number(), v.finite());
const point = v.strictObject({ x: finite, z: finite });
const state = v.strictObject({ home: point, spot: v.nullable(point), hold: v.pipe(finite, v.minValue(0), v.maxValue(look.homeHold)) });
const saved = v.strictObject({ version: v.literal(1), shelters: v.array(v.nullable(state)) });
type Shelter = v.InferOutput<typeof state>;
const HERD_MAX = 512, TREE_MAX = 16384;
const HERD_BOUND = new Error('Pine shelter herd bound exceeded');
interface Slot {
  active: boolean; covered: boolean; hold: number;
  home: { x: number; z: number; r: number }; spot: { x: number; z: number; r: number };
}
const freshSlot = (): Slot => ({ active: false, covered: false, hold: 0,
  home: { x: 0, z: 0, r: look.homeR }, spot: { x: 0, z: 0, r: look.spotR } });

/** Renderer-free bridge of Pine's page HerdShelter law. Its replacement is a serialized shelter row on the species host. */
export class PineRainShelter {
  private readonly herds: () => readonly Herd[];
  private readonly big: readonly PineShelterTree[];
  private readonly kinds: ReadonlySet<string> = new Set(look.kinds);
  private readonly slots = Array.from({ length: HERD_MAX }, freshSlot);
  constructor(herds: () => readonly Herd[], trees: readonly PineShelterTree[]) {
    if (trees.length > TREE_MAX) throw new Error('Pine shelter tree bound exceeded');
    this.herds = herds;
    this.big = trees.filter(tree => tree[3] >= look.bigTree);
  }
  private pick(herd: Herd, shelter: Slot): void {
    let best: PineShelterTree | null = null, score = Infinity;
    for (let index = 0; index < TREE_MAX; index++) {
      const tree = this.big[index];
      if (tree === undefined) break;
      const distance = Math.hypot(tree[0] - herd.cx, tree[1] - herd.cz);
      if (distance > look.reach) continue;
      const candidate = distance - 0.8 * tree[3] - 12 * tree[4];
      if (candidate < score) { score = candidate; best = tree; }
    }
    shelter.covered = best !== null;
    if (best === null) return;
    const dx = herd.cx - best[0], dz = herd.cz - best[1], length = Math.hypot(dx, dz) || 1;
    shelter.spot.x = best[0] + dx / length * (best[2] + look.clear);
    shelter.spot.z = best[1] + dz / length * (best[2] + look.clear);
  }
  /** Run after the single weather owner publishes rain, before the hunting brain reads its herd goals. */
  update(dt: number, rain: number): void {
    const raining = rain > look.wet, herds = this.herds();
    if (herds.length > HERD_MAX) throw HERD_BOUND;
    for (let index = 0; index < HERD_MAX; index++) {
      const herd = herds[index], shelter = this.slots[index];
      if (herd === undefined || shelter === undefined) break;
      if (!this.kinds.has(herd.kind)) continue;
      if (raining) {
        if (!shelter.active) {
          shelter.home.x = herd.cx; shelter.home.z = herd.cz;
          this.pick(herd, shelter); shelter.active = true;
        }
        shelter.hold = look.homeHold;
        if (shelter.covered) { herd.cx = shelter.spot.x; herd.cz = shelter.spot.z; }
      } else if (shelter.active && rain < look.dry) {
        shelter.hold -= dt;
        if (shelter.hold <= 0) shelter.active = false;
      }
    }
  }
  /** The exact wet/drying goal and strict rain thresholds used by the page's wander answer. */
  wanderGoal(index: number, rain: number): { x: number; z: number; r: number } | null {
    const herd = this.herds()[index], shelter = this.slots[index];
    if (herd === undefined || shelter === undefined || !shelter.active) return null;
    if (rain > look.wet) return shelter.covered ? shelter.spot : null;
    return shelter.home;
  }
  /** Stable herd-slot continuation; returned points do not retain live mutable state. */
  snapshot(): v.InferOutput<typeof saved> {
    return { version: 1, shelters: this.herds().map((_herd, index) => {
      const shelter = this.slots[index];
      return shelter === undefined || !shelter.active ? null : { home: { x: shelter.home.x, z: shelter.home.z },
        spot: shelter.covered ? { x: shelter.spot.x, z: shelter.spot.z } : null, hold: shelter.hold };
    }) };
  }
  /** Validate every slot before committing; restored herd identities belong to this host, never the saved host. */
  restore(value: unknown): void {
    const parsed = v.parse(saved, value), herds = this.herds();
    if (parsed.shelters.length > HERD_MAX || parsed.shelters.length !== herds.length) throw new Error('Incompatible Pine rain-herd continuation');
    const next: (Shelter | null)[] = [];
    parsed.shelters.forEach((shelter, index) => {
      const herd = herds[index];
      if (shelter === null) { next.push(null); return; }
      if (herd === undefined || !this.kinds.has(herd.kind)) throw new Error('Incompatible Pine shelter kind');
      next.push(shelter);
    });
    next.forEach((shelter, index) => {
      const slot = this.slots[index];
      if (slot === undefined) throw new Error('Pine shelter slot bound exceeded');
      slot.active = shelter !== null;
      if (shelter === null) return;
      slot.home.x = shelter.home.x; slot.home.z = shelter.home.z;
      slot.covered = shelter.spot !== null; slot.hold = shelter.hold;
      if (shelter.spot !== null) { slot.spot.x = shelter.spot.x; slot.spot.z = shelter.spot.z; }
    });
  }
}

/** One native shelter keeper beside the existing weather owner; no second Weather, settings or random stream. */
export function installPineRainShelter(host: SimHost, herds: () => readonly Herd[], trees: readonly PineShelterTree[], rain: () => number): PineRainShelter {
  const shelter = new PineRainShelter(herds, trees);
  host.onStep('pine.rain-shelter', dt => { shelter.update(dt, rain()); }, { snapshot: () => shelter.snapshot(), restore: value => { shelter.restore(value); } });
  return shelter;
}
