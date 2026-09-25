/**
 * The in-game MENU — one overlay, four tabs: MAP · INVENTORY · ACHIEVEMENTS · SETTINGS (art/menu/round-2-tabs/menu-tab-*.png), plus FEEDBACK once
 * a reviewer has unlocked the review inbox in Settings → REVIEW (src/ui/review.ts; the tab's composer is the lazy Feedback.ts).
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
 *   menu.onFeedbackTab = (panel) => …          // the FEEDBACK tab was selected: mount the composer into `panel`
 *
 * `split` (E124, the user: "two menu buttons, inventory and pause. Pause takes you to settings and feedback. Inventory to
 * map / inventory / trophies"): the one overlay shows one GROUP of tabs at a time — PAUSE: Settings (+ Feedback), titled
 * PAUSED; BAG (the minimap's corner button, src/ui/BagButton.ts; the minimap tap and M too): Map · Inventory ·
 * Achievements, titled BAG. Off (?bagbtn=0) = the old one menu with every tab.
 */
import { getActiveChunk } from '../chunks/registry';
import type { ChunkDef } from '../chunks/ChunkDef';
import { CHUNK_SIZE } from '../core/config';
import type { FullMap } from './Map';
import type { Progress } from '../game/Progress';
import type { Inventory } from '../game/Inventory';
import { icon, type IconId } from './icons';
import { completeEntry } from './ShardComplete';
import { getSetting, setSetting, onSetting, getNumber, setNumber, NUM_RANGE, getMusicStyle, setMusicStyle, onMusicStyle, getSfxSet, setSfxSet, onSfxSet, setting, saveSetting, onSettingChange, settingsReloadUrl, type SettingKey, type NumberKey, type MusicStyle, type SfxSet, type OptionValue } from './Settings';
import { MUSIC_CREDIT, sfxCredit, onSfxCredit } from '../audio/credits';
import { onAudioBusy } from '../audio/preload';
import { CAN_VIBRATE } from './haptics';
import { lockReview, onReview, quickNote, reviewUnlocked, setQuickNote, unlockReview } from './review';
import { isDev, onDev } from '../core/devMode';
import { bindDevToggle, devSwitchRows } from './devSwitch';

export type MenuTab = 'map' | 'inventory' | 'achievements' | 'settings' | 'feedback';
const TABS: { id: MenuTab; label: string }[] = [
  { id: 'map', label: 'Map' }, { id: 'inventory', label: 'Inventory' }, { id: 'achievements', label: 'Achievements' }, { id: 'settings', label: 'Settings' },
  { id: 'feedback', label: 'Feedback' }, // only while the review inbox is unlocked (syncReview)
];
/** the two menus when `split`: which one a tab lives in */
type MenuGroup = 'pause' | 'bag';
const GROUP: Record<MenuTab, MenuGroup> = { map: 'bag', inventory: 'bag', achievements: 'bag', settings: 'pause', feedback: 'pause' };
const TITLE: Record<MenuGroup, string> = { pause: 'Paused', bag: 'Bag' };
/** the menu's keys (Esc is handled apart: it pauses, and closes whatever tab is open) */
const KEY_TAB: Partial<Record<string, MenuTab>> = { KeyM: 'map', KeyI: 'inventory' };
/** what a Settings row's "applies when" reads: the weapons you hold now and the shard */
interface SettingsCtx { weapons: ReadonlySet<string>; melee: boolean; chunk: ChunkDef }
type When = (c: SettingsCtx) => boolean;
const HINTS: Record<MenuTab, string> = { map: 'Drag to pan · pinch to zoom', inventory: 'Tap a weapon to hold it · a skin to wear it', achievements: 'Tap an earned title to wear it', settings: 'Tap outside or Esc to resume', feedback: 'Enter sends · the frame under the menu goes with it' };

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
  /** the shard's wearable skins you own (Nalati: src/player/nalatiSkins.ts) — listed under the weapons, tap to wear / take off */
  skins?: () => SkinRow[];
  onWearSkin?: (id: string) => void;
  /** two menus in one overlay (E124): PAUSE = Settings + Feedback, BAG = Map · Inventory · Achievements */
  split?: boolean;
}
export interface SkinRow { id: string; name: string; blurb: string; worn: boolean }

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

export class GameMenu {
  readonly root: HTMLElement;
  private sheet: HTMLElement;
  private tabBar: HTMLElement;
  private title: HTMLElement;
  private panels: Record<MenuTab, HTMLElement>;
  private hint: HTMLElement;
  private mapMeta: HTMLElement;
  private mapQuest: HTMLElement;
  private zoomChips: HTMLButtonElement[] = [];
  private _tab: MenuTab = 'settings';
  private _open = false;
  onOpen?: (tab: MenuTab) => void;
  onClose?: () => void;
  onExit?: () => void;
  onFeedbackTab?: (panel: HTMLElement) => void;
  /** may a key open the menu now — the HUD says: in the world, no composer up (`hud.menu = …` sets it); closed until then */
  keyGate: () => boolean = () => false;
  /** the Settings rows that apply only sometimes (E130: hidden, not greyed, when they do not apply) — see `applies()` */
  private gated: { el: HTMLElement; when: When }[] = [];

  constructor(private opts: GameMenuOptions) {
    const def = getActiveChunk();
    this.root = el('ws-gmenu');
    this.root.inert = true; // closed until open()
    this.sheet = el('ws-gmenu-sheet ws-glass');
    this.sheet.innerHTML = `
      <div class="ws-gmenu-head">
        <div><div class="ws-gmenu-title">Menu</div><div class="ws-gmenu-sub">${esc(def.displayName)}</div></div>
        <button class="ws-gmenu-dev" type="button">Dev</button>
        <button class="ws-gmenu-close" type="button">Close</button>
      </div>`;
    bindDevToggle(this.sheet.querySelector<HTMLElement>('.ws-gmenu-dev') ?? el('ws-gmenu-dev')); // E140: developer mode from the header
    this.tabBar = el('ws-gmenu-tabs');
    for (const t of TABS) {
      const b = el('ws-gmenu-tab', esc(t.label), 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['tab'] = t.id;
      b.addEventListener('click', () => this.select(t.id));
      this.tabBar.append(b);
    }
    this.sheet.append(this.tabBar);
    const body = el('ws-gmenu-body');
    this.panels = { map: el('ws-gmenu-panel map'), inventory: el('ws-gmenu-panel scroll'), achievements: el('ws-gmenu-panel scroll'), settings: el('ws-gmenu-panel scroll'), feedback: el('ws-gmenu-panel scroll') };
    for (const p of Object.values(this.panels)) { if (p.classList.contains('scroll')) p.dataset['scroll'] = ''; body.append(p); } // index.html swallows touchmove outside [data-scroll]
    this.sheet.append(body);
    this.hint = el('ws-gmenu-hint');
    this.sheet.append(this.hint);
    this.root.append(this.sheet);
    document.body.append(this.root);

    // ── MAP: the FullMap canvas lives inside this panel (Map.ts embedded mode) ──
    this.mapMeta = el('ws-gmenu-mapmeta', `${esc(def.displayName)} · ${CHUNK_SIZE} m`);
    this.mapQuest = el('ws-gmenu-mapquest');
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
    this.panels.map.append(this.mapMeta, this.mapQuest, frame, foot);
    opts.fullMap.onZoom = () => this.syncZoom();

    // ── SETTINGS ──
    this.buildSettings();

    // close: the CLOSE button, the backdrop (desktop habit), Esc
    const closeBtn = this.sheet.querySelector('.ws-gmenu-close'); if (!closeBtn) throw new Error('GameMenu: no .ws-gmenu-close');
    const title = this.sheet.querySelector<HTMLElement>('.ws-gmenu-title'); if (!title) throw new Error('GameMenu: no .ws-gmenu-title');
    this.title = title;
    closeBtn.addEventListener('click', () => { this.close(); });
    this.root.addEventListener('pointerdown', (e) => { if (e.target === this.root) this.close(); });
    // the keyboard's menu keys, all here (E130): M = the Map, I = the Inventory, Esc = pause (Settings); the same key again
    // closes, another one switches tab. One listener, so a key is handled once — main.ts's own M listener re-opened the
    // map the M had just closed, and the HUD's Esc (nolock) opened the menu that this listener then closed (E32)
    document.addEventListener('keydown', (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target, typing = t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      const tab = e.code === 'Escape' ? 'settings' : typing ? undefined : KEY_TAB[e.code];
      if (tab === undefined) return;
      if (this._open) { if (tab === this._tab || e.code === 'Escape') this.close(); else this.open(tab); }
      else if (this.keyGate()) this.open(tab);
      else return;
      e.preventDefault(); e.stopImmediatePropagation();
    });
    window.addEventListener('resize', () => { if (this._open && this._tab === 'map') opts.fullMap.fit(); });
    opts.progress.onChange = () => { if (this._open) this.renderAchievements(); };
    opts.inventory.onChange = () => { if (this._open) this.renderInventory(); };
    this.select('settings');
    this.syncReview(); onReview(() => this.syncReview());
  }

  /** the FEEDBACK tab exists only while the review inbox is unlocked */
  private syncReview(): void {
    if (!reviewUnlocked() && this._tab === 'feedback') this.select('settings');
    else this.syncTabs();
  }
  /** which tabs show: FEEDBACK only while the review inbox is unlocked; split, only the open group's (one tab = no bar) */
  private syncTabs(): void {
    const review = reviewUnlocked(), split = this.opts.split === true, group = GROUP[this._tab];
    let shown = 0;
    for (const b of this.tabBar.children) {
      const id = (b as HTMLElement).dataset['tab'] as MenuTab;
      const on = (id !== 'feedback' || review) && (!split || GROUP[id] === group);
      (b as HTMLElement).hidden = !on;
      if (on) shown++;
    }
    this.tabBar.classList.toggle('review', shown >= 5);
    this.tabBar.hidden = shown <= 1;
    this.title.textContent = split ? TITLE[group] : 'Menu';
  }

  get isOpen(): boolean { return this._open; }
  get tab(): MenuTab { return this._tab; }

  open(tab: MenuTab = this._tab): void {
    this.select(tab);
    if (this._open) return;
    this._open = true;
    this.root.classList.add('show');
    this.root.inert = false;
    this.refresh();
    this.applies();
    if (tab === 'map') { this.opts.fullMap.show(); this.renderQuest(); }
    if (tab === 'feedback') this.onFeedbackTab?.(this.panels.feedback);
    this.onOpen?.(tab);
  }
  /** `silent` = no onClose (exit to the main menu: the HUD handles the world itself) */
  close(silent = false): void {
    if (!this._open) return;
    this._open = false;
    this.root.classList.remove('show');
    this.root.inert = true; // faded to opacity 0 but still in the DOM: out of the tab order and the accessibility tree (VoiceOver / XCUITest)
    this.opts.fullMap.hide();
    if (!silent) this.onClose?.();
  }
  toggle(tab: MenuTab): void { if (this._open && this._tab === tab) this.close(); else this.open(tab); }
  /** an extra header button left of CLOSE, in CLOSE's look (`cls` styles it further — the Compendium's JOURNAL) */
  addHeadButton(label: string, cls: string, onClick: () => void): HTMLButtonElement {
    const close = this.sheet.querySelector('.ws-gmenu-close');
    const b = el(`ws-gmenu-close ${cls}`, esc(label), 'button') as HTMLButtonElement; b.type = 'button';
    b.addEventListener('click', onClick);
    close?.before(b);
    return b;
  }

  select(tab: MenuTab): void {
    this._tab = tab;
    for (const b of this.tabBar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tab'] === tab);
    for (const [id, p] of Object.entries(this.panels)) p.classList.toggle('active', id === tab);
    this.hint.textContent = HINTS[tab];
    this.syncTabs();
    if (this._open) { if (tab === 'map') { this.opts.fullMap.show(); this.syncZoom(); this.renderQuest(); } else this.opts.fullMap.hide(); }
    if (tab === 'inventory') this.renderInventory();
    if (tab === 'achievements') this.renderAchievements();
    if (tab === 'settings') this.applies();
    if (tab === 'feedback' && this._open) this.onFeedbackTab?.(this.panels.feedback);
  }

  /** re-render the data tabs */
  refresh(): void { this.renderInventory(); this.renderAchievements(); this.syncZoom(); }

  /** the quest card over the map: chapter title, the full objective, its sub-steps (the HUD shows only the short chip, E51) */
  private renderQuest(): void {
    const q = this.opts.fullMap.quest;
    this.mapQuest.hidden = q === null || q.objective === '';
    if (!q) return;
    this.mapQuest.innerHTML = `<div class="ws-gmenu-mapquest-title">${esc(q.title)}</div><div class="ws-gmenu-mapquest-obj"><i></i>${esc(q.objective)}</div>${q.hint ? `<div class="ws-gmenu-mapquest-hint">${esc(q.hint)}</div>` : ''}`;
  }

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
    const skins = this.opts.skins?.() ?? [];
    if (skins.length > 0) {
      p.append(el('ws-gmenu-label', 'Skins'));
      for (const s of skins) {
        const card = el(`ws-gmenu-weapon${s.worn ? ' equipped' : ''}`, `
          <i class="ws-gmenu-wicon">${icon('laurel')}</i>
          <div class="ws-gmenu-wbody">
            <div class="ws-gmenu-wname">${esc(s.name)}</div>
            <div class="ws-gmenu-wammo">${esc(s.blurb)}</div>
          </div>
          <span class="ws-gmenu-chip">${s.worn ? 'Worn' : 'Wear'}</span>`, 'button');
        (card as HTMLButtonElement).type = 'button';
        card.addEventListener('click', () => { this.opts.onWearSkin?.(s.id); this.renderInventory(); });
        p.append(card);
      }
    }
    const items = this.opts.inventory.items;
    const slots = this.opts.inventory.slots;
    p.append(el('ws-gmenu-label', `Pack · ${items.length} / ${slots}`));
    const grid = el('ws-gmenu-grid');
    for (let i = 0; i < slots; i++) {
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
    // the shard's "complete" card (E132, src/ui/ShardComplete.ts), once its quest is done: a row on top that reopens it
    const done = completeEntry();
    if (done) {
      const row = el('ws-gmenu-done', `<i class="ws-gmenu-done-icon">${icon('laurel')}</i><div class="ws-gmenu-abody"><div class="ws-gmenu-aname">${esc(done.label)}</div><div class="ws-gmenu-agoal">${esc(done.sub)}</div></div><span class="ws-gmenu-chip">Open</span>`, 'button');
      (row as HTMLButtonElement).type = 'button';
      row.addEventListener('click', () => { this.close(true); done.open(); });   // silent: the card resumes play itself
      p.append(row);
    }
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
  /** builds the Settings tab: only what applies live (E55) — renderer, quality, render scale, AA and touch controls
   *  are read at boot and live in main menu ▸ Settings (src/ui/BootSettings.ts, APPLY & RELOAD). Two cards (E81, the user's
   *  split): SETTINGS holds what ships with the finished game; DEBUG holds the variant pickers and taste toggles that
   *  exist only while the look and sound are being decided — each leaves that card once it is locked in (E78 the
   *  painted horizon, E83 the photo sky, E85 the colour grade, E87 the lighting, E88 the post) */
  private buildSettings(): void {
    const panel = this.panels.settings;
    const resume = el('ws-gmenu-btn resume', 'Resume', 'button') as HTMLButtonElement; resume.type = 'button';
    resume.addEventListener('click', () => this.close());
    const exit = el('ws-gmenu-btn exit', 'Exit to main menu', 'button') as HTMLButtonElement; exit.type = 'button';
    exit.addEventListener('click', () => { this.close(true); this.onExit?.(); });
    const p = el('ws-gmenu-card', '<div class="ws-gmenu-cardtitle">Settings</div>');
    const dbg = el('ws-gmenu-card debug', '<div class="ws-gmenu-cardtitle">Debug<small>for playtests — goes away when the game ships</small></div>');
    // developer mode only (E140, the user's 7a): the Settings ▸ Developer switch shows / hides it live
    dbg.hidden = !isDev(); onDev((on) => { dbg.hidden = !on; });
    panel.append(resume, exit, p, dbg);

    const sw = (key: SettingKey, label: string) => {
      const b = el('ws-gmenu-switch', `<span class="ws-gmenu-swlabel">${label}</span><i class="ws-gmenu-pill"></i>`, 'button') as HTMLButtonElement; b.type = 'button'; b.setAttribute('role', 'switch');
      const sync = (v: boolean) => { b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); };
      sync(getSetting(key)); onSetting(key, sync);
      b.addEventListener('click', () => setSetting(key, !getSetting(key)));
      return b;
    };
    // "applies when" (E130): a row that does not apply to the weapons you hold or to this shard is hidden (re-read on every
    // open — a weapon unlocked mid-run brings its rows); a section label goes with its last row
    const section = (card: HTMLElement, label: string, ...rows: (HTMLElement | [When, HTMLElement])[]): void => {
      const whens: When[] = [];
      const els = rows.map((r) => { if (Array.isArray(r)) { whens.push(r[0]); this.gated.push({ el: r[1], when: r[0] }); return r[1]; } whens.push(() => true); return r; });
      const head = el('ws-gmenu-label', label);
      this.gated.push({ el: head, when: (c) => whens.some((w) => w(c)) });
      card.append(head, ...els);
    };
    const ranged: When = (c) => c.weapons.has('crossbow') || c.weapons.has('rifle'); // the bolts / rounds draw tracers: Nalati's bow draws none (NALATI-MERGE F7)
    section(p, 'Gameplay', sw('aimAssist', 'Aim assist'),
      [ranged, sw('tracers', 'Tracer bolts')],
      [(c) => c.weapons.has('bow'), sw('huntersEye', "Hunter's eye")], // the bow's drop arc (Bow.ts): on by default on touch
      [() => CAN_VIBRATE, sw('haptics', 'Vibration')]); // Android only — iOS Safari has no vibrate (src/ui/haptics.ts)

    // controls: the 0.5–2× look multipliers (Settings 'look' / 'swingLook') — read live by TouchControls + Player's mouse look
    const mult = (key: NumberKey, label: string) => {
      const [lo, hi] = NUM_RANGE[key];
      const row = el('ws-gmenu-row', `<span class="ws-gmenu-swlabel">${label}</span><b class="ws-gmenu-val"></b>`);
      const val = row.querySelector<HTMLElement>('.ws-gmenu-val');
      const s = document.createElement('input'); s.type = 'range'; s.className = 'ws-gmenu-slider';
      s.min = String(lo * 100); s.max = String(hi * 100); s.step = '5'; s.value = String(Math.round(getNumber(key) * 100));
      const paint = () => { if (val) val.textContent = `${(Number(s.value) / 100).toFixed(2)}×`; };
      s.addEventListener('input', () => { setNumber(key, Number(s.value) / 100); paint(); });
      s.addEventListener('pointerdown', (e) => e.stopPropagation());
      paint(); row.append(s); return row;
    };
    section(p, 'Controls', mult('look', 'Look speed'), [(c) => c.melee, mult('swingLook', 'Swing turn speed')]); // a swing's turn: the blades

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
    // music style (Settings 'musicStyle', project/archive/2026-09-23-music.md v3): the MiniMax-Music3 scores or the v1 synth — Music.ts crossfades on a bar;
    // sound effects (Settings 'sfxSet'): the generated set (MOSS-SoundEffect v2 + Stable Audio 3 Medium) or all-synth — Audio.ts swaps them
    const picker = <T extends string>(label: string, options: { v: T; text: string }[], get: () => T, set: (v: T) => void, on: (fn: () => void) => void) => {
      const row = el('ws-gmenu-row', `<span class="ws-gmenu-swlabel">${label}</span>`);
      const box = el('ws-gmenu-seg');
      const paint = () => { for (const c of box.children) (c as HTMLElement).classList.toggle('active', (c as HTMLElement).dataset['v'] === get()); };
      for (const o of options) {
        const b = el('ws-gmenu-segbtn', o.text, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['v'] = o.v;
        b.addEventListener('click', () => { set(o.v); paint(); });
        box.append(b);
      }
      paint(); on(paint); row.append(box); return row;
    };
    const styles: { v: MusicStyle; text: string }[] = [{ v: 'piano', text: 'Piano' }, { v: 'orchestral', text: 'Orchestral' }, { v: 'folk', text: 'Folk' }, { v: 'synth', text: 'Synth' }];
    const sets: { v: SfxSet; text: string }[] = [{ v: 'best', text: 'Generated' }, { v: 'synth', text: 'Synth' }];
    const style = picker('Music style', styles, getMusicStyle, setMusicStyle, (fn) => { onMusicStyle(fn); });
    const sfx = picker('Sound effects', sets, getSfxSet, setSfxSet, (fn) => { onSfxSet(fn); });
    // a pick decodes from the offline cache (project/archive/2026-09-23-preload-offline.md): a spinner by the label only past 300 ms
    onAudioBusy((kind, on) => { (kind === 'music' ? style : sfx).classList.toggle('busy', on); });
    // the licences ask for the models' names in the UI: MiniMax-Music3, and the sfx set's credit ("Powered by Stability AI")
    const sfxNote = el('ws-gmenu-note');
    const paintCredit = () => { const c = sfxCredit(getSfxSet()); sfxNote.textContent = c; sfxNote.hidden = c === ''; };
    paintCredit(); onSfxSet(paintCredit); onSfxCredit(paintCredit);
    p.append(el('ws-gmenu-label', 'Audio'), vol, mus, el('ws-gmenu-note', MUSIC_CREDIT), sfxNote);
    dbg.append(el('ws-gmenu-label', 'Audio variants'), style, sfx);
    // lock-on (E50, src/player/LockOnTarget.ts): how hard the view follows a locked enemy (Gentle = Jake's pick; Off keeps the
    // lock — the reticle, orbit strafing, the lunge, switching — but never turns the view: the motion-sickness escape)
    const lockCams: { v: '1' | '0.5' | '0'; text: string }[] = [{ v: '1', text: 'Follow' }, { v: '0.5', text: 'Gentle' }, { v: '0', text: 'Off' }];
    const lockCam = picker('Lock-on camera', lockCams, () => (getNumber('lockCam') >= 0.75 ? '1' : getNumber('lockCam') > 0.1 ? '0.5' : '0'), (v) => setNumber('lockCam', Number(v)), () => undefined);
    p.append(el('ws-gmenu-label', 'Lock-on'), lockCam, sw('autoLock', 'Auto re-lock'), el('ws-gmenu-note', 'LOCK (Z / middle mouse) locks the enemy nearest the centre. Flick the LOOK pad (mouse flick / wheel) to switch; MOVE circles it.'));

    // look (E55, live — src/ui/Settings.ts OPTIONS): the shard's day clock (src/world/WorldClock.ts: Driftwood's DayNight, Nalati's
    // DayClock — NALATI-MERGE F8; main.ts subscribes). The painted horizon (E78) and the colour grade (E85) are locked on. The
    // boot-time graphics picks are on the title's Settings.
    {
      const times: { v: OptionValue<'time'>; text: string }[] = [{ v: 'live', text: 'Live' }, { v: 'midday', text: 'Midday' }, { v: 'golden', text: 'Golden' }, { v: 'sunset', text: 'Sunset' }, { v: 'night', text: 'Night' }];
      const time = picker('Time of day', times, () => setting('time'), (v) => { saveSetting('time', v); }, (fn) => { onSettingChange('time', fn); });
      section(dbg, 'Look', [(c) => c.chunk.style === 'lowpoly' || c.chunk.style === 'painterly', time]); // the shards with a day clock
      // Look Lab (E65) is done: the sky (E83), lighting (E87) and post (E88) picks are locked in and their switches gone (E136)
    }
    if (getActiveChunk().slug === 'pine-hollow') {
      // Pine Hollow's look lab (PH-L2): the day / night clock or the pre-remaster fixed sunset (a reload: the sky rig is built
      // once), and the clock's time of day
      const skies: { v: OptionValue<'pinesky'>; text: string }[] = [{ v: 'clock', text: 'Day / night' }, { v: 'sunset', text: 'Fixed sunset' }];
      const sky = picker('Sky', skies, () => setting('pinesky'), (v) => { saveSetting('pinesky', v); location.href = settingsReloadUrl(location.href); }, (fn) => { onSettingChange('pinesky', fn); });
      dbg.append(el('ws-gmenu-label', 'Look'), sky);
      if (setting('pinesky') === 'clock') {
        const times: { v: OptionValue<'time'>; text: string }[] = [{ v: 'live', text: 'Live' }, { v: 'midday', text: 'Midday' }, { v: 'golden', text: 'Golden' }, { v: 'sunset', text: 'Sunset' }, { v: 'night', text: 'Night' }];
        dbg.append(picker('Time of day', times, () => setting('time'), (v) => { saveSetting('time', v); }, (fn) => { onSettingChange('time', fn); }));
        // PH-L10: the weather (live: the dawn fog + the showers) or Clear, the look before it; Fog / Rain hold one (live)
        const weathers: { v: OptionValue<'weather'>; text: string }[] = [{ v: 'live', text: 'Live' }, { v: 'clear', text: 'Clear' }, { v: 'fog', text: 'Fog' }, { v: 'rain', text: 'Rain' }];
        dbg.append(picker('Weather', weathers, () => setting('weather'), (v) => { saveSetting('weather', v); }, (fn) => { onSettingChange('weather', fn); }));
      }
    }
    // the frame cap (PINE-HOLLOW PH-P1, tier.ts frameCapFps; live): Auto = Pine Hollow's phone tier at a locked 30, else uncapped
    const caps: { v: OptionValue<'fps'>; text: string }[] = [{ v: 'auto', text: 'Auto' }, { v: '30', text: '30' }, { v: '60', text: 'Uncapped' }];
    dbg.append(el('ws-gmenu-label', 'Frame rate'), picker('Frame cap', caps, () => setting('fps'), (v) => { saveSetting('fps', v); }, (fn) => { onSettingChange('fps', fn); }));
    // E142: the render scale follows the frame time (src/core/dynamicResolution.ts; live): Auto = Pine Hollow's phone tier
    const dyn: { v: OptionValue<'dynres'>; text: string }[] = [{ v: 'auto', text: 'Auto' }, { v: 'on', text: 'On' }, { v: 'off', text: 'Off' }];
    dbg.append(picker('Dynamic resolution', dyn, () => setting('dynres'), (v) => { saveSetting('dynres', v); }, (fn) => { onSettingChange('dynres', fn); }));
    dbg.append(el('ws-gmenu-note', 'Renderer, quality and render scale: Exit to main menu ▸ Settings.'));
    // Review is not debug (E140): playtesters unlock notes with it, so it stays in Settings, with the Developer switch
    p.append(this.buildReview(), ...devSwitchRows());
  }
  /** show only the Settings rows that apply now (E130: the weapons you hold, the shard) — every open and every Settings select */
  private applies(): void {
    const kit = this.opts.kit(), c: SettingsCtx = { weapons: new Set(kit.map((k) => k.id)), melee: kit.some((k) => k.icon === 'sword'), chunk: getActiveChunk() };
    for (const g of this.gated) g.el.hidden = !g.when(c);
  }
  /** Settings → REVIEW: a password unlocks the review inbox (src/ui/review.ts); unlocked, the Quick note switch + LOCK */
  private buildReview(): HTMLElement {
    const box = el('ws-gmenu-review');
    const render = () => {
      box.replaceChildren(el('ws-gmenu-label', 'Review'));
      if (!reviewUnlocked()) {
        const row = el('ws-gmenu-row');
        const input = document.createElement('input'); input.type = 'password'; input.className = 'ws-gmenu-input'; input.placeholder = 'Review password';
        input.autocomplete = 'off'; input.enterKeyHint = 'go';
        const go = el('ws-gmenu-unlock', 'Unlock', 'button') as HTMLButtonElement; go.type = 'button';
        const note = el('ws-gmenu-note', 'Playtesters: the password turns on in-game notes (F8 / ✎) with a screenshot.');
        const tryUnlock = async () => {
          go.disabled = true; note.textContent = 'Checking…';
          const r = await unlockReview(input.value);
          go.disabled = false;
          note.textContent = r === 'bad' ? 'Wrong password.' : r === 'offline' ? 'Could not reach the inbox — try again online.' : '';
        };
        // the menu listens for M / Esc and the player for WASD on document: typing a password must not reach them
        input.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); if (e.code === 'Enter') void tryUnlock(); });
        input.addEventListener('keyup', (e) => { e.stopPropagation(); });
        go.addEventListener('click', () => { void tryUnlock(); });
        row.append(input, go);
        box.append(row, note);
        return;
      }
      const sw = el('ws-gmenu-switch', '<span class="ws-gmenu-swlabel">Quick note (F8 / ✎)</span><i class="ws-gmenu-pill"></i>', 'button') as HTMLButtonElement; sw.type = 'button'; sw.setAttribute('role', 'switch');
      sw.classList.toggle('on', quickNote()); sw.setAttribute('aria-checked', String(quickNote()));
      sw.addEventListener('click', () => setQuickNote(!quickNote()));
      const lock = el('ws-gmenu-unlock', 'Lock', 'button') as HTMLButtonElement; lock.type = 'button';
      lock.addEventListener('click', () => lockReview());
      const row = el('ws-gmenu-row', '<span class="ws-gmenu-swlabel">Review inbox unlocked</span>');
      row.append(lock);
      box.append(sw, row, el('ws-gmenu-note', 'Notes go to the developers with a screenshot and where you stand. FEEDBACK tab above.'));
    };
    render(); onReview(render);
    return box;
  }
}
