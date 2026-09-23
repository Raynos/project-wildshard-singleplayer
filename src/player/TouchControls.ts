/**
 * TouchControls — on-screen first-person controls for coarse-pointer devices (phones, tablets).
 *
 *   const touch = new TouchControls(player, weapons);    // no-op on mouse/trackpad devices (`touch.active === false`)
 *
 * Layout (styled in src/ui/styles/touch.css, prefix `ws-touch-`): a glass control bar across the bottom ~15 % of the screen, split into
 * a MOVE zone (left, anchored stick: push past 85 % while heading forward = sprint) and a LOOK zone (right, drag
 * pad — a TAP on the look pad, under 12 px and 300 ms, fires; a drag only looks). Round glass discs sit above the bar
 * (K1 mockup): AIM over the MOVE pad, JUMP over the LOOK pad, a smaller HOVER between them (AIM and HOVER are toggles:
 * tap to latch, tap again to release — HOVER steps on / off the hoverboard, `player.setHover`, and mirrors the H key).
 * AIM only shows for a ranged weapon: while a melee weapon is held (the Driftwood swords — `MELEE`, polled from
 * `weapons.current.id`) the layer carries `.melee` and a HEAVY disc takes AIM's spot on the same latch (`weapons.adsHeld`:
 * tap = charge, tap again = release; its ring fills with `weapons.current.charge`). Crossing between the two drops the latch.
 * DODGE (a smaller disc above-left of JUMP, hidden while swimming) sets `player.touchDodge` → Player.dodge (toward the
 * stick, a backstep with it centred). During a sword lunge (`meleeLock.lunging`, AimTargets.ts) the view eases onto the
 * locked animal — `lungeTurn`, behind the aim-assist switch. Mockups: art/hud/round-7-sword-touch/.
 * LOOK covers the whole right half of the screen (above the bar too — CoD Mobile free-look); only a touch that starts
 * inside the LOOK pad can tap-fire. Every look drag is scaled by `player.lookMult` (Settings Look / Swing turn speed).
 * While the player swims (`player.onSwimChange`) JUMP is swapped for a DIVE disc in the same spot — a HELD button that
 * drives `player.touchDive` → `player.diveHeld` (hold to go down). Once the eye is under (`player.submerged`, polled)
 * a SURFACE disc appears beside it (`player.touchSurface` → `player.surfaceHeld`, hold to come up) and hides again on
 * surfacing. There is no other vertical control in the water.
 * A SWAP pill mirrors HOVER on the LEFT edge: it calls `weapons.swap()` (crossbow ⇄ AR-15, the Q key); it only shows once a
 * second weapon is unlocked (`weapons.onUnlock` — the AR-15 is a cabin pickup).
 * There is no RELOAD: `weapons.tryFire()` reloads the held weapon itself when it is fired empty. USE is a big button above the
 * discs, shown only while the HUD has an interact prompt; it dispatches the same `KeyE` the keyboard path listens for.
 * The HUD (HUD.ts) mounts the VITALS / BOLTS strips into the bar's top corners (`.ws-game-vitals` / `.ws-game-bolts`).
 * Move touches are only taken inside the bar's MOVE zone; look touches anywhere on the right half; the left half above the bar is not a control surface.
 *
 * Aim assist (AimAssist.ts — friction / snap-on-AIM / tracking, touch only, pause-menu switch): the layer owns an
 * `AimAssist`, feeds it the LOOK-pad drag, runs it from `player.preUpdate` every frame and scales the drag by
 * `assist.lookScale()`.
 *
 * Talks to the player through `player.touchMove / touchSprint / touchJump` (analog, summed with WASD) and to
 * the held weapon through the Weapons manager's `tryFire() / adsHeld / enabled` (Weapons.ts). The layer only receives events once the
 * intro is gone (`#hud.intro` hides it), and never needs pointer lock — iOS has none.
 */
import type { Player } from './Player';
import type { WeaponId, Weapons } from './Weapons';
import { AimAssist } from './AimAssist';
import { meleeLock } from './AimTargets';
import { getSetting } from '../ui/Settings';

export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const STICK_RADIUS = 48;      // px from base to full deflection
const DEADZONE = 0.12;
const SPRINT_AT = 0.85;
const LOOK_RATE = 0.0095;     // rad per px (≈ 0.54°/px; a 200 px swipe turns ~110°)
const PAD_BOOST = 1.6;        // the LOOK pad in the bar is small — a thumb's travel there is worth more
const TAP_PX = 12;            // a look-pad touch that travels less than this …
const TAP_MS = 300;           // … and ends within this is a tap = fire
const MELEE: ReadonlySet<WeaponId> = new Set<WeaponId>(['sword', 'sword-iron', 'sabre']); // HEAVY instead of AIM while one of these is held
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
  private stickPointer = -1; private lookPointer = -1;
  private stickBase = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 }; private lookRate = LOOK_RATE;
  private lookPath = 0; private lookT0 = 0; // tap-to-fire: distance travelled + start time of the look touch
  private stick?: HTMLElement; private knob?: HTMLElement;
  readonly assist?: AimAssist;
  private lookFrameDist = 0; private lookSpeed = 0; // px moved on the LOOK pad since the last frame / smoothed px/s
  private wasSubmerged = false; // the SURFACE disc follows player.submerged
  private wasMelee = false; // the AIM disc hides while a melee weapon is held
  private wasSpear = false; // THROW + BRACE replace AIM + JUMP while the spear is held
  private chargeShown = -1; // the HEAVY disc's ring (--charge) as last painted
  private lookInPad = true; // the look touch started in the LOOK pad (only those may tap-fire)

  constructor(private player: Player, private weapons: Weapons, force = false) {
    this.active = force || IS_TOUCH;
    if (!this.active) return;
    const hud = document.getElementById('hud') ?? document.body;
    hud.classList.add('touch');
    const root = document.createElement('div');
    root.className = 'ws-touch';
    root.innerHTML = `
      <div class="ws-touch-stick"><i></i></div>
      <button class="ws-touch-use" type="button">Use</button>
      <button class="ws-touch-disc aim" type="button"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="12" r="1.4"/><path d="M12 1.5v4.5M12 18v4.5M1.5 12H6M18 12h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span>Aim</span></button>
      <button class="ws-touch-disc heavy" type="button"><i class="ws-touch-charge"></i><svg viewBox="0 0 24 24"><path d="M12 1.5v14M9 12.5h6M12 15.5v2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 17.5l3 2.5M19 17.5l-3 2.5M12 21v1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.75"/></svg><span>Heavy</span></button>
      <button class="ws-touch-disc dodge" type="button"><svg viewBox="0 0 24 24"><path d="M5 5.5 11.5 12 5 18.5M12.5 5.5 19 12l-6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Dodge</span></button>
      <button class="ws-touch-disc swap" type="button"><svg viewBox="0 0 24 24"><path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H7M10.5 12.5 7 16l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Swap</span></button>
      <button class="ws-touch-disc hover" type="button"><svg viewBox="0 0 24 24"><path d="M2 9.5c0-1.4 1.1-2.5 2.5-2.5h15c1.4 0 2.5 1.1 2.5 2.5S20.9 12 19.5 12h-15C3.1 12 2 10.9 2 9.5z"/><path d="M6 15.5h12M8.5 19h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/></svg><span>Hover</span></button>
      <button class="ws-touch-disc throw" type="button"><svg viewBox="0 0 24 24"><path d="M4 20 18.5 5.5M13 5h6v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20l2.5-5.5L9.5 17.5z"/></svg><span>Throw</span></button>
      <button class="ws-touch-disc brace" type="button"><svg viewBox="0 0 24 24"><path d="M9 3.5 3.5 5.5v5c0 4 2.4 6.6 5.5 8 3.1-1.4 5.5-4 5.5-8v-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 21 21 3.5M16 3.5h5v5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Brace</span></button>
      <button class="ws-touch-disc jump" type="button"><svg viewBox="0 0 24 24"><path d="M12 2.5 4 11h5v10.5h6V11h5z"/></svg><span>Jump</span></button>
      <button class="ws-touch-disc surface" type="button"><svg viewBox="0 0 24 24"><path d="M12 21.5V9M7.5 13.5 12 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 5.5c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Surface</span></button>
      <button class="ws-touch-disc dive" type="button"><svg viewBox="0 0 24 24"><path d="M12 2v11.5M7.5 9.5 12 14l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 18.5c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 22c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg><span>Dive</span></button>
      <button class="ws-touch-pause" type="button">Pause</button>
      <div class="ws-touch-bar">
        <div class="ws-touch-zone move"><u></u><span class="ws-touch-label">Move</span></div>
        <div class="ws-touch-zone look"><u></u><span class="ws-touch-label">Look</span></div>
      </div>`;
    hud.append(root);
    const stick = this.stick = el(root, '.ws-touch-stick');
    this.knob = el(stick, 'i');
    const moveZone = el(root, '.ws-touch-zone.move');

    // ── aim assist: runs at the top of every player update (before the camera is posed) so a nudge shows the same frame ──
    const assist = this.assist = new AimAssist(root);
    const aim = el(root, '.aim'), heavy = el(root, '.heavy');
    const prevPre = player.preUpdate;
    player.preUpdate = (dt) => {
      prevPre?.(dt);
      const speed = dt > 0 ? this.lookFrameDist / dt : 0; this.lookFrameDist = 0;
      this.lookSpeed += (speed - this.lookSpeed) * Math.min(1, dt * 15);
      if (weapons.enabled) assist.update(dt, player, weapons.adsHeld, this.lookSpeed);
      // AIM (ranged) ⇄ HEAVY (melee) share the one latch (`weapons.adsHeld`); crossing between the two drops it, so a sword
      // never comes up charging and a crossbow never comes up sighted from the other's latch
      const melee = MELEE.has(weapons.current.id), spear = SPEAR.has(weapons.current.id);
      if (melee !== this.wasMelee || spear !== this.wasSpear) {
        this.wasMelee = melee; this.wasSpear = spear; root.classList.toggle('melee', melee); root.classList.toggle('spear', spear);
        if (weapons.adsHeld) weapons.adsHeld = false;
        if (weapons.altHeld) weapons.altHeld = false;
        aim.classList.remove('on'); heavy.classList.remove('on');
      }
      if (melee) {
        const c = weapons.current.charge ?? 0;
        if (c !== this.chargeShown) { this.chargeShown = c; heavy.style.setProperty('--charge', c.toFixed(3)); heavy.classList.toggle('ready', c >= 1); }
        this.lungeTurn(dt);
      }
      if (player.submerged !== this.wasSubmerged) { this.wasSubmerged = player.submerged; root.classList.toggle('submerged', player.submerged); if (!player.submerged) player.touchSurface = false; }
    };

    // ── stick + look: pointer events on the layer itself (buttons stop propagation) ──
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !force) return;
      const zone = moveZone.getBoundingClientRect();
      const inBar = e.clientY >= zone.top, inMove = inBar && e.clientX <= zone.right;
      if (!inBar && e.clientX <= zone.right) return; // above the bar on the left: not a control surface
      if (inMove && this.stickPointer < 0) {
        this.stickPointer = e.pointerId;
        // the stick is anchored at the MOVE zone's centre; a touch anywhere in the zone grabs it
        this.stickBase = { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 };
        this.showStick(this.stickBase.x, this.stickBase.y, 0, 0);
        this.applyStick(e.clientX - this.stickBase.x, e.clientY - this.stickBase.y);
      } else if (!inMove && this.lookPointer < 0) {
        this.lookPointer = e.pointerId;
        this.lookLast = { x: e.clientX, y: e.clientY };
        // the whole right half looks (CoD Mobile free-look); only a touch that starts in the LOOK pad can tap-fire, and only
        // the pad (small travel) gets the boost
        this.lookInPad = inBar;
        this.lookRate = inBar ? LOOK_RATE * PAD_BOOST : LOOK_RATE;
        this.lookPath = 0; this.lookT0 = performance.now();
      } else return;
      root.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPointer) {
        this.applyStick(e.clientX - this.stickBase.x, e.clientY - this.stickBase.y);
      } else if (e.pointerId === this.lookPointer) {
        const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
        this.lookLast = { x: e.clientX, y: e.clientY };
        this.lookPath += Math.hypot(dx, dy); this.lookFrameDist += Math.hypot(dx, dy);
        this.assist?.noteLook(dx, dy);
        const rate = this.lookRate * this.player.lookMult * (this.assist?.lookScale() ?? 1); // Look speed setting × aim-assist friction near an animal
        this.player.yaw -= dx * rate;
        this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - dy * rate));
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.stickPointer) {
        this.stickPointer = -1;
        this.player.touchMove.x = this.player.touchMove.y = 0;
        this.player.touchSprint = false;
        stick.classList.remove('show');
      } else if (e.pointerId === this.lookPointer) {
        this.lookPointer = -1;
        // a tap on the look pad (barely moved, quick) fires; a drag only looked. Cancelled touches never fire.
        if (e.type === 'pointerup' && this.lookInPad && this.lookPath < TAP_PX && performance.now() - this.lookT0 < TAP_MS && this.weapons.enabled) this.weapons.tryFire();
      }
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // ── buttons ──
    const btn = (sel: string, down: () => void, up?: () => void) => {
      const b = el(root, sel);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); b.classList.add('down'); down(); });
      const end = (e: Event) => { e.stopPropagation(); b.classList.remove('down'); up?.(); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('pointerleave', end);
    };
    // AIM (ranged) and HEAVY (melee) are toggles, not holds: each press flips the latch and the disc stays lit (.on) while it
    // is latched — AIM = iron sights, HEAVY = charging (tap again to release the chop; Sword.ts queues an early release)
    for (const d of [aim, heavy]) {
      d.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.weapons.adsHeld = !this.weapons.adsHeld; d.classList.toggle('on', this.weapons.adsHeld); });
      d.addEventListener('pointerup', (e) => e.stopPropagation());
    }
    // DODGE: a tap dashes toward the MOVE stick's direction (straight back with the stick centred) — Player.dodge, like Left Alt
    btn('.dodge', () => { if (this.weapons.enabled) this.player.touchDodge = true; });
    // SWAP: crossbow ⇄ rifle (Weapons.swap, the Q key); the pill flashes .down while pressed, nothing latches. Hidden until a
    // second weapon is unlocked (the AR-15 pickup — Weapons.onUnlock)
    btn('.swap', () => { if (this.weapons.enabled) this.weapons.swap(); });
    const swap = el(root, '.swap');
    const syncSwap = () => swap.classList.toggle('show', this.weapons.available.length > 1);
    const prevUnlock = this.weapons.onUnlock;
    this.weapons.onUnlock = (id) => { syncSwap(); prevUnlock?.(id); };
    syncSwap();
    // HOVER is a toggle too; the H key flips the same state, so the lit look follows the player, not the button
    const hover = el(root, '.hover');
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
    // SURFACE appears beside DIVE while the eye is under (held: up = release); it goes with the swim state on climb-out.
    // Polled from `player.submerged` every frame (in preUpdate above) rather than hooked on onSubmerge / onSurface, so
    // main.ts can assign those callbacks freely (audio) without having to chain ours.
    btn('.surface', () => { this.player.touchSurface = true; }, () => { this.player.touchSurface = false; });
    root.classList.toggle('submerged', this.player.submerged);
    btn('.ws-touch-pause', () => { document.dispatchEvent(new Event('ws:pause')); });
    btn('.ws-touch-use', () => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })); });
    // the interact prompt ("[E] Open door") becomes a big USE button above the row, labelled with the action
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
    this.showStick(this.stickBase.x, this.stickBase.y, kx, ky);
  }

  private showStick(bx: number, by: number, dx: number, dy: number): void {
    const s = this.stick, k = this.knob;
    if (s === undefined || k === undefined) return;
    s.style.left = `${bx}px`; s.style.top = `${by}px`;
    k.style.transform = `translate(${dx}px, ${dy}px)`;
    s.classList.add('show');
  }
}
