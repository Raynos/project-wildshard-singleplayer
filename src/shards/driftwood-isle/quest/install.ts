import { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { installLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { QuestViews } from '@wildshard/game/plugin/ui';
import { Sword } from '@wildshard/game/weapons/Sword';
import { driftwoodWorld } from '../world/build';
import { registerPlaceSets } from '@wildshard/engine/models/sets';
import type { PlaceSets } from '../runtime/productSections.generated.d.ts';
import { installAdventure, type Adventure } from './adventure';
import { installDeclaredCollectionKeepsakes } from '@wildshard/game/compendium/keepsakes';
import { COLLECTIONS } from '../runtime/boot/blobAssets';
import { captainHat, sailclothCape } from '../runtime/models/captainHat';
import { driftwoodRows } from '../runtime/boot/rows';
import { installItemEffects } from '@wildshard/game/loadout/effects';
import { driftwoodLootPresentation } from '../loot/presentation';
import { installQuestHints } from '@wildshard/game/quest/hints';
import { HeldClaims } from '@wildshard/game/loadout/claims';
import { preloadCaptainMesh } from '../species/captainMesh';
import { preloadSailorHead } from '../species/sailor';

/** `deps`: the heroes' preload and the adventure's install (the shard's by default; a test passes its own) */
export async function installDriftwoodAdventure(ctx: ShardContext, deps: { preload?: () => Promise<unknown>; install?: typeof installAdventure } = {}): Promise<Adventure> {
  const shell = ctx.game.runtime;
  const world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  // Saved used:altar restores the boss synchronously in Finale; resolve the hull before any quest restore/spawn.
  await (deps.preload ?? (() => Promise.all([preloadCaptainMesh(), preloadSailorHead()])))();
  if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during the creature mesh load');
  const { game, sky, player, registry, params } = world;
  const d = driftwoodWorld(shell);
  const adventure = await (deps.install ?? installAdventure)(ctx, { game, sky, player, registry, params, chunk: ctx.manifest,
    prompts: shell.interactables, hud: h.hud, audio: h.audio, music: h.music, inventory: h.inventory, progress: h.progress, fullMap: h.fullMap, animals: h.animals,
    ironDrop: HeldClaims.current(ctx.manifest.slug).claim('iron-sword'), setViewmodel: (on) => { h.weapons.visible = on; }, stowWeapon: (on) => { h.weapons.stowed = on; },
    bridgeFloor: d.bridge === null ? undefined : (x, z) => d.bridge?.floorHeightAt(x, z),
    pois: { hut: d.hut, lookout: d.lookout, wreck: d.wreck, shrine: d.shrine, cave: d.cove }, gulls: d.gulls });
  shell.hooks.adventureFlags = () => adventure.flags.all.slice().sort();
  const placed = [d.pier?.placed, d.boat?.placed, ...d.jetties.map((j) => j.placed), d.hut?.placed, d.lookout?.placed, d.shrine?.placed, d.bushes?.placed, d.palms?.placed, d.rocks?.placed, d.bridge?.placed,
    ...(d.trailside?.placed ?? []), ...(d.cover?.placed ?? []), ...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? []), adventure.zipline?.placed, ...adventure.kit.placed];
  const wreck = [...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? [])];
  registerPlaceSets(await ctx.product.json<PlaceSets>('world/place-sets.json'), { file: 'src/shards/driftwood-isle/data/placeSets.json', members: row => {
    const def = adventure.content.places.find(place => `driftwood-isle/${place.id}` === row.place);
    if (def === undefined) throw new Error(`places: no named place ${row.place}`);
    return row.explicit === undefined ? { near: { placed, ...adventure.place(def.at), r: def.r, mode: 'bounds' } } : { whole: row.explicit === 'wreck' ? wreck : [] };
  } });
  const swords = h.weapons.list.map(({ id }) => h.weapons.get(id)).filter((w): w is Sword => w instanceof Sword);
  const effects = ctx.app.effects, health = ctx.app.player;
  if (effects === null || health === null) throw new Error('Driftwood adventure requires the player effects');
  const economy = declaredLootEconomy(ctx.product.section('economy/loot').rows.loot);
  installItemEffects(ctx);
  await installDeclaredCollectionKeepsakes(ctx, driftwoodRows('custom/collections').keepsakes, economy,
    new Map([['collection', { adventure, world, play: h, swords, catalogue: COLLECTIONS,
      models: new Map([['hat', captainHat], ['cape', sailclothCape]]) }]]));
  const presentation = await driftwoodLootPresentation({ economy, adventure, owned: h.owned, health, audio: h.audio, scope: ctx.scope,
    toast: (text) => { h.hud.toast(text); }, hold: new QuestViews(ctx).panelHold({ hud: h.hud, weapons: h.weapons, menu: h.menu,
      nolock: h.nolock, touchUi: h.touchUi, restartOnClose: true,
      stow: on => { h.weapons.stowed = on; }, resume: () => { h.weapons.setEnabled(!player.swimming); } }) });
  installLoot({ ctx, owned: h.owned, manifest: ctx.manifest, scene: game.scene, player, camera: game.camera,
    animals: () => h.animals.animals, menu: h.menu, presentation, minimap: h.minimap ?? null,
    before: ['body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'] });
  if (h.firstHints !== undefined) {
    const hintRows: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('quests/hints.json')));
    installQuestHints(ctx, hintRows, new Map([['quest', { hints: h.firstHints, animals: h.animals, player, ui: ctx.app.ui }]]));
  }
  return adventure;
}
