import type { Player } from '../player/Player';
import type { Wildlife } from '../entities/Wildlife';
import type { TargetHit } from '../player/Crossbow';
import type { NalatiKit } from '../player/nalatiKit';
import { grassHeightAt } from '../world/GrassTrample';
import '../ui/styles/stealth.css';

/**
 * Nalati crouch + grass stealth (plan row B9; docs/design/nalati/stealth-and-storms.md "Grass stealth",
 * docs/design/nalati/controls.md decision D; mockups art/nalati-grasslands/round-3/3-crouch-disc/*.png,
 * round-2/3-features/stealth-1-crouched-hidden.png, stealth-2-detected.png).
 *
 *   const stealth = new Stealth({ player, wildlife: () => wildlife, isMounted: () => mounted });   // once (src/nalati/index.ts)
 *   stealth.bindKit(kit);        // the sneak shot: × 2 on the bow's arrows and the spear's javelins loosed from HIDDEN
 *   stealth.noteShot();          // every loose / throw / swing (main's weapons.onFire → nalati.onShot)
 *   stealth.update(dt, t);       // every frame (reads the creatures' awareness → the eye pip)
 *
 * CROUCH (decision D): crouching exists only in LONG GRASS — `grassHeightAt(player) ≥ LONG_GRASS` (0.7 m, trampling
 * included), with hysteresis: in after 0.3 s, out after 1.0 s. Touch: a CROUCH disc fades in directly above JUMP
 * (the first time per session with a pulse ring + a TALL GRASS chip) and is a TOGGLE. Desktop: C toggles, Ctrl holds —
 * both gated to long grass like the disc. Jumping (stand + jump in one), sprinting, leaving the grass, the hoverboard,
 * swimming and mounting all stand you up. Driven through `player.keys` ('KeyC' = crouched: Player's own crouch — eye
 * 1.03 m, 2.2 m/s), so Player.ts needs no change and Pine Hollow / Driftwood never see any of this.
 *
 * DETECTION: the creatures own their senses (Pack / Herd via wildEnv.playerVisibility — grass cover at you and along the
 * line to them, your speed, the light, hearing with the grass rustle, the wolves' and the stallion's smell from downwind
 * regardless of grass; Wildlife feeds `wildEnv.playerCrouched`). This module READS their awareness for the eye pip under
 * the crosshair:
 *   HIDDEN    crouched, cover ≥ 0.85, every animal within 40 m under 0.2       closed eye, cyan
 *   VISIBLE   in long grass or crouched, nothing aware of you                  open eye, faint
 *   NOTICED   the most aware animal between 0.2 and its alert level             half eye, amber, + a chevron toward it
 *   DETECTED  an animal at its alert level (a pack shadowing / hunting you, a horse's head up)   red "!", vignette pulse
 *   (no pip out of long grass while standing)
 * plus the GRASS cover meter on the left edge while crouched. `state`, `cover`, `threat` (0..1 of the alert level) are
 * readable for other rows (taming: TRUST only builds crouched).
 */

export type StealthState = 'none' | 'visible' | 'hidden' | 'noticed' | 'detected';
export interface StealthOpts {
  player: Player;
  wildlife: () => Wildlife | null;
  /** riding (B7): no crouch in the saddle */
  isMounted?: () => boolean;
}

export const LONG_GRASS = 0.7;           // m — the crouch disc / C key work in grass at least this tall
const IN_AFTER = 0.3, OUT_AFTER = 1.0;   // s of hysteresis
const HIDDEN_COVER = 0.85;
const NOTICE = 0.2;                      // awareness at which an animal has NOTICED you
const PACK_ALERT = 0.35;                 // a pack's awareness at which it leaves roam to shadow you (Pack.ts)
const HERD_ALERT = 0.45;                 // a horse's head-up level (Herd.ts ALERT_AT)
const SENSE_RANGE = 90;                  // m — creatures further than this don't drive the pip
const QUIET_RANGE = 40;                  // m — HIDDEN needs every animal this close under NOTICE
const SNEAK_MUL = 2, SNEAK_WINDOW = 4;   // × damage for a shot loosed from HIDDEN, landing within this many s

const EYE_OPEN = '<svg viewBox="0 0 24 24"><path d="M1.5 12c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7S4.3 16.6 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.4" fill="currentColor"/></svg>';
const EYE_HALF = '<svg viewBox="0 0 24 24"><path d="M1.5 12c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7S4.3 16.6 1.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 10.5h17" stroke="currentColor" stroke-width="1.7"/><path d="M8.6 10.5a3.4 3.4 0 0 0 6.8 0z" fill="currentColor"/></svg>';
const EYE_SHUT = '<svg viewBox="0 0 24 24"><path d="M2 10c2.9 3.6 6.2 5.4 10 5.4S19.1 13.6 22 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5.6 13.4 4 16M9.4 15 8.8 18M14.6 15l.6 3M18.4 13.4 20 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const ALERT = '<svg viewBox="0 0 24 24"><path d="M12 2.5v12.5" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="12" cy="20.4" r="2.1" fill="currentColor"/></svg>';
const CROUCH_ICON = '<svg viewBox="0 0 24 24"><path d="M5 5.5 12 12l7-6.5M5 12.5 12 19l7-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class Stealth {
  state: StealthState = 'none';
  /** grass cover at the player, 0..1 (the stealth doc's `cover`) */
  cover = 0;
  /** the most aware creature near you, as a fraction of its alert level (0..1) */
  threat = 0;
  /** long grass underfoot (with the hysteresis): the crouch is available */
  inLongGrass = false;
  /** the toggle */
  latched = false;
  private player: Player;
  private wildlife: () => Wildlife | null;
  private isMounted: () => boolean;
  private onT = 0; private offT = 0;
  private toggleReq = false; private ctrlDown = false;
  private t = 0;
  private sneakShot = false; private sneakT = -1e9;
  private threatX = 0; private threatZ = 0;
  private hinted = false;
  // DOM
  private root: HTMLElement; private pip: HTMLElement; private pipIcon: HTMLElement; private pipLabel: HTMLElement;
  private chev: HTMLElement; private meter: HTMLElement; private meterFill: HTMLElement; private hint: HTMLElement;
  private layer: HTMLElement | null; private disc: HTMLElement | null = null;
  private shown: StealthState | '' = '';
  private lastCover = -1; private lastThreat = -1; private lookFrames = 0;

  constructor(opts: StealthOpts) {
    this.player = opts.player; this.wildlife = opts.wildlife; this.isMounted = opts.isMounted ?? (() => false);
    const hud = document.getElementById('hud') ?? document.body;
    this.root = document.createElement('div');
    this.root.className = 'ws-stealth';
    this.root.innerHTML = `<div class="ws-stealth-vig"></div>
      <div class="ws-stealth-pip"><i class="ws-stealth-eye"></i><span class="ws-stealth-label"></span></div>
      <div class="ws-stealth-chev"></div>
      <div class="ws-stealth-grass"><span>Grass</span><b><i></i></b></div>
      <div class="ws-stealth-hint"></div>`;
    hud.append(this.root);
    const q = (sel: string): HTMLElement => { const e = this.root.querySelector<HTMLElement>(sel); if (e === null) throw new Error(`Stealth: missing ${sel}`); return e; };
    this.pip = q('.ws-stealth-pip'); this.pipIcon = q('.ws-stealth-eye'); this.pipLabel = q('.ws-stealth-label');
    this.chev = q('.ws-stealth-chev'); this.meter = q('.ws-stealth-grass'); this.meterFill = q('.ws-stealth-grass i'); this.hint = q('.ws-stealth-hint');
    this.layer = null;
    this.hint.textContent = 'Tall grass · C crouch';
    // desktop: C toggles, Ctrl holds — both gated to long grass (preUpdate)
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyC' && !e.repeat) this.toggleReq = true;
      if (e.code === 'ControlLeft') this.ctrlDown = true;
    });
    document.addEventListener('keyup', (e) => { if (e.code === 'ControlLeft') this.ctrlDown = false; });
    window.addEventListener('blur', () => { this.ctrlDown = false; });
    // the crouch decision runs first thing in the player's update, before it reads its keys
    const prev = this.player.preUpdate;
    this.player.preUpdate = (dt) => { prev?.(dt); this.crouchStep(dt); };
    Object.assign(window, { __stealth: this }); // dev / screenshot hook
  }
  /** dev: the grass height (m, trampling included) at (x, z) */
  grassAt(x: number, z: number): number { return grassHeightAt(x, z); }

  /** the sneak shot: arrows (Bow.damageMultiplier) and javelins (Spear.damageMultiplier) loosed from HIDDEN do × 2 */
  bindKit(kit: NalatiKit): void {
    const bow = kit.bow, spear = kit.spear;
    const prevBow = bow.damageMultiplier;
    bow.damageMultiplier = (hit: TargetHit) => (prevBow?.(hit) ?? 1) * this.sneakMultiplier();
    const prevSpear = spear.damageMultiplier;
    spear.damageMultiplier = (hit: TargetHit) => (prevSpear?.(hit) ?? 1) * this.sneakMultiplier();
  }
  /** a shot was loosed now (main's weapons.onFire): remember whether it left from HIDDEN */
  noteShot(): void { this.sneakShot = this.state === 'hidden'; this.sneakT = this.t; }
  /** × 2 for a shot loosed from HIDDEN (landing within SNEAK_WINDOW s), else 1 */
  sneakMultiplier(): number { return this.sneakShot && this.t - this.sneakT < SNEAK_WINDOW ? SNEAK_MUL : 1; }

  /** touch: the CROUCH disc, stacked above JUMP in the TouchControls layer (touch.css `.ws-touch-disc.crouch`); the layer
   *  carries `.nalati` for the shard's own disc layout (DODGE moves beside JUMP) and `.crouch-avail` while it shows. The
   *  layer is built after the Nalati wiring (main.ts order), so it is looked for until it exists. */
  private attachTouch(): void {
    const layer = document.querySelector<HTMLElement>('#hud .ws-touch');
    if (layer === null) return;
    this.layer = layer;
    layer.classList.add('nalati');
    const d = document.createElement('button');
    d.type = 'button'; d.className = 'ws-touch-disc crouch';
    d.innerHTML = `${CROUCH_ICON}<span>Crouch</span>`;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.toggleReq = true; });
    d.addEventListener('pointerup', (e) => { e.stopPropagation(); });
    layer.append(d);
    this.disc = d;
    this.hint.textContent = 'Tall grass';
    this.hint.classList.add('touch');
  }

  // ── the crouch: long grass, the toggle, what stands you up ──
  private crouchStep(dt: number): void {
    const p = this.player, k = p.keys;
    const blocked = p.hover || p.swimming || this.isMounted();
    const long = !blocked && grassHeightAt(p.position.x, p.position.z) >= LONG_GRASS;
    if (long) { this.onT += dt; this.offT = 0; } else { this.offT += dt; this.onT = 0; }
    this.inLongGrass = blocked ? false : this.inLongGrass ? this.offT < OUT_AFTER : this.onT >= IN_AFTER;
    if (this.toggleReq) { this.toggleReq = false; if (this.inLongGrass || this.latched) this.latched = !this.latched; }
    const sprint = p.touchSprint || (k.has('ShiftLeft') && (k.has('KeyW') || p.touchMove.y > 0.1));
    const jump = k.has('Space') || p.touchJump;
    if (!this.inLongGrass || sprint || jump) this.latched = false; // leaving the grass / sprinting / jumping stands you up
    const crouch = this.latched || (this.ctrlDown && this.inLongGrass);
    // Player crouches on its held 'KeyC' / 'ControlLeft': this module owns both keys in Nalati
    k.delete('ControlLeft');
    if (crouch) k.add('KeyC'); else k.delete('KeyC');
  }

  // ── detection → the eye pip ──
  update(dt: number, t: number): void {
    this.t = t;
    if (this.layer === null && (++this.lookFrames % 30) === 1) this.attachTouch();
    const p = this.player.position;
    const crouched = this.player.crouching;
    const g = grassHeightAt(p.x, p.z), h = crouched ? 1.05 : 1.75;
    this.cover = clamp01((g - 0.15) / (h - 0.15));
    // the most aware creature (as a fraction of its alert level) and whether anything close has noticed you at all
    let level = 0, quiet = true, noticed = false, tx = 0, tz = 0;
    const w = this.wildlife();
    if (w !== null) {
      for (const pack of w.packs) {
        let near: { x: number; z: number } | null = null, nd = SENSE_RANGE;
        for (const m of pack.members) {
          if (!m.alive) continue;
          const d = Math.hypot(m.position.x - p.x, m.position.z - p.z);
          if (d < nd) { nd = d; near = m.position; }
        }
        if (near === null) continue;
        const hunting = pack.phase === 'shadow' || pack.phase === 'encircle' || pack.phase === 'regroup';
        const lv = hunting ? Math.max(1, pack.awareness / PACK_ALERT) : pack.awareness / PACK_ALERT;
        if (pack.awareness >= NOTICE || hunting) { noticed = true; if (nd < QUIET_RANGE) quiet = false; }
        if (lv > level) { level = lv; tx = near.x; tz = near.z; }
      }
      for (const herd of w.herds) {
        for (const m of herd.members) {
          if (!m.alive || (m.mem['ridden'] ?? 0) === 1 || (m.mem['owned'] ?? 0) === 1) continue;
          const d = Math.hypot(m.position.x - p.x, m.position.z - p.z);
          if (d > SENSE_RANGE) continue;
          const aw = m.mem['aw'] ?? 0;
          if (aw >= NOTICE) { noticed = true; if (d < QUIET_RANGE) quiet = false; }
          const lv = aw / HERD_ALERT;
          if (lv > level) { level = lv; tx = m.position.x; tz = m.position.z; }
        }
      }
    }
    this.threat = clamp01(level);
    this.threatX = tx; this.threatZ = tz;
    const context = this.inLongGrass || crouched;
    this.state = !context ? 'none' : level >= 1 ? 'detected' : noticed ? 'noticed' : crouched && this.cover >= HIDDEN_COVER && quiet ? 'hidden' : 'visible';
    this.render(dt);
  }

  private render(_dt: number): void {
    const s = this.state;
    if (s !== this.shown) {
      this.shown = s;
      this.root.dataset['state'] = s;
      this.pipIcon.innerHTML = s === 'hidden' ? EYE_SHUT : s === 'noticed' ? EYE_HALF : s === 'detected' ? ALERT : EYE_OPEN;
      this.pipLabel.textContent = s === 'hidden' ? 'Hidden' : s === 'noticed' ? 'Noticed' : s === 'detected' ? 'Detected' : 'Visible';
    }
    // the GRASS meter while crouched
    const crouched = this.player.crouching;
    this.meter.classList.toggle('on', crouched);
    const c = Math.round(this.cover * 100) / 100;
    if (c !== this.lastCover) { this.lastCover = c; this.meterFill.style.transform = `scaleY(${c.toFixed(2)})`; this.meter.classList.toggle('good', c >= HIDDEN_COVER); }
    const th = Math.round(this.threat * 50) / 50;
    if (th !== this.lastThreat) { this.lastThreat = th; this.pip.style.setProperty('--threat', th.toFixed(2)); }
    // the chevron: round the crosshair, pointing at the most aware creature
    const threatening = s === 'noticed' || s === 'detected';
    this.chev.classList.toggle('on', threatening);
    if (threatening) {
      const p = this.player.position, yaw = this.player.yaw;
      const dx = this.threatX - p.x, dz = this.threatZ - p.z;
      const ax = dx * Math.cos(yaw) - dz * Math.sin(yaw), ay = -dx * Math.sin(yaw) - dz * Math.cos(yaw); // right / forward
      const a = Math.atan2(ax, ay);
      this.chev.style.transform = `translate(${(Math.sin(a) * 64).toFixed(1)}px, ${(-Math.cos(a) * 64).toFixed(1)}px) rotate(${a.toFixed(3)}rad)`;
    }
    // the crouch disc (touch) and the one-time TALL GRASS chip
    const avail = this.inLongGrass || this.latched;
    this.layer?.classList.toggle('crouch-avail', avail);
    this.disc?.classList.toggle('on', this.latched);
    if (avail && !this.hinted) {
      this.hinted = true;
      this.disc?.classList.add('pulse');
      this.hint.classList.add('on');
      setTimeout(() => { this.hint.classList.remove('on'); this.disc?.classList.remove('pulse'); }, 3200);
    }
  }
}
