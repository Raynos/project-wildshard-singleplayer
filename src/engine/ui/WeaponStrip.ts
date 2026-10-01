import type { WeaponId, Weapons } from '../player/Weapons';

/**
 * WeaponStrip — the one weapon-swap control of every shard, built once by main.ts.
 * E303: Jake picked B (tap = next, hold = a wheel). It replaced Pine Hollow's and Nalati's left-edge slot tabs (E154), which
 * ran into HOVER, and the SWAP pill on Driftwood and Nine Dragon. E319 (progress/e319-hud/): Jake moved it off the bar
 * ("far too easy to press by accident") to the left edge under HOVER, and picked its look — the placement board's C ring
 * and the wheel board's C pie, driven by A's touch. The left edge is the traversal column: HORSE (RideHUD) · HOVER · SWAP.
 *
 *   const strip = new WeaponStrip(weapons);   // after TouchControls (it docks into its layer on touch)
 *   game.onUpdate(() => strip.update());      // cheap: DOM writes only when the kit / held weapon / ammo changes
 *
 * Touch: a big round SWAP ring under HOVER — the held weapon inside a ring of swap arrows, its ammo on a badge, one dot per
 * owned weapon under it. It shows once a second weapon is owned (you pick one up, and the ring appears).
 * **Tap = the next weapon** (`weapons.swap()`, the Q key). **Hold = the pie**: a half-disc of wedges fanning right from the
 * ring, one per owned weapon (icon, name, ammo), the held one lit. Slide toward a wedge and let go to hold it; let go on
 * the hub (or cancel) to keep what you have. The wedge is picked by direction, so a short slide is enough.
 * Desktop (`.desk`): a hotbar bottom-centre with the key numbers, names and ammo (keys 1…N, Q = next, the mouse wheel =
 * next / previous: Weapons.ts). A slot can be clicked too.
 * Both show only once a second weapon is owned; the practice room's loan shows them too.
 * Styles: src/engine/ui/styles/touch.css (`ws-touch-swap*`, `ws-touch-pie*`, `ws-touch-strip.desk`, `ws-touch-slot*`).
 */

const ICONS: Partial<Record<WeaponId, string>> = {
  bow: '<path d="M6 3c7 3.5 7 14.5 0 18"/><path d="M6 3v18" stroke-width="0.9"/><path d="M4 12h15M16.5 9.5 19 12l-2.5 2.5"/>',
  sabre: '<path d="M5 19c4-3.5 9.5-9.5 13.5-15.5-1 5-5.5 11.5-11.5 16.5"/><path d="M3.5 16.5l4.5 4.5M4.5 21.5l2-2"/>',
  spear: '<path d="M4 20 16 8"/><path d="M16 8c.8-2.6 2.6-4.4 5-5-.6 2.4-2.4 4.2-5 5z"/><path d="M13.2 8.6l2.2 2.2"/>',
  rifle: '<path d="M3 13h14l3-2h1v3h-4l-2 2H9l-1 3H5l1-3H3z"/>',
  crossbow: '<path d="M4 7c4 3 12 3 16 0M12 5v15M8 17h8"/>',
};
/** the sword slot (Driftwood's wooden / iron sword, Nine Dragon's jian) — and any weapon without its own icon */
const SWORD_ICON = '<path d="M20.5 3.5 9.2 14.8M20.5 3.5l-.6 4.2M20.5 3.5l-4.2.6"/><path d="M6.6 12.2l5.2 5.2M8.4 15.6 4 20"/>';
/** the rifle slot's name is the kit weapon's own (`name`: Nalati's AR-15, Pine Hollow's lever-action) */
const NAMES: Partial<Record<WeaponId, string>> = { bow: 'Bow', sabre: 'Sabre', spear: 'Spear', crossbow: 'Crossbow' };
/** the two curved arrows around the ring (viewBox 0 0 56 56; the ring's centre is 28, 28) */
const RING_ARROWS = '<path d="M9.5 21A20 20 0 0 1 40 11.5"/><path d="M40 11.5l-5.6-.6M40 11.5l-1.3 5.4"/><path d="M46.5 35A20 20 0 0 1 16 44.5"/><path d="M16 44.5l5.6.6M16 44.5l1.3-5.4"/>';
/** the pie's hub icon (the swap arrows) */
const SWAP_ICON = '<path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/>';
/** a press held this long opens the pie; a shorter one is a tap (next weapon) */
const HOLD_MS = 260;
/** the pie: hub and outer radius, px; it spans the right half (−90° … +90°) */
const PIE_HUB = 28, PIE_R = 128;
/** a release within this distance of the centre picks nothing (the hub); beyond it, the wedge in that direction */
const PICK_MIN = 30;

interface Slot { id: WeaponId; el: HTMLElement; ammo: HTMLElement; shownAmmo: number | undefined | null; on: boolean }
interface Wedge { id: WeaponId; el: SVGPathElement; label: HTMLElement }

const iconOf = (id: WeaponId): string => ICONS[id] ?? SWORD_ICON;
const SVGNS = 'http://www.w3.org/2000/svg';

export class WeaponStrip {
  readonly el: HTMLElement;
  private readonly touch: boolean;
  private slots: Slot[] = [];
  private kitKey = '';
  private heldKey = '';
  // touch only: the ring's parts and the pie
  private ringIcon: SVGElement | null = null;
  private ringAmmo: HTMLElement | null = null;
  private shownAmmo: number | undefined | null = null;
  private dots: HTMLElement | null = null;
  private pie: HTMLElement | null = null;
  private wedges: Wedge[] = [];
  private pieCentre = { x: 0, y: 0 };
  private pick: WeaponId | null = null;
  private press: { id: number; timer: number; open: boolean } | null = null;

  constructor(private weapons: Weapons) {
    const hud = document.getElementById('hud') ?? document.body;
    const layer = hud.querySelector<HTMLElement>('.ws-touch');
    this.touch = layer !== null && hud.classList.contains('touch');
    if (this.touch && layer !== null) {
      this.el = document.createElement('button');
      this.el.className = 'ws-touch-swap';
      this.el.setAttribute('type', 'button');
      this.el.innerHTML = `<svg class="ws-touch-swap-arrows" viewBox="0 0 56 56">${RING_ARROWS}</svg><svg class="ws-touch-swap-icon" viewBox="0 0 24 24"></svg><b class="ws-touch-swap-ammo"></b><span class="ws-touch-swap-dots"></span>`;
      this.ringIcon = this.el.querySelector('.ws-touch-swap-icon');
      this.ringAmmo = this.el.querySelector('.ws-touch-swap-ammo');
      this.dots = this.el.querySelector('.ws-touch-swap-dots');
      this.pie = document.createElement('div');
      this.pie.className = 'ws-touch-pie';
      layer.append(this.pie, this.el);
      this.wireRing();
    } else {
      this.el = document.createElement('div');
      this.el.className = 'ws-touch-strip desk';
      hud.append(this.el);
    }
    this.update();
  }

  update(): void {
    const w = this.weapons, list = w.available;
    const key = list.map((k) => k.id).join(',');
    if (key !== this.kitKey) this.build(key);
    const held = w.current.id;
    if (this.touch) {
      if (held !== this.heldKey) this.drawRing(held);
      const ammo = w.current.state.ammo;
      if (ammo !== this.shownAmmo && this.ringAmmo !== null) {
        this.shownAmmo = ammo;
        this.ringAmmo.textContent = ammo === undefined ? '' : String(ammo);
        this.ringAmmo.classList.toggle('empty', ammo === 0);
      }
    }
    for (const s of this.slots) {
      const on = held === s.id;
      if (on !== s.on) { s.on = on; s.el.classList.toggle('on', on); }
      const ammo = w.get(s.id).state.ammo;
      if (ammo !== s.shownAmmo) { s.shownAmmo = ammo; s.ammo.textContent = ammo === undefined ? '' : String(ammo); s.ammo.classList.toggle('empty', ammo === 0); }
    }
  }

  private build(key: string): void {
    this.kitKey = key; this.heldKey = '';
    this.closePie();
    const list = this.weapons.available;
    this.el.classList.toggle('show', list.length > 1);
    this.slots = [];
    if (this.touch) {
      // the pie's wedges are rebuilt on every open (they follow where the ring sits); only the dots live here
      this.dots?.replaceChildren(...list.map(() => document.createElement('i')));
      return;
    }
    this.el.replaceChildren();
    list.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ws-touch-slot';
      b.innerHTML = `<i class="ws-touch-slot-key">${i + 1}</i><svg viewBox="0 0 24 24">${iconOf(k.id)}</svg><span class="ws-touch-slot-name">${NAMES[k.id] ?? k.name}</span><b class="ws-touch-slot-ammo"></b>`;
      const ammo = b.querySelector<HTMLElement>('.ws-touch-slot-ammo');
      if (ammo === null) return;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        if (this.weapons.enabled) this.weapons.select(k.id);
      });
      this.el.append(b);
      this.slots.push({ id: k.id, el: b, ammo, shownAmmo: null, on: false });
    });
  }

  /** the ring shows the held weapon; its dot lights */
  private drawRing(held: WeaponId): void {
    this.heldKey = held;
    if (this.ringIcon !== null) this.ringIcon.innerHTML = iconOf(held);
    const list = this.weapons.available, dots = this.dots?.children;
    if (dots !== undefined) list.forEach((w, i) => { dots[i]?.classList.toggle('on', w.id === held); });
  }

  private wireRing(): void {
    const ring = this.el;
    ring.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); e.preventDefault();
      if (this.press !== null || !this.weapons.enabled) return;
      ring.setPointerCapture(e.pointerId);
      ring.classList.add('down');
      const press = { id: e.pointerId, timer: 0, open: false };
      press.timer = window.setTimeout(() => { press.open = true; this.openPie(); }, HOLD_MS);
      this.press = press;
    });
    ring.addEventListener('pointermove', (e) => {
      const p = this.press;
      if (p === null || e.pointerId !== p.id || !p.open) return;
      e.stopPropagation();
      this.hover(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent, cancelled: boolean): void => {
      const p = this.press;
      if (p === null || e.pointerId !== p.id) return;
      e.stopPropagation();
      window.clearTimeout(p.timer);
      this.press = null;
      ring.classList.remove('down');
      if (ring.hasPointerCapture(e.pointerId)) ring.releasePointerCapture(e.pointerId);
      if (!this.weapons.enabled) { this.closePie(); return; }
      if (!p.open) { if (!cancelled) this.weapons.swap(); return; }
      if (!cancelled) this.hover(e.clientX, e.clientY);
      const pick = cancelled ? null : this.pick;
      this.closePie();
      if (pick !== null && pick !== this.weapons.current.id) this.weapons.select(pick);
    };
    ring.addEventListener('pointerup', (e) => { end(e, false); });
    ring.addEventListener('pointercancel', (e) => { end(e, true); });
  }

  /** open the pie on the ring's centre: one wedge per owned weapon across the right half, the held one lit */
  private openPie(): void {
    const pie = this.pie, layer = pie?.parentElement;
    const list = this.weapons.available, n = list.length;
    if (pie === null || layer === null || layer === undefined || n < 2) return;
    const lr = layer.getBoundingClientRect(), cr = this.el.getBoundingClientRect();
    const cx = cr.left + cr.width / 2 - lr.left;
    // kept on screen top and bottom
    const cy = Math.min(lr.height - PIE_R - 8, Math.max(PIE_R + 8, cr.top + cr.height / 2 - lr.top));
    this.pieCentre = { x: lr.left + cx, y: lr.top + cy };
    pie.style.left = `${cx}px`; pie.style.top = `${cy}px`;
    pie.replaceChildren();
    this.wedges = [];
    const size = PIE_R * 2 + 4;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'ws-touch-pie-disc');
    svg.setAttribute('viewBox', `${-size / 2} ${-size / 2} ${size} ${size}`);
    svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
    pie.append(svg);
    const span = 180 / n;
    const held = this.weapons.current.id;
    const at = (r: number, a: number): string => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
    list.forEach((k, i) => {
      const a0 = (-90 + i * span) * Math.PI / 180, a1 = (-90 + (i + 1) * span) * Math.PI / 180;
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', `M ${at(PIE_HUB, a0)} L ${at(PIE_R, a0)} A ${PIE_R} ${PIE_R} 0 0 1 ${at(PIE_R, a1)} L ${at(PIE_HUB, a1)} A ${PIE_HUB} ${PIE_HUB} 0 0 0 ${at(PIE_HUB, a0)} Z`);
      path.setAttribute('class', `ws-touch-pie-wedge${k.id === held ? ' held' : ''}`);
      svg.append(path);
      const mid = (a0 + a1) / 2, r = (PIE_HUB + PIE_R) / 2 + 6;
      const label = document.createElement('div');
      label.className = `ws-touch-pie-label${k.id === held ? ' held' : ''}`;
      label.style.transform = `translate(${(Math.cos(mid) * r).toFixed(1)}px, ${(Math.sin(mid) * r).toFixed(1)}px)`;
      const ammo = this.weapons.get(k.id).state.ammo;
      const count = ammo === undefined ? '' : ` <b class="${ammo === 0 ? 'empty' : ''}">${ammo}</b>`;
      label.innerHTML = `<svg viewBox="0 0 24 24">${iconOf(k.id)}</svg><span>${NAMES[k.id] ?? k.name}${count}</span>`;
      pie.append(label);
      this.wedges.push({ id: k.id, el: path, label });
    });
    const hub = document.createElement('div');
    hub.className = 'ws-touch-pie-hub';
    hub.innerHTML = `<svg viewBox="0 0 24 24">${SWAP_ICON}</svg>`;
    pie.append(hub);
    this.pick = null;
    pie.classList.add('open');
  }

  /** the wedge in the finger's direction from the centre (past the hub) is the one a release would take */
  private hover(fx: number, fy: number): void {
    const dx = fx - this.pieCentre.x, dy = fy - this.pieCentre.y;
    let best: WeaponId | null = null;
    const n = this.wedges.length;
    if (n > 0 && dx * dx + dy * dy > PICK_MIN * PICK_MIN) {
      // −90° (up) … +90° (down) across the right half; a slide back left clamps to the nearest end wedge
      const deg = Math.max(-89.9, Math.min(89.9, Math.atan2(dy, Math.max(dx, 0.001)) * 180 / Math.PI));
      best = this.wedges[Math.floor((deg + 90) / (180 / n))]?.id ?? null;
    }
    if (best === this.pick) return;
    this.pick = best;
    for (const w of this.wedges) { const on = w.id === best; w.el.classList.toggle('pick', on); w.label.classList.toggle('pick', on); }
  }

  private closePie(): void {
    this.pick = null;
    this.wedges = [];
    if (this.pie === null) return;
    this.pie.classList.remove('open');
    this.pie.replaceChildren();
  }
}
