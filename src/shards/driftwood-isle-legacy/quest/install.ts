import { onCreatureDeath } from '@wildshard/game/loot/deaths';
import { installLoot } from '@wildshard/game/loot/runtime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { Sword } from '@wildshard/game/weapons/Sword';
import { driftwoodWorld } from '../world/build';
import { placeDriftwoodPlaces } from '../world/places';
import { installAdventure, type Adventure } from './adventure';
import { installKeepsakes } from '../loot/keepsakes';
import { bindDriftwoodEffects } from '../loot/effects';
import { driftwoodLootPresentation } from '../loot/presentation';
import { installFirstMinutes } from '../onboarding/firstMinutes';
import { ironSwordDrop } from '../loadout/rows';
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
    ironDrop: ironSwordDrop(shell), setViewmodel: (on) => { h.weapons.visible = on; }, stowWeapon: (on) => { h.weapons.stowed = on; },
    bridgeFloor: d.bridge === null ? undefined : (x, z) => d.bridge?.floorHeightAt(x, z),
    pois: { hut: d.hut, lookout: d.lookout, wreck: d.wreck, shrine: d.shrine, cave: d.cove }, gulls: d.gulls });
  shell.hooks.adventureFlags = () => adventure.flags.all.slice().sort();
  placeDriftwoodPlaces(adventure.place, [d.pier?.placed, d.boat?.placed, ...d.jetties.map((j) => j.placed), d.hut?.placed, d.lookout?.placed, d.shrine?.placed, d.bushes?.placed, d.palms?.placed, d.rocks?.placed, d.bridge?.placed,
    ...(d.trailside?.placed ?? []), ...(d.seabed?.placed ?? []), ...(d.cover?.placed ?? []), ...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? []), adventure.zipline?.placed, ...adventure.kit.placed],
    { wreck: [...(d.wreck?.placed ?? []), ...(d.cove?.placed ?? [])] });
  const swords = h.weapons.list.map(({ id }) => h.weapons.get(id)).filter((w): w is Sword => w instanceof Sword);
  const effects = ctx.app.effects, health = ctx.app.player;
  if (effects === null || health === null) throw new Error('Driftwood adventure requires the player effects');
  bindDriftwoodEffects({ effects, scope: ctx.scope, owned: h.owned, health, player, swords, hitCap: ctx.manifest.fight?.maxHitDamage ?? Infinity, slug: ctx.manifest.slug });
  const scopedGame = { scene: game.scene, camera: game.camera, renderer: game.renderer,
    onUpdate: (run: (dt: number, t: number) => void, label?: string) => { ctx.system({ id: label ?? 'shard.driftwood.keepsakes', phase: 'update', after: ['game.loot', 'body-shadow'], before: ['hud.combat', 'last place', 'first hints', 'main.world'], run }); } };
  installKeepsakes({ owner: ctx, onDeath: (run, order) => { onCreatureDeath(ctx, () => h.animals.animals, run, order); },
    owned: h.owned, adventure, sky, game: scopedGame, player, hud: h.hud, audio: h.audio, music: h.music, registry,
    body: h.bodyShadow ?? null, swords, effectsManaged: true });
  let release = ctx.scope.child('shop.release');
  const presentation = await driftwoodLootPresentation({ adventure, owned: h.owned, audio: h.audio, scope: ctx.scope,
    toast: (text) => { h.hud.toast(text); }, hold: (on) => {
      release.dispose(); release = ctx.scope.child('shop.release'); h.weapons.stowed = on;
      if (on) { h.hud.holdPause = true; h.weapons.setEnabled(false); if (document.pointerLockElement) document.exitPointerLock(); return; }
      h.weapons.setEnabled(!player.swimming); h.hud.onResume?.();
      release.timeout(450, () => { h.hud.holdPause = false; if (!h.nolock && !h.touchUi() && !document.pointerLockElement && h.hud.entered && !h.menu.isOpen) h.hud.setPaused(true); });
    } });
  installLoot({ ctx, owned: h.owned, manifest: ctx.manifest, scene: game.scene, player, camera: game.camera,
    animals: () => h.animals.animals, menu: h.menu, presentation, minimap: h.minimap ?? null,
    before: ['body-shadow', 'keepsakes', 'last place', 'first hints', 'main.world'] });
  if (h.firstHints !== undefined) {
    installFirstMinutes(ctx, { hints: h.firstHints, animals: () => h.animals.animals, player,
      prompt: () => ctx.app.ui.prompt() });
  }
  return adventure;
}
