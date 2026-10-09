// Wildshard Admin (SHARD-PLATFORM SF68, G248–G251): a static site rebuilt from committed reports on every deploy. No
// game in it, no live connection: it fetches data/bundle.json and renders four tools, routed by the hash.
import './style.css';
import { BUNDLE_SCHEMA, type Bundle, type LoadingData } from './bundle.ts';
import { h } from './dom.ts';
import { memoryView } from './memory.ts';
import { planView } from './plan.ts';
import { playtestsView } from './playtests.ts';
import { installUpdates } from './update.ts';

const TABS = ['memory', 'loading', 'playtests', 'plan'] as const;
type Tab = (typeof TABS)[number];

function isTab(v: string): v is Tab {
  return (TABS as readonly string[]).includes(v);
}

function loadingView(root: HTMLElement, data: LoadingData): void {
  if (data.runs.length === 0) {
    root.replaceChildren(
      h('h1', {}, 'Loading explorer'),
      h('section', { class: 'card empty' },
        h('div', { class: 'glyph', 'aria-hidden': 'true' }, '⏱'),
        h('p', {}, h('b', {}, 'No loading benchmark yet.')),
        h('p', {}, data.note),
        h('p', {}, 'When SF67 commits its benchmark, this shows time-to-playable per shard and phase, cold vs warm, and the long tasks with their owners, after the next deploy.')));
    return;
  }
  root.replaceChildren(h('h1', {}, 'Loading explorer'), ...data.runs.map((r) =>
    h('section', { class: 'card' }, h('h3', { style: 'margin-top:0' }, `${r.shard} · ${r.mode}`),
      h('p', { class: 'small' }, `${(r.playableMs / 1000).toFixed(1)} s to playable · ${r.build} · ${r.device}`))));
}

function render(bundle: Bundle): void {
  const view = document.getElementById('view');
  if (!view) return;
  const [head = 'memory', ...rest] = location.hash.replace(/^#/, '').split('/');
  const tab: Tab = isTab(head) ? head : 'memory';
  for (const a of document.querySelectorAll<HTMLElement>('.tabs a')) {
    if (a.dataset['tab'] === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (tab === 'memory') memoryView(view, bundle.memory, rest);
  else if (tab === 'loading') loadingView(view, bundle.loading);
  else if (tab === 'playtests') playtestsView(view, bundle.playtests, rest);
  else planView(view, bundle.plans);
}

async function main(): Promise<void> {
  const build = document.getElementById('build');
  const res = await fetch('/data/bundle.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`data/bundle.json: HTTP ${res.status}`);
  const raw: unknown = await res.json();
  const schema = typeof raw === 'object' && raw !== null && 'schema' in raw ? raw.schema : null;
  if (schema !== BUNDLE_SCHEMA) throw new Error(`data/bundle.json: schema ${JSON.stringify(schema)}, expected ${BUNDLE_SCHEMA}`);
  const bundle = raw as Bundle;
  if (build) {
    build.textContent = `${bundle.build.slice(0, 9)} · ${bundle.builtAt.slice(5, 16).replace('T', ' ')}`;
    build.title = `Built ${bundle.builtAt} from ${bundle.build}`;
  }
  let last = '';
  window.addEventListener('hashchange', () => {
    const tab = location.hash.split('/')[0] ?? '';
    render(bundle);
    if (tab !== last) window.scrollTo(0, 0);
    last = tab;
  });
  last = location.hash.split('/')[0] ?? '';
  render(bundle);
  installUpdates(bundle.build);
}

main().catch((e: unknown) => {
  const view = document.getElementById('view');
  view?.replaceChildren(h('div', { class: 'card err' }, `Could not load the reports: ${e instanceof Error ? e.message : String(e)}`));
});
