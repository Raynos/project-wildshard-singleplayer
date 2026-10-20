import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
/**
 * PineLandmarks — what is left of Pine Hollow's landmarks once the forest page places them (its landmark rows: the fire
 * lookout, the zipline, the footbridge, the hero props and the crags) and lights them (its lantern rows: the three
 * waystones): the bear cave's interior and its shaft and drips, the drawn-up canoe that hides while you paddle it (PH-C8),
 * and the chapter's view binding.
 *
 *   const lm = await installPineLandmarks({ sky, registry, page });   // registers the cave, keeps it updated
 *   lm.setLit('pond', true);                                          // the quest relights a waystone
 */
import * as THREE from 'three';
import { admitLandmarkRows, landmarkRows } from './landmarkRows';
import { PineQuestViews } from '../../quest/views';
import { macrotask } from '@wildshard/engine/boot/plan';
import { modelPoseMatrix as placeMatrix } from '@wildshard/engine/models/placementBatch';
import type { WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { forestPage, type ForestPage } from '@wildshard/game/shardfile/forestPage';
import type { ShardContext } from '@wildshard/game/plugin/context';
import { codePart, loadCodeParts } from './codeParts';
import { CaveInterior } from '@wildshard/game/shardfile/caveInterior';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { installRangedPage } from '@wildshard/game/loadout/rangedPage';
import { finishForestPageAudio } from '@wildshard/game/audio/forestPage';
import { installRuntimeAudioEntry } from '@wildshard/game/plugin/audio';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { RainFx } from '../looks/rainFx';
import { pineMemoryTrim, pineSetCap } from '../debug/options';
import type { RangedPageRows } from '@wildshard/format/rangedPage';

export type WaystoneId = 'pond' | 'ridge' | 'den';

export class PineLandmarks {
  readonly group = new THREE.Group();
  private chapter: PineQuestViews | null = null;
  /** PH-B2: the Ridge's granite and the bear cave (null: the kit is not in this build) */
  crags: { readonly cave: CaveInterior } | null = null;

  constructor(private readonly sky: Sky, private readonly page: ForestPage) { this.group.name = 'pine-landmarks'; }

  /** The placed models are the forest page's landmark rows (world/forest-page.json), placed with its props. */
  async build(): Promise<this> {
    const product = await loadFirstPartyProduct('pine-hollow');
    await admitLandmarkRows(product);
    // the cave + its textures; its roof patch borrows the native collider part
    const cave = CaveInterior.load(await product.json('world/cave-interior.json'), this.page.resources, pineSetCap(TIER_CONFIG.maxTexture));
    await loadCodeParts(); this.page.resources.publish('pine.cave-roof', codePart('cave-roof'));
    this.crags = { cave: await cave };
    const cragFx = new THREE.Group(); cragFx.name = 'pine-crags';
    this.crags.cave.buildFx(); cragFx.add(...this.crags.cave.fx); this.group.add(cragFx);
    return this;
  }

  /** Counted custom chapter/landmark view binding. Platform services take rows. */
  async installChapter(ctx: ShardContext, input: RangedPageRows): Promise<void> {
    const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
    if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Missing landmark play services');
    const floor = forestPage(ctx.scope, input.forest), { audio, music } = play;
    installRuntimeAudioEntry(ctx, 'play', { audio, music });
    const page = await installRangedPage(ctx, { ...input, shadowBatch: !pineMemoryTrim() });
    this.chapter = await PineQuestViews.install(ctx, this);
    const quest = this.chapter.quest;
    const ambience = await finishForestPageAudio(ctx, input.id); quest.bindAudio(input.id);
    const spots = this.crags?.cave.spots() ?? [];
    for (let i = 0; i < Math.min(spots.length, 256); i++) { const spot = spots[i]; if (spot !== undefined) ambience.addSpot({ zone: 'cave', ...spot, fade: 3 }); }
    await RainFx.installPage(ctx, await ctx.product.json('world/weather-observations.json'));
    const life = await installPageLife(ctx, await ctx.product.json(input.life), page.compendium?.state ?? null, ambience.sfx);
    Object.assign(runtime.objects, { pineLife: life });
    ctx.debug.expose(`harness.shard.${ctx.manifest.slug}`, { cabins: floor.cabins, props: floor.props, streams: floor.streams, pineLife: life });
  }

  /** the canoe secret (PH-C8): the drawn-up canoe is gone from the shore while you paddle it (the ride draws its own) */
  setCanoeAway(away: boolean): void {
    const place = landmarkRows().canoe[0];
    if (place === undefined) return;
    const m = away ? new THREE.Matrix4().makeScale(0, 0, 0) : placeMatrix(place);
    this.page.resources.object('heroes.canoe.root').traverse((o) => { if (o instanceof THREE.InstancedMesh) { o.setMatrixAt(0, m); o.instanceMatrix.needsUpdate = true; } });
  }

  setLit(id: WaystoneId, on: boolean): void { this.page.setLantern(`waystone.${id}`, on); }

  update(dt: number, t: number): void { this.chapter?.present(dt); this.crags?.cave.presentFrame(t, this.sky); }
}

/**
 * Build Pine Hollow's landmarks, register them (drawn, colliding, the decks as floors) and keep them updated. The hamlet's
 * buildings are not here: `new Cabins(sky, game.scene)` assembles them with the cabins from the bake (../generators/logCabin.ts).
 */
export async function installPineLandmarks(h: { sky: Sky; registry: WorldRegistry; page: ForestPage }): Promise<PineLandmarks> {
  const lm = await new PineLandmarks(h.sky, h.page).build();
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
