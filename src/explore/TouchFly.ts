/**
 * TouchFly — the phone's god-mode flight controls for the World Explorer (EXPLORE-WORLD.md X2, mockups
 * art/build-world/round-4-god-mode-flight/). Drives the same FreeCam the desktop keys do:
 *
 *   FLY stick (bottom-left)       → cam.move.x / .z  (strafe / forward along the view)
 *   one finger anywhere else      → spin the view (cam.look), or orbit the pivot while an orbit target is set
 *   two fingers                   → pinch = fly forward / back (cam.dolly)
 *   ▲ / ▼ (held)                  → cam.move.y
 *   a tap (no drag)               → onTap(x, y) — Explore selects what is under it
 *
 *   const fly = new TouchFly(layer, cam); fly.onTap = (x, y) => …; fly.orbiting = true / false;
 */
import type { FreeCam } from './FreeCam';

const TOUCH_LOOK = 0.0042; // rad / px — a phone swipe is shorter than a mouse drag
const STICK_R = 46;        // px — the thumb's travel

interface Finger { id: number; x: number; y: number; x0: number; y0: number; t0: number; moved: boolean }

export class TouchFly {
  onTap?: (x: number, y: number) => void;
  /** one finger orbits `cam.pivot` instead of turning the head (a selected object) */
  orbiting = false;
  readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private stickId: number | null = null;
  private stickX = 0; private stickY = 0;
  private readonly fingers = new Map<number, Finger>();
  private pinch = 0;

  constructor(private readonly surface: HTMLElement, private readonly cam: FreeCam, host: HTMLElement) {
    this.stick = document.createElement('div'); this.stick.className = 'ws-x-stick';
    this.knob = document.createElement('i'); this.stick.append(this.knob);
    const label = document.createElement('b'); label.textContent = 'Fly'; this.stick.append(label);
    host.append(this.stick);
    this.stick.addEventListener('pointerdown', this.onStickDown);
    surface.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  /** hold a vertical button: +1 up, −1 down, 0 released */
  vertical(v: number): void { this.cam.move.y = v; }

  dispose(): void {
    this.stick.remove();
    this.surface.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.cam.move.set(0, 0, 0);
  }

  private setStick(dx: number, dy: number): void {
    const d = Math.hypot(dx, dy), k = d > STICK_R ? STICK_R / d : 1;
    this.stickX = dx * k; this.stickY = dy * k;
    this.knob.style.transform = `translate(${this.stickX}px, ${this.stickY}px)`;
    this.cam.move.x = this.stickX / STICK_R;
    this.cam.move.z = -this.stickY / STICK_R;
  }

  private readonly onStickDown = (e: PointerEvent): void => {
    e.preventDefault(); e.stopPropagation();
    this.stickId = e.pointerId;
    const r = this.stick.getBoundingClientRect();
    this.stick.classList.add('on');
    this.setStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
  };

  private readonly onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return; // the desktop mouse belongs to FreeCam
    e.preventDefault();
    this.fingers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false });
    if (this.fingers.size === 2) this.pinch = this.spread();
  };

  private spread(): number {
    const [a, b] = [...this.fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      const r = this.stick.getBoundingClientRect();
      this.setStick(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      return;
    }
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    f.x = e.clientX; f.y = e.clientY;
    if (Math.hypot(f.x - f.x0, f.y - f.y0) > 8) f.moved = true;
    if (this.fingers.size >= 2) {
      const s = this.spread();
      if (this.pinch > 0 && s > 0) this.cam.dolly((s - this.pinch) / 260);
      this.pinch = s;
      return;
    }
    if (!f.moved) return;
    const k = TOUCH_LOOK / this.cam.lookSpeed; // FreeCam.look takes pixels at its own sensitivity
    if (this.orbiting) this.cam.orbit(dx * k, dy * k); else this.cam.look(dx * k, dy * k);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      this.stickId = null; this.stick.classList.remove('on');
      this.setStick(0, 0);
      return;
    }
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    this.fingers.delete(e.pointerId);
    if (this.fingers.size < 2) this.pinch = 0;
    if (!f.moved && performance.now() - f.t0 < 350 && this.fingers.size === 0) this.onTap?.(f.x, f.y);
  };
}
