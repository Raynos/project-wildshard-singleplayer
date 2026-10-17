import { declaredLootEconomy } from '@wildshard/game/shard/declaredRows';
import { installLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { QuestViews } from '@wildshard/game/plugin/ui';
import { Sword } from '@wildshard/game/weapons/Sword';
import { driftwoodWorld } from '../world/build';
import { placeDriftwoodPlaces } from '../world/places';
import { installAdventure, type Adventure } from './adventure';
import { installDeclaredCollectionKeepsakes } from '@wildshard/game/compendium/keepsakes';
import { COLLECTIONS } from '../runtime/boot/blobAssets';
import { captainHat, sailclothCape } from '../runtime/models/captainHat';
import { driftwoodRows } from '../runtime/boot/rows';
import { bindDriftwoodEffects } from '../loot/effects';
import { driftwoodLootPresentation } from '../loot/presentation';
import { installQuestHints } from '@wildshard/game/quest/hints';
import { ironSwordDrop } from '../loadout/rows';
import { loadZiplineGeometry } from '../runtime/models/zipline';
import { preloadCaptainMesh } from '../species/captainMesh';
import { preloadSailorHead } from '../species/sailor';

/** `deps`: the heroes' preload and the adventure's install (the shard's by default; a test passes its own) */
export async function installDriftwoodAdventure(ctx: ShardContext, deps: { preload?: () => Promise<unknown>; install?: typeof installAdventure } = {}): Promise<Adventure> {
  const shell = ctx.game.runtime;
  const world = shell?.world, h = shell?.play;
  if (shell === undefined || world === undefined || world === null || h === undefined || h === null) throw new Error('Driftwood adventure requires the play host');
  // Saved used:altar restores the boss synchronously in Finale; resolve the hull before any quest restore/spawn.
  await (deps.preload ?? (() => Promise.all([preloadCaptainMesh(), preloadSailorHead(), loadZiplineGeometry()])))();
  if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during the creature mesh load');
  const { game, sky, player, registry, params } = world;
  const d = driftwoodWorld(shell);
  const adventure = await (deps.install ?? installAdventure)(ctx, { game, sky, player, registry, params, chunk: ctx.manifest,
    prompts: shell.interactables, hud: h.hud, audio: h.audio, music: h.music, inventory: h.inventory, progress: h.progress, fullMap: h.fullMap, animals: h.animals,
    ironDrop: ironSwordDrop(shell), setViewmodel: (on) => { h.weapons.visible = on; }, stowWeapon: (on) => { h.weapons.stowed = on; },
    bridgeFloor: d.bridge === null ? undefined : (x, z) => d.bridge?.floorHeightAt(x, z),
    pois: { hut: d.hut, lookout: d.lookout, wreck: d.wreck, shrine: d.shrine, cave: d.cove }, gulls: d.gulls });
  shell.hooks.adventureFlags = () => adventure.flags.all.slice().sort();
  placeDriftwoodPlaces(adventure.place, [d.pier?.placed, d.boat?.placed, ...d.jetties.map((j) => j.placed), d.hut?.placed, d.lookout?.placed, d.shrine?.placed, d.bushes?.placed, d.palms?.placed, d.rocks?.placed, d.bridge?.placed,
    ...(d.trailside?.placed ?? []), ...(d.cover?.placed ?? []), ...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? []), adventure.zipline?.placed, ...adventure.kit.placed],
    { wreck: [...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? [])] }, adventure.content.places);
  const swords = h.weapons.list.map(({ id }) => h.weapons.get(id)).filter((w): w is Sword => w instanceof Sword);
  const effects = ctx.app.effects, health = ctx.app.player;
  if (effects === null || health === null) throw new Error('Driftwood adventure requires the player effects');
  const economy = declaredLootEconomy(ctx.product.section('economy/loot').rows.loot);
  bindDriftwoodEffects({ grants: economy.grants, effects, scope: ctx.scope, owned: h.owned, health, player, swords, hitCap: ctx.manifest.fight?.maxHitDamage ?? Infinity, slug: ctx.manifest.slug });
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
