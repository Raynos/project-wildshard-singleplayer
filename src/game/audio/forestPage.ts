/** Client-only forest ambience over native building, animal and encounter owners. */
import { installDeclaredAudio } from '@wildshard/engine/audio/declared';
import * as terrain from '@wildshard/engine/world/Heightfield';
import { registerPlaceSets } from '@wildshard/engine/models/sets';
import { placedGroups } from '@wildshard/engine/models/place';
import type { Scope } from '@wildshard/engine/app/scope';
import type { DeclaredAmbience } from '@wildshard/engine/audio/declaredAmbience';
import { forestPage } from '../shardfile/forestPage';
import type { RangedPage } from '../loadout/rangedPage';
import { installRuntimeGameplayAudio, runtimeAudio } from '../plugin/audio';
import { retainsRuntimeServices } from '../shard/retainedHooks';
import type { ShardContext } from '../plugin/context';

const ambiencePages = new WeakMap<Scope, Map<string, DeclaredAmbience>>();
/** Borrow the actual entered ambience; no audio or input state is copied. */
export function forestPageAmbience(scope: Scope, id: string): DeclaredAmbience {
  const ambience = ambiencePages.get(scope)?.get(id); if (scope.disposed || ambience === undefined) throw new Error('Missing entered forest ambience'); return ambience;
}
/** Named place membership is admitted separately; it adds no physics. */
export async function finishForestPageAudio(ctx: ShardContext, page: Pick<RangedPage, 'rows' | 'loadout' | 'fights'>): Promise<DeclaredAmbience> {
  const id = page.rows.id, floor = forestPage(ctx.scope, page.rows.forest), runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (runtime === undefined || world === undefined || world === null || play === undefined || play === null) throw new Error('Forest audio requires entered play services');
  const { game, sky, registry } = world, { animals, audio, music } = play, cabins = floor.cabins, row = floor.rows.buildings, fights = page.fights;
  registerPlaceSets(page.rows.places, { file: 'declared forest page', registry, centres: { placed: placedGroups(), point: place => place } });
  const ambience = installDeclaredAudio(runtimeAudio(ctx, ctx.product.shardfile.audio), { audio, sea: 0, floorRows: { cabins: row.floors }, sites: { cabins: terrain.CABIN_SITES },
    owners: { terrain, cabins: { ...cabins.life.audioState, firePits: row.firePits } }, ...(retainsRuntimeServices(ctx) ? { scope: ctx.scope } : {}) }, 'ambience');
  fights.useSfx(ambience.sfx);
  await installRuntimeGameplayAudio(ctx, { audio, music, camera: game.camera, ambience, doorChanges: cabins.life.doorChanges, owners: { sky, animals, elites: fights.elites } });
  if (!page.rows.shadowBatch) animals.shadowBatch = false;
  runtime.hooks.equipmentUpdate = dt => { page.loadout.update(dt); }; runtime.hooks.audioUpdate = dt => { ambience.update(dt, game.camera); };
  runtime.hooks.dispose = () => { ambience.dispose(); }; runtime.hooks.checkpoint = () => fights.onPlayerDeath();
  runtime.hooks.eliteEngaged = () => fights.eliteEngaged(); runtime.hooks.isElite = actor => fights.isElite(actor);
  runtime.hooks.stepSurface = at => ambience.stepSurface(at.x, at.z, at.y); runtime.hooks.directional = page.rows.directional;
  const book = ambiencePages.get(ctx.scope) ?? new Map<string, DeclaredAmbience>();
  if (book.has(id)) throw new Error('Duplicate entered forest ambience');
  book.set(id, ambience); ambiencePages.set(ctx.scope, book); ctx.scope.onDispose(() => { book.delete(id); });
  Object.assign(runtime.objects, { ambience }); return ambience;
}
