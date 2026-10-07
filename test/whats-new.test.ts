// SF60 / G214 (Jake: B, a slim banner under the logo): the main menu's WHAT'S NEW banner shows with Developer on and at
// least one entry, folds to one line, opens in place on a tap, and HIDE UNTIL NEXT BUILD keeps it away until the build
// changes (hidden on build A, shown again on build B).
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { setDev } from '../src/engine/core/devMode';
import { titleCards } from '../src/game/titleDeck';
import { buildTitleMenu } from '../src/game/mainMenu';
import { WHATS_NEW, type WhatsNew } from '../src/game/whatsNew';
import { buildWhatsNewBanner, shortBuild, whatsNewShown, type HiddenStore } from '../src/game/whatsNewBanner';

afterEach(() => { setDev(false); document.body.replaceChildren(); });

const NEWS: WhatsNew = { date: '7 OCT 2026', entries: ['Sky Reach: ride the Rising Islet', 'Nine Dragon: north lantern lift', 'Lifts: no stalling'] };
const memory = (): HiddenStore & { value: string | null } => {
  const store = { value: null as string | null, read: () => store.value, write: (build: string) => { store.value = build; } };
  return store;
};
const noop = (): void => undefined;
const onTap = (el: HTMLElement, fn: () => void): void => { el.addEventListener('click', fn); };

describe('the gate', () => {
  it('Developer on and entries, unless hidden on this very build', () => {
    expect(whatsNewShown({ developer: true, entries: 3, build: 'aaaaaaa', hiddenOn: null })).toBe(true);
    expect(whatsNewShown({ developer: false, entries: 3, build: 'aaaaaaa', hiddenOn: null })).toBe(false);
    expect(whatsNewShown({ developer: true, entries: 0, build: 'aaaaaaa', hiddenOn: null })).toBe(false);
    expect(whatsNewShown({ developer: true, entries: 3, build: 'aaaaaaa', hiddenOn: 'aaaaaaa' })).toBe(false);
    expect(whatsNewShown({ developer: true, entries: 3, build: 'bbbbbbb', hiddenOn: 'aaaaaaa' })).toBe(true);
  });
  it('the build is the commit, so a redeploy of one commit stays hidden', () => {
    expect(shortBuild('bc9c3309e-mfx1a2b')).toBe('bc9c3309e');
    expect(shortBuild('b-mfx1a2b')).toBe('mfx1a2b');
  });
  it('today\'s data has 3–5 lines', () => {
    expect(WHATS_NEW.entries.length).toBeGreaterThanOrEqual(3);
    expect(WHATS_NEW.entries.length).toBeLessThanOrEqual(5);
  });
});

describe('the banner', () => {
  it('folded: one line "WHAT\'S NEW · N CHANGES" with the build; a tap opens the entries and HIDE UNTIL NEXT BUILD', () => {
    const banner = buildWhatsNewBanner({ news: NEWS, developer: true, onTap, build: 'bc9c3309e', store: memory() });
    if (banner === null) throw new Error('banner should show');
    document.body.append(banner.root);
    const head = banner.root.querySelector<HTMLButtonElement>('.ws-whatsnew-head');
    const body = banner.root.querySelector<HTMLElement>('.ws-whatsnew-body');
    expect(banner.root.querySelector('.ws-whatsnew-title')?.textContent).toBe('WHAT\'S NEW · 3 CHANGES');
    expect(banner.root.querySelector('.ws-whatsnew-build')?.textContent).toBe('BC9C3309E');
    expect(body?.hidden).toBe(true);
    expect(head?.getAttribute('aria-expanded')).toBe('false');
    head?.click();
    expect(banner.open).toBe(true);
    expect(body?.hidden).toBe(false);
    expect(head?.getAttribute('aria-expanded')).toBe('true');
    expect([...banner.root.querySelectorAll('.ws-whatsnew-list li')].map((li) => li.textContent)).toEqual([...NEWS.entries]);
    expect(banner.root.querySelector('.ws-whatsnew-line')?.textContent).toBe('PLAYTEST BUILD BC9C3309E · 7 OCT 2026');
    expect(banner.root.querySelector('.ws-whatsnew-hide')?.textContent).toBe('HIDE UNTIL NEXT BUILD');
    head?.click();
    expect(body?.hidden).toBe(true);
  });
  it('entries are text, never markup', () => {
    const banner = buildWhatsNewBanner({ news: { entries: ['<b>bold</b>'] }, developer: true, onTap, build: 'aaaaaaa', store: memory() });
    expect(banner?.root.querySelector('.ws-whatsnew-list li')?.textContent).toBe('<b>bold</b>');
    expect(banner?.root.querySelector('.ws-whatsnew-list b')).toBeNull();
    expect(banner?.root.querySelector('.ws-whatsnew-title')?.textContent).toBe('WHAT\'S NEW · 1 CHANGE');
    expect(banner?.root.querySelector('.ws-whatsnew-line')?.textContent).toBe('PLAYTEST BUILD AAAAAAA');
  });
  it('HIDE UNTIL NEXT BUILD: hidden on build A, shown again on build B', () => {
    const store = memory();
    const a = buildWhatsNewBanner({ news: NEWS, developer: true, onTap, build: 'aaaaaaa', store });
    if (a === null) throw new Error('banner should show');
    document.body.append(a.root);
    a.toggle();
    a.root.querySelector<HTMLButtonElement>('.ws-whatsnew-hide')?.click();
    expect(store.value).toBe('aaaaaaa');
    expect(document.querySelector('.ws-whatsnew')).toBeNull();
    expect(buildWhatsNewBanner({ news: NEWS, developer: true, onTap, build: 'aaaaaaa', store })).toBeNull();
    expect(buildWhatsNewBanner({ news: NEWS, developer: true, onTap, build: 'bbbbbbb', store })).not.toBeNull();
  });
  it('a store that throws shows the banner (and a hide lasts the page)', () => {
    const broken: HiddenStore = { read: () => { throw new Error('denied'); }, write: () => { throw new Error('denied'); } };
    const banner = buildWhatsNewBanner({ news: NEWS, developer: true, onTap, build: 'aaaaaaa', store: broken });
    if (banner === null) throw new Error('banner should show');
    document.body.append(banner.root);
    banner.hide();
    expect(document.querySelector('.ws-whatsnew')).toBeNull();
    expect(buildWhatsNewBanner({ news: NEWS, developer: true, onTap, build: 'aaaaaaa' })).not.toBeNull(); // the device save, fresh
  });
});

describe('on the main menu', () => {
  for (const dev of [false, true]) {
    it(`Developer ${dev}: ${dev ? 'the banner sits right under the logo, the cards and SETTINGS unchanged' : 'no banner'}`, () => {
      setDev(dev);
      const store = memory();
      const menu = buildTitleMenu({ cards: titleCards(), active: null, onEnter: noop, onExplore: noop, onSettings: noop, onGrid: noop, screen: 'main', whatsNew: NEWS, whatsNewStore: store });
      document.body.append(menu.root);
      const banner = menu.root.querySelector('.ws-whatsnew');
      expect(banner !== null).toBe(dev);
      if (dev) expect(menu.root.querySelector('.ws-main-logo')?.nextElementSibling).toBe(banner);
      expect(menu.root.querySelectorAll('.ws-main-card').length).toBe(dev ? 2 : 1);
      menu.root.querySelector<HTMLButtonElement>('.ws-whatsnew-head')?.click();
      expect(menu.screen).toBe('main'); // the tap opens the banner, never SHARD SELECT
      menu.dispose();
    });
  }
  it('no entries: no banner, even with Developer on', () => {
    setDev(true);
    const menu = buildTitleMenu({ cards: titleCards(), active: null, onEnter: noop, onExplore: noop, onSettings: noop, onGrid: noop, screen: 'main', whatsNew: { entries: [] }, whatsNewStore: memory() });
    expect(menu.root.querySelector('.ws-whatsnew')).toBeNull();
    menu.dispose();
  });
});
