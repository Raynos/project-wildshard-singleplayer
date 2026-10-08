// Playtest reports (SF68 tool 3): each G222 agent playtest's top 10, with the clips and stills each item names, what
// works, and the full gallery. Media opens in a full-screen viewer; videos load only when tapped.
import type { Playtest, PlaytestMedia } from './bundle.ts';
import { h, rich } from './dom.ts';

let current = '';

export function openMedia(m: PlaytestMedia): void {
  const box = document.getElementById('lightbox');
  if (!box) return;
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }
  function close(): void {
    if (!box) return;
    box.hidden = true;
    box.replaceChildren();
    document.removeEventListener('keydown', onKey);
  }
  const media = m.kind === 'video'
    ? h('video', { src: `/${m.src}`, controls: true, autoplay: true, muted: true, playsinline: true, loop: true })
    : h('img', { src: `/${m.src}`, alt: m.name });
  box.replaceChildren(
    h('div', { class: 'lb-top' }, h('span', {}, m.name), h('button', { class: 'lb-close', type: 'button', 'aria-label': 'Close', onclick: close }, '✕')),
    h('div', { class: 'lb-media', onclick: (e) => {
      if (e.target === e.currentTarget) close();
    } }, media));
  box.hidden = false;
  document.addEventListener('keydown', onKey);
}

function tile(m: PlaytestMedia, withName: boolean): HTMLButtonElement {
  const poster = m.kind === 'image'
    ? h('img', { src: `/${m.src}`, alt: m.name, loading: 'lazy', decoding: 'async' })
    : m.poster ? h('img', { src: `/${m.poster}`, alt: '', loading: 'lazy', decoding: 'async' }) : null;
  return h('button', { type: 'button', 'aria-label': `Open ${m.name}`, onclick: () => openMedia(m) },
    poster,
    m.kind === 'video' ? h('span', { class: 'play', 'aria-hidden': 'true' }, '▶') : null,
    withName ? h('span', { class: 'clipname' }, m.name.replace(/\.(mp4|jpe?g|webp|png)$/, '')) : null);
}

export function playtestsView(root: HTMLElement, rounds: Playtest[], route: string[]): void {
  const [want] = route;
  if (want && rounds.some((r) => r.id === want)) current = want;
  const round = rounds.find((r) => r.id === current) ?? rounds[0];
  if (!round) {
    root.replaceChildren(h('div', { class: 'card empty' }, h('div', { class: 'glyph' }, '▶'), h('p', {}, 'No playtest rounds are committed yet.')));
    return;
  }
  current = round.id;
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Round' },
    ...rounds.map((r) => h('button', { class: 'chip', type: 'button', 'aria-pressed': r.id === round.id ? 'true' : 'false', onclick: () => {
      current = r.id;
      history.replaceState(null, '', `#playtests/${r.id}`);
      playtestsView(root, rounds, []);
      window.scrollTo(0, 0);
    } }, r.id.replace(/^round-(\d+)-/, 'Round $1 · '))));

  const top = h('section', { class: 'card flat' });
  for (const item of round.top) {
    const shots = round.media.filter((m) => item.media.includes(m.name));
    top.append(h('details', { class: 'issue' },
      h('summary', {}, h('span', { class: 'rank' }, String(item.rank)), h('span', { class: 'ititle' }, rich(item.title))),
      h('div', { class: 'ibody' },
        ...item.lines.map((l) => h('p', {}, rich(l))),
        shots.length > 0 ? h('div', { class: 'thumbs' }, ...shots.map((m) => tile(m, false))) : null)));
  }
  const images = round.media.filter((m) => m.kind === 'image');
  const clips = round.media.filter((m) => m.kind === 'video');
  const parts: (Node | null)[] = [
    chips,
    h('h1', {}, round.title),
    h('p', { class: 'sub' }, round.date, round.builds.length > 0 ? ' · builds ' : '',
      ...round.builds.map((b, i) => h('span', { class: 'mono' }, `${i > 0 ? ', ' : ''}${b}`))),
    h('h2', {}, `Top ${round.top.length} problems`),
    round.top.length > 0 ? top : h('p', { class: 'small' }, 'This round has no top-10 list.'),
    round.works.length > 0 ? h('h2', {}, 'What works') : null,
    round.works.length > 0 ? h('section', { class: 'card' }, h('ul', { class: 'works', style: 'margin:0;padding-left:18px' }, ...round.works.map((w) => h('li', {}, rich(w))))) : null,
    clips.length > 0 ? h('h2', {}, `Clips (${clips.length})`) : null,
    clips.length > 0 ? h('div', { class: 'gallery' }, ...clips.map((m) => tile(m, true))) : null,
    images.length > 0 ? h('h2', {}, `Stills (${images.length})`) : null,
    images.length > 0 ? h('div', { class: 'gallery' }, ...images.map((m) => tile(m, true))) : null,
    h('p', { class: 'small', style: 'margin-top:16px' }, 'Source ', h('code', {}, round.source)),
  ];
  root.replaceChildren(...parts.filter((p): p is Node => p !== null));
}
