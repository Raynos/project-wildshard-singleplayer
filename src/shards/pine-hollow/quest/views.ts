/** Counted pool, lamp and puff drawing. The data-only story host owns play state. */
import * as THREE from 'three';
import { perfLap } from '@wildshard/engine/core/perfLap';
import type { ShardContext } from '@wildshard/game/plugin/context';
import type { ForestStory } from '@wildshard/sdk/quest/forestStoryRows';
import { installForestStory } from '@wildshard/sdk/quest/forestStory';
import type { PineLandmarks } from '../runtime/world/landmarks';
import { DomePuffs } from '@wildshard/engine/fx/groundFx';
import { BeaverPool } from '../world/beaverPool';
import './pinehollow.css';

export class PineQuestViews {
  private readonly leadPuffs;
  private readonly spawnPuffs;
  private readonly at = new THREE.Vector3();
  private canoeAway = false;
  private readonly lit = new Map<string, boolean>();
  private readonly done;
  private constructor(readonly quest: ForestStory, private readonly landmarks: PineLandmarks, private readonly pool: BeaverPool, done: string) {
    this.done = done;
    const lead = quest.stag.puffs, spawn = quest.thralls.puffs;
    this.leadPuffs = new DomePuffs(landmarks.group, new THREE.Color(...lead.color), lead.count);
    this.spawnPuffs = new DomePuffs(landmarks.group, new THREE.Color(...spawn.color), spawn.count);
    pool.setOpen(quest.flags.has('open:dam-sluice'), true); this.lamps();
  }
  static async install(ctx: ShardContext, landmarks: PineLandmarks): Promise<PineQuestViews> {
    const quest = await installForestStory(ctx, await ctx.product.json('quests/forest-story.json'));
    const world = ctx.game.runtime?.world, declared = ctx.product.shardfile.quests.quests[0];
    if (world === undefined || world === null || declared === undefined) throw new Error('Missing quest view world');
    const pool = await new BeaverPool(world.sky).build(); landmarks.group.add(pool.group);
    return new PineQuestViews(quest, landmarks, pool, declared.completeFlag);
  }
  private lamps(): void {
    for (const id of ['pond', 'ridge', 'den'] as const) {
      const on = this.quest.flags.has(`lit:${id}`) || this.quest.flags.has(this.done);
      if (this.lit.get(id) !== on) { this.lit.set(id, on); this.landmarks.setLit(id, on); }
    }
  }
  present(dt: number, time: number): void {
    const { quest, at } = this, { stag, thralls } = quest;
    this.pool.setOpen(quest.flags.has('open:dam-sluice')); this.pool.update(dt); this.lamps();
    if (this.canoeAway !== quest.moverAway) { this.canoeAway = quest.moverAway; this.landmarks.setCanoeAway(this.canoeAway); }
    if (perfLap.active) return;
    this.leadPuffs.update(dt, time); this.spawnPuffs.update(dt, time);
    const lead = stag.takePuffs(), spawns = thralls.takePuffs(), leadRows = stag.puffs, spawnRows = thralls.puffs;
    for (let i = 0; i < 64; i++) { const puff = lead[i]; if (puff === undefined) break;
      this.leadPuffs.burst(at.set(puff.x, puff.y + leadRows.height, puff.z), ...leadRows[puff.kind]); }
    for (let i = 0; i < 64; i++) { const puff = spawns[i]; if (puff === undefined) break;
      this.spawnPuffs.burst(at.set(puff.x, puff.y + spawnRows.height, puff.z), ...spawnRows.burst); }
  }
}
