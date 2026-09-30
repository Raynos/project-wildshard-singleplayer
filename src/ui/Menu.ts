/**
 * The in-game MENU — one overlay: the BAG (MAP · GEAR · FINDS · PACK · FEATS, E314) and PAUSE (SETTINGS), plus FEEDBACK once
 * a reviewer has unlocked the review inbox in Settings → REVIEW (src/ui/review.ts; the tab's composer is the lazy Feedback.ts).
 * Replaces the old pause box and the stand-alone full-map screen: tapping the minimap (or M) opens it on
 * the Map tab, the pause button / Esc opens it on Settings (the switches live there; RESUME and EXIT TO MAIN are the
 * header bar's two buttons since E178). Styled by src/ui/styles/gmenu.css (prefix ws-gmenu-). The world keeps running underneath, as the
 * full map always did; the overlay swallows touch so the pads don't move you.
 *
 *   const menu = new GameMenu({ fullMap, progress, inventory, kit, volume });
 *   hud.menu = menu;                          // HUD.setPaused → menu.open('settings'); menu.onClose → hud.onResume
 *   menu.open('map') / menu.close() / menu.isOpen / menu.tab
 *   menu.onExit = () => hud.exitToMenu();     // the PAUSE header's EXIT TO MAIN (E178)
 *   menu.refresh()                            // re-render the data tabs (kills, harvests, unlocks)
 *   menu.openBag()                            // the BAG on GEAR (the minimap corner's bag button)
 *   menu.setLoot({ gear, finds, wear })       // a shard's loot (src/game/loot/install.ts): GEAR's extras + the FINDS tab
 *   menu.onFeedbackTab = (panel) => …          // the FEEDBACK tab was selected: mount the composer into `panel`
 *
 * Two menus in one overlay (E124, the user: "two menu buttons, inventory and pause. Pause takes you to settings and
 * feedback. Inventory to map / inventory / trophies"; shipped: "I think we can ship that"): it shows one GROUP of tabs at
 * a time — PAUSE: Settings (+ Feedback), titled PAUSED; BAG (the minimap's corner button, src/ui/BagButton.ts; the minimap
 * tap and M too): Map · Inventory · Achievements, titled BAG. (The old one-menu-with-every-tab, `?bagbtn=0`, went in E162.)
 * E314 (Jake's picks, docs/plans/DRIFTWOOD-LOOT.md): the BAG is five icon tabs on every shard — MAP · GEAR (the paper doll:
 * the weapons and skins that used to head the Inventory, and the shard's loot) · FINDS (Driftwood's sticker book, hidden
 * where a shard has none) · PACK (the Inventory's junk grid) · FEATS (Achievements); Pine Hollow's JOURNAL sits before
 * FEATS. The panels are src/ui/bag.ts.
 */
import { getActiveChunk } from '../chunks/registry';
import type { ChunkDef } from '../chunks/ChunkDef';
import { CHUNK_SIZE } from '../core/config';
import type { FullMap } from './Map';
import type { Progress } from '../game/Progress';
import type { Inventory } from '../game/Inventory';
import { icon, type IconId } from './icons';
import { completeEntry } from './ShardComplete';
import { getSetting, setSetting, onSetting, getNumber, setNumber, NUM_RANGE, getSfxSet, onSfxSet, type SettingKey, type NumberKey } from './Settings';
import { MUSIC_CREDIT, sfxCredit, onSfxCredit } from '../audio/credits';
import { onAudioBusy } from '../audio/preload';
import { CAN_VIBRATE } from './haptics';
import { lockReview, onReview, quickNote, reviewUnlocked, setQuickNote, unlockReview } from './review';
import { isDev, onDev } from '../core/devMode';
import { bindDevToggle, devSwitchRows } from './devSwitch';
import { foldCard } from './cards';
import { buildDebugMenu, type DebugMenu } from './DebugMenu';
import { renderFinds, renderGear, type FindsView, type GearLoot } from './bag';

export type MenuTab = 'map' | 'gear' | 'finds' | 'inventory' | 'achievements' | 'settings' | 'feedback';
/** the BAG's tabs are icon tabs, one short word each (E314, Jake's pick board 8 A): MAP · GEAR · FINDS · PACK · FEATS on
 *  every shard (FINDS only where the shard has finds: Driftwood today; `inventory` is PACK, `achievements` FEATS) */
const TABS: { id: MenuTab; label: string; icon?: IconId }[] = [
  { id: 'map', label: 'Map', icon: 'map' }, { id: 'gear', label: 'Gear', icon: 'sword' }, { id: 'finds', label: 'Finds', icon: 'seaglass' },
  { id: 'inventory', label: 'Pack', icon: 'pack' }, { id: 'achievements', label: 'Feats', icon: 'star' }, { id: 'settings', label: 'Settings' },
  { id: 'feedback', label: 'Feedback' }, // only while the review inbox is unlocked (syncReview)
];
/** the two menus (E124): which one a tab lives in */
export type MenuGroup = 'pause' | 'bag';
const GROUP: Record<MenuTab, MenuGroup> = { map: 'bag', gear: 'bag', finds: 'bag', inventory: 'bag', achievements: 'bag', settings: 'pause', feedback: 'pause' };
const TITLE: Record<MenuGroup, string> = { pause: 'Paused', bag: 'Bag' };
/** the menu's keys (Esc is handled apart: it pauses, and closes whatever tab is open) */
const KEY_TAB: Partial<Record<string, MenuTab>> = { KeyM: 'map', KeyI: 'inventory' };
/** what a Settings row's "applies when" reads: the weapons you hold now and the shard */
interface SettingsCtx { weapons: ReadonlySet<string>; melee: boolean; chunk: ChunkDef }
type When = (c: SettingsCtx) => boolean;
const HINTS: Record<MenuTab, string> = { map: 'Drag to pan · pinch to zoom', gear: 'Tap a weapon to hold it', finds: 'Found = bright · missing = dashed', inventory: 'What the hunt leaves you', achievements: 'Tap an earned title to wear it', settings: 'Tap outside or Esc to resume', feedback: 'Enter sends · the frame under the menu goes with it' };

/** the weapons as the GEAR tab shows them — read live from Weapons (src/player/Weapons.ts) */
export interface KitEntry { id: string; name: string; ammoLabel: string; ammo: number; magazine: number; reserve: number; equipped: boolean; icon: IconId }

export interface GameMenuOptions {
  fullMap: FullMap;
  progress: Progress;
  inventory: Inventory;
  /** the unlocked weapons, held one first */
  kit: () => KitEntry[];
  /** hold a weapon from the GEAR tab */
  onEquip?: (id: string) => void;
  /** the shard's wearable skins you own (Nalati: src/player/nalatiSkins.ts) — GEAR's SKINS row, tap to wear / take off */
  skins?: () => SkinRow[];
  onWearSkin?: (id: string) => void;
}
export interface SkinRow { id: string; name: string; blurb: string; worn: boolean }
/** a shard's loot in the BAG (src/game/loot/install.ts, Driftwood): GEAR's extras, the FINDS tab, wearing a cosmetic */
export interface BagLoot { gear: () => GearLoot | null; finds: (() => FindsView) | null; wear: (id: string) => void }

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
/** a tab's face: the BAG's are an icon over one short word (E314 board 8 A); PAUSE's stay words */
const tabHtml = (label: string, ic?: IconId): string => (ic ? `<i class="ws-gmenu-ticon">${icon(ic)}</i><span class="ws-gmenu-tword">${esc(label)}</span>` : esc(label));

export class GameMenu {
  readonly root: HTMLElement;
  private sheet: HTMLElement;
  private tabBar: HTMLElement;
  private title: HTMLElement;
  private subtitle: HTMLElement;
  private practice = false;
  /** the header bar's two actions (E178): RESUME (PAUSE) / CLOSE (BAG) on the left, EXIT TO MAIN on the right (PAUSE only) */
  private closeBtn: HTMLElement;
  private exitBtn: HTMLElement;
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
    // E178 (the user: "[resume] PAUSED {dev} [exit to main] … keeps the two main actions at the top static so you dont
    // have to scroll back to top"): the header bar is the menu's one row of actions, pinned above the tabs and the panel.
    // The left button goes back to play in both menus (RESUME / CLOSE); EXIT TO MAIN, the pause menu's only, sits on the
    // right, so a thumb that dismisses the BAG at the top-left never lands on the exit in the PAUSE menu
    this.sheet.innerHTML = `
      <div class="ws-gmenu-head ws-gmenu-bar">
        <button class="ws-gmenu-close" type="button">Resume</button>
        <div class="ws-gmenu-mid">
          <div class="ws-gmenu-titlerow"><div class="ws-gmenu-title">Menu</div><button class="ws-gmenu-dev" type="button">Dev</button></div>
          <div class="ws-gmenu-sub">${esc(def.displayName)}</div>
        </div>
        <button class="ws-gmenu-exit" type="button" aria-label="Exit to main menu">Exit <span class="ws-gmenu-nowrap">to main</span></button>
      </div>`;
    bindDevToggle(this.sheet.querySelector<HTMLElement>('.ws-gmenu-dev') ?? el('ws-gmenu-dev')); // E140: developer mode from the header
    this.tabBar = el('ws-gmenu-tabs');
    for (const t of TABS) {
      const b = el('ws-gmenu-tab', tabHtml(t.label, t.icon), 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['tab'] = t.id;
      b.addEventListener('click', () => this.select(t.id));
      this.tabBar.append(b);
    }
    this.sheet.append(this.tabBar);
    const body = el('ws-gmenu-body');
    this.panels = { map: el('ws-gmenu-panel map'), gear: el('ws-gmenu-panel scroll'), finds: el('ws-gmenu-panel scroll'), inventory: el('ws-gmenu-panel scroll'), achievements: el('ws-gmenu-panel scroll'), settings: el('ws-gmenu-panel scroll'), feedback: el('ws-gmenu-panel scroll') };
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
    const closeBtn = this.sheet.querySelector<HTMLElement>('.ws-gmenu-close'); if (!closeBtn) throw new Error('GameMenu: no .ws-gmenu-close');
    const exitBtn = this.sheet.querySelector<HTMLElement>('.ws-gmenu-exit'); if (!exitBtn) throw new Error('GameMenu: no .ws-gmenu-exit');
    const title = this.sheet.querySelector<HTMLElement>('.ws-gmenu-title'); if (!title) throw new Error('GameMenu: no .ws-gmenu-title');
    const subtitle = this.sheet.querySelector<HTMLElement>('.ws-gmenu-sub'); if (!subtitle) throw new Error('GameMenu: no .ws-gmenu-sub');
    this.title = title; this.subtitle = subtitle; this.closeBtn = closeBtn; this.exitBtn = exitBtn;
    closeBtn.addEventListener('click', () => { this.close(); });
    exitBtn.addEventListener('click', () => { this.close(true); this.onExit?.(); }); // silent: the HUD brings the title back itself
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
  /** which tabs show: FEEDBACK only while the review inbox is unlocked; only the open group's (one tab = no bar) */
  private syncTabs(): void {
    const review = reviewUnlocked(), group = GROUP[this._tab];
    let shown = 0;
    for (const b of this.tabBar.children) {
      const d = (b as HTMLElement).dataset, id = d['tab'] as MenuTab | undefined;
      const g = (d['group'] as MenuGroup | undefined) ?? (id === undefined ? 'bag' : GROUP[id]); // an action tab carries its group
      const on = (id !== 'feedback' || review) && (id !== 'finds' || this.hasFinds) && g === group && !(this.practice && id === 'map');
      (b as HTMLElement).hidden = !on;
      if (on) shown++;
    }
    this.tabBar.classList.toggle('review', shown >= 5);
    this.tabBar.classList.toggle('four', shown === 4); // BAG with Pine Hollow's JOURNAL: ACHIEVEMENTS must fit a phone
    this.tabBar.hidden = shown <= 1;
    this.tabBar.classList.toggle('icons', group === 'bag');
    this.title.textContent = this.practice && group === 'pause' ? 'Practice' : TITLE[group];
    // E178: the PAUSE menu leaves to the title from its header; the BAG only closes
    const pause = group === 'pause';
    this.closeBtn.textContent = pause ? 'Resume' : 'Close';
    this.exitBtn.hidden = !pause;
    // E176: the build pill shows over the PAUSE menu (not the BAG), so the root says which one is up
    this.root.classList.toggle('pause', pause);
    window.dispatchEvent(new Event('ws-menu'));
  }

  get isOpen(): boolean { return this._open; }
  get inPractice(): boolean { return this.practice; }

  /** The arena keeps Settings and Feedback but never presents the shard's terrain map. A feature playground (E307) is a
   *  practice room too: `room` names it under the title (the arena's is "Training arena"). */
  setPractice(active: boolean, room = 'Training arena'): void {
    this.practice = active;
    this.root.classList.toggle('practice', active);
    this.subtitle.textContent = active ? room : getActiveChunk().displayName;
    this.exitBtn.innerHTML = active ? 'Exit <span class="ws-gmenu-nowrap">to Explore</span>' : 'Exit <span class="ws-gmenu-nowrap">to main</span>';
    this.exitBtn.setAttribute('aria-label', active ? 'Exit to Explore' : 'Exit to main menu');
    if (active && this._tab === 'map') this.select('settings'); else this.syncTabs();
  }

  /** pause ▸ Settings ▸ Debug, the grouped registry (E162; the title's Settings mounts the same one, E172) */
  private debug: DebugMenu | null = null;
  private memTimer = 0;
  /** the Debug rows' readouts (Shards in memory, E155; debugOptions.ts DEBUG_READOUTS) — only while this menu is open on
   *  Settings; DebugMenu reads only the ones that can be seen (not while the card is folded, E177) */
  private paintMemory(): void {
    if (this._open && this._tab === 'settings') this.debug?.paint();
  }
  get tab(): MenuTab { return this._tab; }

  open(tab: MenuTab = this._tab): void {
    const selected = this.practice && tab === 'map' ? 'settings' : tab;
    this.select(selected);
    if (this._open) return;
    this._open = true;
    this.paintMemory();
    this.memTimer = window.setInterval(() => { this.paintMemory(); }, 2000); // while open only (close() stops it)
    this.root.classList.add('show');
    this.root.inert = false;
    window.dispatchEvent(new Event('ws-menu')); // E176: the build pill follows the pause menu
    this.refresh();
    this.applies();
    if (selected === 'map') { this.opts.fullMap.show(); this.renderQuest(); }
    if (selected === 'feedback') this.onFeedbackTab?.(this.panels.feedback);
    this.onOpen?.(selected);
  }
  /** `silent` = no onClose (exit to the main menu: the HUD handles the world itself) */
  close(silent = false): void {
    if (!this._open) return;
    this._open = false;
    window.clearInterval(this.memTimer); this.memTimer = 0;
    this.root.classList.remove('show');
    window.dispatchEvent(new Event('ws-menu')); // E176
    this.root.inert = true; // faded to opacity 0 but still in the DOM: out of the tab order and the accessibility tree (VoiceOver / XCUITest)
    this.opts.fullMap.hide();
    if (!silent) this.onClose?.();
  }
  toggle(tab: MenuTab): void { if (this._open && this._tab === tab) this.close(); else this.open(tab); }
  /**
   * A tab in `group`'s bar that runs `onPick` instead of showing a panel — the Compendium's JOURNAL, a tab in the BAG menu
   * after Map · Inventory, before Achievements (Jake, 2026-09-25: the header button was "the dumbest place"; pick A).
   */
  addActionTab(label: string, group: MenuGroup, onPick: () => void, tabIcon: IconId | undefined = group === 'bag' ? 'book' : undefined): HTMLButtonElement {
    const b = el('ws-gmenu-tab', tabHtml(label, tabIcon), 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['group'] = group;
    b.addEventListener('click', onPick);
    const before = this.tabBar.querySelector('[data-tab="achievements"]');
    if (before) before.before(b); else this.tabBar.append(b);
    this.syncTabs();
    return b;
  }

  select(tab: MenuTab): void {
    this._tab = tab;
    for (const b of this.tabBar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tab'] === tab);
    for (const [id, p] of Object.entries(this.panels)) p.classList.toggle('active', id === tab);
    this.hint.textContent = HINTS[tab];
    this.syncTabs();
    if (this._open) { if (tab === 'map') { this.opts.fullMap.show(); this.syncZoom(); this.renderQuest(); } else this.opts.fullMap.hide(); }
    if (tab === 'gear') this.renderGear();
    if (tab === 'finds') this.renderFinds();
    if (tab === 'inventory') this.renderInventory();
    if (tab === 'achievements') this.renderAchievements();
    if (tab === 'settings') this.applies();
    if (tab === 'feedback' && this._open) this.onFeedbackTab?.(this.panels.feedback);
  }

  /** re-render the data tabs */
  refresh(): void { this.renderGear(); this.renderFinds(); this.renderInventory(); this.renderAchievements(); this.syncZoom(); }

  /** the BAG's home: GEAR (the minimap corner's bag button) */
  openBag(): void { this.open('gear'); }

  /** a shard's loot (Driftwood, src/game/loot/install.ts): GEAR's coins / hearts / charms / cosmetics and the FINDS tab */
  private loot: BagLoot | null = null;
  private get hasFinds(): boolean { return this.loot !== null && this.loot.finds !== null; }
  setLoot(loot: BagLoot | null): void {
    this.loot = loot;
    if (this._tab === 'finds' && !this.hasFinds) this.select('gear'); else this.syncTabs();
    if (this._open) this.refresh();
  }

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

  // ── GEAR (E314, board 6 C): the paper doll — every shard's weapons and skins, the shard's loot where it has one ──
  private renderGear(): void {
    renderGear(this.panels.gear, {
      weapons: this.opts.kit(), skins: this.opts.skins?.() ?? [], loot: this.loot?.gear() ?? null,
      onEquip: (id) => { this.opts.onEquip?.(id); this.renderGear(); },
      onWearSkin: (id) => { this.opts.onWearSkin?.(id); this.renderGear(); },
      onWear: (id) => { this.loot?.wear(id); this.renderGear(); },
    });
  }

  // ── FINDS (E314, board 7 B): the sticker book — only on a shard with finds ──
  private renderFinds(): void {
    const f = this.loot?.finds;
    if (f) renderFinds(this.panels.finds, f()); else this.panels.finds.replaceChildren();
  }

  // ── PACK (the Inventory): the junk the hunt leaves you, as before; its weapon cards moved to GEAR (E314) ──
  private renderInventory() {
    const p = this.panels.inventory; p.replaceChildren();
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
    // E178: no full-width RESUME / EXIT TO MAIN MENU on top of the panel any more — they are the header bar's two buttons
    const p = el('ws-gmenu-card', '<div class="ws-gmenu-cardtitle">Settings</div>');
    const dbg = foldCard('debug', 'Debug', 'for playtests — goes away when the game ships'); // E177: folded until it is asked for
    // developer mode only (E140, the user's 7a): the Settings ▸ Developer switch shows / hides it live
    dbg.hidden = !isDev(); onDev((on) => { dbg.hidden = !on; });
    panel.append(p, dbg);

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
    // a pick decodes from the offline cache (project/archive/2026-09-23-preload-offline.md): a spinner by the label only past 300 ms
    onAudioBusy((kind, on) => { this.debug?.row(kind === 'music' ? 'musicStyle' : 'sfxSet')?.classList.toggle('busy', on); });
    // the licences ask for the models' names in the UI: MiniMax-Music3, and the sfx set's credit ("Powered by Stability AI")
    const sfxNote = el('ws-gmenu-note');
    const paintCredit = () => { const c = sfxCredit(getSfxSet()); sfxNote.textContent = c; sfxNote.hidden = c === ''; };
    paintCredit(); onSfxSet(paintCredit); onSfxCredit(paintCredit);
    p.append(el('ws-gmenu-label', 'Audio'), vol, mus, el('ws-gmenu-note', MUSIC_CREDIT), sfxNote);
    // lock-on (E50, src/player/LockOnTarget.ts): how hard the view follows a locked enemy (Gentle = Jake's pick; Off keeps the
    // lock — the reticle, orbit strafing, the lunge, switching — but never turns the view: the motion-sickness escape)
    const lockCams: { v: '1' | '0.5' | '0'; text: string }[] = [{ v: '1', text: 'Follow' }, { v: '0.5', text: 'Gentle' }, { v: '0', text: 'Off' }];
    const lockCam = picker('Lock-on camera', lockCams, () => (getNumber('lockCam') >= 0.75 ? '1' : getNumber('lockCam') > 0.1 ? '0.5' : '0'), (v) => setNumber('lockCam', Number(v)), () => undefined);
    p.append(el('ws-gmenu-label', 'Lock-on'), lockCam, sw('autoLock', 'Auto re-lock'), el('ws-gmenu-note', 'LOCK (Z / middle mouse) locks the enemy nearest the centre. Flick the LOOK pad (mouse flick / wheel) to switch; MOVE circles it.'));

    // DEBUG (E162): every variant, taste toggle and developer aid, grouped — declared once in src/ui/debugOptions.ts and
    // rendered by src/ui/DebugMenu.ts (collapsible groups, only the rows that apply to this shard, a filter). Shards in
    // memory carries the on-device readout (E155 / E159): refreshed only while this menu is open on Settings
    this.debug = buildDebugMenu(dbg);
    // Review is not debug (E140): playtesters unlock notes with it, so it stays in Settings, with the Developer switch
    p.append(this.buildReview(), ...devSwitchRows());
  }
  /** show only the Settings rows that apply now (E130: the weapons you hold, the shard) — every open and every Settings select */
  private applies(): void {
    const kit = this.opts.kit(), c: SettingsCtx = { weapons: new Set(kit.map((k) => k.id)), melee: kit.some((k) => k.icon === 'sword'), chunk: getActiveChunk() };
    for (const g of this.gated) g.el.hidden = !g.when(c);
    this.debug?.applies(c);
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
