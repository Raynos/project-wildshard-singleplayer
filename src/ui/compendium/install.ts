/**
 * installCompendium — wires the active shard's compendium into the game (one call from main.ts; nothing happens on a
 * shard that registered none). It owns: the state + its save, the tracker's hooks, the book, the ways in, the trophy wall.
 *
 *   installCompendium({ chunkId, game, camera, hud, menu, animals, cabins, interactables, weapons, touchUi, nolock });
 *
 * Ways in: the key N (desktop; J is the lock-on's), the BAG menu's JOURNAL tab, the HUD's journal disc (touch,
 * under PAUSE), and EXAMINE on a trophy-wall slot (opens on that entry). Hooks (tracker.ts): an animal within 120 m →
 * discovered; in view within 70 m with a clear line → seen; AnimalManager.onKill → taken (+ its weight); a POI's radius
 * → visited. While the book is open the pointer lock and the weapons are released (like the review composer); closing
 * it resumes through the HUD's own resume path.
 */
import * as THREE from 'three';
import { PINE_HOLLOW_COMPENDIUM } from './shards/pine-hollow';
import '../styles/compendium.css';
import { compendiumFor, registerCompendium } from './registry';
import { CompendiumState } from './state';
import { CompendiumTracker } from './tracker';
import { Journal } from './Journal';
import { TrophyWall } from '../../world/TrophyWall';
import { activePhysics } from '../../physics/active';
import { lineOfSight } from '../../physics/query';
import type { HUD } from '../HUD';
import type { GameMenu } from '../Menu';
import type { AnimalManager } from '../../entities/AnimalManager';
import type { Interactable } from '../../world/Cabin';

export interface CompendiumHost {
  chunkId: string;
  game: { onUpdate: (fn: (dt: number, t: number) => void) => void };
  camera: THREE.Camera;
  hud: HUD;
  menu: GameMenu;
  animals: AnimalManager;
  /** the shard's cabins (the wall hangs in one) — null on a shard without */
  cabins: { roots: readonly THREE.Object3D[] } | null;
  /** main.ts's prompt list ("[E] …") */
  interactables: Interactable[];
  weapons: { setEnabled: (on: boolean) => void };
  touchUi: () => boolean;
  nolock: boolean;
}

/** every shard's compendium (Driftwood / Nalati: add theirs here) */
for (const def of [PINE_HOLLOW_COMPENDIUM]) registerCompendium(def);

const GLYPH_BOOK = '<svg viewBox="0 0 24 24"><path d="M4 5.5C6.5 4 9.5 4 12 5.8 14.5 4 17.5 4 20 5.5V19c-2.5-1.4-5.5-1.4-8 .5-2.5-1.9-5.5-1.9-8-.5z M12 5.8V19.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

export function installCompendium(host: CompendiumHost): { state: CompendiumState; journal: Journal; wall: TrophyWall | null } | null {
  const def = compendiumFor(host.chunkId);
  if (!def) return null;
  const { hud, menu, weapons } = host;
  const state = new CompendiumState(def);
  const journal = new Journal(state);
  const tracker = new CompendiumTracker(state, {
    canSee: (from, to) => { const p = activePhysics(); return p === null || lineOfSight(p, from, to, 1.2); },
  });

  // ── ways in ──
  const disc = document.createElement('button');
  disc.type = 'button'; disc.className = 'ws-cmp-disc';
  disc.innerHTML = `${GLYPH_BOOK}Journal`;
  disc.addEventListener('click', () => { if (hud.entered) journal.open(); });
  (document.getElementById('hud') ?? document.body).append(disc);
  menu.addActionTab('Journal', 'bag', () => { journal.open(); }); // a BAG tab: Map · Inventory · Journal · Achievements
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyN' || e.repeat || !hud.entered || menu.isOpen || journal.isOpen) return;
    e.preventDefault(); journal.open();
  });

  // ── open / close: release the lock + the weapons, then resume the way the pause menu does ──
  let holdTimer = 0;
  journal.onOpen = () => {
    window.clearTimeout(holdTimer);
    hud.holdPause = true;
    weapons.setEnabled(false);
    if (menu.isOpen) menu.close(true);
    if (document.pointerLockElement) document.exitPointerLock();
    disc.classList.remove('new');
  };
  journal.onClose = () => {
    hud.onResume?.(); // main.ts's enter(): weapons back on, the pointer re-locked (the CLOSE click / the key is the gesture)
    holdTimer = window.setTimeout(() => {
      hud.holdPause = false;
      if (!host.nolock && !host.touchUi() && !document.pointerLockElement && hud.entered && !menu.isOpen && !journal.isOpen) hud.setPaused(true);
    }, 450);
  };

  // ── the trophy wall ──
  let wall: TrophyWall | null = null;
  const place = def.wall, root = place ? host.cabins?.roots[place.cabin] : undefined;
  if (place && root && (def.trophies ?? []).length > 0) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...place.at);
    anchor.rotation.y = place.yaw;
    root.add(anchor);
    anchor.updateMatrixWorld(true);
    const hudRoot = document.getElementById('hud');
    wall = new TrophyWall({ anchor, state, factory: host.animals.factory, rows: place.rows, width: place.width, rowY: place.rowY, ...(hudRoot ? { hud: hudRoot } : {}) });
    wall.onExamine = (id) => { journal.open(id); };
    host.interactables.push(wall.interactable);
  }

  // ── what the book records ──
  state.onChange = (e, _from, to) => {
    const onWall = (def.trophies ?? []).some((t) => t.entry === e.id);
    if (to === 'taken') hud.toast(`Journal · ${e.name} — taken`);
    else if (to === 'seen') hud.toast(`Journal · ${e.kind === 'place' ? 'new place' : 'new page'}: ${e.name}`);
    if (onWall) wall?.refresh(); // taken: the mount goes up; discovered: the chalk name replaces ???
    if (to !== 'discovered') disc.classList.add('new');
  };
  const prevKill = host.animals.onKill;
  host.animals.onKill = (a) => { prevKill?.(a); tracker.killed(a); };
  const eye = { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 } };
  host.game.onUpdate((dt) => {
    disc.classList.toggle('show', hud.entered && host.touchUi() && !menu.isOpen);
    if (!hud.entered) return;
    const cam = host.camera;
    const e = cam.matrixWorld.elements;
    eye.position.x = e[12]; eye.position.y = e[13]; eye.position.z = e[14];
    eye.forward.x = -e[8]; eye.forward.y = -e[9]; eye.forward.z = -e[10];
    tracker.update(dt, eye, host.animals.animals);
    wall?.update(cam);
  });
  return { state, journal, wall };
}
