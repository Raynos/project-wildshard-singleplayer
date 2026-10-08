import type { Scope } from '../app/scope';
import type { UiHandle } from './layers';
import { TabRegistry, type TabSpec, type TabFragment } from './tabs';
import { uiScope, mountUi } from './ownership';
import { buildControlsPanel } from '../input/ControlsPanel';
import { installKeyHelp } from './KeyHelp';
import { engineString } from '../strings';
import { buildSavePanel } from './SavePanel';
import { app } from '../app/runtime';
import type { AppState } from '../app/systems';
import { containMenuInput } from '../input/menuInput';
import type { Action } from '../input/InputService';
/** The in-game menu renders registered data views, settings and feedback.
 * The highest visible layer owns navigation and back; its child scope owns each open session.
 * Tab and fragment registrations keep stable order and return owner disposers.
 */
import { activeLevel } from '../level/selection';
import type { LevelSpec } from '../level/spec';
import type { FullMap } from './Map';
import { icon, type IconId } from './icons';
import { getSetting, setSetting, onSetting, getNumber, setNumber, NUM_RANGE, getSfxSet, type SettingKey, type NumberKey } from './Settings';
import { MUSIC_CREDIT, sfxCredit, onSfxCredit } from '../audio/credits';
import { CAN_VIBRATE } from './haptics';
import { lockReview, onReview, quickNote, reviewUnlocked, setQuickNote, unlockReview } from './review';
import { isDev, onDev } from '../core/devMode';
import { devSwitchRows } from './devSwitch';
import { foldCard } from './cards';
import { buildDebugMenu, type DebugMenu } from './DebugMenu';
import { settingsCategories, settingsHint, type SettingsCat, type SettingsCats } from './settingsCats';
import { SAVE_STRINGS } from './saveStrings';
import { TIER } from '../core/tier';
import { buildMusicStyleRow } from './musicStyleRow';

type BuiltInTab = 'map' | 'settings' | 'feedback';
export type MenuTab = string;
/** the BAG's tabs are icon tabs, one short word each (E314, Jake's pick board 8 A): MAP · GEAR · FINDS · PACK · FEATS on
 *  every shard (FINDS only where the shard has finds: Driftwood today; `inventory` is PACK, `achievements` FEATS) */
const TABS: { id: MenuTab; label: string; icon?: IconId }[] = [
  { id: 'map', label: engineString('s_be176b0015c4'), icon: 'map' }, { id: 'settings', label: engineString('s_74a883a037bc') },
  { id: 'feedback', label: engineString('s_aac77df34720') }, // only while the review inbox is unlocked (syncReview)
];
/** the two menus (E124): 'pause' holds the engine's own tabs (Settings, Feedback); 'play' the map and every tab the game
 *  registers (its Bag; the game names it: s_b053c961f2ac) — E405: the engine names none of the game's tabs */
export type MenuGroup = 'pause' | 'play';
const PAUSE_TABS: ReadonlySet<MenuTab> = new Set(['settings', 'feedback']);
const groupOf = (tab: MenuTab): MenuGroup => (PAUSE_TABS.has(tab) ? 'pause' : 'play');
const TITLE: Record<MenuGroup, string> = { pause: engineString('s_e159b06187d3'), play: engineString('s_b053c961f2ac') };
/** the menu's keys (Esc is handled apart: it pauses, and closes whatever tab is open) */

/** what a Settings row's "applies when" reads: the weapons you hold now and the shard */
interface SettingsCtx { weapons: ReadonlySet<string>; melee: boolean; tracers: boolean; huntersEye: boolean; chunk: LevelSpec }
type When = (c: SettingsCtx) => boolean;
const HINTS: Record<BuiltInTab, string> & Partial<Record<string, string>> = { map: engineString('s_90238ffb7476'), gear: engineString('s_d6a37d4c0ef4'), finds: engineString('s_77fb830f183c'), inventory: engineString('s_f60c27a1ad27'), achievements: engineString('s_b86de6f1d8e0'), settings: engineString('s_de1b7705e971'), feedback: engineString('s_1806a5739ce4') };

/** the weapons as the GEAR tab shows them — read live from Weapons (src/engine/player/Weapons.ts) */
export interface KitEntry { id: string; name: string; ammoLabel: string; ammo: number; magazine: number; reserve: number; equipped: boolean; icon: IconId; melee: boolean; tracers: boolean; huntersEye: boolean }

export interface GameMenuOptions {
  /** The game supplies its presentation title when constructing this level menu. */
  levelName?: string;
  fullMap: FullMap;
  /** Only capabilities used to show applicable Settings rows; the game's own tabs are registered separately. */
  settings: () => Omit<SettingsCtx, 'chunk'>;
  /** more key actions that open a tab (the game's: its `bag` key → its inventory) */
  keys?: Readonly<Partial<Record<Action, MenuTab>>>;
}
/** `locked`: not owned yet — dim, not tappable; `icon`: the card's glyph (default laurel) */
export interface SkinRow { id: string; name: string; blurb: string; worn: boolean; locked?: boolean; icon?: IconId }
const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };
const words = (cls: string, text: string, tag = 'div'): HTMLElement => { const node = el(cls, '', tag); node.textContent = text; return node; };
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
/** a tab's face: the BAG's are an icon over one short word (E314 board 8 A); PAUSE's stay words */
const tabButton = (label: string, ic?: IconId): HTMLButtonElement => {
  const button = document.createElement('button'); button.className = 'ws-gmenu-tab'; button.type = 'button';
  if (ic) {
    const glyph = el('ws-gmenu-ticon', icon(ic), 'i'), word = el('ws-gmenu-tword', '', 'span');
    word.textContent = label; button.append(glyph, word);
  } else button.textContent = label;
  return button;
};

export class GameMenu {
  readonly scope = uiScope('GameMenu');
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
  private panels: Record<BuiltInTab, HTMLElement> & Partial<Record<string, HTMLElement>>;
  private hint: HTMLElement;
  private mapMeta: HTMLElement;
  private mapQuest: HTMLElement;
  /** the map's POI · You key: hidden over a practice room's own map (its names are on it, it has no POIs; E353) */
  private mapLegend: HTMLElement;
  private zoomChips: HTMLButtonElement[] = [];
  private _tab: MenuTab = 'settings';
  private layer: UiHandle | null = null;
  private openScope: Scope | null = null;
  private readonly tabsRegistry = new TabRegistry();
  private get _open(): boolean { return this.layer?.active === true; }
  private resumeState: AppState = 'play';
  onOpen?: (tab: MenuTab) => void;
  onClose?: () => void;
  onExit?: () => void;
  onFeedbackTab?: (panel: HTMLElement) => void;
  /** may a key open the menu now — the HUD says: in the world, no composer up (`hud.menu = …` sets it); closed until then */

  /** the Settings rows that apply only sometimes (E130: hidden, not greyed, when they do not apply) — see `applies()` */
  private controlsPanel: ReturnType<typeof buildControlsPanel> | undefined;
  /** pause ▸ Settings's categories: a rail + one pane on a desktop (J10 layout A), one column on a phone */
  private cats: SettingsCats | undefined;
  private gated: { el: HTMLElement; when: When }[] = [];
  /** the Settings card (its title, then every section) and the sections the game added to it (`addSettingsSection`) */
  private settingsCard: HTMLElement | undefined;
  private readonly sectionRefresh = new Set<() => void>();

  private opts: GameMenuOptions;
  constructor(opts: GameMenuOptions) {
    this.opts = opts;
    const levelName = this.opts.levelName ?? '';
    this.root = el('ws-gmenu');
    this.root.inert = true; // closed until open()
    this.sheet = el('ws-gmenu-sheet ws-glass');
    // E178 (the user: "[resume] PAUSED {dev} [exit to main] … keeps the two main actions at the top static so you dont
    // have to scroll back to top"): the header bar is the menu's one row of actions, pinned above the tabs and the panel.
    // The left button goes back to play in both menus (RESUME / CLOSE); EXIT TO MAIN, the pause menu's only, sits on the
    // right, so a thumb that dismisses the BAG at the top-left never lands on the exit in the PAUSE menu
    this.sheet.innerHTML = engineString('s_1856a8fac1fd', ['']);
    this.tabBar = el('ws-gmenu-tabs');
    for (const t of TABS) {
      const b = tabButton(t.label, t.icon); b.dataset['tab'] = t.id;
      this.scope.listen(b, 'click', () => this.select(t.id));
      this.tabBar.append(b);
    }
    this.sheet.append(this.tabBar);
    const body = el('ws-gmenu-body');
    this.panels = { map: el('ws-gmenu-panel map'), settings: el('ws-gmenu-panel scroll'), feedback: el('ws-gmenu-panel scroll') };
    for (const p of Object.values(this.panels)) { if (p === undefined) continue; if (p.classList.contains('scroll')) p.dataset['scroll'] = ''; body.append(p); } // index.html swallows touchmove outside [data-scroll]
    this.sheet.append(body);
    this.hint = el('ws-gmenu-hint');
    this.sheet.append(this.hint);
    this.root.append(this.sheet);
    mountUi(this.root, this.scope, document.body);

    // ── MAP: the FullMap canvas lives inside this panel (Map.ts embedded mode) ──
    this.mapMeta = el('ws-gmenu-mapmeta'); this.mapMeta.textContent = levelName; // E318: the shard's name, no chunk size
    this.mapQuest = el('ws-gmenu-mapquest');
    const frame = el('ws-gmenu-mapframe');
    opts.fullMap.mount(frame);
    const foot = el('ws-gmenu-mapfoot');
    const zooms = el('ws-gmenu-zooms');
    for (const z of [1, 2, 4]) {
      const b = el('ws-gmenu-zoom', engineString('s_03a5f0ef36b4', [z]), 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['z'] = String(z);
      this.scope.listen(b, 'click', () => { opts.fullMap.setZoom(z); this.syncZoom(); });
      zooms.append(b); this.zoomChips.push(b);
  }
    this.mapLegend = el('ws-gmenu-legend', engineString('s_dd35e28aa4b1', [icon('poi'), icon('you')]));
    foot.append(zooms, this.mapLegend);
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
    this.subtitle.textContent = levelName;
    this.scope.listen(closeBtn, 'click', () => { this.close(); });
    this.scope.listen(exitBtn, 'click', () => { this.close(true); this.onExit?.(); }); // silent: the HUD brings the title back itself
    this.scope.listen(this.root, 'pointerdown', (e) => { if (e.target === this.root) this.close(); });
    containMenuInput(this.root, this.scope);
    const toggle = (tab: MenuTab): void => {
      if (!this._open && app.state !== 'play' && app.state !== 'practice') return;
      if (app.ui.blocking && this.layer?.top !== true) {
        if (!app.ui.topYields) return;
        app.ui.back(); // E385: PAUSE over an NPC's dialogue closes it, then opens the menu
        if (app.ui.top !== 'hud') return; // another overlay was under it
      }
      this.toggle(tab);
    };
    app.input.bind('pause', () => { toggle('settings'); }, this.scope);
    app.input.bind('map', () => { toggle('map'); }, this.scope);
    for (const [action, tab] of Object.entries(opts.keys ?? {}) as [Action, MenuTab | undefined][]) if (tab !== undefined) app.input.bind(action, () => { toggle(tab); }, this.scope);
    this.scope.listen(window, 'resize', () => { if (this._open && this._tab === 'map') opts.fullMap.fit(); });
    this.select('settings');
    this.syncReview(); onReview(() => this.syncReview());
    installKeyHelp(this.scope); // F1 or / during play: the live key bindings (E419), on every level
  }

  /** the FEEDBACK tab exists only while the review inbox is unlocked */
  private syncReview(): void {
    if (!reviewUnlocked() && this._tab === 'feedback') this.select('settings');
    else this.syncTabs();
  }
  /** which tabs show: FEEDBACK only while the review inbox is unlocked; only the open group's (one tab = no bar) */
  private syncTabs(): void {
    const review = reviewUnlocked(), group = groupOf(this._tab);
    const playTabs = new Set(['map', ...this.tabsRegistry.registeredTabs.map((tab) => tab.id)]);
    let shown = 0;
    for (const b of this.tabBar.children) {
      const d = (b as HTMLElement).dataset, id = d['tab'];
      const g = d['group'] ?? (id === undefined ? 'play' : groupOf(id)); // an action tab carries its group
      const shownHere = id === undefined || groupOf(id) !== 'play' || playTabs.has(id);
      const on = (id !== 'feedback' || review) && shownHere && g === group && !(id === 'map' && this.noMap);
      (b as HTMLElement).hidden = !on;
      if (on) shown++;
    }
    this.tabBar.classList.toggle('review', shown >= 5);
    this.tabBar.classList.toggle('four', shown === 4); // a BAG without FINDS (Nalati, Nine Dragon): ACHIEVEMENTS must fit a phone
    this.tabBar.hidden = shown <= 1;
    this.tabBar.classList.toggle('icons', group === 'play');
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
  private developerTools: DebugMenu | null = null;

  /** the Debug rows' readouts (Shards in memory, E155; debugOptions.ts DEBUG_READOUTS) — only while this menu is open on
   *  Settings; DebugMenu reads only the ones that can be seen (not while the card is folded, E177) */
  private paintMemory(): void {
    if (this._open && this._tab === 'settings') { this.debug?.paint(); this.developerTools?.paint(); }
  }
  get tab(): MenuTab { return this._tab; }

  open(tab: MenuTab = this._tab): void {
    const selected = this.noMap && tab === 'map' ? 'settings' : this.land(tab);
    this.select(selected);
    if (this._open) return;
    this.resumeState = app.state;
    this.openScope = this.scope.child('open');
    this.layer = app.ui.push('gameMenu', { root: this.root, order: 0, back: () => { this.close(); } }, this.openScope);
    app.setState('paused');
    this.paintMemory();
    this.openScope.interval(2000, () => { this.paintMemory(); }); // while open only (close() stops it)
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
    this.layer?.dispose(); this.layer = null;
    this.openScope?.dispose(); this.openScope = null;
    app.setState(this.resumeState);

    this.root.classList.remove('show');
    window.dispatchEvent(new Event('ws-menu')); // E176
    this.root.inert = true; // faded to opacity 0 but still in the DOM: out of the tab order and the accessibility tree (VoiceOver / XCUITest)
    this.opts.fullMap.hide();
    if (!silent) this.onClose?.();
  }
  toggle(tab: MenuTab): void { if (this._open && this._tab === tab) this.close(); else this.open(tab); }
  /** a BAG tab this shard doesn't have lands on GEAR: no pack (Nalati, Nine Dragon) — I / PACK; no feats (Nine Dragon) */
  private land(want: MenuTab): MenuTab {
    if (this.panels[want] === undefined) return 'gear';
    return want;
  }
  select(want: MenuTab): void {
    const tab = this.land(want);
    this._tab = tab;
    for (const b of this.tabBar.children) (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tab'] === tab);
    for (const [id, p] of Object.entries(this.panels)) p?.classList.toggle('active', id === tab);
    this.hint.textContent = this.hintFor(tab);
    this.syncTabs(); this.syncCats();
    if (this._open) { if (tab === 'map') { this.opts.fullMap.show(); this.syncZoom(); this.renderQuest(); } else this.opts.fullMap.hide(); }
    if (tab === 'settings') this.applies();
    this.renderRegisteredTab(tab);
    if (tab === 'feedback' && this._open) this.onFeedbackTab?.(this.panels.feedback);
  }

  /** re-render the data tabs */
  refresh(): void { for (const tab of this.tabsRegistry.registeredTabs) this.renderRegisteredTab(tab.id); this.syncZoom(); this.hint.textContent = this.hintFor(this._tab); }

  /** the BAG's home: GEAR (the minimap corner's bag button) */
  openBag(): void { this.open('gear'); }

  /** Registered game / kit tabs own all Bag presentation. */
  addTab(spec: TabSpec): () => void {
    if (this.panels[spec.id] !== undefined) throw new Error(`Duplicate UI tab: ${spec.id}`);
    const scope = this.scope.child(`tab.${spec.id}`);
    const off = this.tabsRegistry.tab(spec);
    const panel = el('ws-gmenu-panel scroll'); panel.dataset['scroll'] = '';
    const button = tabButton(spec.title, spec.icon);
    button.type = 'button'; button.dataset['tab'] = spec.id;
    scope.listen(button, 'click', () => { this.select(spec.id); });
    this.panels[spec.id] = panel;
    this.panels.map.parentElement?.append(panel);
    const next = this.tabsRegistry.registeredTabs.find((row) => row.id !== spec.id && (row.order ?? 0) > (spec.order ?? 0));
    const before = [...this.tabBar.children].find((child) => (child as HTMLElement).dataset['tab'] === (next?.id ?? 'settings'));
    this.tabBar.insertBefore(button, before ?? null); this.syncTabs();
    const remove = (): void => { off(); panel.remove(); button.remove(); delete this.panels[spec.id]; if (this._tab === spec.id) this.select('gear'); else this.syncTabs(); };
    scope.onDispose(remove); return () => { scope.dispose(); };
  }
  addTabFragment(tab: string, fragment: TabFragment): () => void {
    const panel = tab === 'pack' ? 'inventory' : tab === 'feats' ? 'achievements' : tab;
    const off = this.tabsRegistry.fragment(panel, fragment); this.syncTabs();
    return () => { off(); this.syncTabs(); };
  }
  private renderRegisteredTab(tab: MenuTab): void {
    const panel = this.panels[tab];
    if (panel !== undefined && this.tabsRegistry.registeredTabs.some((row) => row.id === tab)) {
      panel.replaceChildren(); this.tabsRegistry.render(tab, panel);
    }
  }
  private hintFor(tab: MenuTab): string {
    // a practice room's map is fitted to the frame and doesn't pan (Map.ts update): the pinch is all it takes
    if (tab === 'map' && this.opts.fullMap.hasRoom) return engineString('s_room_map_hint');
    return this.tabsRegistry.registeredTabs.find((row) => row.id === tab)?.hint ?? HINTS[tab] ?? '';
  }
  /** the quest card over the map: chapter title, the full objective, its sub-steps (the HUD shows only the short chip, E51) */
  private renderQuest(): void {
    const q = this.opts.fullMap.quest;
    this.mapQuest.hidden = q === null || q.objective === '';
    if (!q) return;
    const title = el('ws-gmenu-mapquest-title'), objective = el('ws-gmenu-mapquest-obj'), hint = el('ws-gmenu-mapquest-hint');
    title.textContent = q.title; objective.append(document.createElement('i'), document.createTextNode(q.objective)); hint.textContent = q.hint;
    this.mapQuest.replaceChildren(title, objective); if (q.hint) this.mapQuest.append(hint);
  }

  private syncZoom() {
    const z = this.opts.fullMap.zoom;
    this.mapLegend.hidden = this.opts.fullMap.hasRoom;
    for (const b of this.zoomChips) b.classList.toggle('active', Math.abs(Number(b.dataset['z']) - z) < 0.01);
  }

  // ── SETTINGS ──
  /** builds the Settings tab: only what applies live (E55) — renderer, quality, render scale, AA and touch controls
   *  are read at boot and live in main menu ▸ Settings (src/engine/ui/BootSettings.ts, APPLY & RELOAD). Two cards (E81, the user's
   *  split): SETTINGS holds what ships with the finished game; DEBUG holds the variant pickers and taste toggles that
   *  exist only while the look and sound are being decided — each leaves that card once it is locked in (E78 the
   *  painted horizon, E83 the photo sky, E85 the colour grade, E87 the lighting, E88 the post) */
  private buildSettings(): void {
    const panel = this.panels.settings;
    const catLabel: Record<SettingsCat, string> = { video: engineString('s_settings_video'), audio: engineString('s_bc1b88907d3b'), controls: engineString('s_799c26913574'), keys: engineString('s_f4fce9bc331d'),
      gameplay: engineString('s_31bcb8940fff'), save: SAVE_STRINGS.title, review: engineString('s_aff0766a5290'), debug: engineString('s_1a03bd2fd107') };
    const cats = settingsCategories(panel, this.scope, catLabel, () => { this.syncCats(); }); this.cats = cats;
    // E178: no full-width RESUME / EXIT TO MAIN MENU on top of the panel any more — they are the header bar's two buttons
    const p = el('ws-gmenu-card', engineString('s_e68f72548349')); this.settingsCard = p;
    const dbg = foldCard('debug', engineString('s_1a03bd2fd107'), engineString('s_8c4422087396')); // E177: folded until it is asked for
    const tools = foldCard('developerTools', engineString('s_96f0c06bbcb7'), 'Diagnostics and unfinished work');
    // developer mode only (E140, the user's 7a): the Settings ▸ Developer switch shows / hides it live
    dbg.hidden = !isDev(); tools.hidden = !isDev(); onDev((on) => { dbg.hidden = !on; tools.hidden = !on; cats.sync(); });
    cats.pane.append(p, tools, dbg); cats.tag('review', tools); cats.tag('debug', dbg);
    // VIDEO (desktop rail only): the boot-time picks are the main menu's (E55), so the pause menu reads them out
    const tierRow = el('ws-gmenu-row', engineString('s_b756f4e0f8ff', [esc(engineString('s_1b2c08a8733d'))])), tierVal = tierRow.querySelector<HTMLElement>('.ws-gmenu-val');
    if (tierVal) tierVal.textContent = TIER === 'phone' ? engineString('s_63dceb8800b2') : engineString('s_9bd88f2485ac');
    const video = [cats.head(el('ws-gmenu-label', esc(catLabel.video))), tierRow, el('ws-gmenu-note', esc(engineString('s_settings_video_note')))];
    p.append(...video); cats.tag('video', ...video);

    const sw = (key: SettingKey, label: string) => {
      const b = el('ws-gmenu-switch', engineString('s_d652c0be6be8', [label]), 'button') as HTMLButtonElement; b.type = 'button'; b.setAttribute('role', 'switch');
      const sync = (v: boolean) => { b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v)); };
      sync(getSetting(key)); onSetting(key, sync);
      this.scope.listen(b, 'click', () => setSetting(key, !getSetting(key)));
      return b;
    };
    // "applies when" (E130): a row that does not apply to the weapons you hold or to this shard is hidden (re-read on every
    // open — a weapon unlocked mid-run brings its rows); a section label goes with its last row
    const section = (card: HTMLElement, cat: SettingsCat, label: string, ...rows: (HTMLElement | [When, HTMLElement])[]): void => {
      const whens: When[] = [];
      const els = rows.map((r) => { if (Array.isArray(r)) { whens.push(r[0]); this.gated.push({ el: r[1], when: r[0] }); return r[1]; } whens.push(() => true); return r; });
      const head = el('ws-gmenu-label', label);
      cats.head(head); // both sections are named as their category
      this.gated.push({ el: head, when: (c) => whens.some((w) => w(c)) });
      card.append(head, ...els); cats.tag(cat, head, ...els);
    };
    const ranged: When = (c) => c.tracers; // the bolts / rounds draw tracers: Nalati's bow draws none (NALATI-MERGE F7)
    section(p, 'gameplay', engineString('s_31bcb8940fff'), sw('aimAssist', engineString('s_714896153134')),
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
      this.scope.listen(s, 'input', () => { setNumber(key, Number(s.value) / 100); paint(); });
      this.scope.listen(s, 'pointerdown', (e) => e.stopPropagation());
      paint(); row.append(s); return row;
    };
    section(p, 'controls', engineString('s_799c26913574'), mult('look', engineString('s_64e57bf9ef8a')), [(c) => c.melee, mult('swingLook', engineString('s_e532946ea0dd'))]); // a swing's turn: the blades

    // audio: master volume (Settings 'volume', 0..1) — main.ts drives the AudioContext gain from it
    const vol = el('ws-gmenu-row', engineString('s_31a1802e19b8'));
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.className = 'ws-gmenu-slider';
    slider.value = String(Math.round(getNumber('volume') * 100));
    this.scope.listen(slider, 'input', () => setNumber('volume', Number(slider.value) / 100));
    this.scope.listen(slider, 'pointerdown', (e) => e.stopPropagation());
    vol.append(slider);
    // music volume (Settings 'music', 0..1) — src/engine/audio/Music.ts drives its bus from it
    const mus = el('ws-gmenu-row', engineString('s_4db5c63706fd'));
    const mslider = document.createElement('input'); mslider.type = 'range'; mslider.min = '0'; mslider.max = '100'; mslider.className = 'ws-gmenu-slider';
    mslider.value = String(Math.round(getNumber('music') * 100));
    this.scope.listen(mslider, 'input', () => setNumber('music', Number(mslider.value) / 100));
    this.scope.listen(mslider, 'pointerdown', (e) => e.stopPropagation());
    mus.append(mslider);
    // music style (Settings 'musicStyle', project/archive/2026-09-23-music.md v3): the MiniMax-Music3 scores or the v1 synth — Music.ts crossfades on a bar;
    // Best sound samples (MOSS-SoundEffect v2 + Stable Audio 3 Medium); synth covers missing samples.
    const picker = <T extends string>(label: string, options: { v: T; text: string }[], get: () => T, set: (v: T) => void, on: (fn: () => void) => void) => {
      const row = el('ws-gmenu-row', engineString('s_54fa835c7c85', [label]));
      const box = el('ws-gmenu-seg');
      const paint = () => { for (const c of box.children) (c as HTMLElement).classList.toggle('active', (c as HTMLElement).dataset['v'] === get()); };
      for (const o of options) {
        const b = words('ws-gmenu-segbtn', o.text, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['v'] = o.v;
        this.scope.listen(b, 'click', () => { set(o.v); paint(); });
        box.append(b);
      }
      paint(); on(paint); row.append(box); return row;
    };
    // a pick decodes from the offline cache (project/archive/2026-09-23-preload-offline.md): a spinner by the label only past 300 ms
    // the licences ask for the models' names in the UI: MiniMax-Music3, and the sfx set's credit ("Powered by Stability AI")
    const sfxNote = el('ws-gmenu-note');
    const paintCredit = () => { const c = sfxCredit(getSfxSet()); sfxNote.textContent = c; sfxNote.hidden = c === ''; };
    paintCredit(); onSfxCredit(paintCredit);
    const audio = [cats.head(el('ws-gmenu-label', engineString('s_bc1b88907d3b'))), vol, mus, buildMusicStyleRow(this.scope), el('ws-gmenu-note', MUSIC_CREDIT), sfxNote];
    p.append(...audio); cats.tag('audio', ...audio);
    // lock-on (E50, src/engine/player/LockOnTarget.ts): how hard the view follows a locked enemy (Gentle = Jake's pick; Off keeps the
    // lock — the reticle, orbit strafing, the lunge, switching — but never turns the view: the motion-sickness escape)
    const lockCams: { v: '1' | '0.5' | '0'; text: string }[] = [{ v: '1', text: engineString('s_641d1ef657bd') }, { v: '0.5', text: engineString('s_96124817c810') }, { v: '0', text: engineString('s_ca7981b46ecf') }];
    const lockCam = picker(engineString('s_21ed7056ff10'), lockCams, () => (getNumber('lockCam') >= 0.75 ? '1' : getNumber('lockCam') > 0.1 ? '0.5' : '0'), (v) => setNumber('lockCam', Number(v)), () => undefined);
    const lockOn = [el('ws-gmenu-label', engineString('s_fcc34c9149ac')), lockCam, sw('autoLock', engineString('s_c436a89a4252')), el('ws-gmenu-note', engineString('s_c12db72ef23e'))];
    p.append(...lockOn); cats.tag('gameplay', ...lockOn);

    // DEBUG (E162): every variant, taste toggle and developer aid, grouped — declared once in src/engine/ui/debugOptions.ts and
    // rendered by src/engine/ui/DebugMenu.ts (collapsible groups, only the rows that apply to this shard, a filter). Shards in
    // memory carries the on-device readout (E155 / E159): refreshed only while this menu is open on Settings
    this.debug = buildDebugMenu(dbg);
    this.developerTools = buildDebugMenu(tools, { purpose: 'developer' });
    // Review is not debug (E140): playtesters unlock notes with it, so it stays in Settings, with the Developer switch
    const review = [this.buildReview(), ...devSwitchRows()];
    p.append(...review); cats.tag('review', ...review);
    this.savePanel = buildSavePanel(); cats.pane.append(this.savePanel); cats.tag('save', this.savePanel);
    this.controlsPanel = buildControlsPanel(app.levelScope ?? app.engineScope); cats.pane.append(this.controlsPanel); cats.tag('keys', this.controlsPanel);
    cats.sync();
  }
  /** A section the game adds to pause ▸ Settings: its label and rows join the Settings card under category `cat` (on a
   *  desktop they show with that category; on a phone in the one column). `first` puts them right under the card's title
   *  (SAVES, G83); `refresh` runs on every open, before the rows are shown. Returns the disposer; the menu's scope disposes it too. */
  addSettingsSection(cat: SettingsCat, els: readonly HTMLElement[], opts: { first?: boolean; refresh?: () => void } = {}): () => void {
    const card = this.settingsCard, cats = this.cats;
    if (card === undefined || cats === undefined) throw new Error('GameMenu: Settings is not built');
    if (opts.first === true) card.firstElementChild?.after(...els); else card.append(...els);
    cats.tag(cat, ...els);
    const refresh = opts.refresh;
    if (refresh !== undefined) this.sectionRefresh.add(refresh);
    let live = true;
    let forget: () => void = () => undefined;
    const remove = (): void => {
      if (!live) return; live = false; forget(); // SF57: an early remove drops the menu's hold on `refresh` too
      for (const e of els) { e.hidden = true; e.remove(); }
      if (refresh !== undefined) this.sectionRefresh.delete(refresh);
      cats.sync();
    };
    forget = this.scope.capture('disposers', remove);
    if (this._open) this.applies(); else cats.sync();
    return remove;
  }
  /** layout A on a desktop: the sheet goes wide for Settings, and the footer says click (J10) */
  private syncCats(): void {
    const wide = this.cats?.desk === true && this._tab === 'settings';
    this.root.classList.toggle('wide', wide);
    this.hint.textContent = wide ? settingsHint() : this.hintFor(this._tab);
  }
  /** show only the Settings rows that apply now (E130: the weapons you hold, the shard) — every open and every Settings select */
  private applies(): void {
    this.savePanel?.refresh();
    this.controlsPanel?.refresh();
    for (const refresh of this.sectionRefresh) refresh();
    const c: SettingsCtx = { ...this.opts.settings(), chunk: activeLevel() };
    for (const g of this.gated) g.el.hidden = !g.when(c);
    this.cats?.sync();
    this.debug?.applies(c);
    this.developerTools?.applies(c);
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
        this.scope.listen(input, 'keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); if (e.code === 'Enter') void tryUnlock(); });
        this.scope.listen(input, 'keyup', (e) => { e.stopPropagation(); });
        this.scope.listen(go, 'click', () => { void tryUnlock(); });
        row.append(input, go);
        box.append(row, note);
        return;
      }
      const sw = el('ws-gmenu-switch', engineString('s_e1e76f890568'), 'button') as HTMLButtonElement; sw.type = 'button'; sw.setAttribute('role', 'switch');
      sw.classList.toggle('on', quickNote()); sw.setAttribute('aria-checked', String(quickNote()));
      this.scope.listen(sw, 'click', () => setQuickNote(!quickNote()));
      const lock = el('ws-gmenu-unlock', engineString('s_db44b8db4f05'), 'button') as HTMLButtonElement; lock.type = 'button';
      this.scope.listen(lock, 'click', () => lockReview());
      const row = el('ws-gmenu-row', engineString('s_b39f8f67f676'));
      row.append(lock);
      box.append(sw, row, el('ws-gmenu-note', engineString('s_806c6e56a7d8')));
    };
    render(); onReview(render);
    return box;
  }
}
