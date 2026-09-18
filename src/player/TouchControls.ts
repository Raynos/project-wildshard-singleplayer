/**
 * TouchControls — on-screen first-person controls for coarse-pointer devices (phones, tablets).
 *
 *   const touch = new TouchControls(player, crossbow);   // no-op on mouse/trackpad devices (`touch.active === false`)
 *
 * Layout (styled in src/ui/styles/touch.css, prefix `ws-touch-`): a glass control bar across the bottom ~15 % of the screen, split into
 * a MOVE zone (left, anchored stick: push past 85 % while heading forward = sprint) and a LOOK zone (right, drag
 * pad — a TAP on the look pad, under 12 px and 300 ms, fires; a drag only looks). A row of three buttons sits
 * directly above the bar: JUMP · RELOAD · AIM (a toggle: tap to latch ADS on, tap again to release); USE appears
 * in the row only while the HUD has an interact prompt and dispatches the same `KeyE` the keyboard path listens for.
 * Move/look touches are only taken inside the bar; the world above it is not a control surface.
 *
 * Talks to the player through `player.touchMove / touchSprint / touchJump` (analog, summed with WASD) and to
 * the crossbow through its public `tryFire() / reload() / adsHeld`. The layer only receives events once the
 * intro is gone (`#hud.intro` hides it), and never needs pointer lock — iOS has none.
 */
import type { Player } from './Player';
import type { Crossbow } from './Crossbow';

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

  constructor(private player: Player, private crossbow: Crossbow, force = false) {
    this.active = force || IS_TOUCH;
    if (!this.active) return;
    const hud = document.getElementById('hud') ?? document.body;
    hud.classList.add('touch');
    const root = document.createElement('div');
    root.className = 'ws-touch';
    root.innerHTML = `
      <div class="ws-touch-stick"><i></i></div>
      <div class="ws-touch-btns">
        <button class="ws-touch-btn use" type="button">Use</button>
        <button class="ws-touch-btn jump" type="button">Jump</button>
        <button class="ws-touch-btn reload" type="button">Reload</button>
        <button class="ws-touch-btn aim" type="button">Aim</button>
      </div>
      <button class="ws-touch-pause" type="button">Pause</button>
      <div class="ws-touch-bar">
        <div class="ws-touch-zone move"><u></u><span class="ws-touch-label">Move</span></div>
        <div class="ws-touch-zone look"><u></u><span class="ws-touch-label">Look</span></div>
      </div>`;
    hud.appendChild(root);
    this.root = root;
    this.stick = root.querySelector('.ws-touch-stick')!;
    this.knob = this.stick.querySelector('i')!;

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
        this.lookPath += Math.hypot(dx, dy);
        this.player.yaw -= dx * this.lookRate;
        this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - dy * this.lookRate));
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
        if (e.type === 'pointerup' && this.lookPath < TAP_PX && performance.now() - this.lookT0 < TAP_MS && this.crossbow.enabled) this.crossbow.tryFire();
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
    aim.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.crossbow.adsHeld = !this.crossbow.adsHeld; aim.classList.toggle('on', this.crossbow.adsHeld); });
    aim.addEventListener('pointerup', (e) => e.stopPropagation());
    btn('.reload', () => { if (this.crossbow.enabled) this.crossbow.reload(); });
    btn('.jump', () => { this.player.touchJump = true; });
    btn('.ws-touch-pause', () => document.dispatchEvent(new Event('ws:pause')));
    btn('.use', () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));
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
