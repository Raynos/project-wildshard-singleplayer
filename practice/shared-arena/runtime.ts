import { Game } from '@wildshard/engine/core/Game';
import { readyWebGLContext } from '@wildshard/engine/core/webglStartup';
import { applyLevelTier, TIER } from '@wildshard/engine/core/tier';
import { configureLevel } from '@wildshard/engine/level/selection';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import { app } from '@wildshard/engine/app/runtime';
import { Scope } from '@wildshard/engine/app/scope';
import { withOwner } from '@wildshard/engine/app/ownership';
import { installSaveEnvironment } from '@wildshard/engine/saves/environment';
import { Physics } from '@wildshard/engine/physics/Physics';
import { setRagdollClock, ragdollsFor } from '@wildshard/engine/physics/ragdoll';
import { loadRapier } from '@wildshard/engine/physics/rapier';
import { Bodies, BODY_CAP } from '@wildshard/engine/physics/bodies';
import { setActiveBodies, setActivePhysics } from '@wildshard/engine/physics/active';
import { addPiece } from '@wildshard/engine/physics/pieces';
import { installWorldRegistry } from '@wildshard/engine/world/registry';
import { Player } from '@wildshard/engine/player/Player';
import { TouchControls } from '@wildshard/engine/player/TouchControls';
import { LockOnSystem } from '@wildshard/engine/player/LockOnTarget';
import { setAimTargets } from '@wildshard/engine/player/AimTargets';
import { listenPage } from '@wildshard/engine/input/dom';
import { installGameplayInput, weaponInputContext } from '@wildshard/engine/input/gameplay';
import { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { TrainingArena } from '@wildshard/engine/practice/TrainingArena';
import { HUD } from '@wildshard/engine/ui/HUD';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { Sword, type SwordOptions } from '../../src/game/weapons/Sword';
import { PracticeCreature } from '../../src/game/practice/PracticeCreature';
import { EncounterSession } from '../../src/game/practice/EncounterSession';
import type { ArenaProduct } from './types';
import { configurePracticeOcclusion } from '../../src/practiceLighting';

/** Explicit demo composition; its supplied product contains no world entry or persistent save authority. */
export interface PracticeDemoOptions {
  readonly canvas: HTMLCanvasElement;
  readonly level: LevelSpec;
  readonly products: readonly ArenaProduct[];
  /** Install the admitted species/materials and return the authored held sword. */
  readonly prepare: (game: Game) => Promise<SwordOptions>;
  readonly status: (message: string) => void;
}

/** A single page owns this actual-game arena. No full-world bootstrap, quests or persistent saves are installed. */
export interface PracticeDemo {
  readonly choices: readonly { id: string; label: string }[];
  readonly select: (id: string) => Promise<boolean>;
  readonly retry: () => void;
  readonly back: () => void;
  readonly dispose: () => void;
  readonly game: Game;
  readonly arena: TrainingArena;
  readonly player: Player;
}

export async function startSharedArena(options: PracticeDemoOptions): Promise<PracticeDemo> {
  installSaveEnvironment({ storage: () => null, persistent: () => false, persist: () => Promise.resolve(false) });
  const owner = new Scope('practice-demo');
  installWorldRegistry(); configureLevel(options.level); applyLevelTier(options.level.tiers?.[TIER]);
  const context = await readyWebGLContext(options.canvas);
  const game = withOwner(owner, () => new Game(options.canvas, context, options.level));
  try {
    await game.buildSky(); game.retainEngineScene(); game.beginLevelSystems();
    const physics = new Physics(await loadRapier(), undefined, owner);
    owner.onDispose(() => { setActivePhysics(null); setRagdollClock(null); physics.dispose(); }); setActivePhysics(physics);
    setRagdollClock(() => game.alpha);
    const player = owner.run(() => new Player(game.camera, physics, options.canvas));
    owner.onDispose(() => { player.motor.dispose(); setActiveBodies(null); });
    owner.run(() => setActiveBodies(new Bodies(physics, player.position, BODY_CAP[TIER]).attach(game)));
    player.bindFrame(physics, player.motor, { heightAt: () => 900, waterSurfaceAt: () => null, platforms: [] });
    installGameplayInput(player, options.canvas, owner, INPUT_CONTEXTS);
    player.traversalEvents = app.events;
    app.input.buffer.ms = options.level.fight.input?.bufferMs ?? 120;
    const registry = app.registry;
    owner.run(() => registry.onAdd(piece => {
      if (piece.object !== undefined) game.scene.add(piece.object);
      addPiece(physics, piece);
    }));
    const swordOptions = await options.prepare(game);
    const arena = owner.run(() => new TrainingArena(game, registry, physics, { x: 0, z: 0 }));
    const sword = owner.run(() => new Sword({ game, sky: game.sky, player }, arena, { ...swordOptions, allowUnlocked: true }));
    const weapons = owner.run(() => new EquipmentService(sword, { scope: owner, events: app.events }));
    app.registerEquipment(weapons, owner); weaponInputContext(weapons, owner);
    const lock = owner.run(() => new LockOnSystem(player, weapons, game.camera));
    lock.inputService = app.input;
    app.addSystem({ id: 'engine.lockon.input', phase: 'input', after: ['engine.input.collect'], before: ['engine.player.input'],
      run: () => { if (app.input.consume('lock')) lock.resolveToggle(); } }, owner);
    const touch = owner.run(() => new TouchControls(player, weapons, false, lock));
    const hud = owner.run(() => new HUD({ pointerLock: !touch.active, weaponUi: sword.row.ui, maxBolts: weapons.state.magazine,
      developerBanner: 'ENEMY ARENA · UNACCEPTED WIP' }));
    hud.markEntered();
    const pause = (): void => {
      const paused = app.state !== 'paused'; app.setState(paused ? 'paused' : 'practice');
      options.status(paused ? 'Paused. Tap Pause again to resume.' : 'Practice resumed.');
    };
    owner.listen(document, 'ws:pause', pause);
    listenPage(owner, 'keydown', event => { if (event.code === 'Escape' && !event.repeat) { event.preventDefault(); pause(); } });
    weapons.onHit = (_kind, headshot, killed) => { hud.showHitMarker(headshot, killed); };
    const choices = options.products.flatMap(entry => {
      const program = entry.product.section('actors/species-programs').program;
      if (program === undefined) throw new Error('Arena product has no species program');
      return program.species.flatMap(species => species.variants.map(variant => ({
        id: `${species.kind}:${variant.id}`, label: entry.label, species, variant: variant.id,
        product: entry.product, strikes: program.strikes, presentation: entry.presentation,
      })));
    });
    const encounter = new EncounterSession<string, PracticeCreature>({
      load: id => {
        const choice = choices.find(row => row.id === id);
        if (choice === undefined) throw new Error('Unknown demo opponent');
        return PracticeCreature.create({ species: choice.species, variant: choice.variant, strikes: choice.strikes,
          product: choice.product, scene: game.rootScene, sky: game.sky, physics, player, weapons, owner,
          style: options.level.creatureStyle ?? 'toon', render: options.level.creatures, flash: () => hud.damageFlash(),
          onPlayerDeath: () => options.status('Defeated. Retry starts a fresh local bout.'),
          onDeath: () => options.status('Opponent defeated. Collect the practice coins.'),
          onCollect: coins => options.status(`Collected ${coins} local practice coins.`),
        });
      }, dispose: actor => { actor.dispose(); },
    });
    owner.onDispose(() => { encounter.dispose(); setAimTargets([]); });
    player.onLand = hard => { arena.land(hard); };
    owner.listen(options.canvas, 'click', () => { if (!touch.active) player.lock(); });
    app.addSystem({ id: 'engine.input.collect', phase: 'input', before: ['engine.player.input'], run: () => { player.collectActions(); } }, owner);
    game.onInput(dt => { player.input(dt); }, 'engine.player.input');
    game.onFixed('pre', dt => { ragdollsFor(physics).fixedPre(dt); }, 'physics.corpse.pre', true);
    game.onFixed('step', () => { physics.step(); }, 'physics.step', true);
    game.onFixed('post', dt => { ragdollsFor(physics).fixedPost(dt); }, 'physics.corpse.post', true);
    game.onFixed('post', dt => { player.step(dt); }, 'player.step', true);
    game.onUpdate(dt => { player.update(dt, game.alpha); }, 'player.update');
    app.addSystem({ id: 'demo.weapon', phase: 'update', after: ['training-arena'], run: (dt, t) => { weapons.update(dt, t); } }, owner);
    game.onUpdate(() => {
      const vitals = arena.playerVitals;
      hud.setState({ bolts: weapons.state.ammo, maxBolts: weapons.state.magazine, reserve: weapons.state.reserve,
        loaded: weapons.state.loaded, reloading: weapons.state.reloading, reloadProgress: weapons.state.reloadProgress,
        weaponUi: weapons.current.row.ui, health: vitals?.health ?? 100, maxHealth: vitals?.maxHealth ?? 100,
        pos: { x: player.position.x, z: player.position.z }, yaw: player.yaw, kills: 0, prompt: '', speed: player.speedFactor, ads: weapons.state.ads });
    }, 'demo.hud');
    game.buildComposer();
    const defaultAO = game.post?.ao === undefined || game.post.ao === null ? null : { ...game.post.ao.configuration };
    const select = async (id: string): Promise<boolean> => {
      if (arena.entered) arena.exit();
      if (!await encounter.select(id)) return false;
      const actor = encounter.snapshot.actor;
      if (actor === null) return false;
      const selected = choices.find(row => row.id === id);
      if (defaultAO !== null && game.post?.ao !== undefined && game.post.ao !== null) {
        game.post.ao.configuration.aoRadius = defaultAO.aoRadius;
        game.post.ao.configuration.intensity = defaultAO.intensity;
      }
      configurePracticeOcclusion(game.post?.ao ?? null, selected?.presentation.arenaOcclusion);
      arena.setOpponent(actor); arena.enter(player, weapons); setAimTargets(arena.activeTargets);
      options.status('Practice bout. Health and rewards stay in this page.');
      return true;
    };
    const first = choices[0]; if (first === undefined) throw new Error('Demo has no admitted opponents');
    app.setState('paused');
    game.start();
    return { back: () => { arena.exit(); encounter.exit(); setAimTargets([]); app.setState('paused'); }, choices: choices.map(({ id, label }) => ({ id, label })), select,
      retry: () => {
        const actor = encounter.snapshot.actor;
        if (actor !== null) { actor.retry(); app.setState('practice'); options.status('Fresh practice bout.'); return; }
        const reload = async (): Promise<void> => {
          try { if (!await select(encounter.snapshot.selection ?? first.id)) options.status('Opponent could not load. Select again to retry.'); }
          catch (error: unknown) { options.status(error instanceof Error ? error.message : 'Opponent could not load.'); }
        };
        void reload();
      },
      dispose: () => { arena.exit(); game.dispose(); }, game, arena, player };
  } catch (error: unknown) { game.dispose(); throw error; }
}
