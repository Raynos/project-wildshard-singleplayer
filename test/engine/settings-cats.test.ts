// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { SETTINGS_CATS, SETTINGS_DESK_QUERY, settingsCategories, type SettingsCat } from '../../src/engine/ui/settingsCats';

const scopes: Scope[] = [];
afterEach(() => { for (const scope of scopes.splice(0)) scope.dispose(); document.body.replaceChildren(); vi.restoreAllMocks(); });
const LABELS: Record<SettingsCat, string> = { video: 'Video', audio: 'Audio', controls: 'Controls', keys: 'Key bindings', gameplay: 'Gameplay', save: 'Save', review: 'Review', debug: 'Debug' };
function build(desk: boolean) {
  const media = window.matchMedia(SETTINGS_DESK_QUERY);
  vi.spyOn(media, 'matches', 'get').mockReturnValue(desk); vi.spyOn(window, 'matchMedia').mockReturnValue(media);
  const scope = new Scope('cats-test'); scopes.push(scope);
  const panel = document.createElement('div'); document.body.append(panel);
  const cats = settingsCategories(panel, scope, LABELS, () => undefined);
  // one card holding four categories' rows (as Menu.ts's Settings card does), then a card per category
  const card = document.createElement('div'), rows: Partial<Record<SettingsCat, HTMLElement>> = {};
  cats.pane.append(card);
  for (const cat of SETTINGS_CATS) {
    const row = document.createElement('div'); row.textContent = cat; rows[cat] = row;
    if (['video', 'audio', 'controls', 'gameplay', 'review'].includes(cat)) card.append(row); else cats.pane.append(row);
    cats.tag(cat, row);
  }
  const debug = rows.debug; if (debug) debug.hidden = true; // developer mode off
  cats.sync();
  const shown = (cat: SettingsCat): boolean => !(rows[cat]?.classList.contains('catoff') ?? true);
  return { panel, cats, card, rows, media, shown, rail: [...panel.querySelectorAll<HTMLButtonElement>('.ws-gmenu-cat')] };
}

it('desktop: a category rail (Video · Audio · Controls · Key bindings · Gameplay …) and one category on the right', () => {
  const { panel, cats, rail, shown, card } = build(true);
  expect(window.matchMedia).toHaveBeenCalledWith('(pointer: fine) and (min-width: 900px)');
  expect(panel.classList.contains('cats')).toBe(true);
  expect(rail.filter((b) => b.hidden === false).map((b) => b.textContent)).toEqual(['Video', 'Audio', 'Controls', 'Key bindings', 'Gameplay', 'Save', 'Review']);
  expect(SETTINGS_CATS.filter(shown)).toEqual(['video']);
  rail.find((b) => b.dataset['cat'] === 'keys')?.click();
  expect(cats.selected).toBe('keys'); expect(SETTINGS_CATS.filter(shown)).toEqual(['keys']);
  expect(card.classList.contains('catoff')).toBe(true); // the shared card has nothing of Key bindings: it goes too
  expect(panel.querySelector('.ws-gmenu-cathead')?.textContent).toBe('Key bindings');
  expect(rail.find((b) => b.classList.contains('active'))?.dataset['cat']).toBe('keys');
  rail.find((b) => b.dataset['cat'] === 'audio')?.click();
  expect(SETTINGS_CATS.filter(shown)).toEqual(['audio']); expect(card.classList.contains('catoff')).toBe(false);
});

it('desktop: a category with nothing to show leaves the rail, and a selected one falls back to the first', () => {
  const { cats, rows, rail } = build(true);
  const debug = rows.debug; if (!debug) throw new Error('no debug row');
  debug.hidden = false; cats.sync(); expect(rail.find((b) => b.dataset['cat'] === 'debug')?.hidden).toBe(false);
  cats.select('debug'); debug.hidden = true; cats.sync();
  expect(cats.selected).toBe('video'); expect(rail.find((b) => b.dataset['cat'] === 'debug')?.hidden).toBe(true);
});

it('phone (or a narrow window): every category stacked as before, no rail, no Video', () => {
  const { panel, shown, card, media } = build(false);
  expect(panel.classList.contains('cats')).toBe(false);
  expect(SETTINGS_CATS.filter(shown)).toEqual(SETTINGS_CATS.filter((cat) => cat !== 'video'));
  expect(card.classList.contains('catoff')).toBe(false);
  vi.spyOn(media, 'matches', 'get').mockReturnValue(true); media.dispatchEvent(new Event('change'));
  expect(panel.classList.contains('cats')).toBe(true);
});
