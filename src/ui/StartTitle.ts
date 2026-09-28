/** Renderer-free opening title. Only the selected shard's hero art is decoded. */
import driftThumb from '../chunks/thumbs/driftwood-isle.jpg';
import driftPortrait from '../chunks/thumbs/driftwood-isle-portrait.jpg';
import driftLandscape from '../chunks/thumbs/driftwood-isle-landscape.jpg';
import pineThumb from '../chunks/thumbs/pine-hollow.jpg';
import pinePortrait from '../chunks/thumbs/pine-hollow-portrait.jpg';
import pineLandscape from '../chunks/thumbs/pine-hollow-landscape.jpg';
import nalatiThumb from '../chunks/thumbs/nalati-grasslands.jpg';
import nalatiPortrait from '../chunks/thumbs/nalati-grasslands-portrait.jpg';
import nalatiLandscape from '../chunks/thumbs/nalati-grasslands-landscape.jpg';
import nineThumb from '../chunks/thumbs/nine-dragon-stack.jpg';
import ninePortrait from '../chunks/thumbs/nine-dragon-stack-portrait.jpg';
import nineLandscape from '../chunks/thumbs/nine-dragon-stack-landscape.jpg';
import { setTitleArrival, type TitleArrivalMode } from '../boot/titleArrival';
import { markUnload } from '../boot/lastEnd';
import { previousNineBootLine } from '../boot/nineBootTrace';
import { bindDevToggle } from './devSwitch';

interface Card {
  slug: string; name: string; label: string; thumb: string; portrait: string; landscape: string;
  badge?: 'Early access' | 'Experimental';
}

// Keep these labels and images aligned with the four ChunkDefs. The title does not import
// those defs: terrain and world modules must stay outside the opening document's JS graph.
const CARDS: readonly Card[] = [
  { slug: 'driftwood-isle', name: 'Driftwood Isle', label: 'Low-poly island · open ocean · (−1, +6) · 500 m shard', thumb: driftThumb, portrait: driftPortrait, landscape: driftLandscape },
  { slug: 'pine-hollow', name: 'Pine Hollow', label: 'Boreal pine forest · (+3, −2) · 500 m shard', thumb: pineThumb, portrait: pinePortrait, landscape: pineLandscape },
  { slug: 'nalati-grasslands', name: 'Nalati Grasslands', label: 'Alpine steppe · (+4, −2) · 500 m shard', thumb: nalatiThumb, portrait: nalatiPortrait, landscape: nalatiLandscape, badge: 'Early access' },
  { slug: 'nine-dragon-stack', name: 'Nine Dragon Stack', label: 'Vertical neon city · (−2, +1) · 500 m shard', thumb: nineThumb, portrait: ninePortrait, landscape: nineLandscape, badge: 'Experimental' },
];

const SWORD = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 3.5L9 14l1 1L20.5 4.5z M6.5 12.5l5 5 M8 14l-4.5 4.5 1 1L9 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

function required(root: ParentNode, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Start title: missing ${selector}`);
  return found;
}

export function showStartTitle(): void {
  const hud = document.getElementById('hud');
  if (hud === null) throw new Error('Start title: missing #hud');
  hud.classList.add('intro');
  const title = document.createElement('div');
  title.className = 'ws-menu';
  title.innerHTML = `
    <div class="ws-menu-hero show"></div>
    <div class="ws-menu-head"><div class="ws-wordmark">Project <b>Wildshard</b></div>
      <button class="ws-menu-mode ws-menu-explore" type="button"><span class="ws-menu-mode-glyph">${EYE}</span><span class="ws-menu-explore-text"><b>Explore world</b><small>Fly · inspect</small></span></button></div>
    <div class="ws-menu-deck">
      <div class="ws-menu-cards"><div class="ws-menu-deck-track">${CARDS.map((card, i) => `
        <button class="ws-menu-card" type="button" data-i="${i}">
          <span class="ws-menu-card-img" style="background-image:url('${card.thumb}')"><i class="ws-menu-card-tag">Load</i>${card.badge ? `<i class="ws-menu-card-exp${card.badge === 'Early access' ? ' ws-menu-card-ea' : ''}">${card.badge}</i>` : ''}</span>
          <b>${card.name}</b><small>${card.label}</small>
        </button>`).join('')}</div></div>
      <div class="ws-menu-dots">${CARDS.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <div class="ws-menu-modes"><button class="ws-menu-mode ws-menu-play" type="button"><span class="ws-menu-mode-glyph">${SWORD}</span><b>Enter world</b><small>Loads this shard</small></button></div>
      <button class="ws-menu-arena" type="button"><b>Practice arena</b><small>HUD + weapon explorer · starter weapon</small><span>›</span></button>
      <div class="ws-menu-row"><button class="ws-menu-settings" type="button">Settings</button><button class="ws-menu-sound ws-menu-dev" type="button">Dev</button></div>
    </div>`;
  hud.append(title);

  const interrupted = previousNineBootLine();
  if (interrupted) {
    const notice = document.createElement('div');
    notice.className = 'ws-menu-recovery';
    notice.setAttribute('role', 'status');
    notice.textContent = `${interrupted}\nReturned to shard select. Choose a world when ready.`;
    required(title, '.ws-menu-head').append(notice);
  }

  const list = required(title, '.ws-menu-cards');
  const track = required(title, '.ws-menu-deck-track');
  const hero = required(title, '.ws-menu-hero');
  const cards = Array.from(title.querySelectorAll<HTMLElement>('.ws-menu-card'));
  const dots = Array.from(title.querySelectorAll<HTMLElement>('.ws-menu-dots i'));
  let index = 0;
  const heroUrl = (card: Card): string => innerWidth < innerHeight ? card.portrait : card.landscape;
  const place = (extra = 0, animate = true): void => {
    const card = cards[index];
    if (card === undefined) return;
    track.style.transition = animate ? 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none';
    track.style.transform = `translateX(${list.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2) + extra}px)`;
  };
  const select = (i: number): void => {
    index = Math.max(0, Math.min(CARDS.length - 1, i));
    const selected = CARDS[index];
    if (selected === undefined) return;
    cards.forEach((card, n) => { card.classList.toggle('selected', n === index); });
    dots.forEach((dot, n) => { dot.classList.toggle('on', n === index); });
    hero.style.backgroundImage = `url('${heroUrl(selected)}')`;
    place();
  };
  const launch = (mode: TitleArrivalMode): void => {
    const selected = CARDS[index];
    if (selected === undefined) return;
    setTitleArrival({ slug: selected.slug, mode });
    markUnload(`title chose ${selected.slug} (${mode})`);
    const url = new URL(location.href);
    url.search = '';
    url.searchParams.set('chunk', selected.slug);
    location.assign(url.toString());
  };

  let drag: { id: number; x: number; at: number; dx: number } | null = null;
  list.addEventListener('pointerdown', (event) => {
    drag = { id: event.pointerId, x: event.clientX, at: performance.now(), dx: 0 };
    list.setPointerCapture(event.pointerId);
  });
  list.addEventListener('pointermove', (event) => {
    if (drag === null || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.x;
    const end = (drag.dx > 0 && index === 0) || (drag.dx < 0 && index === CARDS.length - 1);
    place(end ? drag.dx * 0.3 : drag.dx, false);
  });
  let swipedAt = 0;
  const finish = (event: PointerEvent): void => {
    if (drag === null || event.pointerId !== drag.id) return;
    const { dx, at } = drag;
    drag = null;
    const speed = dx / Math.max(1, performance.now() - at);
    if (Math.abs(dx) > 36 || (Math.abs(speed) > 0.35 && Math.abs(dx) > 14)) {
      swipedAt = performance.now();
      select(index + (dx < 0 ? 1 : -1));
    } else place();
  };
  list.addEventListener('pointerup', finish);
  list.addEventListener('pointercancel', finish);
  cards.forEach((card, i) => { card.addEventListener('click', () => { if (performance.now() - swipedAt > 400) select(i); }); });
  dots.forEach((dot, i) => { dot.addEventListener('click', () => { select(i); }); });
  required(title, '.ws-menu-play').addEventListener('click', () => { launch('enter'); });
  required(title, '.ws-menu-explore').addEventListener('click', () => { launch('explore'); });
  required(title, '.ws-menu-arena').addEventListener('click', () => { launch('arena'); });
  required(title, '.ws-menu-settings').addEventListener('click', () => { void import('./BootSettings').then(({ openBootSettings }) => openBootSettings()); });
  bindDevToggle(required(title, '.ws-menu-dev'));
  addEventListener('resize', () => { const selected = CARDS[index]; if (selected) hero.style.backgroundImage = `url('${heroUrl(selected)}')`; place(0, false); });
  const resize = new ResizeObserver(() => { place(0, false); });
  resize.observe(list);
  select(0);
  requestAnimationFrame(() => { place(0, false); });
  document.dispatchEvent(new Event('ws:ready'));
}

showStartTitle();
