import { type SkinLocker, type Inventory, Elites, GroundTell, type EliteRule } from '#game';
import { app, type Game, type Sky, type Player, type EquipmentService, type Weapon, lineOfSight, canReach, type AnimalManager, type Animal, CameraFX, type HUD, type Audio, type Music, EliteBar } from '#engine';
import * as THREE from 'three';




import { Crossbow, MAX_BOLTS, crossbowDisplayModel } from '#kit';
import { applySkin, type SkinDef } from '#engine/player/Skins';
import { SKINS, type SkinId } from '../loadout/skins';
import type { PineHollowSfx } from '../audio/sfx';
import type { Interactable } from '../world/homestead';
import { voice, type PineCtx } from './ctx';
import { installPinePresentation } from './chargeTells';
import { makePineElites, swapRolledElites, isPineElite } from './elites';
import { AntlerKing, KING_KIND } from './antlerKing';

import { perfLap } from '#engine/core/perfLap';
import { registerPineLap } from '../dev/perfLap';

/**
 * Pine Hollow's fights, wired in one call (PINE-HOLLOW-REMASTER: PH-C3 the four named elites, PH-C2 the Antler King,
 * PH-F1 the combat feel of the ranged kit). main.ts calls `installPineCombat` once on Pine Hollow, after the herds, the
 * weapons and the HUD exist and before the boot's shader precompile (everything the fights draw is built here, parked, so
 * its programs compile with the rest: no compile mid-fight), and asks `onPlayerDeath()` before its own respawn.
 *
 *   elites.ts      the four elites (Elite.ts scripts), their lairs, drops, trophies; `?elite=<id>&from=<m>`
 *   antlerKing.ts  the boss (Boss.ts script), the arena, the thralls, the hazards; `?boss=antler-king&bossPhase=&bossGod=1`
 *   kingModel.ts   the King's stand-in look — the one factory PH-M3 swaps
 *   feel.ts        hit-stop / kick / trauma / debris by surface / the wild chargers' lane tells
 *   ctx.ts         what they share; combatMath.ts the pure rules (test/shards/pine-hollow/pine-combat.test.ts)
 */

export interface PineCombatHost {
  game: Game; sky: Sky; player: Player; animals: AnimalManager; weapons: EquipmentService;
  crossbow: Weapon; rifle: { displayModel: () => THREE.Group }; skins: SkinLocker; wearSkin: (s: SkinDef) => void;
  /** the Warden's Longbow (PH-C11): the King's orb shows it, taking it hands it over (loadout.grantLongbow) */
  longbow?: { displayModel: () => THREE.Group; grant: () => void } | null;
  /** before a checkpoint's bolt refill: the loadout goes back to iron bolts, so the refill never tops up a special stack */
  ironFirst?: () => void;
  inventory: Inventory; hud: HUD; audio: Audio; music: Music;
  interactables: Interactable[]; params: URLSearchParams;
}

export interface PineCombat {
  /** Sealed room fog override, answered by the active plugin scope. */
  weatherHold: () => number;
  /** a death in the King's fight is his (back at the phase checkpoint): true = do not respawn at the gate */
  onPlayerDeath: () => boolean;
  /** a named elite (its skin comes from the elite's orb, not main.ts's legendary kill drop) */
  isElite: (a: Animal) => boolean;
  /** Pine Hollow's one-shots (ForestAmbience.sfx), once the ambience exists */
  useSfx: (sfx: PineHollowSfx) => void;
  /** a named elite's fight is on (its bar pinned): the music holds combat (src/shards/pine-hollow/audio/wiring.ts) */
  eliteEngaged: () => boolean;
}

export function installPineCombat(h: PineCombatHost): PineCombat {
  const { game, sky, player, animals, weapons, params } = h;
  const god = params.has('bossGod');
  // the player's legs: a roar's stun and the King's intro both root you; either one holds
  let introLock = false;
  let sfx: PineHollowSfx | null = null;
  const legs = (): void => { player.carried = (app.player?.attributes['moveLocked'] ?? 0) > 0 || introLock; };
  // the drop orbs' skinned weapons, built now and parked (hidden) in the scene so the boot's precompile covers their
  // programs: the first elite kill / the King's reward then compiles nothing mid-play
  const buildSkin = (id: SkinId): THREE.Object3D => {
    const s = SKINS[id];
    const m = s.weapon === 'rifle' ? h.rifle.displayModel() : h.crossbow instanceof Crossbow ? crossbowDisplayModel(h.crossbow, sky) : new THREE.Group();
    applySkin(m, s, sky);
    return m;
  };
  const parked = new Map<SkinId, THREE.Object3D>();
  const park = new THREE.Group(); park.name = 'pine-drops-parked'; park.position.y = -500; game.scene.add(park);
  for (const id of ['ironhide', 'ghost-stag', 'blackpaw', 'imperial', 'warden'] as const) { const m = buildSkin(id); m.visible = false; park.add(m); parked.set(id, m); }
  const ctx: PineCtx = {
    game, sky, player, animals, god,
    hurt: (a, dmg, throughWalls = false) => {
      const target = app.player;
      if (god || target === null || (!throughWalls && !canReach(a, player.position))) return;
      app.combat.hit({ source: a.combatActor(), sourceTags: [a.kind === KING_KIND ? `boss.${a.kind}` : `creature.${a.kind}`, 'feel.blow', 'cover.checked'],
        target, amount: dmg, point: a.position, dir: new THREE.Vector3(), throughWalls, cause: { kind: a.kind, label: a.label } });
    },
    stun: (s) => { const target = app.player; if (god || target === null) return; app.effects?.apply(target, 'effect.stun', undefined, { duration: s }); legs(); },
    trauma: (k) => { CameraFX.for(game).addTrauma(k); },
    sound: (name, at) => { voice(animals, name, at); },
    shot: (name, at) => { sfx?.shot(name, { at }); },
    toast: (s) => { h.hud.toast(s); }, feed: (s) => { h.hud.killFeed(s); },
    addItem: (id, n) => { h.inventory.add(id, n); },
    ownSkin: (id) => { const s = SKINS[id]; h.skins.own(id); h.wearSkin(s); if (s.weapon === 'rifle') weapons.unlock('rifle'); },
    skinModel: (id) => { const m = parked.get(id); if (m) { parked.delete(id); m.removeFromParent(); m.visible = true; return m; } return buildSkin(id); },
    dusk: () => sky.dayNight?.dusk ?? 0, night: () => sky.dayNight?.night ?? 0,
    longbow: h.longbow ? {
      // the stave stands along the orb's item axis (−Z, tip up) at half size: a 1.7 m bow in a legendary's orb
      model: () => { const w = new THREE.Group(), m = h.longbow?.displayModel(); if (m) { m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.5); w.add(m); } return w; },
      grant: () => { h.longbow?.grant(); },
    } : null,
  };

  const feel = installPinePresentation({ game, weapons, animals, makeTell: (color) => new GroundTell(game.scene, 'lane', color) });

  // ── the elites ──
  swapRolledElites(animals);
  const condition = (rule: EliteRule): boolean => rule === 'always' || (rule === 'dusk' ? ctx.dusk() > 0.5 : rule === 'night' ? ctx.night() > 0.5 : false);
  const elites = new Elites({
    scene: game.scene, camera: game.camera, renderer: game.renderer, player, condition,
    addInteractable: (it) => { h.interactables.push(it); },
    removeInteractable: (it) => { const i = h.interactables.indexOf(it); if (i !== -1) h.interactables.splice(i, 1); },
    toast: ctx.toast,
    sting: (e) => { if (e === 'kill') h.music.sting('chunk'); else h.music.combat(e === 'phase2' ? 1 : 0.8); },
    pickupHum: (on) => { h.audio.pickupHum(on); },
    ownSkin: (id) => { if (id in SKINS) ctx.ownSkin(id as keyof typeof SKINS); },
    // the floating name hides behind the cabin's walls, the crags, a rise (no physics yet: always seen)
    canSee: (from, to) => { const ph = app.physics; return ph === null || lineOfSight(ph, from, to, 0.6); },
  }, new EliteBar(), 'pine-hollow');
  const pineElites = makePineElites(ctx, elites);

  // ── the Antler King ── (his name, not his kind, in the aim readout; no floating plate: he has the boss bar)
  const king = new AntlerKing({
    ctx, interactables: h.interactables, params, music: h.music,
    refill: () => { h.ironFirst?.(); h.crossbow.addBolts(MAX_BOLTS - (h.crossbow.state.bolts ?? MAX_BOLTS)); },
    setWeaponsEnabled: (on) => { introLock = !on; legs(); weapons.setEnabled(on); },
    pickupHum: (on) => { h.audio.pickupHum(on); },
  });

  // dev: `?elite=<id>` — out now, you `&from=` m off it (toward the Hollow), facing it
  const eliteParam = params.get('elite');
  if (eliteParam !== null) {
    const a = elites.devSpawn(eliteParam);
    if (a) {
      const from = Number(params.get('from') ?? '30'), d = Math.hypot(a.position.x, a.position.z) || 1;
      const x = a.position.x - (a.position.x / d) * from, z = a.position.z - (a.position.z / d) * from;
      player.spawn(x, z, Math.atan2(-(a.position.x - x), -(a.position.z - z)));
    }
  }

  // The shell split its original frame into world / creature / HUD passes. Lair spawns must
  // still precede the first world pass and creature sync, which installs their hitboxes.
  game.app.addSystem({ id: 'elites', phase: 'update', before: ['main.world', 'engine.creatures.update', 'main.frame'], run: (dt, t) => {
    legs();
    feel.update(dt, t);
    if (perfLap.active) return; // E350 F-J1: the PERF LAP's teleports find no lair and wake no King
    pineElites.update(dt, t);
    king.update(dt, t);
  } }, game.levelScope);
  Object.assign(window, { __pineElites: pineElites, __antlerKing: king });
  registerPineLap({ game, player, animals, music: h.music, hud: h.hud, elites, king }); // E350 F-J1: the fps panel's PERF LAP

  return {
    weatherHold: () => king.fight.weatherHold,
    onPlayerDeath: () => { const target = app.player; if (target !== null) app.effects?.remove(target, 'effect.stun'); introLock = false; legs(); return king.onPlayerDeath(); },
    isElite: isPineElite,
    useSfx: (s) => { sfx = s; },
    eliteEngaged: () => elites.focus?.state === 'engaged',
  };
}
