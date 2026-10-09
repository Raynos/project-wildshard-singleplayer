import type { Scope } from '@wildshard/engine/app/scope';
import { EffectService } from '@wildshard/engine/combat/effects/EffectService';
import { sourceMultiplier, type EffectTarget } from '@wildshard/engine/combat/effects/types';
import type { TargetHit } from '@wildshard/engine/combat/types';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { Player } from '@wildshard/engine/player/Player';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';
import { declarePanel, mountPanel, panelScope, type PanelNode, type PanelSvg, type PanelView } from '@wildshard/sdk/panels';
import { SNEAK_SHOT, NALATI_SOURCE_MULTIPLIERS } from './weapons/effects';

import type { Wildlife } from './creatures/wildlife';

import type { NalatiLoadout } from './weapons/loadout';
import { grassBaseHeightAt } from '@wildshard/game/systems/looks/grassField';
import { grassHeightAt } from '@wildshard/game/systems/looks/trample';
import './stealth.css';

/**
 * Nalati crouch + grass stealth (plan row B9; docs/design/nalati/stealth-and-storms.md "Grass stealth",
 * docs/design/nalati/controls.md decision D; mockups art/nalati-grasslands/round-3/3-crouch-disc/*.png,
 * round-2/3-features/stealth-1-crouched-hidden.jpg, stealth-2-detected.jpg).
 *
 *   const stealth = new Stealth({ player, wildlife: () => wildlife, isMounted: () => mounted });   // once (src/shards/nalati-grasslands/index.ts)
 *   stealth.bindKit(kit);        // the sneak shot: × 2 on the bow's arrows and the spear's javelins loosed from HIDDEN
 *   stealth.noteShot();          // every loose / throw / swing (main's weapons.onFire → nalati.onShot)
 *   stealth.update(dt, t);       // every frame (reads the creatures' awareness → the eye pip)
 *
 * CROUCH (decision D): crouching exists only in LONG GRASS — `grassBaseHeightAt(player) ≥ LONG_GRASS` (0.7 m) — and where
 * `crouchHere()` says a quest needs it (the taming approach: the stallion grazes the knee-high meadow, E287), with
 * hysteresis: in after 0.3 s, out after 1.0 s. The grass at your own feet is read as it stands, not trampled: every step
 * you take flattens it to 15 % for ~20 s, so the trampled height hid the disc from anyone who walked in (E287). Touch: a CROUCH disc fades in in the base HUD's slot over
 * JUMP (hudSlots `up0`; the first time per session with a pulse ring + a TALL GRASS chip) and is a TOGGLE. Desktop: C toggles, Ctrl holds —
 * both gated to long grass like the disc. Jumping (stand + jump in one), sprinting, leaving the grass, the hoverboard,
 * swimming, mounting and a practice room (the arena, a playground, 3 km over the grass: `practiceRoom.open`, E321) all stand you up.
 * The scoped player.crouch answer gates the shared motor's crouch (eye 1.03 m, 2.2 m/s); without a shard answer the motor stays standing.
 *
 * DETECTION: the creatures own their senses (Pack / Herd via wildEnv.playerVisibility — grass cover at you and along the
 * line to them, your speed, the light, hearing with the grass rustle, the wolves' and the stallion's smell from downwind
 * regardless of grass; Wildlife feeds `wildEnv.playerCrouched`). This module READS their awareness for the eye pip under
 * the crosshair (on the phone a row of the base HUD's top-left status column instead — hudSlots, E154):
 *   HIDDEN    crouched, cover ≥ 0.85, every animal within 40 m under 0.2       closed eye, cyan
 *   VISIBLE   in long grass or crouched, nothing aware of you                  open eye, faint
 *   NOTICED   the most aware animal between 0.2 and its alert level             half eye, amber, + a chevron toward it
 *   DETECTED  an animal at its alert level (a pack shadowing / hunting you, a horse's head up)   red "!", vignette pulse
 *   (no pip out of long grass while standing)
 * plus the GRASS cover meter while crouched (the left edge; on the phone a status-column row). `state`, `cover`, `threat` (0..1 of the alert level) are
 * readable for other rows (taming: TRUST only builds crouched).
 */

export type StealthState = 'none' | 'visible' | 'hidden' | 'noticed' | 'detected';
export interface StealthOpts {
  player: Player;
  ctx?: LevelContext;
  wildlife: () => Wildlife | null;
  /** riding (B7): no crouch in the saddle */
  isMounted?: () => boolean;
  /** the crouch off long grass, where a quest asks for it (the taming approach, E287) */
  crouchHere?: () => boolean;
  /** the grass's base height at a point (the kit's grass field by default; a test passes its own) */
  grassAt?: (x: number, z: number) => number;
}

export const LONG_GRASS = 0.7;           // m — the crouch disc / C key work in grass at least this tall
const IN_AFTER = 0.3, OUT_AFTER = 1.0;   // s of hysteresis
const HIDDEN_COVER = 0.85;
const NOTICE = 0.2;                      // awareness at which an animal has NOTICED you
const PACK_ALERT = 0.35;                 // a pack's awareness at which it leaves roam to shadow you (Pack.ts)
const HERD_ALERT = 0.45;                 // a horse's head-up level (Herd.ts ALERT_AT)
const SENSE_RANGE = 90;                  // m — creatures further than this don't drive the pip
const QUIET_RANGE = 40;                  // m — HIDDEN needs every animal this close under NOTICE

// the eye pip's icons, drawn as data (SF28: the platform's declared panels build them as inline SVG)
const svgIcon = (...children: PanelSvg[]): PanelSvg => ({ svg: 'svg', attrs: [['viewBox', '0 0 24 24']], children });
const EYE_LINE = 'M1.5 12c2.8-4.6 6.3-7 10.5-7s7.7 2.4 10.5 7c-2.8 4.6-6.3 7-10.5 7S4.3 16.6 1.5 12z';
const eyeOutline: PanelSvg = { svg: 'path', attrs: [['d', EYE_LINE], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.7']] };
export const EYE_OPEN = svgIcon(eyeOutline, { svg: 'circle', attrs: [['cx', '12'], ['cy', '12'], ['r', '3.4'], ['fill', 'currentColor']] });
export const EYE_HALF = svgIcon(eyeOutline,
  { svg: 'path', attrs: [['d', 'M3.5 10.5h17'], ['stroke', 'currentColor'], ['stroke-width', '1.7']] },
  { svg: 'path', attrs: [['d', 'M8.6 10.5a3.4 3.4 0 0 0 6.8 0z'], ['fill', 'currentColor']] });
export const EYE_SHUT = svgIcon(
  { svg: 'path', attrs: [['d', 'M2 10c2.9 3.6 6.2 5.4 10 5.4S19.1 13.6 22 10'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.8'], ['stroke-linecap', 'round']] },
  { svg: 'path', attrs: [['d', 'M5.6 13.4 4 16M9.4 15 8.8 18M14.6 15l.6 3M18.4 13.4 20 16'], ['stroke', 'currentColor'], ['stroke-width', '1.5'], ['stroke-linecap', 'round']] });
export const ALERT = svgIcon(
  { svg: 'path', attrs: [['d', 'M12 2.5v12.5'], ['stroke', 'currentColor'], ['stroke-width', '3.4'], ['stroke-linecap', 'round']] },
  { svg: 'circle', attrs: [['cx', '12'], ['cy', '20.4'], ['r', '2.1'], ['fill', 'currentColor']] });
const CROUCH_ICON = '<svg viewBox="0 0 24 24"><path d="M5 5.5 12 12l7-6.5M5 12.5 12 19l7-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** the screen layer: the DETECTED vignette, the eye pip, the threat chevron, the GRASS meter, the TALL GRASS chip */
export const STEALTH_LAYER: PanelNode = { cls: 'ws-stealth', children: [
  { cls: 'ws-stealth-vig' },
  { cls: 'ws-stealth-pip', ref: 'pip', children: [{ tag: 'i', cls: 'ws-stealth-eye', ref: 'pipIcon' }, { tag: 'span', cls: 'ws-stealth-label', ref: 'pipLabel' }] },
  { cls: 'ws-stealth-chev', ref: 'chev' },
  { cls: 'ws-stealth-grass', ref: 'meter', children: [{ tag: 'span', text: 'Grass' }, { tag: 'b', children: [{ tag: 'i', ref: 'meterFill' }] }] },
  { cls: 'ws-stealth-hint', ref: 'hint', text: 'Tall grass · C crouch' },
] };
/** touch: the eye + state row of the status column */
export const STEALTH_ROW: PanelNode = { cls: 'ws-stealth-row', data: { state: 'none' }, children: [
  { tag: 'i', cls: 'ws-stealth-eye', ref: 'icon' }, { tag: 'span', cls: 'ws-stealth-label', ref: 'label' },
] };
/** touch: the GRASS cover row of the status column */
export const STEALTH_GRASS_ROW: PanelNode = { cls: 'ws-stealth-grassrow', children: [
  { tag: 'span', text: 'Grass' }, { tag: 'b', children: [{ tag: 'i', ref: 'fill' }] },
] };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class Stealth {
  private readonly scope: Scope;
  state: StealthState = 'none';
  /** grass cover at the player, 0..1 (the stealth doc's `cover`) */
  cover = 0;
  /** the most aware creature near you, as a fraction of its alert level (0..1) */
  threat = 0;
  /** long grass underfoot (with the hysteresis): the crouch is available */
  inLongGrass = false;
  /** the disc shows / the toggle works: long grass, or a place that asks for the crouch (`crouchHere`) */
  canCrouch = false;
  /** the toggle */
  latched = false;
  private player: Player;
  private wildlife: () => Wildlife | null;
  private isMounted: () => boolean;
  private crouchHere: () => boolean;
  private onT = 0; private offT = 0;
  private toggleWas = false; private touchToggle = false;
  private t = 0;
  private readonly shotEffects = new EffectService([SNEAK_SHOT]);
  private readonly shotTarget: EffectTarget = { attributes: {} };
  private threatX = 0; private threatZ = 0;
  private hinted = false;
  // the declared panels (SF28): the screen layer, and on the phone two status-column rows
  private readonly layer: PanelView;
  /** touch (hudSlots, E154): the CROUCH disc, the eye + state and the GRASS meter as rows of the status column */
  private readonly disc: HTMLElement; private readonly row: PanelView; private readonly grassRow: PanelView;
  private shown: StealthState | '' = '';
  private lastCover = -1; private lastThreat = -1;

  private readonly grassBase: (x: number, z: number) => number;
  constructor(opts: StealthOpts) {
    this.scope = opts.ctx?.scope ?? panelScope('stealth');
    this.player = opts.player; this.wildlife = opts.wildlife; this.isMounted = opts.isMounted ?? (() => false); this.crouchHere = opts.crouchHere ?? (() => false); this.grassBase = opts.grassAt ?? grassBaseHeightAt;
    this.layer = declarePanel(STEALTH_LAYER);
    mountPanel(this.layer, this.scope);
    // the phone: the base HUD's slots (src/engine/ui/hudSlots.ts) — nothing here is placed by this module
    const disc = (value: Parameters<typeof hudSlots.disc>[0]): HTMLButtonElement => opts.ctx ? opts.ctx.hud.disc(value) : hudSlots.disc(value, this.scope);
    this.disc = disc({ cls: 'ws-stealth-crouch', icon: CROUCH_ICON, label: 'Crouch', spot: 'up0', press: () => { this.touchToggle = true; } });
    this.row = declarePanel(STEALTH_ROW);
    if (opts.ctx) opts.ctx.hud.widget('band.3', this.row.root, 3); else hudSlots.widget('band.3', this.row.root, 3, this.scope);
    this.grassRow = declarePanel(STEALTH_GRASS_ROW);
    if (opts.ctx) opts.ctx.hud.widget('band.3', this.grassRow.root, 4); else hudSlots.widget('band.3', this.grassRow.root, 4, this.scope);
    const unlayer = hudSlots.onLayer(() => { this.layer.text('hint', 'Tall grass'); this.layer.flag('hint', 'touch', true); });
    opts.ctx?.scope.onDispose(unlayer);
    opts.ctx?.scope.onDispose(() => { this.layer.remove(); this.latched = false; });
  }
  /** dev: the grass height (m, trampling included) at (x, z) */
  grassAt(x: number, z: number): number { return grassHeightAt(x, z); }

  /** the sneak shot: arrows (Bow.damageMultiplier) and javelins (Spear.damageMultiplier) loosed from HIDDEN do × 2 */
  bindKit(kit: NalatiLoadout): void {
    const bow = kit.bow, spear = kit.spear;
    const prevBow = bow.damageMultiplier;
    bow.damageMultiplier = (hit: TargetHit) => (prevBow?.(hit) ?? 1) * this.sneakMultiplier();
    const prevSpear = spear.damageMultiplier;
    spear.damageMultiplier = (hit: TargetHit) => (prevSpear?.(hit) ?? 1) * this.sneakMultiplier();
  }
  /** a shot was loosed now (main's weapons.onFire): remember whether it left from HIDDEN */
  noteShot(): void {
    this.shotEffects.remove(this.shotTarget, SNEAK_SHOT.id);
    if (this.state === 'hidden') this.shotEffects.apply(this.shotTarget, SNEAK_SHOT.id);
  }
  /** × 2 for a shot loosed from HIDDEN (landing within SNEAK_WINDOW s), else 1 */
  sneakMultiplier(): number { return sourceMultiplier(NALATI_SOURCE_MULTIPLIERS, { sourceTags: this.shotTarget.effectTags ?? [] }); }

  // ── the crouch: long grass, the toggle, what stands you up ──
  crouchStep(dt: number): void {
    const p = this.player;
    const blocked = p.hover || p.swimming || this.isMounted() || practiceRoom.open;
    const long = !blocked && this.grassBase(p.position.x, p.position.z) >= LONG_GRASS;
    if (long) { this.onT += dt; this.offT = 0; } else { this.offT += dt; this.onT = 0; }
    this.inLongGrass = blocked ? false : this.inLongGrass ? this.offT < OUT_AFTER : this.onT >= IN_AFTER;
    this.canCrouch = !blocked && (this.inLongGrass || this.crouchHere());
  }

  answerCrouch(request: { want: boolean; via: 'toggle' | 'hold' }): { allowed: boolean; latched: boolean } {
    const want = request.want || (request.via === 'toggle' && this.touchToggle);
    if (request.via === 'toggle') {
      if (want && !this.toggleWas && (this.canCrouch || this.latched)) this.latched = !this.latched;
      this.toggleWas = request.want;
      this.touchToggle = false;
    }
    const p = this.player;
    const sprint = (p.inputService?.held('sprint') ?? false) && ((p.inputService?.held('move.forward') ?? false) || p.touchMove.y > 0.1);
    const jump = p.touchJump || (p.inputService?.pressed('jump') ?? false);
    if (!this.canCrouch || sprint || jump) this.latched = false;
    return { allowed: request.via === 'hold' && this.canCrouch, latched: this.latched };
  }

  // ── detection → the eye pip ──
  update(dt: number, t: number): void {
    this.shotEffects.update(Math.max(0, t - this.t));
    this.t = t;
    const p = this.player.position;
    const crouched = this.player.crouching;
    const g = this.grassBase(p.x, p.z), h = crouched ? 1.05 : 1.75; // as it stands round you, not your own footprint
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
    const context = !practiceRoom.open && (this.inLongGrass || crouched);   // no eye pip in a practice room (E321)
    this.state = !context ? 'none' : level >= 1 ? 'detected' : noticed ? 'noticed' : crouched && this.cover >= HIDDEN_COVER && quiet ? 'hidden' : 'visible';
    this.render(dt);
  }

  private render(_dt: number): void {
    const s = this.state;
    if (s !== this.shown) {
      this.shown = s;
      this.layer.data('', 'state', s);
      const icon = s === 'hidden' ? EYE_SHUT : s === 'noticed' ? EYE_HALF : s === 'detected' ? ALERT : EYE_OPEN;
      const label = s === 'hidden' ? 'Hidden' : s === 'noticed' ? 'Noticed' : s === 'detected' ? 'Detected' : 'Visible';
      this.layer.fill('pipIcon', [icon]); this.layer.text('pipLabel', label);
      this.row.data('', 'state', s); this.row.fill('icon', [icon]); this.row.text('label', label);
    }
    // the GRASS meter while crouched
    const crouched = this.player.crouching;
    this.layer.flag('meter', 'on', crouched); this.grassRow.flag('', 'on', crouched);
    const c = Math.round(this.cover * 100) / 100;
    if (c !== this.lastCover) {
      this.lastCover = c;
      this.layer.style('meterFill', 'transform', `scaleY(${c.toFixed(2)})`); this.grassRow.style('fill', 'transform', `scaleX(${c.toFixed(2)})`);
      this.layer.flag('meter', 'good', c >= HIDDEN_COVER); this.grassRow.flag('', 'good', c >= HIDDEN_COVER);
    }
    const th = Math.round(this.threat * 50) / 50;
    if (th !== this.lastThreat) { this.lastThreat = th; this.layer.style('pip', '--threat', th.toFixed(2)); this.row.style('', '--threat', th.toFixed(2)); }
    // the chevron: round the crosshair, pointing at the most aware creature
    const threatening = s === 'noticed' || s === 'detected';
    this.layer.flag('chev', 'on', threatening);
    if (threatening) {
      const p = this.player.position, yaw = this.player.yaw;
      const dx = this.threatX - p.x, dz = this.threatZ - p.z;
      const ax = dx * Math.cos(yaw) - dz * Math.sin(yaw), ay = -dx * Math.sin(yaw) - dz * Math.cos(yaw); // right / forward
      const a = Math.atan2(ax, ay);
      this.layer.style('chev', 'transform', `translate(${(Math.sin(a) * 64).toFixed(1)}px, ${(-Math.cos(a) * 64).toFixed(1)}px) rotate(${a.toFixed(3)}rad)`);
    }
    // the crouch disc (touch) and the one-time TALL GRASS chip
    const avail = this.canCrouch || this.latched;
    hudSlots.show(this.disc, avail);
    this.disc.classList.toggle('on', this.latched);
    if (avail && !this.hinted) {
      this.hinted = true;
      this.disc.classList.add('pulse');
      this.layer.flag('hint', 'on', true);
      const endHint = (): void => { this.layer.flag('hint', 'on', false); this.disc.classList.remove('pulse'); };
      this.scope.timeout(3200, endHint);
    }
  }
}

/** The shard owns eligibility and latch; the engine motor owns the crouch action. */
export function installStealth(ctx: LevelContext, opts: StealthOpts): Stealth {
  const stealth = new Stealth({ ...opts, ctx });
  ctx.inputContext({ id: 'stealth', actions: ['crouch', 'crouch.hold'], keys: { crouch: ['KeyC'], 'crouch.hold': ['ControlLeft', 'ControlRight'] } });
  ctx.app.input.push('stealth', ctx.scope);
  ctx.answer('player.crouch', (request) => stealth.answerCrouch(request));
  ctx.system({ id: 'shard.nalati.stealth.crouch', phase: 'input', before: ['engine.player.input'], run: (dt) => { stealth.crouchStep(Math.min(dt, 0.05)); } });
  ctx.debug.expose('nalati.stealth', stealth);
  return stealth;
}
