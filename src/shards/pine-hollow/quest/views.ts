/** G565: Pine's listed quest views over the shared page composition, presented from the landmarks' world update: the
 * counted beaver pool, the mill wheel, the hollow's secret projection, the guide's and spawns' puffs and the journal feat. */
import * as THREE from 'three';
import type { ShardContext } from '@wildshard/game/plugin/context';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { perfLap } from '@wildshard/engine/core/perfLap';
import { DomePuffs } from '@wildshard/engine/fx/groundFx';
import type { QuestPageRows } from '@wildshard/format/questPageComposition';
import { installQuestPageComposition, prepareQuestPageComposition, type QuestPageComposition } from '@wildshard/game/quest/pageComposition';
import { installChapterLead, installQuestSpawnDirector } from '@wildshard/game/quest/chapterDirector';
import { forestPage, type ForestPage } from '@wildshard/game/shardfile/forestPage';
import { rangedPage } from '@wildshard/game/loadout/rangedPage';
import type { PineLandmarks } from '../runtime/world/landmarks';
import { BeaverPool } from '../world/beaverPool';
import './pinehollow.css';

/** The view rows of quests/forest-story.json (generators/forestStory.ts). */
interface PineViewRows {
  readonly page: string; readonly ranged: string; readonly content: `custom/${string}`; readonly wheel: { readonly flag: string; readonly speed: number };
  readonly secret: { readonly scene: string; readonly floorY: number; readonly mid: readonly [number, number, number] };
}
interface PineQuestOwners {
  readonly flags: Flags; readonly pool: BeaverPool; readonly view: PineViewRows; readonly floor: ForestPage;
  readonly spine: NonNullable<QuestPageComposition['spine']>; readonly facets: QuestPageComposition['facets'];
  readonly journal: () => ReturnType<typeof rangedPage>['compendium']; readonly player: THREE.Vector3;
  readonly stag: ReturnType<typeof installChapterLead>; readonly thralls: Awaited<ReturnType<typeof installQuestSpawnDirector>>;
  readonly leadPuffs: DomePuffs; readonly spawnPuffs: DomePuffs; readonly hollow: { at: THREE.Vector3 | null };
}
const _v = new THREE.Vector3();
export class PineQuestViews {
  private slowT = 0;
  private constructor(private readonly o: PineQuestOwners) { o.pool.setOpen(o.flags.has('open:dam-sluice'), true); }
  get flags(): Flags { return this.o.flags; }
  static async install(ctx: ShardContext, landmarks: PineLandmarks): Promise<PineQuestViews> {
    const rows = await ctx.product.json<QuestPageRows>('quests/page-composition.json'), view = await ctx.product.json<PineViewRows>('quests/forest-story.json');
    await prepareQuestPageComposition(ctx, rows);
    const { flags, facets, spine } = await installQuestPageComposition(ctx, rows);
    const world = ctx.game.runtime?.world;
    if (world === undefined || world === null || spine === null) throw new Error('Missing quest view world');
    const floor = forestPage(ctx.scope, view.page), equipment = rangedPage(ctx.scope, view.ranged), native = ctx.product.section<unknown>(view.content);
    const thralls = await installQuestSpawnDirector(ctx, native), stag = installChapterLead(ctx, native);
    thralls.useSfx(equipment.ambience.sfx);
    // the guide's and the spawns' declared puffs: shimmer domes swelling where each cue fired
    const leadPuffs = ctx.scope.own(new DomePuffs(world.game.scene, new THREE.Color(...stag.puffs.color), stag.puffs.count));
    const spawnPuffs = ctx.scope.own(new DomePuffs(world.game.scene, new THREE.Color(...thralls.puffs.color), thralls.puffs.count));
    const hollow: PineQuestOwners['hollow'] = { at: null };
    void floor.cabins.resources.place(view.secret.scene).then(() => { hollow.at = new THREE.Vector3().fromArray(view.secret.mid); return hollow; });
    const pool = await new BeaverPool().build(ctx); landmarks.group.add(pool.group);
    return new PineQuestViews({ flags, pool, view, floor, spine, facets, journal: () => equipment.compendium, player: world.player.position,
      stag, thralls, leadPuffs, spawnPuffs, hollow });
  }
  present(dt: number, t: number): void {
    const { flags, pool, view, floor, spine, facets, player, stag, thralls, leadPuffs, spawnPuffs, hollow } = this.o;
    pool.setOpen(flags.has('open:dam-sluice')); pool.update(dt);
    floor.cabins.life.wheelSpeed = flags.has(view.wheel.flag) ? view.wheel.speed : 0;
    if (!perfLap.active) { // E350 F-J1: the PERF LAP's teleports call no stag and no thralls, and project no secret
      stag.update(dt, t); thralls.update(dt, player); leadPuffs.update(dt, t); spawnPuffs.update(dt, t);
      for (const puff of stag.takePuffs()) leadPuffs.burst(_v.set(puff.x, puff.y + stag.puffs.height, puff.z), ...stag.puffs[puff.kind]);
      for (const puff of thralls.takePuffs()) spawnPuffs.burst(_v.set(puff.x, puff.y + thralls.puffs.height, puff.z), ...thralls.puffs.burst);
    }
    if (t - this.slowT <= 0.5) return;
    this.slowT = t;
    if (!perfLap.active && hollow.at !== null) spine.project('secret', { playerX: player.x, playerY: player.y, playerZ: player.z,
      atX: hollow.at.x, atY: hollow.at.y, atZ: hollow.at.z, floorY: view.secret.floorY });
    const st = this.o.journal()?.state;
    if (st?.def.entries.every((e) => { const s = st.stats(e.id).state; return s === 'seen' || s === 'taken'; }) === true) facets.achievements?.event('journal', 1);
  }
}
