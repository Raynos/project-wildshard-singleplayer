// The drafts site (WORLDCLAW-TOOLS W16, J16, J57): a separate, read-only website with only the drafts. Hash routes are
// in-page navigation, not switches (the site has no query params at all):
//   #/                                   the title (J39)
//   #/<slug>                             STAGES (Developer on) or the public teaser (J13, J22)
//   #/<slug>/stage/<P>                   a stage page (J40)
//   #/<slug>/explore/<tab>/<sub>/<arg>   Draft Explore (J44)
//   #/<slug>/protos                      the prototypes (W7)
//   #/<slug>/maplab                      Map Lab (W6)
import './styles.css';
import { stageName, type Atlas } from './atlas';
import { atlas, developer, draftIndex, url } from './data';
import { clear, h } from './dom';
import { explorePage } from './explore';
import { protosPage, stageFromRoute, stagePage, stagesPage, teaserPage, titlePage } from './pages';

const app = document.getElementById('app') ?? document.body;

/** The draft splash (J41): the key art full screen, "DRAFT · <name> · <stage>", a bar that fills as the first pictures load. */
function splash(a: Atlas): { done: () => void } {
  const fill = h('div', { class: 'wd-splash-fill' });
  const count = h('span', { class: 'wd-label' });
  const el = h('div', { class: 'wd-splash' },
    h('div', { class: 'wd-splash-inner' },
      h('div', { class: 'wd-label' }, `Draft · ${a.name} · ${a.run.stage} ${stageName(a.run.stage)}`),
      h('div', { class: 'wd-h1', style: 'color:#e8f1f5;margin-top:6px' }, a.name),
      h('div', { class: 'wd-splash-bar' }, fill),
      h('div', { style: 'margin-top:6px' }, count)));
  if (a.keyArt) el.style.backgroundImage = `url("${url(a, a.keyArt, 'full')}")`;
  document.body.append(el);
  let finished = false;
  const done = (): void => {
    if (finished) return;
    finished = true;
    el.classList.add('wd-out');
    setTimeout(() => el.remove(), 400);
  };
  // Track the pictures the first screen asked for.
  requestAnimationFrame(() => {
    const imgs = [...app.querySelectorAll('img')].filter((i) => i.loading !== 'lazy').slice(0, 12);
    let loaded = 0;
    const tick = (): void => {
      loaded++;
      fill.style.width = `${(100 * loaded) / Math.max(1, imgs.length)}%`;
      count.textContent = `${loaded} / ${imgs.length} images · ${a.items.length} in the draft`;
      if (loaded >= imgs.length) done();
    };
    count.textContent = `0 / ${imgs.length} images · ${a.items.length} in the draft`;
    if (imgs.length === 0) done();
    for (const img of imgs) {
      if (img.complete) tick();
      else { img.addEventListener('load', tick, { once: true }); img.addEventListener('error', tick, { once: true }); }
    }
  });
  return { done };
}

let shownSplash = '';

async function render(): Promise<void> {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent).filter(Boolean);
  const [slug, view, a1, a2, a3] = parts;
  try {
    if (!slug) {
      const index = await draftIndex();
      clear(app);
      app.append(titlePage(index, () => void render()));
      return;
    }
    const index = await draftIndex();
    const card = index.drafts.find((d) => d.slug === slug);
    if (!card) throw new Error(`No draft called ${slug}.`);
    if (!developer()) {
      clear(app);
      app.append(teaserPage(card, index.blob));
      return;
    }
    const a = await atlas(slug);
    clear(app);
    let page: HTMLElement;
    if (view === 'stage') {
      const id = stageFromRoute(a1);
      page = id ? stagePage(a, id) : stagesPage(a);
    } else if (view === 'explore') page = explorePage(a, a1, a2, a3);
    else if (view === 'protos') page = protosPage(a);
    else if (view === 'maplab') page = await (await import('./maplab')).mapLabPage(a);
    else page = stagesPage(a);
    app.append(page);
    if (shownSplash !== slug) {
      shownSplash = slug;
      splash(a);
    }
  } catch (e) {
    if (e instanceof TypeError && /dynamically imported module|Importing a module script failed/.test(e.message) && sessionStorage.getItem('wd-reloaded') !== location.hash) {
      // A new deploy replaced the chunk this page knew: load the new build once.
      sessionStorage.setItem('wd-reloaded', location.hash);
      location.reload();
      return;
    }
    clear(app);
    app.append(h('div', { class: 'wd-page' },
      h('a', { class: 'wd-back', href: '#/' }, 'Drafts'),
      h('p', { class: 'wd-error' }, e instanceof Error ? e.message : String(e))));
  }
}

let lastPath = '';
window.addEventListener('hashchange', () => {
  const path = location.hash;
  if (path === lastPath) return;
  lastPath = path;
  void render().then(() => window.scrollTo(0, 0));
});
lastPath = location.hash;
void render();
