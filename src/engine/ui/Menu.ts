import { engineString } from '#engine/strings';
import { buildSavePanel } from './SavePanel';
import { app } from '../app/runtime';
import type { AppState } from '../app/systems';
import { containMenuInput } from '../input/menuInput';
/**
 * The in-game MENU — one overlay: the BAG (MAP · GEAR · FINDS · PACK · FEATS, E314) and PAUSE (SETTINGS), plus FEEDBACK once
 * a reviewer has unlocked the review inbox in Settings → REVIEW (src/engine/ui/review.ts; the tab's composer is the lazy Feedback.ts).
 * Replaces the old pause box and the stand-alone full-map screen: tapping the minimap (or M) opens it on
 * the Map tab, the pause button / Esc opens it on Settings (the switches live there; RESUME and EXIT TO MAIN are the
 * header bar's two buttons since E178). Styled by src/engine/ui/styles/gmenu.css (prefix ws-gmenu-). The world keeps running underneath, as the
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
 * a time — PAUSE: Settings (+ Feedback), titled PAUSED; BAG (the minimap's corner button, src/game/bag/BagButton.ts; the minimap
 * tap and M too): Map · Inventory · Achievements, titled BAG. (The old one-menu-with-every-tab, `?bagbtn=0`, went in E162.)
 * E314 (Jake's picks, project/archive/2026-09-30-driftwood-loot.md): the BAG is five icon tabs on every shard — MAP · GEAR (the paper doll:
 * the weapons and skins that used to head the Inventory, and the shard's loot) · FINDS (Driftwood's sticker book, hidden
 * where a shard has none) · PACK (the Inventory's junk grid) · FEATS (Achievements); Pine Hollow's JOURNAL sits before
 * FEATS. The panels are src/game/bag/bag.ts. Pine Hollow (E314 C): its hunter's journal is its FINDS (`setFinds`, from
 * src/game/compendium/install.ts), GEAR's skins row is FINISHES, and each PACK item says what Mott gives for it (`pack`).
 * Nalati (E314 C, src/shards/nalati-grasslands/bag.ts): MAP · GEAR · FINDS · FEATS — no PACK (its Inventory has 0 slots), GEAR's SKINS row
 * lists every skin (the locked ones dim), FINDS is the elites and their prizes plus the places (`setFinds`).
 * A shard with no inventory slots or achievements gets MAP · GEAR;
 * GEAR names the Neon Jian and shows the Fei Zhua grapple as a card (`tools`). Which tabs a shard gets: bag.ts `bagTabs`.
 */
import { activeLevel } from '../level/selection';
import type { LevelSpec } from '../level/spec';
import type { FullMap } from './Map';
import type { Progress } from '#game/Progress';
import type { Inventory, ItemId } from '#game/Inventory';
import { icon, type IconId } from './icons';
import { completeEntry } from '#game/complete/ShardComplete';
import { getSetting, setSetting, onSetting, getNumber, setNumber, NUM_RANGE, getSfxSet, onSfxSet, type SettingKey, type NumberKey } from './Settings';
import { MUSIC_CREDIT, sfxCredit, onSfxCredit } from '../audio/credits';
import { onAudioBusy } from '../audio/preload';
import { CAN_VIBRATE } from './haptics';
import { lockReview, onReview, quickNote, reviewUnlocked, setQuickNote, unlockReview } from './review';
import { isDev, onDev } from '../core/devMode';
import { devSwitchRows } from './devSwitch';
import { foldCard } from './cards';
import { buildDebugMenu, type DebugMenu } from './DebugMenu';
import { bagTabs, renderFinds, renderGear, type FindsView, type GearLoot, type GearTool } from '#game/bag/bag';

export type MenuTab = 'map' | 'gear' | 'finds' | 'inventory' | 'achievements' | 'settings' | 'feedback';
/** the BAG's tabs are icon tabs, one short word each (E314, Jake's pick board 8 A): MAP · GEAR · FINDS · PACK · FEATS on
 *  every shard (FINDS only where the shard has finds: Driftwood today; `inventory` is PACK, `achievements` FEATS) */
const TABS: { id: MenuTab; label: string; icon?: IconId }[] = [
  { id: 'map', label: engineString('s_be176b0015c4'), icon: 'map' }, { id: 'gear', label: engineString('s_d6eaec65e742'), icon: 'sword' }, { id: 'finds', label: engineString('s_e0c3d922cd87'), icon: 'seaglass' },
  { id: 'inventory', label: engineString('s_80dc21673e55'), icon: 'pack' }, { id: 'achievements', label: engineString('s_9194ccf56b9c'), icon: 'star' }, { id: 'settings', label: engineString('s_74a883a037bc') },
  { id: 'feedback', label: engineString('s_aac77df34720') }, // only while the review inbox is unlocked (syncReview)
];
/** the two menus (E124): which one a tab lives in */
export type MenuGroup = 'pause' | 'bag';
const GROUP: Record<MenuTab, MenuGroup> = { map: 'bag', gear: 'bag', finds: 'bag', inventory: 'bag', achievements: 'bag', settings: 'pause', feedback: 'pause' };
const TITLE: Record<MenuGroup, string> = { pause: engineString('s_e159b06187d3'), bag: engineString('s_b053c961f2ac') };
/** the menu's keys (Esc is handled apart: it pauses, and closes whatever tab is open) */
const KEY_TAB: Partial<Record<string, MenuTab>> = { KeyM: 'map', KeyI: 'inventory' };
/** what a Settings row's "applies when" reads: the weapons you hold now and the shard */
interface SettingsCtx { weapons: ReadonlySet<string>; melee: boolean; tracers: boolean; huntersEye: boolean; chunk: LevelSpec }
type When = (c: SettingsCtx) => boolean;
const HINTS: Record<MenuTab, string> = { map: engineString('s_90238ffb7476'), gear: engineString('s_d6a37d4c0ef4'), finds: engineString('s_77fb830f183c'), inventory: engineString('s_f60c27a1ad27'), achievements: engineString('s_b86de6f1d8e0'), settings: engineString('s_de1b7705e971'), feedback: engineString('s_1806a5739ce4') };

/** the weapons as the GEAR tab shows them — read live from Weapons (src/engine/player/Weapons.ts) */
export interface KitEntry { id: string; name: string; ammoLabel: string; ammo: number; magazine: number; reserve: number; equipped: boolean; icon: IconId; melee: boolean; tracers: boolean; huntersEye: boolean }

export interface GameMenuOptions {
  /** The game supplies its presentation title when constructing this level menu. */
  levelName?: string;
  fullMap: FullMap;
  progress: Progress;
  inventory: Inventory;
  /** the unlocked weapons, held one first */
  kit: () => KitEntry[];
  /** hold a weapon from the GEAR tab */
  onEquip?: (id: string) => void;
  /** the shard's wearable skins you own (Nalati: src/shards/nalati-grasslands/weapons/nalatiSkins.ts) — GEAR's SKINS row, tap to wear / take off;
   *  Pine Hollow's finishes (src/shards/pine-hollow/loadout/finishes.ts) */
  skins?: () => SkinRow[];
  onWearSkin?: (id: string) => void;
  /** the skins row's heading (default SKINS; Pine Hollow: FINISHES) */
  skinsTitle?: string;
  /** a shard whose pack is a trade stock (Pine Hollow, E314 C): the line over the grid, and one line per item */
  pack?: PackTrade;
  /** GEAR's cards for gear that is not a weapon (Nine Dragon's Fei Zhua grapple, E314 A) */
  tools?: () => GearTool[];
}
/** `locked`: not owned yet — dim, not tappable; `icon`: the card's glyph (default laurel) */
export interface SkinRow { id: string; name: string; blurb: string; worn: boolean; locked?: boolean; icon?: IconId }
/** Pine Hollow's PACK: "Everything here trades at Mott's stall", and under each item what Mott gives for it */
export interface PackTrade { note: string; hint: string; gearHint?: string; line: (id: ItemId) => string | null }
/** a shard's loot in the BAG (src/game/loot/install.ts, Driftwood): GEAR's extras, the FINDS tab, wearing a cosmetic */
export interface BagLoot { gear: () => GearLoot | null; finds: (() => FindsView) | null; wear: (id: string) => void }

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
/** a tab's face: the BAG's are an icon over one short word (E314 board 8 A); PAUSE's stay words */
const tabHtml = (label: string, ic?: IconId): string => (ic ? `<i class="ws-gmenu-ticon">${icon(ic)}</i><span class="ws-gmenu-tword">${esc(label)}</span>` : esc(label));

export class GameMenu {
  private savePanel: ReturnType<typeof buildSavePanel> | null = null;
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
  private resumeState: AppState = 'play';
  onOpen?: (tab: MenuTab) => void;
  onClose?: () => void;
  onExit?: () => void;
  onFeedbackTab?: (panel: HTMLElement) => void;
  /** may a key open the menu now — the HUD says: in the world, no composer up (`hud.menu = …` sets it); closed until then */
  keyGate: () => boolean = () => false;
  /** the Settings rows that apply only sometimes (E130: hidden, not greyed, when they do not apply) — see `applies()` */
  private gated: { el: HTMLElement; when: When }[] = [];

  constructor(private opts: GameMenuOptions) {
    const levelName = this.opts.levelName ?? '';
    this.root = el('ws-gmenu');
    this.root.inert = true; // closed until open()
    this.sheet = el('ws-gmenu-sheet ws-glass');
    // E178 (the user: "[resume] PAUSED {dev} [exit to main] … keeps the two main actions at the top static so you dont
    // have to scroll back to top"): the header bar is the menu's one row of actions, pinned above the tabs and the panel.
    // The left button goes back to play in both menus (RESUME / CLOSE); EXIT TO MAIN, the pause menu's only, sits on the
    // right, so a thumb that dismisses the BAG at the top-left never lands on the exit in the PAUSE menu
    this.sheet.innerHTML = engineString('s_1856a8fac1fd', [esc(levelName)]);
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
    this.mapMeta = el('ws-gmenu-mapmeta', esc(levelName)); // E318: the shard's name, no chunk size
    this.mapQuest = el('ws-gmenu-mapquest');
    const frame = el('ws-gmenu-mapframe');
    opts.fullMap.mount(frame);
    const foot = el('ws-gmenu-mapfoot');
    const zooms = el('ws-gmenu-zooms');
    for (const z of [1, 2, 4]) {
      const b = el('ws-gmenu-zoom', engineString('s_03a5f0ef36b4', [z]), 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['z'] = String(z);
      b.addEventListener('click', () => { opts.fullMap.setZoom(z); this.syncZoom(); });
      zooms.append(b); this.zoomChips.push(b);
    }
    foot.append(zooms, el('ws-gmenu-legend', engineString('s_dd35e28aa4b1', [icon('poi'), icon('you')])));
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
    containMenuInput(this.root);
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
    const bag = bagTabs({ finds: this.hasFinds, pack: this.hasPack, feats: this.hasFeats }); // E314: the tabs this shard fills
    let shown = 0;
    for (const b of this.tabBar.children) {
      const d = (b as HTMLElement).dataset, id = d['tab'] as MenuTab | undefined;
      const g = (d['group'] as MenuGroup | undefined) ?? (id === undefined ? 'bag' : GROUP[id]); // an action tab carries its group
      const inBag = id === undefined || GROUP[id] !== 'bag' || bag.includes(id);
      const on = (id !== 'feedback' || review) && inBag && g === group && !(id === 'map' && this.noMap);
      (b as HTMLElement).hidden = !on;
      if (on) shown++;
    }
    this.tabBar.classList.toggle('review', shown >= 5);
    this.tabBar.classList.toggle('four', shown === 4); // a BAG without FINDS (Nalati, Nine Dragon): ACHIEVEMENTS must fit a phone
    this.tabBar.hidden = shown <= 1;
    this.tabBar.classList.toggle('icons', group === 'bag');
    this.title.textContent = this.practice && group === 'pause' ? engineString('s_d3857b12b4ce') : TITLE[group];
    // E178: the PAUSE menu leaves to the title from its header; the BAG only closes
    const pause = group === 'pause';
    this.closeBtn.textContent = pause ? engineString('s_d640c7421da0') : engineString('s_7d9eb7acb13e');
    this.exitBtn.hidden = !pause;
    // E176: the build pill shows over the PAUSE menu (not the BAG), so the root says which one is up
    this.root.classList.toggle('pause', pause);
    window.dispatchEvent(new Event('ws-menu'));
  }

  get isOpen(): boolean { return this._open; }
  get inPractice(): boolean { return this.practice; }
  /** a practice room without a map of its own: no MAP tab (the shard's terrain is not where you are). The arena and the
   *  playgrounds bring their own (Minimap.setRoom, E321), so their MAP tab shows the room */
  private get noMap(): boolean { return this.practice && !this.opts.fullMap.hasRoom; }

  /** The arena keeps Settings and Feedback but never presents the shard's terrain map (its MAP tab is the room's own,
   *  E321). A feature playground (E307) is a practice room too: `room` names it under the title (the arena's is
   *  "Training arena"). */
  setPractice(active: boolean, room = 'Training arena'): void {
    this.practice = active;
    this.root.classList.toggle('practice', active);
    this.subtitle.textContent = active ? room : (this.opts.levelName ?? '');
    this.mapMeta.textContent = active ? room : (this.opts.levelName ?? ''); // E314: the MAP tab over a room's own map names the room
    this.exitBtn.innerHTML = active ? engineString('s_36c97383811d') : engineString('s_2c5e5026f627');
    this.exitBtn.setAttribute('aria-label', active ? engineString('s_084735ce4470') : engineString('s_83b2c11883e2'));
    if (active && this._tab === 'map' && this.noMap) this.select('settings'); else this.syncTabs();
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
    const selected = this.noMap && tab === 'map' ? 'settings' : this.land(tab);
    this.select(selected);
    if (this._open) return;
    this.resumeState = app.state;
    this._open = true;
    app.setState('paused');
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
    app.setState(this.resumeState);
    window.clearInterval(this.memTimer); this.memTimer = 0;
    this.root.classList.remove('show');
    window.dispatchEvent(new Event('ws-menu')); // E176
    this.root.inert = true; // faded to opacity 0 but still in the DOM: out of the tab order and the accessibility tree (VoiceOver / XCUITest)
    this.opts.fullMap.hide();
    if (!silent) this.onClose?.();
  }
  toggle(tab: MenuTab): void { if (this._open && this._tab === tab) this.close(); else this.open(tab); }
  /** a BAG tab this shard doesn't have lands on GEAR: no pack (Nalati, Nine Dragon) — I / PACK; no feats (Nine Dragon) */
  private land(want: MenuTab): MenuTab {
    return (want === 'inventory' && !this.hasPack) || (want === 'achievements' && !this.hasFeats) ? 'gear' : want;
  }
  select(want: MenuTab): void {
    const tab = this.land(want);
    this._tab = tab;
    for (const b of this.tabBar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tab'] === tab);
    for (const [id, p] of Object.entries(this.panels)) p.classList.toggle('active', id === tab);
    this.hint.textContent = this.hintFor(tab);
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
  /** a shard's FINDS without loot: Pine Hollow's hunter's journal (src/game/compendium/install.ts, E314 C) */
  private bagFragments = new Map<MenuTab, Map<string, (host: HTMLElement) => void>>();
  addBagFragment(tab: 'map' | 'gear' | 'pack' | 'finds' | 'feats', fragment: { id: string; render: (host: HTMLElement) => void }): () => void {
    const panel = tab === 'pack' ? 'inventory' : tab === 'feats' ? 'achievements' : tab;
    let rows = this.bagFragments.get(panel);
    if (rows === undefined) { rows = new Map(); this.bagFragments.set(panel, rows); }
    rows.set(fragment.id, fragment.render);
    this.syncTabs();
    return () => { if (rows.get(fragment.id) === fragment.render) rows.delete(fragment.id); if (rows.size === 0) this.bagFragments.delete(panel); this.syncTabs(); };
  }
  private renderBagFragments(tab: MenuTab): void {
    for (const render of this.bagFragments.get(tab)?.values() ?? []) render(this.panels[tab]);
  }
  private finds: (() => FindsView) | null = null;
  private get findsView(): (() => FindsView) | null { return this.loot?.finds ?? this.finds; }
  private get hasFinds(): boolean { return this.findsView !== null || this.bagFragments.get('finds')?.size !== undefined; }
  /** a shard with no pack (Nalati, E314 C: `inventory.slots` 0) has no PACK tab */
  private get hasPack(): boolean { return this.opts.inventory.slots > 0; }
  /** a shard with no achievements (Nine Dragon, E314 A) has no FEATS tab */
  private get hasFeats(): boolean { return this.opts.progress.rows.length > 0; }
  setFinds(finds: (() => FindsView) | null): void {
    this.finds = finds;
    if (this._tab === 'finds' && !this.hasFinds) this.select('gear'); else this.syncTabs();
    if (this._open) this.refresh();
  }
  /** the hint line: a shard's own for GEAR / FINDS / PACK where it has one (Pine Hollow, E314 C) */
  private hintFor(tab: MenuTab): string {
    if (tab === 'finds') return this.findsView?.().hint ?? HINTS.finds;
    if (tab === 'inventory') return this.opts.pack?.hint ?? HINTS.inventory;
    if (tab === 'gear') return this.opts.pack?.gearHint ?? HINTS.gear;
    return HINTS[tab];
  }
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
    this.mapQuest.innerHTML = engineString('s_9b2a687f808a', [esc(q.title), esc(q.objective), q.hint ? engineString('s_ceba3ca94f0b', [esc(q.hint)]) : '']);
  }

  private syncZoom() {
    const z = this.opts.fullMap.zoom;
    for (const b of this.zoomChips) b.classList.toggle('active', Math.abs(Number(b.dataset['z']) - z) < 0.01);
  }

  // ── GEAR (E314, board 6 C): the paper doll — every shard's weapons and skins, the shard's loot where it has one ──
  private renderGear(): void {
    renderGear(this.panels.gear, {
      weapons: this.opts.kit(), skins: this.opts.skins?.() ?? [], loot: this.loot?.gear() ?? null, ...(this.opts.skinsTitle !== undefined ? { skinsTitle: this.opts.skinsTitle } : {}),
      tools: this.opts.tools?.() ?? [],
      onEquip: (id) => { this.opts.onEquip?.(id); this.renderGear(); },
      onWearSkin: (id) => { this.opts.onWearSkin?.(id); this.renderGear(); },
      onWear: (id) => { this.loot?.wear(id); this.renderGear(); },
    });
  }

  // ── FINDS (E314, board 7 B): the sticker book — only on a shard with finds ──
  private renderFinds(): void {
    const f = this.findsView;
    if (f) renderFinds(this.panels.finds, f()); else this.panels.finds.replaceChildren();
    this.renderBagFragments('finds');
  }

  // ── PACK (the Inventory): the junk the hunt leaves you, as before; its weapon cards moved to GEAR (E314) ──
  private renderInventory() {
    const p = this.panels.inventory; p.replaceChildren();
    const items = this.opts.inventory.items;
    const slots = this.opts.inventory.slots;
    const trade = this.opts.pack;
    p.append(el('ws-gmenu-label', engineString('s_94d98347b2ef', [items.length, slots])));
    if (trade) p.append(el('ws-gmenu-packnote', esc(trade.note)));
    const grid = el('ws-gmenu-grid');
    for (let i = 0; i < slots; i++) {
      const it = items[i];
      const line = it && trade ? trade.line(it.id) : null; // Pine Hollow: what Mott gives for it (E314 C)
      grid.append(it
        ? el('ws-gmenu-slot', engineString('s_96ae14555109', [icon(it.icon), it.count, esc(it.label), line !== null ? engineString('s_b5f268a201a9', [esc(line)]) : '']))
        : el('ws-gmenu-slot empty'));
    }
    p.append(grid);
  }

  // ── ACHIEVEMENTS ──
  private renderAchievements() {
    const pr = this.opts.progress, p = this.panels.achievements; p.replaceChildren();
    const rows = pr.rows, n = rows.length, e = pr.earnedCount;
    const levelName = this.opts.levelName ?? '';
    // the shard's "complete" card (E132, src/game/complete/ShardComplete.ts), once its quest is done: a row on top that reopens it
    const done = completeEntry();
    if (done) {
      const row = el('ws-gmenu-done', engineString('s_07078891e4d4', [icon('laurel'), esc(done.label), esc(done.sub)]), 'button');
      (row as HTMLButtonElement).type = 'button';
      row.addEventListener('click', () => { this.close(true); done.open(); });   // silent: the card resumes play itself
      p.append(row);
    }
    p.append(el('ws-gmenu-label', engineString('s_19898a95936f', [esc(levelName), e, n])));
    p.append(el('ws-bar ws-gmenu-total', engineString('s_3ac582ba7063', [n ? (e / n) * 100 : 0])));
    p.append(el('ws-gmenu-label', engineString('s_e2d6dc448c63')));
    const t = pr.title;
    p.append(el(`ws-gmenu-titlecard${t ? '' : ' none'}`, engineString('s_7eb13d096208', [icon('laurel'), t ? esc(t.title) : engineString('s_7aa430f0081b'), t ? engineString('s_3b833995b06d') : engineString('s_f912f6149076')])));
    p.append(el('ws-gmenu-label', engineString('s_da4ea1a751fa')));
    if (!n) p.append(el('ws-gmenu-empty', engineString('s_86170799a9ce')));
    for (const r of rows) {
      const row = el(`ws-gmenu-ach${r.earned ? ' earned' : ''}${r.active ? ' active' : ''}`, engineString('s_7f1998be1049', [r.def.icon, icon(r.def.icon), esc(r.def.name), esc(r.def.goal), r.count, r.def.count, (r.count / r.def.count) * 100, icon(r.earned ? 'check' : 'lock'), esc(r.def.title), r.active ? engineString('s_c965a4b3b12e') : '']), 'button');
      (row as HTMLButtonElement).type = 'button';
      row.addEventListener('click', () => { if (r.earned) pr.wear(r.def.id); });
      p.append(row);
    }
  }

  // ── SETTINGS ──
  /** builds the Settings tab: only what applies live (E55) — renderer, quality, render scale, AA and touch controls
   *  are read at boot and live in main menu ▸ Settings (src/engine/ui/BootSettings.ts, APPLY & RELOAD). Two cards (E81, the user's
   *  split): SETTINGS holds what ships with the finished game; DEBUG holds the variant pickers and taste toggles that
   *  exist only while the look and sound are being decided — each leaves that card once it is locked in (E78 the
   *  painted horizon, E83 the photo sky, E85 the colour grade, E87 the lighting, E88 the post) */
  private buildSettings(): void {
    const panel = this.panels.settings;
    // E178: no full-width RESUME / EXIT TO MAIN MENU on top of the panel any more — they are the header bar's two buttons
    const p = el('ws-gmenu-card', engineString('s_e68f72548349'));
    const dbg = foldCard('debug', engineString('s_1a03bd2fd107'), engineString('s_8c4422087396')); // E177: folded until it is asked for
    // developer mode only (E140, the user's 7a): the Settings ▸ Developer switch shows / hides it live
    dbg.hidden = !isDev(); onDev((on) => { dbg.hidden = !on; });
    panel.append(p, dbg);

    const sw = (key: SettingKey, label: string) => {
      const b = el('ws-gmenu-switch', engineString('s_d652c0be6be8', [label]), 'button') as HTMLButtonElement; b.type = 'button'; b.setAttribute('role', 'switch');
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
    const ranged: When = (c) => c.tracers; // the bolts / rounds draw tracers: Nalati's bow draws none (NALATI-MERGE F7)
    section(p, engineString('s_31bcb8940fff'), sw('aimAssist', engineString('s_714896153134')),
      [ranged, sw('tracers', engineString('s_702cb41e280a'))],
      [(c) => c.huntersEye, sw('huntersEye', engineString('s_80f6259cced8'))], // the bow's drop arc (Bow.ts): on by default on touch
      [() => CAN_VIBRATE, sw('haptics', engineString('s_59e1fd02f6c2'))]); // Android only — iOS Safari has no vibrate (src/engine/ui/haptics.ts)

    // controls: the 0.5–2× look multipliers (Settings 'look' / 'swingLook') — read live by TouchControls + Player's mouse look
    const mult = (key: NumberKey, label: string) => {
      const [lo, hi] = NUM_RANGE[key];
      const row = el('ws-gmenu-row', engineString('s_b756f4e0f8ff', [label]));
      const val = row.querySelector<HTMLElement>('.ws-gmenu-val');
      const s = document.createElement('input'); s.type = 'range'; s.className = 'ws-gmenu-slider';
      s.min = String(lo * 100); s.max = String(hi * 100); s.step = '5'; s.value = String(Math.round(getNumber(key) * 100));
      const paint = () => { if (val) val.textContent = engineString('s_03a5f0ef36b4', [(Number(s.value) / 100).toFixed(2)]); };
      s.addEventListener('input', () => { setNumber(key, Number(s.value) / 100); paint(); });
      s.addEventListener('pointerdown', (e) => e.stopPropagation());
      paint(); row.append(s); return row;
    };
    section(p, engineString('s_799c26913574'), mult('look', engineString('s_64e57bf9ef8a')), [(c) => c.melee, mult('swingLook', engineString('s_e532946ea0dd'))]); // a swing's turn: the blades

    // audio: master volume (Settings 'volume', 0..1) — main.ts drives the AudioContext gain from it
    const vol = el('ws-gmenu-row', engineString('s_31a1802e19b8'));
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.className = 'ws-gmenu-slider';
    slider.value = String(Math.round(getNumber('volume') * 100));
    slider.addEventListener('input', () => setNumber('volume', Number(slider.value) / 100));
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());
    vol.append(slider);
    // music volume (Settings 'music', 0..1) — src/engine/audio/Music.ts drives its bus from it
    const mus = el('ws-gmenu-row', engineString('s_4db5c63706fd'));
    const mslider = document.createElement('input'); mslider.type = 'range'; mslider.min = '0'; mslider.max = '100'; mslider.className = 'ws-gmenu-slider';
    mslider.value = String(Math.round(getNumber('music') * 100));
    mslider.addEventListener('input', () => setNumber('music', Number(mslider.value) / 100));
    mslider.addEventListener('pointerdown', (e) => e.stopPropagation());
    mus.append(mslider);
    // music style (Settings 'musicStyle', project/archive/2026-09-23-music.md v3): the MiniMax-Music3 scores or the v1 synth — Music.ts crossfades on a bar;
    // sound effects (Settings 'sfxSet'): the generated set (MOSS-SoundEffect v2 + Stable Audio 3 Medium) or all-synth — Audio.ts swaps them
    const picker = <T extends string>(label: string, options: { v: T; text: string }[], get: () => T, set: (v: T) => void, on: (fn: () => void) => void) => {
      const row = el('ws-gmenu-row', engineString('s_54fa835c7c85', [label]));
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
    p.append(el('ws-gmenu-label', engineString('s_bc1b88907d3b')), vol, mus, el('ws-gmenu-note', MUSIC_CREDIT), sfxNote);
    // lock-on (E50, src/engine/player/LockOnTarget.ts): how hard the view follows a locked enemy (Gentle = Jake's pick; Off keeps the
    // lock — the reticle, orbit strafing, the lunge, switching — but never turns the view: the motion-sickness escape)
    const lockCams: { v: '1' | '0.5' | '0'; text: string }[] = [{ v: '1', text: engineString('s_641d1ef657bd') }, { v: '0.5', text: engineString('s_96124817c810') }, { v: '0', text: engineString('s_ca7981b46ecf') }];
    const lockCam = picker(engineString('s_21ed7056ff10'), lockCams, () => (getNumber('lockCam') >= 0.75 ? '1' : getNumber('lockCam') > 0.1 ? '0.5' : '0'), (v) => setNumber('lockCam', Number(v)), () => undefined);
    p.append(el('ws-gmenu-label', engineString('s_fcc34c9149ac')), lockCam, sw('autoLock', engineString('s_c436a89a4252')), el('ws-gmenu-note', engineString('s_c12db72ef23e')));

    // DEBUG (E162): every variant, taste toggle and developer aid, grouped — declared once in src/engine/ui/debugOptions.ts and
    // rendered by src/engine/ui/DebugMenu.ts (collapsible groups, only the rows that apply to this shard, a filter). Shards in
    // memory carries the on-device readout (E155 / E159): refreshed only while this menu is open on Settings
    this.debug = buildDebugMenu(dbg);
    // Review is not debug (E140): playtesters unlock notes with it, so it stays in Settings, with the Developer switch
    p.append(this.buildReview(), ...devSwitchRows());
    this.savePanel = buildSavePanel(); panel.append(this.savePanel);
  }
  /** show only the Settings rows that apply now (E130: the weapons you hold, the shard) — every open and every Settings select */
  private applies(): void {
    this.savePanel?.refresh();
    const kit = this.opts.kit(), c: SettingsCtx = { weapons: new Set(kit.map((k) => k.id)), melee: kit.some((k) => k.melee), tracers: kit.some((k) => k.tracers), huntersEye: kit.some((k) => k.huntersEye), chunk: activeLevel() };
    for (const g of this.gated) g.el.hidden = !g.when(c);
    this.debug?.applies(c);
  }
  /** Settings → REVIEW: a password unlocks the review inbox (src/engine/ui/review.ts); unlocked, the Quick note switch + LOCK */
  private buildReview(): HTMLElement {
    const box = el('ws-gmenu-review');
    const render = () => {
      box.replaceChildren(el('ws-gmenu-label', engineString('s_aff0766a5290')));
      if (!reviewUnlocked()) {
        const row = el('ws-gmenu-row');
        const input = document.createElement('input'); input.type = 'password'; input.className = 'ws-gmenu-input'; input.placeholder = engineString('s_3aa9d82ecee0');
        input.autocomplete = 'off'; input.enterKeyHint = 'go';
        const go = el('ws-gmenu-unlock', engineString('s_4ac709aa58bc'), 'button') as HTMLButtonElement; go.type = 'button';
        const note = el('ws-gmenu-note', engineString('s_0a5f05def8ad'));
        const tryUnlock = async () => {
          go.disabled = true; note.textContent = engineString('s_ec963ffc911b');
          const r = await unlockReview(input.value);
          go.disabled = false;
          note.textContent = r === 'bad' ? engineString('s_08e7aa3eae21') : r === 'offline' ? engineString('s_76856232ac38') : '';
        };
        // the menu listens for M / Esc and the player for WASD on document: typing a password must not reach them
        input.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); if (e.code === 'Enter') void tryUnlock(); });
        input.addEventListener('keyup', (e) => { e.stopPropagation(); });
        go.addEventListener('click', () => { void tryUnlock(); });
        row.append(input, go);
        box.append(row, note);
        return;
      }
      const sw = el('ws-gmenu-switch', engineString('s_e1e76f890568'), 'button') as HTMLButtonElement; sw.type = 'button'; sw.setAttribute('role', 'switch');
      sw.classList.toggle('on', quickNote()); sw.setAttribute('aria-checked', String(quickNote()));
      sw.addEventListener('click', () => setQuickNote(!quickNote()));
      const lock = el('ws-gmenu-unlock', engineString('s_db44b8db4f05'), 'button') as HTMLButtonElement; lock.type = 'button';
      lock.addEventListener('click', () => lockReview());
      const row = el('ws-gmenu-row', engineString('s_b39f8f67f676'));
      row.append(lock);
      box.append(sw, row, el('ws-gmenu-note', engineString('s_806c6e56a7d8')));
    };
    render(); onReview(render);
    return box;
  }
}
