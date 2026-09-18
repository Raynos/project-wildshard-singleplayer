/**
 * TouchControls — on-screen first-person controls for coarse-pointer devices (phones, tablets).
 *
 *   const touch = new TouchControls(player, crossbow);   // no-op on mouse/trackpad devices (`touch.active === false`)
 *
 * Layout (styled in hud.css, `.ws-touch`):
 *   left half   floating stick — appears where the thumb lands; push past 85 % while moving ahead = sprint
 *   right half  drag to look (yaw/pitch), tap-safe: a still touch does nothing
 *   buttons     FIRE (big) and AIM (hold) bottom-right, RELOAD + JUMP above them; USE shows only while
 *               the HUD has an interact prompt and dispatches the same `KeyE` the keyboard path listens for.
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
const LOOK_RATE = 0.005;      // rad per px (≈ 0.29°/px; a 200 px swipe turns 57°)

export class TouchControls {
  readonly active: boolean;
  private root?: HTMLElement;
  private stickPointer = -1; private lookPointer = -1;
  private stickBase = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private stick?: HTMLElement; private knob?: HTMLElement;

  constructor(private player: Player, private crossbow: Crossbow, force = false) {
    this.active = force || IS_TOUCH;
    if (!this.active) return;
    const hud = document.getElementById('hud') ?? document.body;
    hud.classList.add('touch');
    const root = document.createElement('div');
    root.className = 'ws-touch';
    root.innerHTML = `
      <div class="ws-stick"><i></i></div>
      <div class="ws-tbtns">
        <button class="ws-tbtn use" type="button">Use</button>
        <button class="ws-tbtn jump" type="button">Jump</button>
        <button class="ws-tbtn reload" type="button">Reload</button>
        <button class="ws-tbtn aim" type="button">Aim</button>
        <button class="ws-tbtn fire" type="button">Fire</button>
      </div>`;
    hud.appendChild(root);
    this.root = root;
    this.stick = root.querySelector('.ws-stick')!;
    this.knob = this.stick.querySelector('i')!;

    // ── stick + look: pointer events on the layer itself (buttons stop propagation) ──
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && !force) return;
      const left = e.clientX < window.innerWidth * 0.5;
      if (left && this.stickPointer < 0) {
        this.stickPointer = e.pointerId;
        this.stickBase = { x: e.clientX, y: e.clientY };
        this.showStick(e.clientX, e.clientY, 0, 0);
      } else if (!left && this.lookPointer < 0) {
        this.lookPointer = e.pointerId;
        this.lookLast = { x: e.clientX, y: e.clientY };
      } else return;
      root.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    root.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickPointer) {
        let dx = e.clientX - this.stickBase.x, dy = e.clientY - this.stickBase.y;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
        const mag = Math.min(1, len / STICK_RADIUS);
        const scaled = mag < DEADZONE ? 0 : (mag - DEADZONE) / (1 - DEADZONE);
        const nx = len > 0 ? dx / len : 0, ny = len > 0 ? dy / len : 0;
        this.player.touchMove.x = nx * scaled;
        this.player.touchMove.y = -ny * scaled;
        this.player.touchSprint = mag > SPRINT_AT && -ny > 0.5;
        this.showStick(this.stickBase.x, this.stickBase.y, dx, dy);
      } else if (e.pointerId === this.lookPointer) {
        const dx = e.clientX - this.lookLast.x, dy = e.clientY - this.lookLast.y;
        this.lookLast = { x: e.clientX, y: e.clientY };
        this.player.yaw -= dx * LOOK_RATE;
        this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - dy * LOOK_RATE));
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId === this.stickPointer) {
        this.stickPointer = -1;
        this.player.touchMove.x = this.player.touchMove.y = 0;
        this.player.touchSprint = false;
        this.stick!.classList.remove('show');
      } else if (e.pointerId === this.lookPointer) this.lookPointer = -1;
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
    btn('.fire', () => { if (this.crossbow.enabled) this.crossbow.tryFire(); });
    btn('.aim', () => { this.crossbow.adsHeld = true; }, () => { this.crossbow.adsHeld = false; });
    btn('.reload', () => { if (this.crossbow.enabled) this.crossbow.reload(); });
    btn('.jump', () => { this.player.touchJump = true; });
    btn('.use', () => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })));
  }

  private showStick(bx: number, by: number, dx: number, dy: number) {
    const s = this.stick!, k = this.knob!;
    s.style.left = `${bx}px`; s.style.top = `${by}px`;
    k.style.transform = `translate(${dx}px, ${dy}px)`;
    s.classList.add('show');
  }
}
