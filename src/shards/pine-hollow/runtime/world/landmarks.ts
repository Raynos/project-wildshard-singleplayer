import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
/**
 * PineLandmarks — what is left of Pine Hollow's landmarks once the forest page places them (its landmark rows: the fire
 * lookout, the zipline, the footbridge, the hero props and the crags) and lights them (its lantern rows: the three
 * waystones) and the story hides the drawn-up canoe while you paddle it (PH-C8): the bear cave's interior and its shaft
 * and drips, and the chapter's view binding.
 *
 *   const lm = await installPineLandmarks({ sky, registry });   // registers the cave, keeps it updated
 */
import * as THREE from 'three';
import { PineQuestViews } from '../../quest/views';
import { macrotask } from '@wildshard/engine/boot/plan';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { CaveInterior } from '@wildshard/game/shardfile/caveInterior';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { rangedPage } from '@wildshard/game/loadout/rangedPage';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { installForestWeather } from '@wildshard/sdk/looks/forestWeather';
import { pineSetCap } from '../boot/files';
import type { RangedPageRows } from '@wildshard/format/rangedPage';

export class PineLandmarks {
  readonly group = new THREE.Group();
  private chapter: PineQuestViews | null = null;
  /** PH-B2: the Ridge's granite and the bear cave (null: the kit is not in this build) */
  crags: { readonly cave: CaveInterior } | null = null;

  constructor(private readonly sky: Sky) { this.group.name = 'pine-landmarks'; }

  /** The placed models are the forest page's landmark rows (world/forest-page.json), placed with its props. */
  async build(): Promise<this> {
    const product = await loadFirstPartyProduct('pine-hollow');
    // the cave, its textures and its roof patch
    this.crags = { cave: await CaveInterior.load(await product.json('world/cave-interior.json'), pineSetCap(TIER_CONFIG.maxTexture)) };
    const cragFx = new THREE.Group(); cragFx.name = 'pine-crags';
    this.crags.cave.buildFx(); cragFx.add(...this.crags.cave.fx); this.group.add(cragFx);
    return this;
  }

  /** Counted custom chapter/landmark view binding. Platform services take rows. */
  async installChapter(ctx: ShardContext, input: RangedPageRows): Promise<void> {
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
    if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Missing landmark play services');
    const page = rangedPage(ctx.scope, input.id);
    this.chapter = await PineQuestViews.install(ctx, this);
    const ambience = page.ambience;
    const spots = this.crags?.cave.spots() ?? [];
    for (let i = 0; i < Math.min(spots.length, 256); i++) { const spot = spots[i]; if (spot !== undefined) ambience.addSpot({ zone: 'cave', ...spot, fade: 3 }); }
    await installForestWeather(ctx, await ctx.product.json('world/forest-weather.json'));
    const life = await installPageLife(ctx, await ctx.product.json(input.life), page.compendium?.state ?? null, ambience.sfx);
    Object.assign(runtime.objects, { pineLife: life });
  }

  update(dt: number, t: number): void { this.chapter?.present(dt, t); this.crags?.cave.presentFrame(t, this.sky); }
}

/**
 * Build Pine Hollow's landmarks, register them (drawn, colliding, the decks as floors) and keep them updated. The hamlet's
 * buildings are not here: `new Cabins(sky, game.scene)` assembles them with the cabins from the bake (../generators/logCabin.ts).
 */
export async function installPineLandmarks(h: { sky: Sky; registry: WorldRegistry }): Promise<PineLandmarks> {
  const lm = await new PineLandmarks(h.sky).build();
  // what is left is light: the waystones' flames and anchors, the cave's shaft and drips
  h.registry.add({ id: 'pine-landmarks', name: 'Landmark lights', category: 'props', file: 'src/shards/pine-hollow/runtime/world/landmarks.ts', object: lm.group });
  // PH-B2: the crags' modules registered themselves (models, 90 hulls a task); the cave's shell + the ground over it
  const crags = lm.crags;
  if (crags) {
    await macrotask();
    h.registry.add({ id: 'pine-cave', name: 'Bear cave', category: 'nature', file: 'src/game/shardfile/caveInterior.ts', colliders: [...crags.cave.shell, ...crags.cave.roofPatch()], surface: 'rock' });
  }
  return lm;
}
