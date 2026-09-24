/**
 * TouchControls — on-screen first-person controls for coarse-pointer devices (phones, tablets).
 *
 *   const touch = new TouchControls(player, weapons);    // no-op on mouse/trackpad devices (`touch.active === false`)
 *
 * Layout E (E42, Jake's pick from art/hud/round-10-look-zone/board.jpg), split 45 / 55 (E46, corrected in E58 — Jake: "45%
 * movement, 55% is the right hand section … consists of both the attack and the look pad … the attack button can touch the
 * dividing line on the 55 side", not three equally spaced buttons), portrait, styled in
 * src/ui/styles/touch.css (prefix `ws-touch-`). A see-through glass control bar (67 % solid) runs across the bottom ~15 % of
 * the screen, split by a divider at 45 % (`--split`) into two thumb zones:
 *
 *  - MOVE (the bar's left 45 %): an anchored stick that is always drawn: a thin cyan ring with a glowing cyan knob resting
 *    at its centre, centred in the zone. A touch anywhere in the MOVE zone grabs it; the knob
 *    follows the thumb inside the ring. Pushing past SPRINT_AT while heading forward sprints: the ring's top arc lights and
 *    a SPRINT tag lights just above the bar over the stick. Not floating (declined in E11). The left 45 % above the bar is not a control surface.
 *  - LOOK (the bar's right 55 %, and the right 55 % of the screen above it — CoD Mobile free-look): dragging turns the
 *    camera and NEVER attacks. The LOOK pad (a dashed rounded square as wide as ATTACK, centred in the section's free part)
 *    is its visual, lit while a drag that started in the bar is looking.
 *  - ATTACK disc, in the LOOK section with its left edge on the divider, on the bar's centre line; a touch on the disc is
 *    ATTACK, never a look. Touch-down fires at once (`weapons.tryFire()`, the disc flashes); the disc then captures the touch, so a
 *    drag from it turns the camera while the finger is held. With a MELEE weapon (the Driftwood swords, `MELEE`, polled
 *    from `weapons.current.id`, the layer carries `.melee`), holding it still (under HOLD_PX of travel) for HOLD_MS starts
 *    the heavy charge (`weapons.adsHeld = true`, the `.ws-touch-charge` ring fills with `weapons.current.charge`) and lifting
 *    releases the chop (`adsHeld = false`; Sword.ts queues an early release). Only a lift or a cancel ends the hold — no
 *    pointerleave, so a thumb rolling off the disc's edge keeps the charge. A fast tap-tap-tap stays a light combo: each
 *    tap lifts before HOLD_MS. With a ranged weapon the same disc reads FIRE (fire on down, drag = look, no hold).
 *  - iOS WebKit (E46, Jake's iPhone): the layer cancels its own touch events (non-passive touchstart / touchmove /
 *    touchend), pinch gestures, dragstart / contextmenu / selectstart, and marks every element draggable="false"; with
 *    touch.css's touch-action / user-select / touch-callout / user-drag none on every element that kills the double-tap
 *    zoom, the text selection / loupe / callout and the drag-lift ghost of a long-pressed button, which had stolen the
 *    ATTACK hold (the heavy never charged). Pointer events still fire. The listeners sit on the layer only, which is
 *    hidden while the title / menus are up, so their taps (the build pill, the cards) keep their clicks.
 *  - Every look surface turns at ONE rate: LOOK_RATE × `player.lookMult` (Settings Look / Swing turn speed) × aim-assist
 *    friction — the old 1.6× LOOK-pad boost is gone (E37 audit F6), so a swipe turns the same wherever it starts.
 *  - Right-thumb arc, just above the bar at the right edge: DODGE (lower-left) and JUMP (upper-right), one size, in a short
 *    even diagonal (E63's T feel; the V DODGE disc beside it was deleted in E82).
 *    It sets `player.touchDodge` → Player.dodge (toward the stick, a backstep with it centred) and
 *    hides while swimming. Its cooldown (`player.dodgeCooldown`, E59) shows as a dark clock sweep unwinding over the disc
 *    (--cd), a cyan flash when it is back (.ready), and a tap before then only shakes the disc (.deny). While the player swims (`player.onSwimChange`) JUMP gives its spot to DIVE, a HELD button
 *    (`player.touchDive` → `player.diveHeld`); once the eye is under (`player.submerged`, polled) SURFACE appears in
 *    DODGE's spot (`player.touchSurface`, hold to come up) and hides again on surfacing.
 *  - LOCK shows while a weapon that locks is held (`.lockable` — LockOnTarget's LOCK_WEAPONS: the swords, Nalati's sabre and
 *    spear, NALATI-MERGE H3); in Nalati's saddle (`player.ride`, `.riding`) MOVE steers the horse, so it never reads ORBIT.
 *  - AIM (ranged kit only): the iron-sights toggle latch (`weapons.adsHeld`, tap on / tap off, lit `.on`) sits up-right of
 *    the FIRE disc, clear of the pill, left of DODGE, on the same thumb. Crossing between melee and ranged drops the latch, so a sword never
 *    comes up charging and a crossbow never comes up sighted.
 *  - SWAP: a pill over the divider, seated on the bar's top edge, just up-left of the ATTACK disc (its charge ring clear).
 *    It calls `weapons.swap()` (the Q key) and only shows once a second weapon is unlocked (`weapons.onUnlock`).
 *  - HOVER (E80, Jake's pick C, art/hud/round-11-hover-position/C-bar-tab-above-move.jpg): a folder tab on the bar's top
 *    edge above the MOVE label, a toggle (`player.setHover`, mirrors the H key; lit `.on` while riding).
 *  - PAUSE top-left; under it the `?perf` frame meter, then a status column (`.ws-touch-status`) that the HUD (HUD.ts) fills
 *    with the VITALS strip and, on ranged kit, the BOLTS readout — out of the thumb lane.
 *  - USE: a big band above the right-thumb arc, shown only while the HUD has an interact prompt; it dispatches the same
 *    `KeyE` the keyboard path listens for. There is no RELOAD: `weapons.tryFire()` reloads an empty weapon itself.
 *
 * During a sword lunge (`meleeLock.lunging`, AimTargets.ts) the view eases onto the locked animal — `lungeTurn`, behind
 * the aim-assist switch. Aim assist (AimAssist.ts — friction / snap-on-AIM / tracking, touch only, pause-menu switch): the
 * layer owns an `AimAssist`, feeds it every look drag, runs it from `player.preUpdate` every frame and scales the drag by
 * `assist.lookScale()`.
 *
 * Lock-on (E50, src/player/LockOnTarget.ts, project/archive/2026-09-23-lock-on.md): the LOCK disc (J — on the right-thumb arc up-left of DODGE,
 * melee only) toggles it; its states follow `lockOn.state` (off dim / available pulsing / LOCKED filled). While locked
 * every look drag (the LOOK side, the free-look area, a drag from ATTACK) is the ±10° glance that springs back, a FLICK on
 * the LOOK side (≥ 28 px at ≥ 600 px/s within 200 ms) switches target, the LOOK pad reads SWITCH ‹ ›, MOVE reads ORBIT
 * with an arc lit on the pushed side, and aim assist / the lunge turn stand down. A short tap on an enemy above the bar
 * locks it.
 * Talks to the player through `player.touchMove / touchSprint / touchJump / touchDodge / touchDive / touchSurface`
 * (analog, summed with WASD) and to the held weapon through the Weapons manager's `tryFire() / adsHeld / enabled / swap()`
 * (Weapons.ts). The layer only receives events once the intro is gone (`#hud.intro` hides it), and never needs pointer
 * lock — iOS has none.
 */
import type { Player } from './Player';
import type { WeaponId, Weapons } from './Weapons';
import { AimAssist } from './AimAssist';
import { lockOn, meleeLock } from './AimTargets';
import { FlickTracker, LOCK_WEAPONS, addLockOffset, type LockOnSystem } from './LockOnTarget';
import { getSetting } from '../ui/Settings';

export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const STICK_RADIUS = 48;      // px from base to full deflection — the ring's radius, so the knob's centre reaches the ring at full push
const DEADZONE = 0.12;
const SPRINT_AT = 0.85;
// ONE look rate on every surface (E42, audit F6 / R17): the free-look rate above the bar, 0.0095 rad/px (≈ 0.54°/px, a 200 px
// swipe turns ~110°). The LOOK pad's old 1.6× boost is dropped rather than applied everywhere: pointer capture lets a drag
// that starts in the bar run up the screen, so the pad no longer needs extra reach, and the Look speed slider scales it all.
const LOOK_RATE = 0.0095;
const HOLD_PX = 12;           // an ATTACK touch that travels less than this …
const HOLD_MS = 250;          // … and is still down after this starts the heavy charge (melee only)
const MELEE: ReadonlySet<WeaponId> = new Set<WeaponId>(['sword', 'sword-iron', 'sabre']); // ATTACK + hold-heavy (no AIM) while one of these is held (Nalati's sabre too)
/** Nalati's spear (Spear.ts): THROW (held, a javelin) takes AIM's spot and BRACE (held) takes JUMP's (combat-B mockup) */
const SPEAR: ReadonlySet<WeaponId> = new Set<WeaponId>(['spear']);
const LUNGE_TURN_RATE = 6;    // /s — exponential ease of the lunge camera turn (≈ 60 % of the bearing over a 0.15 s lunge)
const LUNGE_TURN_MAX = 150 * Math.PI / 180; // rad/s cap on it

/** a control the layer's own markup (above) must contain — a miss is a template typo, not a runtime state */
function el(parent: ParentNode, sel: string): HTMLElement {
  const e = parent.querySelector<HTMLElement>(sel);
  if (e === null) throw new Error(`TouchControls: missing ${sel}`);
  return e;
}

export class TouchControls {
  readonly active: boolean;
  private stickPointer = -1; private lookPointer = -1; private attackPointer = -1;
  private stickBase = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private attackLast = { x: 0, y: 0 }; private attackPath = 0; private attackT0 = 0; // the ATTACK touch: last spot, px travelled, start time
  private heavyHeld = false; // the ATTACK hold became a heavy charge (weapons.adsHeld is ours to release)
  private stick?: HTMLElement; private knob?: HTMLElement;
  readonly assist?: AimAssist;
  private lookFrameDist = 0; private lookSpeed = 0; // px dragged on any look surface since the last frame / smoothed px/s
  private wasSubmerged = false; // the SURFACE disc follows player.submerged
  private wasMelee = false; // the AIM disc hides while a melee weapon is held
  private chargeShown = -1; // the ATTACK disc's heavy ring (--charge) as last painted
  private cdShown = -1; // the DODGE disc's cooldown sweep (--cd) as last painted
  private lockShown = ''; private orbitShown = 0; // the lock-on state / the lit ORBIT arc as last painted (E50)
  private readonly flick = new FlickTracker(); private lookT0 = 0; private lookDown = { x: 0, y: 0 }; private lookInBar = false;
  private wasSpear = false; // THROW + BRACE replace AIM + JUMP while the spear is held
  private wasBow = false; // the AIM disc reads DRAW (and rings the draw) while Nalati's bow is held
  private wasLockable = false; // the LOCK disc shows while a weapon that locks is held (LOCK_WEAPONS: the swords, Nalati's sabre + spear)
  private wasRiding = false; // in Nalati's saddle MOVE steers the horse: it never reads ORBIT (`.riding`)
  private drawShown = -1; // the DRAW ring (--charge on AIM) as last painted

  constructor(private player: Player, private weapons: Weapons, force = false, private lock?: LockOnSystem) {
    this.active = force || IS_TOUCH;
    if (!this.active) return;
    const hud = document.getElementById('hud') ?? document.body;
    hud.classList.add('touch');
    const root = document.createElement('div');
    root.className = 'ws-touch';
    root.innerHTML = `
      <button class="ws-touch-use" type="button">Use</button>
      <div class="ws-touch-status"></div>
      <button class="ws-touch-disc aim" type="button"><i class="ws-touch-charge"></i><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="1.4"/><path d="M12 1.5v4.5M12 18v4.5M1.5 12H6M18 12h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Aim</span></button>
      <button class="ws-touch-disc lock" type="button"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 1.8v4.4M12 17.8v4.4M1.8 12h4.4M17.8 12h4.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="12" r="2.1"/></svg><span>Lock</span></button>
      <button class="ws-touch-disc dodge" type="button"><i class="ws-touch-cd"></i><svg viewBox="0 0 24 24"><path d="M5 5.5 11.5 12 5 18.5M12.5 5.5 19 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Dodge</span></button>
      <button class="ws-touch-disc throw" type="button"><svg viewBox="0 0 24 24"><path d="M4 20 18.5 5.5M13 5h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20l2.5-5.5L9.5 17.5z"/></svg><span>Throw</span></button>
      <button class="ws-touch-disc brace" type="button"><svg viewBox="0 0 24 24"><path d="M9 3.5 3.5 5.5v5c0 4 2.4 6.6 5.5 8 3.1-1.4 5.5-4 5.5-8v-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 21 21 3.5M16 3.5h5v5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Brace</span></button>
      <button class="ws-touch-disc jump" type="button"><svg viewBox="0 0 24 24"><path d="M12 2.5 4 11h5v10.5h6V11h5z"/></svg><span>Jump</span></button>
      <button class="ws-touch-disc surface" type="button"><svg viewBox="0 0 24 24"><path d="M12 21.5V9M7.5 13.5 12 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 5.5c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Surface</span></button>
      <button class="ws-touch-disc dive" type="button"><svg viewBox="0 0 24 24"><path d="M12 2v11.5M7.5 9.5 12 14l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 18.5c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 22c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg><span>Dive</span></button>
      <button class="ws-touch-pause" type="button">Pause</button>
      <div class="ws-touch-bar">
        <div class="ws-touch-zone move"><span class="ws-touch-label">Move</span><div class="ws-touch-stick"><i></i></div><u class="ws-touch-orbit"><i></i><i></i></u><b class="ws-touch-sprint">Sprint</b></div>
        <div class="ws-touch-zone look"><div class="ws-touch-lookpad"><svg viewBox="0 0 24 24"><path d="M12 2.5 15.2 6.5H8.8zM12 21.5 8.8 17.5h6.4zM2.5 12 6.5 8.8v6.4zM21.5 12 17.5 15.2V8.8z"/></svg><svg class="sw" viewBox="0 0 24 24"><path d="M8.5 5.5 3 12l5.5 6.5M15.5 5.5 21 12l-5.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Look</span></div></div>
      </div>
      <button class="ws-touch-attack" type="button"><i class="ws-touch-charge"></i><svg class="melee" viewBox="0 0 24 24"><path d="M20.5 3.5 9.2 14.8M20.5 3.5l-.6 4.2M20.5 3.5l-4.2.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.6 12.2l5.2 5.2M8.4 15.6 4 20" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg><svg class="ranged" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="melee">Attack</span><span class="ranged">Fire</span><small class="melee">Hold = heavy</small></button>
      <div class="ws-touch-pill"><button class="swap" type="button">Swap</button></div>
      <button class="ws-touch-hover" type="button"><svg viewBox="0 0 24 24"><path d="M2.5 13.5h19c0 1.7-1.3 2.5-3 2.5H5.5c-1.7 0-3-.8-3-2.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 16v2.5M17 16v2.5M6 10.5c1.8-3.2 10.2-3.2 12 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Hover</span></button>`;
    hud.append(root);
    // ── iOS WebKit hardening (E46 — Jake's iPhone): a long press on a button lifted a drag preview of the ATTACK disc (and
    //    fired pointercancel, so the heavy never charged), a quick double tap zoomed, a press selected text. Pointer events
    //    still fire when the touch events are cancelled, so: cancel every touch on the layer (kills double-tap zoom, the
    //    long-press selection / callout / loupe / drag lift), no pinch, nothing draggable, no context menu or selection.
    //    touch.css adds touch-action: none + user-select / touch-callout / user-drag none on every element of the layer. ──
    const cancel = (e: Event): void => { if (e.cancelable) e.preventDefault(); };
    for (const t of ['touchstart', 'touchmove', 'touchend'] as const) root.addEventListener(t, cancel, { passive: false });
    for (const t of ['dragstart', 'contextmenu', 'selectstart'] as const) root.addEventListener(t, cancel);
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, cancel, { passive: false });
    for (const n of root.querySelectorAll('*')) n.setAttribute('draggable', 'false');
    const stick = this.stick = el(root, '.ws-touch-stick');
    this.knob = el(stick, 'i');
    const moveZone = el(root, '.ws-touch-zone.move'), lookpad = el(root, '.ws-touch-lookpad');
    const lockBtn = el(root, '.ws-touch-disc.lock'), lockLabel = el(lockBtn, 'span'), lookLabel = el(lookpad, 'span'), moveLabel = el(moveZone, '.ws-touch-label');

    // ── aim assist: runs at the top of every player update (before the camera is posed) so a nudge shows the same frame ──
    const assist = this.assist = new AimAssist(root);
    const aim = el(root, '.aim'), attack = el(root, '.ws-touch-attack'), dodge = el(root, '.dodge'), aimLabel = el(aim, 'span');
    const prevPre = player.preUpdate;
    player.preUpdate = (dt) => {
      prevPre?.(dt);
      const speed = dt > 0 ? this.lookFrameDist / dt : 0; this.lookFrameDist = 0;
      this.lookSpeed += (speed - this.lookSpeed) * Math.min(1, dt * 15);
      if (weapons.enabled && lockOn.state !== 'locked') assist.update(dt, player, weapons.adsHeld, this.lookSpeed); // locked (E50): the lock aims, not the assist
      // AIM (ranged latch) and the ATTACK hold-heavy (melee) share `weapons.adsHeld`; crossing between the two drops it, so a
      // sword never comes up charging and a crossbow never comes up sighted from the other's latch
      const melee = MELEE.has(weapons.current.id), spear = SPEAR.has(weapons.current.id);
      if (melee !== this.wasMelee || spear !== this.wasSpear) {
        this.wasMelee = melee; this.wasSpear = spear; root.classList.toggle('melee', melee); root.classList.toggle('spear', spear);
        if (weapons.adsHeld) weapons.adsHeld = false;
        if (weapons.altHeld) weapons.altHeld = false;
        this.heavyHeld = false;
        aim.classList.remove('on'); attack.classList.remove('on');
      }
      const lockable = LOCK_WEAPONS.has(weapons.current.id), riding = player.ride !== null;
      if (lockable !== this.wasLockable) { this.wasLockable = lockable; root.classList.toggle('lockable', lockable); }
      if (riding !== this.wasRiding) { this.wasRiding = riding; root.classList.toggle('riding', riding); this.lockShown = ''; }
      const bow = weapons.current.id === 'bow';
      if (bow !== this.wasBow) { this.wasBow = bow; root.classList.toggle('bow', bow); aimLabel.textContent = bow ? 'Draw' : 'Aim'; }
      if (bow) { const c = weapons.current.charge ?? 0; if (c !== this.drawShown) { this.drawShown = c; aim.style.setProperty('--charge', c.toFixed(3)); } }
      if (melee) {
        // ATTACK held still past HOLD_MS → the heavy charge (released on lift). A fast tap lifts first and stays a light swing.
        if (this.attackPointer >= 0 && !this.heavyHeld && weapons.enabled && this.attackPath < HOLD_PX && performance.now() - this.attackT0 >= HOLD_MS) {
          this.heavyHeld = true; weapons.adsHeld = true; attack.classList.add('on');
        }
        const c = weapons.current.charge ?? 0;
        if (c !== this.chargeShown) { this.chargeShown = c; attack.style.setProperty('--charge', c.toFixed(3)); attack.classList.toggle('ready', c >= 1); }
        if (lockOn.state !== 'locked') this.lungeTurn(dt); // locked: the lock's camera track already faces the target
      }
      // lock-on (E50): LOCK's three states (off dim / available pulse / LOCKED filled), SWITCH on the LOOK pad, ORBIT on MOVE
      const ls = lockOn.state;
      if (ls !== this.lockShown) {
        this.lockShown = ls;
        root.classList.toggle('lock-available', ls === 'available'); root.classList.toggle('locked', ls === 'locked');
        lockLabel.textContent = ls === 'locked' ? 'Locked' : 'Lock'; lookLabel.textContent = ls === 'locked' ? 'Switch' : 'Look'; moveLabel.textContent = ls === 'locked' && !riding ? 'Orbit' : 'Move';
      }
      const orbit = ls === 'locked' && !riding ? Math.sign(Math.round(player.touchMove.x * 3) / 3) : 0;
      if (orbit !== this.orbitShown) { this.orbitShown = orbit; root.classList.toggle('orbit-l', orbit < 0); root.classList.toggle('orbit-r', orbit > 0); }
      // DODGE cooldown (E59): a dark clock sweep unwinds over the disc (--cd 1 → 0) and it flashes .ready when it is back
      const cd = Math.round(player.dodgeCooldown * 100) / 100;
      if (cd !== this.cdShown) {
        if (cd === 0 && this.cdShown > 0) { dodge.classList.remove('ready'); void dodge.offsetWidth; dodge.classList.add('ready'); }
        dodge.style.setProperty('--cd', String(cd)); dodge.classList.toggle('cooling', cd > 0);
        this.cdShown = cd;
      }
      if (player.submerged !== this.wasSubmerged) { this.wasSubmerged = player.submerged; root.classList.toggle('submerged', player.submerged); if (!player.submerged) player.touchSurface = false; }
    };

    // ── stick + look: pointer events on the layer itself (buttons stop propagation; ATTACK hands its touch back via capture) ──
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !force) return;
      const zone = moveZone.getBoundingClientRect();
      const inBar = e.clientY >= zone.top, inMove = inBar && e.clientX <= zone.right;
      if (!inBar && e.clientX <= zone.right) return; // above the bar on the left: not a control surface
      if (inMove && this.stickPointer < 0) {
        this.stickPointer = e.pointerId;
        // the stick is anchored (its ring's centre, left of the ATTACK disc); a touch anywhere in the MOVE zone grabs it
        const ring = stick.getBoundingClientRect();
        this.stickBase = { x: ring.left + ring.width / 2, y: ring.top + ring.height / 2 };
        stick.classList.add('held');
        this.applyStick(e.clientX - this.stickBase.x, e.clientY - this.stickBase.y);
      } else if (!inMove && this.lookPointer < 0) {
        // the whole right 55 % looks (the bar's LOOK section, the screen above it) — and never attacks. A drag that starts in
        // the bar lights the LOOK pad while it lasts.
        this.lookPointer = e.pointerId;
        this.lookLast = { x: e.clientX, y: e.clientY };
        this.lookDown = { x: e.clientX, y: e.clientY }; this.lookT0 = performance.now(); this.lookInBar = inBar;
        this.flick.begin(e.clientX, e.clientY, this.lookT0);
        lookpad.classList.toggle('active', inBar);
      } else return;
      root.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPointer) {
        this.applyStick(e.clientX - this.stickBase.x, e.clientY - this.stickBase.y);
      } else if (e.pointerId === this.lookPointer) {
        // locked (E50 §2.5): a flick switches target, anything slower is the glance
        const f = lockOn.state === 'locked' ? this.flick.move(e.clientX, e.clientY, performance.now()) : null;
        if (f !== null) this.lock?.flick(f);
        else this.look(e.clientX - this.lookLast.x, e.clientY - this.lookLast.y);
        this.lookLast = { x: e.clientX, y: e.clientY };
      } else if (e.pointerId === this.attackPointer) {
        const dx = e.clientX - this.attackLast.x, dy = e.clientY - this.attackLast.y;
        this.attackLast = { x: e.clientX, y: e.clientY };
        this.attackPath += Math.hypot(dx, dy);
        this.look(dx, dy);
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.stickPointer) {
        this.stickPointer = -1;
        stick.classList.remove('held');
        this.player.touchMove.x = this.player.touchMove.y = 0;
        this.player.touchSprint = false;
        stick.classList.remove('sprint');
        this.showKnob(0, 0);
      } else if (e.pointerId === this.lookPointer) {
        this.lookPointer = -1;
        lookpad.classList.remove('active');
        // a short tap on an enemy above the bar locks it (E50 L11) — the look area never attacks, so a tap there is free
        if (e.type === 'pointerup' && !this.lookInBar && performance.now() - this.lookT0 < 220 && Math.hypot(e.clientX - this.lookDown.x, e.clientY - this.lookDown.y) < 12) this.lock?.tapLock(e.clientX, e.clientY);
      } else if (e.pointerId === this.attackPointer) {
        this.attackPointer = -1;
        attack.classList.remove('down');
        // lifting a heavy hold releases the chop (Sword.ts queues it if the charge is not full yet)
        if (this.heavyHeld) { this.heavyHeld = false; this.weapons.adsHeld = false; attack.classList.remove('on'); }
      }
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);

    // ── ATTACK / FIRE: fires on touch-down; the disc then captures the touch (its move / up events bubble to the layer's
    //    handlers above), so a drag from it turns the camera while the finger is held and a still hold (melee) becomes the
    //    heavy — see preUpdate. Only a lift (pointerup) or a cancel ends it: no pointerleave, so a thumb rolling off the
    //    disc's edge keeps the charge, and a lost capture doesn't end it either. ──
    attack.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (e.pointerType === 'mouse' && !force) return;
      if (this.attackPointer >= 0) return; // one finger on the disc at a time
      this.attackPointer = e.pointerId;
      this.attackLast = { x: e.clientX, y: e.clientY }; this.attackPath = 0; this.attackT0 = performance.now();
      attack.setPointerCapture(e.pointerId);
      attack.classList.add('down');
      if (this.weapons.enabled) {
        this.weapons.tryFire();
        attack.classList.remove('fire'); void attack.offsetWidth; attack.classList.add('fire'); // restart the swing flash
      }
    });

    // ── buttons ──
    const btn = (sel: string, down: () => void, up?: () => void) => {
      const b = el(root, sel);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); b.classList.add('down'); down(); });
      const end = (e: Event) => { e.stopPropagation(); b.classList.remove('down'); up?.(); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('pointerleave', end);
    };
    // AIM (ranged only) is a toggle, not a hold: each press flips the iron-sights latch and the disc stays lit (.on) while latched
    aim.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.weapons.adsHeld = !this.weapons.adsHeld; aim.classList.toggle('on', this.weapons.adsHeld); });
    aim.addEventListener('pointerup', (e) => e.stopPropagation());
    // LOCK (E50, the J disc): a toggle — lock the enemy nearest the centre, tap again to release; with nothing lockable it
    // flashes NO TARGET and the view re-levels (LockOnTarget.toggle)
    btn('.ws-touch-disc.lock', () => { if (this.weapons.enabled) this.lock?.toggle(); });
    if (this.lock) {
      const prevNone = this.lock.onNoTarget;
      this.lock.onNoTarget = () => { prevNone?.(); lockBtn.classList.remove('none'); void lockBtn.offsetWidth; lockBtn.classList.add('none'); lockLabel.textContent = 'No target'; setTimeout(() => { if (lockOn.state !== 'locked') lockLabel.textContent = 'Lock'; }, 700); };
    }
    // DODGE (Player.dodge, docs/plans/DODGE-FEEL.md — E63's T feel, V deleted in E82). A tap during the cooldown only
    // shakes the disc (.deny) — no dodge is queued (E59)
    {
      const d = el(root, '.dodge');
      btn('.dodge', () => {
        if (!this.weapons.enabled) return;
        if (this.player.dodgeCooldown > 0) { d.classList.remove('deny'); void d.offsetWidth; d.classList.add('deny'); return; }
        this.player.touchDodge = true;
      });
    }
    // SWAP: crossbow ⇄ rifle (Weapons.swap, the Q key); the pill flashes .down while pressed, nothing latches. Hidden until a
    // second weapon is unlocked (the AR-15 pickup — Weapons.onUnlock)
    btn('.swap', () => { if (this.weapons.enabled) this.weapons.swap(); });
    const swapPill = el(root, '.ws-touch-pill');
    const syncSwap = () => swapPill.classList.toggle('show', this.weapons.available.length > 1);
    const prevUnlock = this.weapons.onUnlock;
    this.weapons.onUnlock = (id) => { syncSwap(); prevUnlock?.(id); };
    syncSwap();
    // HOVER (the tab over MOVE, E80) is a toggle too; the H key flips the same state, so the lit look follows the player, not the button
    const hover = el(root, '.ws-touch-hover');
    hover.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.player.setHover(!this.player.hover); });
    hover.addEventListener('pointerup', (e) => e.stopPropagation());
    const prevHover = this.player.onHoverChange;
    this.player.onHoverChange = (on) => { hover.classList.toggle('on', on); prevHover?.(on); };
    hover.classList.toggle('on', this.player.hover);
    btn('.jump', () => { this.player.touchJump = true; });
    // the spear (Nalati): THROW = hold to wind a javelin up, release to throw; BRACE = hold to plant the spear (Spear.ts)
    btn('.throw', () => { if (this.weapons.enabled) this.weapons.adsHeld = true; }, () => { this.weapons.adsHeld = false; });
    btn('.brace', () => { if (this.weapons.enabled) this.weapons.altHeld = true; }, () => { this.weapons.altHeld = false; });
    // DIVE replaces JUMP while swimming: a held control (down = held), released on up / cancel / leave
    btn('.dive', () => { this.player.touchDive = true; }, () => { this.player.touchDive = false; });
    const prevSwim = this.player.onSwimChange;
    this.player.onSwimChange = (on) => { root.classList.toggle('swimming', on); if (!on) { this.player.touchDive = false; this.player.touchSurface = false; root.classList.remove('submerged'); } prevSwim?.(on); };
    root.classList.toggle('swimming', this.player.swimming);
    // SURFACE appears beside DIVE (in DODGE's spot; DODGE hides while swimming) while the eye is under (held: up = release); it goes with the swim state on climb-out.
    // Polled from `player.submerged` every frame (in preUpdate above) rather than hooked on onSubmerge / onSurface, so
    // main.ts can assign those callbacks freely (audio) without having to chain ours.
    btn('.surface', () => { this.player.touchSurface = true; }, () => { this.player.touchSurface = false; });
    root.classList.toggle('submerged', this.player.submerged);
    btn('.ws-touch-pause', () => { document.dispatchEvent(new Event('ws:pause')); });
    btn('.ws-touch-use', () => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })); });
    // the interact prompt ("[E] Open door") becomes a big USE band above the right-thumb arc, labelled with the action
    const use = el(root, '.ws-touch-use');
    const bindPrompt = (prompt: HTMLElement) => {
      const sync = () => {
        const on = prompt.classList.contains('show');
        use.classList.toggle('show', on);
        if (on) use.textContent = prompt.textContent.replace(/^[A-Z]\s*/, '').trim() || 'Use';
      };
      new MutationObserver(sync).observe(prompt, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
      sync();
    };
    // the HUD may be built after this layer (main.ts order) — wait for the prompt element to appear
    const found = hud.querySelector<HTMLElement>('.ws-game-prompt');
    if (found) bindPrompt(found);
    else {
      const mo = new MutationObserver(() => { const p = hud.querySelector<HTMLElement>('.ws-game-prompt'); if (p) { mo.disconnect(); bindPrompt(p); } });
      mo.observe(hud, { childList: true });
    }
  }

  /** during a sword lunge, ease the view onto the locked animal: ~60 % of the bearing over the dash, capped — touch only,
   *  behind the aim-assist switch (mouse aim is never moved for you) */
  private lungeTurn(dt: number): void {
    const t = meleeLock.target;
    if (!meleeLock.lunging || t === null || !getSetting('aimAssist')) return;
    const p = this.player.position;
    let d = Math.atan2(-(t.position.x - p.x), -(t.position.z - p.z)) - this.player.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d)); // wrap to ±π
    const step = d * (1 - Math.exp(-dt * LUNGE_TURN_RATE)), cap = LUNGE_TURN_MAX * dt;
    this.player.yaw += Math.max(-cap, Math.min(cap, step));
  }

  private applyStick(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy);
    const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0; // direction from the raw delta
    const mag = Math.min(1, len / STICK_RADIUS);
    const scaled = mag < DEADZONE ? 0 : (mag - DEADZONE) / (1 - DEADZONE);
    let kx = dx, ky = dy;
    if (len > STICK_RADIUS) { kx *= STICK_RADIUS / len; ky *= STICK_RADIUS / len; } // knob stays on the ring
    this.player.touchMove.x = nx * scaled;
    this.player.touchMove.y = -ny * scaled;
    this.player.touchSprint = mag > SPRINT_AT && -ny > 0.5;
    this.stick?.classList.toggle('sprint', this.player.touchSprint); // the ring's top arc + the SPRINT tick light
    this.showKnob(kx, ky);
  }

  /** the knob inside the always-drawn ring: follows the thumb while held, back at the centre on release */
  private showKnob(dx: number, dy: number): void {
    if (this.knob !== undefined) this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  /** a look drag from any surface (the LOOK section, the right 55 % above the bar, an ATTACK drag): one rate × Look speed × aim-assist friction */
  private look(dx: number, dy: number): void {
    if (lockOn.state === 'locked') { const r = LOOK_RATE * this.player.lookMult; addLockOffset(-dx * r, -dy * r); return; } // locked (E50): a glance, not a turn
    this.lookFrameDist += Math.hypot(dx, dy);
    this.assist?.noteLook(dx, dy);
    const rate = LOOK_RATE * this.player.lookMult * (this.assist?.lookScale() ?? 1);
    this.player.yaw -= dx * rate;
    this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - dy * rate));
  }
}
