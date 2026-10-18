import { createCreatureSpawner, type CreatureSpawnRow } from '../plugin/brain';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
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
