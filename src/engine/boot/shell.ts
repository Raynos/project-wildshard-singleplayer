/**
 * The loading screen's markup, painted from the first HTML bytes (project/archive/2026-09-22-load-perf.md §1b, the
 * gauntlet's `inline.ts` idea): index.html carries this exact markup inside `<div class="ws-load"
 * data-shell>`, so the title panel is on screen as soon as the page's CSS is — before the 1.7 MB bundle
 * has downloaded, compiled and run. `Loading` (src/engine/ui/Loading.ts) adopts that element and fills in the
 * two facts only the bundle knows (`slug`, `tier`); a page without the shell (dev harnesses) builds it
 * from this same markup. test/shell.test.ts keeps index.html and this markup identical; the wordmark and tagline are the
 * app's (src/engine/app/identity.ts).
 */
import type { Scope } from '../app/scope';
import { HudSlots } from '../ui/hudSlots';
import { appIdentity } from '../app/identity';

const shellHtml = (tagline: string): string => `<div class="ws-load-head">
<div class="ws-wordmark">${appIdentity().wordmark}</div>
<div class="ws-load-tagline">${tagline}</div>
</div>
<div class="ws-load-body">
<div class="ws-glass ws-load-panel">
<div class="ws-load-title"><span class="ws-load-kicker">Loading chunk ·</span><b data-el="slug"></b><span class="ws-load-clock" data-el="clock">00:00.0</span></div>
<div class="ws-load-simple"><div class="ws-load-bar"><div class="ws-load-fill" data-el="bar"></div></div><div class="ws-load-line" data-el="line">Loading</div></div>
<div class="ws-load-meta ws-load-meta-1">
<div><span>tier</span><span data-el="tier"></span></div>
</div>
<div class="ws-load-track">
<div class="ws-load-track-row"><span class="ws-load-track-name">download</span><span class="ws-load-track-fact" data-el="dlFact">—</span><span class="ws-load-track-pct" data-el="dlPct">0</span></div>
<div class="ws-load-bar"><div class="ws-load-fill" data-el="dlBar"></div></div>
<div class="ws-load-track-row ws-load-grid" data-el="pfRow" hidden><span class="ws-load-track-name">grid</span><span class="ws-load-track-fact" data-el="pfFact">—</span><span class="ws-load-track-pct" data-el="pfPct">0</span></div>
</div>
<div class="ws-load-track">
<div class="ws-load-track-row"><span class="ws-load-track-name">setup</span><span class="ws-load-track-fact" data-el="suFact">—</span><span class="ws-load-track-pct" data-el="suPct">0</span></div>
<div class="ws-load-bar"><div class="ws-load-fill" data-el="suBar"></div></div>
</div>
<div class="ws-load-log" data-el="rows"></div>
<div class="ws-load-diagnostics" data-el="diagnostics">Memory: checking · CPU: checking</div>
</div>
</div>
<div class="ws-load-foot"><span data-el="foot"></span></div>`;

/** Runtime shell markup: the caller fills the identity tagline through textContent. */
export const loadShellTemplate = (): string => shellHtml('');

/** Paint an owned loading panel before a fresh-page handoff. The compiled caller
 * supplies navigation; no renderer or save service is imported by this shell. */
export function beginNavigationShell(name: string, owner: Scope, navigate: () => void, card?: HTMLButtonElement | null): Scope {
  if (owner.disposed || owner.disposing) throw new Error('Navigation shell requires a live owner');
  const attempt = owner.child('navigation'), html = document.documentElement, title = html.classList.contains('title-first');
  const existing = document.querySelector<HTMLElement>('.ws-load'), root = existing ?? document.createElement('div'), slots = new HudSlots();
  if (existing === null) { root.className = 'ws-load'; root.dataset['shell'] = ''; root.innerHTML = loadShellTemplate(); slots.widget('band.1', root, 0, attempt, document.body); }
  const hidden = root.classList.contains('hide'), nameField = root.querySelector<HTMLElement>('[data-el="slug"]');
  const previousName = nameField?.textContent ?? '', disabled = card?.disabled ?? false, busy = card?.getAttribute('aria-busy') ?? null;
  if (nameField !== null) nameField.textContent = name;
  root.classList.remove('hide'); root.dataset['navigation'] = '';
  html.classList.remove('title-first');
  if (card !== undefined && card !== null) { card.disabled = true; card.setAttribute('aria-busy', 'true'); }
  attempt.onDispose(() => {
    if (existing === null) slots.discard(root);
    else { root.classList.toggle('hide', hidden); delete root.dataset['navigation']; if (nameField !== null) nameField.textContent = previousName; }
    html.classList.toggle('title-first', title);
    if (card !== undefined && card !== null) { card.disabled = disabled; if (busy === null) card.removeAttribute('aria-busy'); else card.setAttribute('aria-busy', busy); }
  });
  // RAF runs before paint. A second frame leaves a complete paint opportunity
  // before synchronous storage work or navigation can block this document.
  attempt.raf(() => { attempt.raf(() => { try { navigate(); } catch (error) { attempt.dispose(); throw error; } }); });
  return attempt;
}
