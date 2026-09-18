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
 * While the player swims (`player.onSwimChange`) JUMP is swapped for a DIVE disc in the same spot — a HELD button that
 * drives `player.touchDive` → `player.diveHeld` (hold to go down). Once the eye is under (`player.submerged`, polled)
 * a SURFACE disc appears beside it (`player.touchSurface` → `player.surfaceHeld`, hold to come up) and hides again on
 * surfacing. There is no other vertical control in the water.
 * A SWAP pill mirrors HOVER on the LEFT edge: it calls `weapons.swap()` (crossbow ⇄ AR-15, the Q key); it only shows once a
 * second weapon is unlocked (`weapons.onUnlock` — the AR-15 is a cabin pickup).
 * There is no RELOAD: `weapons.tryFire()` reloads the held weapon itself when it is fired empty. USE is a big button above the
 * discs, shown only while the HUD has an interact prompt; it dispatches the same `KeyE` the keyboard path listens for.
 * The HUD (HUD.ts) mounts the VITALS / BOLTS strips into the bar's top corners (`.ws-game-vitals` / `.ws-game-bolts`).
 * Move/look touches are only taken inside the bar; the world above it is not a control surface.
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
import type { Weapons } from './Weapons';
import { AimAssist } from './AimAssist';

export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const STICK_RADIUS = 48;      // px from base to full deflection
const DEADZONE = 0.12;
const SPRINT_AT = 0.85;
const LOOK_RATE = 0.0095;     // rad per px (≈ 0.54°/px; a 200 px swipe turns ~110°)
const PAD_BOOST = 1.6;        // the LOOK pad in the bar is small — a thumb's travel there is worth more
const TAP_PX = 12;            // a look-pad touch that travels less than this …
const TAP_MS = 300;           // … and ends within this is a tap = fire

export class TouchControls {
  readonly active: boolean;
  private root?: HTMLElement;
  private stickPointer = -1; private lookPointer = -1;
  private stickBase = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 }; private lookRate = LOOK_RATE;
  private lookPath = 0; private lookT0 = 0; // tap-to-fire: distance travelled + start time of the look touch
  private stick?: HTMLElement; private knob?: HTMLElement;
  readonly assist?: AimAssist;
  private lookFrameDist = 0; private lookSpeed = 0; // px moved on the LOOK pad since the last frame / smoothed px/s
  private wasSubmerged = false; // the SURFACE disc follows player.submerged

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
      <button class="ws-touch-disc swap" type="button"><svg viewBox="0 0 24 24"><path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H7M10.5 12.5 7 16l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Swap</span></button>
      <button class="ws-touch-disc hover" type="button"><svg viewBox="0 0 24 24"><path d="M2 9.5c0-1.4 1.1-2.5 2.5-2.5h15c1.4 0 2.5 1.1 2.5 2.5S20.9 12 19.5 12h-15C3.1 12 2 10.9 2 9.5z"/><path d="M6 15.5h12M8.5 19h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/></svg><span>Hover</span></button>
      <button class="ws-touch-disc jump" type="button"><svg viewBox="0 0 24 24"><path d="M12 2.5 4 11h5v10.5h6V11h5z"/></svg><span>Jump</span></button>
      <button class="ws-touch-disc surface" type="button"><svg viewBox="0 0 24 24"><path d="M12 21.5V9M7.5 13.5 12 9l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 5.5c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span>Surface</span></button>
      <button class="ws-touch-disc dive" type="button"><svg viewBox="0 0 24 24"><path d="M12 2v11.5M7.5 9.5 12 14l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 18.5c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4 1.7-1.4 3.4-1.4 1.6 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M4 22c1.7 0 1.7-1.4 3.3-1.4s1.7 1.4 3.4 1.4 1.7-1.4 3.3-1.4 1.7 1.4 3.3 1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/></svg><span>Dive</span></button>
      <button class="ws-touch-pause" type="button">Pause</button>
      <div class="ws-touch-bar">
        <div class="ws-touch-zone move"><u></u><span class="ws-touch-label">Move</span></div>
        <div class="ws-touch-zone look"><u></u><span class="ws-touch-label">Look</span></div>
      </div>`;
    hud.appendChild(root);
    this.root = root;
    this.stick = root.querySelector('.ws-touch-stick')!;
    this.knob = this.stick.querySelector('i')!;

    // ── aim assist: runs at the top of every player update (before the camera is posed) so a nudge shows the same frame ──
    const assist = this.assist = new AimAssist(root);
    const prevPre = player.preUpdate;
    player.preUpdate = (dt) => {
      prevPre?.(dt);
      const speed = dt > 0 ? this.lookFrameDist / dt : 0; this.lookFrameDist = 0;
      this.lookSpeed += (speed - this.lookSpeed) * Math.min(1, dt * 15);
      if (weapons.enabled) assist.update(dt, player, weapons.adsHeld, this.lookSpeed);
      if (player.submerged !== this.wasSubmerged) { this.wasSubmerged = player.submerged; root.classList.toggle('submerged', player.submerged); if (!player.submerged) player.touchSurface = false; }
    };

    // ── stick + look: pointer events on the layer itself (buttons stop propagation) ──
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !force) return;
      const zone = root.querySelector<HTMLElement>('.ws-touch-zone.move')!.getBoundingClientRect();
      if (e.clientY < zone.top) return; // above the bar: not a control surface
      const inMove = e.clientX <= zone.right;
      if (inMove && this.stickPointer < 0) {
        this.stickPointer = e.pointerId;
        // the stick is anchored at the MOVE zone's centre; a touch anywhere in the zone grabs it
        this.stickBase = { x: zone.left + zone.width / 2, y: zone.top + zone.height / 2 };
        this.showStick(this.stickBase.x, this.stickBase.y, 0, 0);
        this.applyStick(e.clientX - this.stickBase.x, e.clientY - this.stickBase.y);
      } else if (!inMove && this.lookPointer < 0) {
        this.lookPointer = e.pointerId;
        this.lookLast = { x: e.clientX, y: e.clientY };
        this.lookRate = LOOK_RATE * PAD_BOOST;
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
        const rate = this.lookRate * (this.assist?.lookScale() ?? 1); // aim-assist friction near an animal
        this.player.yaw -= dx * rate;
        this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - dy * rate));
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.stickPointer) {
        this.stickPointer = -1;
        this.player.touchMove.x = this.player.touchMove.y = 0;
        this.player.touchSprint = false;
        this.stick!.classList.remove('show');
      } else if (e.pointerId === this.lookPointer) {
        this.lookPointer = -1;
        // a tap on the look pad (barely moved, quick) fires; a drag only looked. Cancelled touches never fire.
        if (e.type === 'pointerup' && this.lookPath < TAP_PX && performance.now() - this.lookT0 < TAP_MS && this.weapons.enabled) this.weapons.tryFire();
      }
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('contextmenu', (e) => e.preventDefault());

    // ── buttons ──
    const btn = (sel: string, down: () => void, up?: () => void) => {
      const b = root.querySelector<HTMLElement>(sel)!;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); b.classList.add('down'); down(); });
      const end = (e: Event) => { e.stopPropagation(); b.classList.remove('down'); up?.(); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end); b.addEventListener('pointerleave', end);
    };
    // AIM is a toggle, not a hold: each press flips ADS and the button stays lit (.on) while it is latched
    const aim = root.querySelector<HTMLElement>('.aim')!;
    aim.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.weapons.adsHeld = !this.weapons.adsHeld; aim.classList.toggle('on', this.weapons.adsHeld); });
    aim.addEventListener('pointerup', (e) => e.stopPropagation());
    // SWAP: crossbow ⇄ rifle (Weapons.swap, the Q key); the pill flashes .down while pressed, nothing latches. Hidden until a
    // second weapon is unlocked (the AR-15 pickup — Weapons.onUnlock)
    btn('.swap', () => { if (this.weapons.enabled) this.weapons.swap(); });
    const swap = root.querySelector<HTMLElement>('.swap')!;
    const syncSwap = () => swap.classList.toggle('show', this.weapons.available.length > 1);
    const prevUnlock = this.weapons.onUnlock;
    this.weapons.onUnlock = (id) => { syncSwap(); prevUnlock?.(id); };
    syncSwap();
    // HOVER is a toggle too; the H key flips the same state, so the lit look follows the player, not the button
    const hover = root.querySelector<HTMLElement>('.hover')!;
    hover.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.player.setHover(!this.player.hover); });
    hover.addEventListener('pointerup', (e) => e.stopPropagation());
    const prevHover = this.player.onHoverChange;
    this.player.onHoverChange = (on) => { hover.classList.toggle('on', on); prevHover?.(on); };
    hover.classList.toggle('on', this.player.hover);
    btn('.jump', () => { this.player.touchJump = true; });
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
    btn('.ws-touch-pause', () => document.dispatchEvent(new Event('ws:pause')));
    btn('.ws-touch-use', () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));
    // the interact prompt ("[E] Open door") becomes a big USE button above the row, labelled with the action
    const use = root.querySelector<HTMLElement>('.ws-touch-use')!;
    const bindPrompt = (prompt: HTMLElement) => {
      const sync = () => {
        const on = prompt.classList.contains('show');
        use.classList.toggle('show', on);
        if (on) use.textContent = (prompt.textContent ?? '').replace(/^[A-Z]\s*/, '').trim() || 'Use';
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

  private applyStick(dx: number, dy: number) {
    const len = Math.hypot(dx, dy);
    const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0; // direction from the raw delta
    const mag = Math.min(1, len / STICK_RADIUS);
    const scaled = mag < DEADZONE ? 0 : (mag - DEADZONE) / (1 - DEADZONE);
    if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; } // knob stays on the ring
    this.player.touchMove.x = nx * scaled;
    this.player.touchMove.y = -ny * scaled;
    this.player.touchSprint = mag > SPRINT_AT && -ny > 0.5;
    this.showStick(this.stickBase.x, this.stickBase.y, dx, dy);
  }

  private showStick(bx: number, by: number, dx: number, dy: number) {
    const s = this.stick!, k = this.knob!;
    s.style.left = `${bx}px`; s.style.top = `${by}px`;
    k.style.transform = `translate(${dx}px, ${dy}px)`;
    s.classList.add('show');
  }
}
