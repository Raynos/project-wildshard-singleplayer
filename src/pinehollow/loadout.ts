import * as THREE from 'three';
import type { Sky } from '../world/Sky';
import type { Weapons } from '../player/Weapons';
import { fixIBL, VIEWMODEL_GROUP, PLAIN_BOLT, worldHit, type BoltMod, type Crossbow } from '../player/Crossbow';
import type { LeverRifle } from '../player/LeverRifle';
import type { Longbow } from '../player/Longbow';
import type { Inventory } from '../game/Inventory';
import type { HUD } from '../ui/HUD';
import type { Audio } from '../audio/Audio';
import type { PineHollowSfx, PhShot } from '../audio/PineHollowSfx';
import { BOLT_KINDS, BOLT_LABEL, BOLT_NAME, Quiver, boltDamage, boltFlight, type AmmoKind, type BoltKind } from './ammo';

/**
 * Pine Hollow's LOADOUT (PINE-HOLLOW-REMASTER PH-C11; ranged only, PH-U15): the crossbow (the hero), the lever-action
 * (src/player/LeverRifle.ts, the cabin's rifle — PH-U5), the Warden's Longbow (src/player/Longbow.ts, the Antler King's
 * reward), and the ammunition the trader swaps for (ammo.ts: pitch-tipped and broadhead bolts, cartridges, arrows).
 * main.ts calls `installPineLoadout` once on Pine Hollow, after the kit exists and before the boot's precompile.
 *
 *   · SPECIAL BOLTS — the loaded kind (B, or a tap on the touch ammo strip, cycles iron → pitch → broadhead, skipping
 *     empty stacks) dresses the crossbow's next bolt (`Crossbow.boltMod`: its flight by ammo.ts's rules, the rain read
 *     live, and its damage by the animal it lands in) and its HUD label; a special stack that runs dry falls back to iron.
 *     The specials are kept across sessions (`ws.ph.loadout.v1`); iron bolts refill as ever.
 *   · THE LEVER-ACTION'S SOUNDS — Pine Hollow's generated set (PineHollowSfx): the shot + its echo off the ridge, the
 *     lever's cycle, the hammer on an empty chamber (`leverDry`), a cartridge thumbed through the gate (`leverRoundIn`);
 *     Audio.ts's AR-15 shot / latch click until the set decodes.
 *   · THE LONGBOW — owned once the King falls (`grantLongbow`; the pack's 'warden-longbow' flag re-grants it on load);
 *     its draw creak (`longbowDraw`), its loose (`longbowLoose`; Audio.crossbowFire until the set decodes).
 *   · STONE — a bolt, an arrow or a round landing on rock / stone plays `boltImpact-rock` (the crack + the ricochet).
 *   · FEEL — nothing here: the combat feel (feel.ts: hit-stop, kick, trauma, debris) hooks `Weapons.onHit / onImpact`,
 *     which every kit weapon forwards, so the rifle and the bow land with it like the crossbow.
 *
 *   loadout.addAmmo('pitch', 10)     the trader, the contracts ('iron' / 'pitch' / 'broadhead' / 'cartridge' / 'arrow')
 *   loadout.onPlayerDeath()          back to iron bolts before main.ts's refill tops up the loaded stack
 *   loadout.useSfx(sfx)  loadout.useRain(() => rain)   once the ambience / the weather exist
 *   dev: `?weapon=lever|longbow|crossbow` (held at start), `?ammo=pitch|broadhead` (10 loaded), `window.__loadout`
 */

export interface PineLoadoutHost {
  scene: THREE.Scene; sky: Sky; weapons: Weapons; crossbow: Crossbow | null; rifle: LeverRifle; longbow: Longbow;
  inventory: Inventory; hud: HUD; audio: Audio; params: URLSearchParams;
}

export interface PineLoadout {
  addAmmo: (kind: AmmoKind, n: number) => void;
  count: (kind: AmmoKind) => number;
  /** the loaded bolt kind */
  readonly bolt: BoltKind;
  selectBolt: (kind: BoltKind) => void;
  cycleBolt: () => void;
  grantLongbow: () => void;
  onPlayerDeath: () => void;
  useSfx: (sfx: PineHollowSfx) => void;
  useRain: (rain: () => number) => void;
  update: (dt: number) => void;
}

const STORE = 'ws.ph.loadout.v1';
const ECHO_DELAY = 0.42, ECHO_GAIN = 0.55;
/** the bolt dress per kind: a uniform-only tint of the iron bolt's material (no program) */
const TINT: Readonly<Record<Exclude<BoltKind, 'iron'>, { color: number; roughness: number }>> = {
  pitch: { color: 0x9a6a36, roughness: 0.55 },     // resin-dark, a warm sheen
  broadhead: { color: 0xc8ccd4, roughness: 0.8 },  // bright cold steel
};

/** the impact point sits on stone (the physics material a short probe through it meets, up / across / along) */
const PROBE = [[0, 1, 0], [1, 0, 0], [0, 0, 1]] as const;
function stony(p: { x: number; y: number; z: number }): boolean {
  for (const [x, y, z] of PROBE) {
    const m = worldHit({ x: p.x + x * 0.4, y: p.y + y * 0.4, z: p.z + z * 0.4 }, { x: p.x - x * 0.4, y: p.y - y * 0.4, z: p.z - z * 0.4 }, 0)?.material;
    if (m !== undefined) return m === 'rock' || m === 'stone';
  }
  return false;
}

export function installPineLoadout(h: PineLoadoutHost): PineLoadout {
  const { weapons, crossbow, rifle, longbow, hud, audio, inventory, params } = h;
  let saved: Partial<Record<BoltKind, number>> = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Partial<Record<BoltKind, number>>; } catch { /* defaults */ }
  const quiver = new Quiver({ pitch: saved.pitch ?? 0, broadhead: saved.broadhead ?? 0 });
  let sfx: PineHollowSfx | null = null;
  let rain: () => number = () => 0;
  let dirty = false, saveT = 0;
  const live = (): number => crossbow?.state.bolts ?? 0;

  // the special bolts' dresses: clones of the iron bolt's material, re-hooked like Skins.ts's (dfg fix + the sky's CSM)
  const dress = new Map<BoltKind, THREE.Material>();
  if (crossbow) for (const k of ['pitch', 'broadhead'] as const) {
    const m = crossbow.boltMaterial.clone() as THREE.MeshStandardMaterial;
    m.name = `xbow-bolt-${k}`; m.color.setHex(TINT[k].color); m.roughness = TINT[k].roughness;
    fixIBL(m, VIEWMODEL_GROUP); h.sky.setupMaterial(m);
    dress.set(k, m);
  }
  // the dresses must be in the scene for the boot's precompile (they share the bolt's program; this proves it)
  const parked = new THREE.Group(); parked.name = 'pine-loadout-parked'; parked.position.y = -500;
  for (const m of dress.values()) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), m); mesh.visible = false; parked.add(mesh); }
  h.scene.add(parked);

  const mods = new Map<BoltKind, BoltMod>();
  for (const k of BOLT_KINDS) mods.set(k, { gravity: 1, drag: 1, damage: (animal) => boltDamage(k, animal), material: dress.get(k) });
  const applyBolt = (): void => {
    if (!crossbow) return;
    const k = quiver.selected, m = mods.get(k) ?? PLAIN_BOLT, f = boltFlight(k, rain());
    m.gravity = f.gravity; m.drag = f.drag;
    crossbow.boltMod = m; crossbow.ammoLabel = BOLT_LABEL[k];
  };
  const markDirty = (): void => { dirty = true; };
  const save = (): void => {
    if (crossbow) quiver.stash(live());
    try { localStorage.setItem(STORE, JSON.stringify({ pitch: quiver.counts.pitch, broadhead: quiver.counts.broadhead })); } catch { /* not persisted */ }
    dirty = false;
  };

  const selectBolt = (kind: BoltKind, quiet = false): void => {
    if (!crossbow) return;
    const n = quiver.select(kind, live());
    if (n === null) return;
    crossbow.state.bolts = n; crossbow.state.loaded = n > 0 && crossbow.state.loaded; // the bolt on the rail is swapped for one of the new kind
    applyBolt(); markDirty();
    if (!quiet) { hud.toast(`${BOLT_NAME[kind]} loaded · ${n}`); audio.weaponSwap(); }
  };
  const cycleBolt = (): void => { if (crossbow) selectBolt(quiver.next()); };

  const addAmmo = (kind: AmmoKind, n: number): void => {
    if (kind === 'cartridge') { rifle.addRounds(n); return; }
    if (kind === 'arrow') { longbow.addBolts(n); return; }
    if (!crossbow) return;
    if (kind === quiver.selected) crossbow.addBolts(n); else quiver.add(kind, n);
    markDirty();
  };
  const count = (kind: AmmoKind): number => kind === 'cartridge' ? rifle.state.reserve + rifle.state.ammo : kind === 'arrow' ? longbow.state.bolts : quiver.count(kind, live());

  // ── input: B cycles the bolt kind while the crossbow is held; the touch ammo strip, tapped, does the same ──
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.code !== 'KeyB' || weapons.current.id !== 'crossbow' || !weapons.current.inputAllowed()) return;
    cycleBolt();
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (!(t instanceof Element) || t.closest('.ws-game-bolts') === null || weapons.current.id !== 'crossbow' || !weapons.enabled) return;
    e.stopPropagation(); cycleBolt();
  }, true);

  // ── sounds (chained over main.ts's: the held weapon decides) ──
  const shot = (name: PhShot, gain = 1): boolean => sfx?.shot(name, { gain }) ?? false;
  const prevFire = weapons.onFire;
  weapons.onFire = () => {
    const id = weapons.current.id;
    if (id === 'rifle' && shot('leverShot')) { window.setTimeout(() => { shot('leverEcho', ECHO_GAIN); }, ECHO_DELAY * 1000); return; }
    if (id === 'bow' && shot('longbowLoose')) return;
    prevFire?.();
  };
  const prevReload = weapons.onReloadStart;
  weapons.onReloadStart = () => { if (weapons.current.id !== 'rifle') prevReload?.(); }; // the lever gun's reload is its rounds (onRoundIn), not the AR's magazine
  rifle.onCycle = () => { shot('leverCycle'); };
  rifle.onRoundIn = () => { if (!shot('leverRoundIn', 0.9)) audio.dryFire(); };
  // the lever gun's hammer on an empty chamber (the crossbow keeps Audio's latch click)
  const prevDry = weapons.onDry;
  weapons.onDry = () => { if (weapons.current.id === 'rifle' && shot('leverDry')) return; prevDry?.(); };
  // a bolt / arrow / round on stone (a crag, a boulder, the cave): the crack and the ricochet instead of main.ts's ground thud.
  // The impact point is on the surface, so a short probe through it on each axis in turn meets what was hit.
  const prevImpact = weapons.onImpact;
  weapons.onImpact = (surface, point) => {
    if (surface === 'ground' && stony(point) && sfx?.shot('boltImpact-rock', { at: point }) === true) return;
    prevImpact?.(surface, point);
  };
  longbow.onDrawStart = () => { shot('longbowDraw', 0.8); };
  longbow.onRecover = (ok) => { hud.toast(ok ? 'Arrow recovered' : 'Arrow broke'); };

  // ── the longbow: the King's reward, kept by the pack's flag ──
  const grantLongbow = (): void => {
    weapons.unlock('bow');
    weapons.select('bow');
    hud.toast("The Warden's Longbow · hold FIRE to draw, let go at full draw");
  };
  if (inventory.count('warden-longbow') > 0) weapons.unlock('bow');

  // ── dev ──
  const want = params.get('weapon');
  if (want === 'lever' || want === 'rifle') { weapons.unlock('rifle'); weapons.select('rifle', true); }
  else if (want === 'longbow' || want === 'bow') { weapons.unlock('bow'); weapons.select('bow', true); }
  else if (want === 'crossbow') weapons.select('crossbow', true);
  const ammoParam = params.get('ammo');
  if (ammoParam === 'pitch' || ammoParam === 'broadhead') { quiver.add(ammoParam, 10); selectBolt(ammoParam, true); }

  applyBolt();
  const api: PineLoadout = {
    addAmmo, count, selectBolt, cycleBolt, grantLongbow,
    get bolt() { return quiver.selected; },
    onPlayerDeath: () => { if (quiver.selected !== 'iron') selectBolt('iron', true); },
    useSfx: (s) => { sfx = s; s.prewarm(['leverShot', 'leverEcho', 'leverCycle', 'leverDry', 'leverRoundIn', 'longbowDraw', 'longbowLoose', 'boltImpact-rock']); },
    useRain: (r) => { rain = r; },
    update: (dt) => {
      if (!crossbow) return;
      quiver.stash(live());
      // a special stack ran dry (nothing on the rail): back to iron, which the crossbow spans itself
      if (quiver.selected !== 'iron' && live() <= 0 && !crossbow.state.loaded && !crossbow.state.reloading) {
        const was = quiver.selected;
        selectBolt('iron', true); hud.toast(`${BOLT_NAME[was]} spent · iron bolts loaded`);
      }
      applyBolt();
      saveT += dt;
      if (weapons.current.id === 'crossbow' && saveT > 2) { saveT = 0; if (dirty || quiver.selected !== 'iron') save(); }
    },
  };
  Object.assign(window, { __loadout: api, __lever: rifle, __longbow: longbow }); // dev: `__lever.freezeCycle = 0.45`, `__longbow.freezeDraw = 1`
  return api;
}
