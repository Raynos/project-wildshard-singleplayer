import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import * as THREE from 'three';
import { WRECK } from '../world/sites';
import { LightPool } from '@wildshard/engine/fx/LightPool';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { buildIronSwordDisplay } from '../runtime/fpArms';
import { ItemPickup } from '@wildshard/engine/player/WeaponPickup';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

/**
 * IronSword — the iron sword as LOOT on Driftwood Isle ("the whole point of Project Wildshard is that you can find
 * equipment on the floor"): a big faceted display model of the iron sword (art/driftwood-isle/round-2-first-person/driftwood-fp-sword-iron.png — steel
 * blade with a bright bevelled edge and a darker fuller, dark iron cross guard, leather-wrapped grip, round pommel;
 * flat-shaded vertex colours, no textures) hovering ~1 m over the wreck's broken midships deck inside the item orb
 * (`WeaponPickup.ts` — the AR-15's floating bubble, reused unchanged), with a warm amber point light + a soft halo so
 * the glow reads from the cove beach, day or night.
 *
 * The weapon itself is the existing rig: `new Sword(world, targets, { blade: 'iron' })` (Sword.ts, 28 base damage),
 * registered with the kit manager as `'sword-iron'` (Weapons.ts `extras`). This file only builds the pickup.
 *
 *   const drop = new IronSwordPickup({ scene, sky, position: ironSwordSite(wreck, heightAt) });   // floor point = the deck
 *   interactables.push(drop.interactable);                       // "[E] Take iron sword" within `radius` (the door / harvest prompt path)
 *   drop.onPickup = () => { weapons.unlock('sword-iron'); weapons.select('sword-iron'); hud.toast('Iron sword acquired · 1/2 to switch, Q to swap'); audio.hitMarker(); };
 *   drop.onNear = (on) => audio.pickupHum(on);
 *   game.onUpdate((dt, t) => drop.update(dt, t, game.renderer, game.camera));
 *   drop.guard = () => sailorDead ? null : 'Guarded — …';        // B4 / D6 (src/game/quest/Adventure.ts sets it on Driftwood):
 *   drop.onGuarded = (why) => hud.toast(why);                    // the prompt shows why, E does nothing until the guard is down
 *   `?weapon=iron` (dev): weapons.unlock('sword-iron'); weapons.select('sword-iron', true); drop.dispose();
 *
 * `ironSwordSite(wreck)` = in the wreck's hold in front of the weapon rack (the model's `anchors.swordRack`); a hull
 * without the anchor → the heeled deck at the broken midships planks (local (-0.7, 4.2)), else the sand beside the
 * hull — `ironSwordSite` never returns undefined. No walk-in take any more (it grabbed the sword before the sailor had
 * risen, B4): the sword is taken with E, once `guard` lets it go.
 */

export interface IronSwordPickupOptions {
  scene: THREE.Scene;
  sky: Sky;
  materials: ReadonlyMap<string, THREE.Material>;
  /** the floor point under the orb (the deck) */
  position: THREE.Vector3;
  prompt?: string;
}

const WARM = 0xffb257;
/** the pickup's cosmetic draws (the glow's flicker phase, the orb's bob and motes) come from this seed, not `Math.random`:
 *  the frame at the wreck stays the same however many three.js objects the boot made before it */
const COSMETIC_SEED = SEED ^ 0x1205;
const LIFT = 0.22;                 // m the orb's floor point sits over the deck: the big sword (DISPLAY_SCALE × 1.25 m) pokes out of the
                                   // orb top and bottom, so the pommel clears the planks
const DISPLAY_SCALE = 1.3, TILT = THREE.MathUtils.degToRad(40);   // fills the orb diagonally like the AR-15 in the mockup
const GUARDED_R = 1.4;             // m, eye → prompt point while guarded (E296): the reason shows at the rack only, not over the
                                   // whole hold's fight (on the phone it was the big USE band across the sailor), and any other prompt wins

/** a soft warm halo (additive sprite) so the glow reads from far off — a radial texture drawn once */
let haloTex: THREE.CanvasTexture | null = null;
function makeHalo(): THREE.CanvasTexture {
  const S = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d');
  if (ctx === null) throw new Error('makeHalo: no 2d canvas context');
  const gr = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The world floor point for the pickup (D6): in the hold, in front of the weapon rack (`wreck.anchors.swordRack`, the
 * model agent's point on the port wall facing into the hold — the orb hangs 0.55 m out from the wall so it clears the
 * pegs); a wreck without the anchor → the heeled deck at the broken midships planks, else the sand beside the hull.
 */
export function ironSwordSite(wreck: { floorHeightAt: (x: number, z: number) => number | undefined }, heightAt: (x: number, z: number) => number): THREE.Vector3 {
  const rack = rackAnchor(wreck);
  if (rack) return new THREE.Vector3(rack.x + Math.sin(rack.yaw) * 0.55, rack.y, rack.z + Math.cos(rack.yaw) * 0.55);
  const h = WRECK.heading, cs = Math.cos(h), sn = Math.sin(h);
  // hull frame (Wreck.ts): local x = starboard, z = stern; world = R_y(heading) · local
  const lx = -0.7, lz = 4.2;
  const x = WRECK.x + lx * cs + lz * sn, z = WRECK.z - lx * sn + lz * cs;
  const deck = wreck.floorHeightAt(x, z);
  if (deck !== undefined) return new THREE.Vector3(x, deck, z);
  const sx = WRECK.x + 4.2 * cs, sz = WRECK.z - 4.2 * sn; // starboard side, on the sand
  return new THREE.Vector3(sx, heightAt(sx, sz), sz);
}

function rackAnchor(wreck: object): { x: number; y: number; z: number; yaw: number } | null {
  if (!('anchors' in wreck)) return null;
  const a: unknown = wreck.anchors;
  if (typeof a !== 'object' || a === null || !('swordRack' in a)) return null;
  const r: unknown = a.swordRack;
  if (typeof r !== 'object' || r === null || !('x' in r) || !('y' in r) || !('z' in r)) return null;
  const { x, y, z } = r, yaw = 'yaw' in r ? r.yaw : 0;
  return typeof x === 'number' && typeof y === 'number' && typeof z === 'number' ? { x, y, z, yaw: typeof yaw === 'number' ? yaw : 0 } : null;
}

export class IronSwordPickup extends ItemPickup {
  /** the "[E]" prompt: the pickup's, unless `guard` says why it can't be taken yet */
  declare readonly interactable: Interactable;
  /**
   * B4 / D6: while this returns a reason the sword can't be taken (the drowned sailor still guards it) the prompt shows
   * the reason and E does nothing but `onGuarded(reason)` — only at the rack (GUARDED_R) and as a weak prompt (E296: it
   * covered the fight). Null = free to take (Pine Hollow / dev: no guard).
   */
  guard: (() => string | null) | null = null;
  onGuarded?: (reason: string) => void;
  private glowLight: THREE.PointLight;
  private halo: THREE.Sprite;
  private haloMat: THREE.SpriteMaterial;
  private glowScene: THREE.Scene;
  private readonly phase: number;
  private gone = false;

  constructor(opts: IronSwordPickupOptions) {
    const cosmetic = new Rng(COSMETIC_SEED), phase = cosmetic.next() * 7;
    const floor = opts.position.clone(); floor.y += LIFT;
    super({ scene: opts.scene, item: buildIronSwordDisplay(opts.materials), position: floor, prompt: opts.prompt ?? 'Take iron sword', radius: 2.6, scale: DISPLAY_SCALE, tilt: TILT, random: () => cosmetic.next() });
    this.glowScene = opts.scene; this.phase = phase;
    const base = this.interactable, reason = (): string | null => this.guard?.() ?? null;
    this.interactable = {
      position: base.position,
      get radius() { return reason() === null ? base.radius : Math.min(base.radius, GUARDED_R); },
      get weak() { return reason() !== null; },
      get label() { return reason() ?? base.label; },
      onInteract: () => { const r = reason(); if (r !== null) this.onGuarded?.(r); else base.onInteract(); },
    };
    // the warm glow: an amber point light over the deck (the orb's own is a short cyan one) and a big soft halo
    this.glowLight = LightPool.for(opts.scene).acquire(WARM, 18, 11, 1.6); // pooled (B7): released dark on pickup, never removed
    this.glowLight.position.set(floor.x, floor.y + 1.3, floor.z);
    haloTex ??= cacheUntilDisposed(makeHalo(), () => { haloTex = null; });
    this.haloMat = new THREE.SpriteMaterial({ map: haloTex, color: WARM, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.halo = new THREE.Sprite(this.haloMat);
    this.halo.position.set(floor.x, floor.y + 0.75, floor.z);
    this.halo.scale.setScalar(3.2);
    this.halo.renderOrder = 19;
    opts.scene.add(this.halo);
  }

  override dispose(): void {
    super.dispose();
    this.removeGlow();
  }
  private removeGlow(): void {
    if (this.gone) return;
    this.gone = true;
    this.glowScene.remove(this.halo);
    LightPool.for(this.glowScene).release(this.glowLight); // dark, still in the scene: a light-count change would recompile every lit program
    this.haloMat.dispose();
  }

  /** the glow flickers while the sword waits, and flares out with the orb once it is taken */
  override update(dt: number, t: number, renderer?: Renderer, camera?: THREE.PerspectiveCamera): void {
    super.update(dt, t, renderer, camera);
    if (!this.taken) {
      const tt = t + this.phase;
      const flick = 1 + Math.sin(tt * 2.2) * 0.1 + Math.sin(tt * 7.3) * 0.05;
      this.glowLight.intensity = 18 * flick;
      this.haloMat.opacity = 0.5 * flick;
      return;
    }
    if (this.gone) return;
    // the burst: the glow flares and dies with the orb (ItemPickup's BURST_TIME is ~0.3 s)
    this.glowLight.intensity = Math.max(0, this.glowLight.intensity - dt * 120);
    this.haloMat.opacity = Math.max(0, this.haloMat.opacity - dt * 2.5);
    this.halo.scale.addScalar(dt * 6);
    if (this.haloMat.opacity <= 0) this.removeGlow();
  }
}
