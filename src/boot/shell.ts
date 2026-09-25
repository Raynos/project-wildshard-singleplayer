/**
 * The loading screen's markup, painted from the first HTML bytes (project/archive/2026-09-22-load-perf.md §1b, the
 * gauntlet's `inline.ts` idea): index.html carries this exact markup inside `<div class="ws-load"
 * data-shell>`, so the title panel is on screen as soon as the page's CSS is — before the 1.7 MB bundle
 * has downloaded, compiled and run. `Loading` (src/ui/Loading.ts) adopts that element and fills in the
 * two facts only the bundle knows (`slug`, `tier`); a page without the shell (dev harnesses) builds it
 * from this same string. test/shell.test.ts keeps index.html and this string identical.
 */
export const LOAD_SHELL_HTML = `<div class="ws-load-head">
<div class="ws-wordmark">Project <b>Wildshard</b></div>
<div class="ws-load-tagline">A world that does not exist yet, arriving one chunk at a time.</div>
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
</div>
<div class="ws-load-track">
<div class="ws-load-track-row"><span class="ws-load-track-name">setup</span><span class="ws-load-track-fact" data-el="suFact">—</span><span class="ws-load-track-pct" data-el="suPct">0</span></div>
<div class="ws-load-bar"><div class="ws-load-fill" data-el="suBar"></div></div>
</div>
<div class="ws-load-log" data-el="rows"></div>
</div>
</div>
<div class="ws-load-foot"><span>local build · unuploaded</span><span data-el="foot">an in-progress private project</span></div>`;
