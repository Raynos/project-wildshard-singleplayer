/**
 * The in-game MENU — one overlay, four tabs: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (art/menu-tab-*.png).
 * Replaces the old pause box and the stand-alone full-map screen: tapping the minimap (or M) opens it on
 * the Map tab, the pause button / Esc opens it on Settings (Resume, Exit to main menu and the switches live
 * there). Styled by src/ui/styles/gmenu.css (prefix ws-gmenu-). The world keeps running underneath, as the
 * full map always did; the overlay swallows touch so the pads don't move you.
 *
 *   const menu = new GameMenu({ fullMap, progress, inventory, kit, volume });
 *   hud.menu = menu;                          // HUD.setPaused → menu.open('settings'); menu.onClose → hud.onResume
 *   menu.open('map') / menu.close() / menu.isOpen / menu.tab
 *   menu.onExit = () => hud.exitToMenu();     // the Settings tab's EXIT TO MAIN MENU
 *   menu.refresh()                            // re-render the data tabs (kills, harvests, unlocks)
 */
import { getActiveChunk } from '../chunks/registry';
import { CHUNK_SIZE } from '../core/config';
import type { FullMap } from './Map';
import type { Progress } from '../game/Progress';
import { PACK_SLOTS, type Inventory } from '../game/Inventory';
import { icon, type IconId } from './icons';
import { getSetting, setSetting, onSetting, getNumber, setNumber, type SettingKey } from './Settings';
import { gfxPrefs, saveGfxPrefs } from '../core/tier';

export type MenuTab = 'map' | 'inventory' | 'achievements' | 'settings';
const TABS: { id: MenuTab; label: string }[] = [
  { id: 'map', label: 'Map' }, { id: 'inventory', label: 'Inventory' }, { id: 'achievements', label: 'Achievements' }, { id: 'settings', label: 'Settings' },
];
const HINTS: Record<MenuTab, string> = { map: 'Drag to pan · pinch to zoom', inventory: 'Tap a weapon to hold it', achievements: 'Tap an earned title to wear it', settings: 'Tap outside or Esc to resume' };

/** the weapons as the Inventory tab shows them — read live from Weapons (src/player/Weapons.ts) */
export interface KitEntry { id: string; name: string; ammoLabel: string; ammo: number; magazine: number; reserve: number; equipped: boolean; icon: IconId }

export interface GameMenuOptions {
  fullMap: FullMap;
  progress: Progress;
  inventory: Inventory;
  /** the unlocked weapons, held one first */
  kit: () => KitEntry[];
  /** hold a weapon from the Inventory tab */
  onEquip?: (id: string) => void;
}

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

export class GameMenu {
  readonly root: HTMLElement;
  private sheet: HTMLElement;
  private tabBar: HTMLElement;
  private panels: Record<MenuTab, HTMLElement>;
  private hint: HTMLElement;
  private mapMeta: HTMLElement;
  private zoomChips: HTMLButtonElement[] = [];
  private _tab: MenuTab = 'settings';
  private _open = false;
  onOpen?: (tab: MenuTab) => void;
  onClose?: () => void;
  onExit?: () => void;

  constructor(private opts: GameMenuOptions) {
    const def = getActiveChunk();
    this.root = el('ws-gmenu');
    this.sheet = el('ws-gmenu-sheet ws-glass');
    this.sheet.innerHTML = `
      <div class="ws-gmenu-head">
        <div><div class="ws-gmenu-title">Menu</div><div class="ws-gmenu-sub">${esc(def.displayName)} · Shard 1</div></div>
        <button class="ws-gmenu-close" type="button">Close</button>
      </div>`;
    this.tabBar = el('ws-gmenu-tabs');
    for (const t of TABS) {
      const b = el('ws-gmenu-tab', esc(t.label), 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['tab'] = t.id;
      b.addEventListener('click', () => this.select(t.id));
      this.tabBar.append(b);
    }
    this.sheet.append(this.tabBar);
    const body = el('ws-gmenu-body');
    this.panels = { map: el('ws-gmenu-panel map'), inventory: el('ws-gmenu-panel scroll'), achievements: el('ws-gmenu-panel scroll'), settings: el('ws-gmenu-panel scroll') };
    for (const p of Object.values(this.panels)) { if (p.classList.contains('scroll')) p.dataset['scroll'] = ''; body.append(p); } // index.html swallows touchmove outside [data-scroll]
    this.sheet.append(body);
    this.hint = el('ws-gmenu-hint');
    this.sheet.append(this.hint);
    this.root.append(this.sheet);
    document.body.append(this.root);

    // ── MAP: the FullMap canvas lives inside this panel (Map.ts embedded mode) ──
    this.mapMeta = el('ws-gmenu-mapmeta', `${esc(def.displayName)} · ${CHUNK_SIZE} m`);
    const frame = el('ws-gmenu-mapframe');
    opts.fullMap.mount(frame);
    const foot = el('ws-gmenu-mapfoot');
    const zooms = el('ws-gmenu-zooms');
    for (const z of [1, 2, 4]) {
      const b = el('ws-gmenu-zoom', `${z}×`, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['z'] = String(z);
      b.addEventListener('click', () => { opts.fullMap.setZoom(z); this.syncZoom(); });
      zooms.append(b); this.zoomChips.push(b);
    }
    foot.append(zooms, el('ws-gmenu-legend', `<span><i class="poi">${icon('poi')}</i>POI</span><span><i class="you">${icon('you')}</i>You</span>`));
    this.panels.map.append(this.mapMeta, frame, foot);
    opts.fullMap.onZoom = () => this.syncZoom();

    // ── SETTINGS ──
    this.applyBtn = this.buildSettings();

    // close: the CLOSE button, the backdrop (desktop habit), Esc
    const closeBtn = this.sheet.querySelector('.ws-gmenu-close'); if (!closeBtn) throw new Error('GameMenu: no .ws-gmenu-close');
    closeBtn.addEventListener('click', () => { this.close(); });
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
    document.addEventListener('keydown', (e) => {
      if (!this._open) return;
      if (e.code === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.code === 'KeyM') this.close();
    });
    window.addEventListener('resize', () => { if (this._open && this._tab === 'map') opts.fullMap.fit(); });
    opts.progress.onChange = () => { if (this._open) this.renderAchievements(); };
    opts.inventory.onChange = () => { if (this._open) this.renderInventory(); };
    this.select('settings');
  }

  get isOpen(): boolean { return this._open; }
  get tab(): MenuTab { return this._tab; }

  open(tab: MenuTab = this._tab): void {
    this.select(tab);
    if (this._open) return;
    this._open = true;
    this.root.classList.add('show');
    this.refresh();
    if (tab === 'map') this.opts.fullMap.show();
    this.onOpen?.(tab);
  }
  /** `silent` = no onClose (exit to the main menu: the HUD handles the world itself) */
  close(silent = false): void {
    if (!this._open) return;
    this._open = false;
    this.root.classList.remove('show');
    this.opts.fullMap.hide();
    if (!silent) this.onClose?.();
  }
  toggle(tab: MenuTab): void { if (this._open && this._tab === tab) this.close(); else this.open(tab); }

  select(tab: MenuTab): void {
    this._tab = tab;
    for (const b of this.tabBar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tab'] === tab);
    for (const [id, p] of Object.entries(this.panels)) p.classList.toggle('active', id === tab);
    this.hint.textContent = HINTS[tab];
    if (this._open) { if (tab === 'map') { this.opts.fullMap.show(); this.syncZoom(); } else this.opts.fullMap.hide(); }
    if (tab === 'inventory') this.renderInventory();
    if (tab === 'achievements') this.renderAchievements();
  }

  /** re-render the data tabs */
  refresh(): void { this.renderInventory(); this.renderAchievements(); this.syncZoom(); }

  private syncZoom() {
    const z = this.opts.fullMap.zoom;
    for (const b of this.zoomChips) b.classList.toggle('active', Math.abs(Number(b.dataset['z']) - z) < 0.01);
  }

  // ── INVENTORY ──
  private renderInventory() {
    const p = this.panels.inventory; p.replaceChildren();
    p.append(el('ws-gmenu-label', 'Equipped'));
    for (const w of this.opts.kit()) {
      const pct = w.magazine ? Math.round((w.ammo / w.magazine) * 100) : 0;
      const card = el(`ws-gmenu-weapon${w.equipped ? ' equipped' : ''}`, `
        <i class="ws-gmenu-wicon">${icon(w.icon)}</i>
        <div class="ws-gmenu-wbody">
          <div class="ws-gmenu-wname">${esc(w.name)}</div>
          ${w.ammoLabel ? `<div class="ws-gmenu-wammo">${esc(w.ammoLabel)} · ${w.ammo} / ${w.magazine}${w.reserve ? ` + ${w.reserve}` : ''}</div>
          <div class="ws-bar"><i style="width:${pct}%"></i></div>` : '<div class="ws-gmenu-wammo">Melee</div>'}
        </div>
        <span class="ws-gmenu-chip">${w.equipped ? 'Equipped' : 'Hold'}</span>`, 'button');
      (card as HTMLButtonElement).type = 'button';
      card.addEventListener('click', () => { if (!w.equipped) { this.opts.onEquip?.(w.id); this.renderInventory(); } });
      p.append(card);
    }
    const items = this.opts.inventory.items;
    p.append(el('ws-gmenu-label', `Pack · ${items.length} / ${PACK_SLOTS}`));
    const grid = el('ws-gmenu-grid');
    for (let i = 0; i < PACK_SLOTS; i++) {
      const it = items[i];
      grid.append(it
        ? el('ws-gmenu-slot', `<i class="ws-gmenu-sicon">${icon(it.icon)}</i><b class="ws-gmenu-count">×${it.count}</b><span class="ws-gmenu-sname">${esc(it.label)}</span>`)
        : el('ws-gmenu-slot empty'));
    }
    p.append(grid);
  }

  // ── ACHIEVEMENTS ──
  private renderAchievements() {
    const pr = this.opts.progress, p = this.panels.achievements; p.replaceChildren();
    const rows = pr.rows, n = rows.length, e = pr.earnedCount;
    const def = getActiveChunk();
    p.append(el('ws-gmenu-label', `${esc(def.displayName)} · ${e} / ${n} earned`));
    p.append(el('ws-bar ws-gmenu-total', `<i style="width:${n ? (e / n) * 100 : 0}%"></i>`));
    p.append(el('ws-gmenu-label', 'Your title'));
    const t = pr.title;
    p.append(el(`ws-gmenu-titlecard${t ? '' : ' none'}`, `
      <i class="ws-gmenu-laurel">${icon('laurel')}</i>
      <div><div class="ws-gmenu-titletext">${t ? esc(t.title) : 'No title yet'}</div>
      <div class="ws-gmenu-titlesub">${t ? 'Shown under your name in multiplayer' : 'Earn one below'}</div></div>`));
    p.append(el('ws-gmenu-label', 'Shard achievements'));
    if (!n) p.append(el('ws-gmenu-empty', 'This shard has no achievements yet.'));
    for (const r of rows) {
      const row = el(`ws-gmenu-ach${r.earned ? ' earned' : ''}${r.active ? ' active' : ''}`, `
        <i class="ws-gmenu-aicon ${r.def.icon}">${icon(r.def.icon)}</i>
        <div class="ws-gmenu-abody">
          <div class="ws-gmenu-aname">${esc(r.def.name)}</div>
          <div class="ws-gmenu-agoal">${esc(r.def.goal)} · ${r.count} / ${r.def.count}</div>
          <div class="ws-bar"><i style="width:${(r.count / r.def.count) * 100}%"></i></div>
        </div>
        <div class="ws-gmenu-areward">
          <i class="ws-gmenu-amark">${icon(r.earned ? 'check' : 'lock')}</i>
          <div><div class="ws-gmenu-atitle">${esc(r.def.title)}</div>${r.active ? '<span class="ws-gmenu-chip">Active</span>' : ''}</div>
        </div>`, 'button');
      (row as HTMLButtonElement).type = 'button';
      row.addEventListener('click', () => { if (r.earned) pr.wear(r.def.id); });
      p.append(row);
    }
  }

  // ── SETTINGS ──
  /** builds the Settings tab; returns the RESTART TO APPLY button (see `markReload`) */
  private buildSettings(): HTMLButtonElement {
    const p = this.panels.settings;
    const resume = el('ws-gmenu-btn resume', 'Resume', 'button') as HTMLButtonElement; resume.type = 'button';
    resume.addEventListener('click', () => this.close());
    const exit = el('ws-gmenu-btn exit', 'Exit to main menu', 'button') as HTMLButtonElement; exit.type = 'button';
    exit.addEventListener('click', () => { this.close(true); this.onExit?.(); });
    p.append(resume, exit, el('ws-gmenu-rule'));

    const sw = (key: SettingKey, label: string) => {
      const b = el('ws-gmenu-switch', `<span class="ws-gmenu-swlabel">${label}</span><i class="ws-gmenu-pill"></i>`, 'button') as HTMLButtonElement; b.type = 'button'; b.setAttribute('role', 'switch');
      const sync = (v: boolean) => { b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); };
      sync(getSetting(key)); onSetting(key, sync);
      b.addEventListener('click', () => setSetting(key, !getSetting(key)));
      return b;
    };
    p.append(el('ws-gmenu-label', 'Gameplay'), sw('aimAssist', 'Aim assist'), sw('tracers', 'Tracer bolts'));

    // graphics: the boot prefs in src/core/tier.ts (read at start-up → reload to apply)
    const seg = (label: string, options: { v: string; text: string }[], get: () => string, set: (v: string) => void) => {
      const row = el('ws-gmenu-row', `<span class="ws-gmenu-swlabel">${label}</span>`);
      const box = el('ws-gmenu-seg');
      const paint = () => { for (const c of box.children) (c as HTMLElement).classList.toggle('active', (c as HTMLElement).dataset['v'] === get()); };
      for (const o of options) {
        const b = el('ws-gmenu-segbtn', o.text, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['v'] = o.v;
        b.addEventListener('click', () => { set(o.v); paint(); this.markReload(); });
        box.append(b);
      }
      paint(); row.append(box); return row;
    };
    const dprOpts = [{ v: '1', text: '1.0×' }, { v: '1.25', text: '1.25×' }, { v: '1.5', text: '1.5×' }, { v: 'auto', text: 'Auto' }];
    const aaOpts = [{ v: 'on', text: 'On' }, { v: 'off', text: 'Off' }, { v: 'auto', text: 'Auto' }];
    p.append(el('ws-gmenu-label', 'Graphics'),
      seg('Render scale', dprOpts, () => gfxPrefs.dpr, (v) => { if (v === 'auto' || v === '1' || v === '1.25' || v === '1.5') { gfxPrefs.dpr = v; saveGfxPrefs(); } }),
      seg('Anti-aliasing', aaOpts, () => gfxPrefs.aa, (v) => { if (v === 'auto' || v === 'on' || v === 'off') { gfxPrefs.aa = v; saveGfxPrefs(); } }));
    const apply = el('ws-gmenu-apply', 'Restart to apply', 'button') as HTMLButtonElement; apply.type = 'button'; apply.hidden = true;
    apply.addEventListener('click', () => location.reload());
    p.append(apply);

    // audio: master volume (Settings 'volume', 0..1) — main.ts drives the AudioContext gain from it
    const vol = el('ws-gmenu-row', '<span class="ws-gmenu-swlabel">Master volume</span>');
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.className = 'ws-gmenu-slider';
    slider.value = String(Math.round(getNumber('volume') * 100));
    slider.addEventListener('input', () => setNumber('volume', Number(slider.value) / 100));
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    vol.append(slider);
    // music volume (Settings 'music', 0..1) — src/audio/Music.ts drives its bus from it
    const mus = el('ws-gmenu-row', '<span class="ws-gmenu-swlabel">Music</span>');
    const mslider = document.createElement('input'); mslider.type = 'range'; mslider.min = '0'; mslider.max = '100'; mslider.className = 'ws-gmenu-slider';
    mslider.value = String(Math.round(getNumber('music') * 100));
    mslider.addEventListener('input', () => setNumber('music', Number(mslider.value) / 100));
    mslider.addEventListener('pointerdown', (e) => e.stopPropagation());
    mus.append(mslider);
    p.append(el('ws-gmenu-label', 'Audio'), vol, mus);
    return apply;
  }
  /** the render scale / AA rows changed a boot pref (src/core/tier.ts `gfxPrefs`) — only a reload applies it */
  private applyBtn: HTMLButtonElement;
  private markReload(): void { this.applyBtn.hidden = false; }
}
