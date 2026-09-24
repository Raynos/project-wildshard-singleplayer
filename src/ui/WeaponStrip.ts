import type { WeaponId, Weapons } from '../player/Weapons';

/**
 * WeaponStrip — the Nalati weapon slots (plan row B3; mockups art/nalati-grasslands/round-2/1-combat/combat-E-weapon-swap.png,
 * 3 slots per the plan's decision — bow · sabre · spear, the javelins live in the spear slot — and
 * art/nalati-grasslands/round-2/7-controls/controls-desktop-keys.png for the desktop hotbar).
 *
 *   const strip = new WeaponStrip(weapons);   // after TouchControls (it docks into its layer on touch)
 *   game.onUpdate(() => strip.update());      // cheap: DOM writes only when the kit / held weapon / ammo changes
 *
 * One square glass slot per OWNED weapon in `weapons.available` order (slot n = key n), the held one outlined in cyan, the
 * ammo (arrows / javelins) in the corner, red at 0. **Tap a slot = hold it** (the kit's 0.25 + 0.25 s holster swap);
 * tapping the slot already held = back to the previous weapon (`weapons.last()`, the design's "double-tap = last").
 * Touch: docked in the TouchControls layer as three edge tabs down the LEFT screen edge under the status column (layout D,
 * NALATI-MERGE H2 — art/hud/round-12-nalati-merge/D-*.jpg), the slot number in each tab's corner (the ammo is the column's
 * ARROWS row, src/ui/NalatiHUD.ts), and the layer's SWAP pill is hidden (`.strip`). Desktop: a hotbar bottom-centre with
 * the key numbers and names (`.desk`), clickable too.
 * Styles: src/ui/styles/touch.css (`ws-touch-strip`, `ws-touch-slot*`).
 */

const ICONS: Partial<Record<WeaponId, string>> = {
  bow: '<path d="M6 3c7 3.5 7 14.5 0 18"/><path d="M6 3v18" stroke-width="0.9"/><path d="M4 12h15M16.5 9.5 19 12l-2.5 2.5"/>',
  sabre: '<path d="M5 19c4-3.5 9.5-9.5 13.5-15.5-1 5-5.5 11.5-11.5 16.5"/><path d="M3.5 16.5l4.5 4.5M4.5 21.5l2-2"/>',
  spear: '<path d="M4 20 16 8"/><path d="M16 8c.8-2.6 2.6-4.4 5-5-.6 2.4-2.4 4.2-5 5z"/><path d="M13.2 8.6l2.2 2.2"/>',
  rifle: '<path d="M3 13h14l3-2h1v3h-4l-2 2H9l-1 3H5l1-3H3z"/>',
  crossbow: '<path d="M4 7c4 3 12 3 16 0M12 5v15M8 17h8"/>',
};
const NAMES: Partial<Record<WeaponId, string>> = { bow: 'Bow', sabre: 'Sabre', spear: 'Spear', rifle: 'AR-15', crossbow: 'Crossbow' };

interface Slot { id: WeaponId; el: HTMLButtonElement; ammo: HTMLElement; shownAmmo: number | undefined | null; on: boolean }

export class WeaponStrip {
  readonly el: HTMLElement;
  private slots: Slot[] = [];
  private kitKey = '';

  constructor(private weapons: Weapons) {
    const hud = document.getElementById('hud') ?? document.body;
    const layer = hud.querySelector<HTMLElement>('.ws-touch');
    const touch = layer !== null && hud.classList.contains('touch');
    this.el = document.createElement('div');
    this.el.className = touch ? 'ws-touch-strip' : 'ws-touch-strip desk';
    if (touch) { layer.classList.add('strip'); layer.append(this.el); } else hud.append(this.el);
    this.update();
  }

  update(): void {
    const w = this.weapons, list = w.available;
    const key = list.map((k) => k.id).join(',');
    if (key !== this.kitKey) this.build(key);
    for (const s of this.slots) {
      const held = w.current.id === s.id;
      if (held !== s.on) { s.on = held; s.el.classList.toggle('on', held); }
      const ammo = w.get(s.id).state.ammo;
      if (ammo !== s.shownAmmo) { s.shownAmmo = ammo; s.ammo.textContent = ammo === undefined ? '' : String(ammo); s.ammo.classList.toggle('empty', ammo === 0); }
    }
  }

  private build(key: string): void {
    this.kitKey = key;
    this.el.replaceChildren();
    this.slots = [];
    this.weapons.available.forEach((k, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ws-touch-slot';
      b.innerHTML = `<i class="ws-touch-slot-key">${i + 1}</i><svg viewBox="0 0 24 24">${ICONS[k.id] ?? ICONS.sabre ?? ''}</svg><span class="ws-touch-slot-name">${NAMES[k.id] ?? k.name}</span><b class="ws-touch-slot-ammo"></b>`;
      const ammo = b.querySelector<HTMLElement>('.ws-touch-slot-ammo');
      if (ammo === null) return;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); e.preventDefault();
        b.classList.add('down');
        if (!this.weapons.enabled) return;
        if (this.weapons.current.id === k.id && !this.weapons.swappingNow) this.weapons.last(); else this.weapons.select(k.id);
      });
      const up = (e: Event) => { e.stopPropagation(); b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      this.el.append(b);
      this.slots.push({ id: k.id, el: b, ammo, shownAmmo: null, on: false });
    });
  }
}
