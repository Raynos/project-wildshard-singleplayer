/**
 * ErrorModal — what the player sees when the game hits an error, and the wiring that reports every error (E133).
 *
 *   installErrorModal();              // once, before anything else runs (main.ts)
 *   showError('what', 'detail…');     // explicit: a fatal error (main().catch — the boot failed)
 *
 * Every error is reported to the server (src/core/errorReport.ts → api/errors.ts → `pnpm inbox:pull`). What the player
 * sees depends on how bad it is:
 *
 *   - **non-fatal** — a frame-loop system switched off (src/core/faults.ts), or an uncaught error / rejection once the
 *     world is running: no modal, no interruption. A small quiet chip in the sky under the top HUD ("A glitch was reported ✓"), once a
 *     session, that fades by itself or goes on a tap. The game keeps running.
 *   - **fatal** — the boot failed, or a core system (the render, the physics step, the player's step) keeps throwing and
 *     the loop stopped: the modal, in the game's glass. RELOAD HERE (back where the player stood: `?at=` + `?glreload`,
 *     the GPU-recovery reload, src/core/GpuRecovery.ts), TITLE SCREEN, and KEEP PLAYING when the loop is still alive;
 *     a collapsed DETAILS with the message and stack for testers; "Report sent ✓" once the server has it.
 *
 * It can never loop: nothing reloads by itself; a second fatal error just ticks the counter; and after RELOADS_MAX
 * reloads from here inside RELOAD_WINDOW_MS (a crash right after RELOAD HERE, maybe tied to the spot) RELOAD HERE
 * becomes a plain reload at the spawn. Self-contained styles (the stylesheet that failed may be the problem); every
 * entry point is wrapped so the modal itself never throws.
 */
import { DescribedError, describeError, emitFault, loopState, onFault, type Fault } from '../core/faults';
import { ErrorReporter, safeUrl, sendReport as send, type ReportOutcome } from '../core/errorReport';
import { RELOAD_PARAM } from '../core/GpuRecovery';
import { installLifeTrace } from '../core/lifeTrace';
import { currentPose, reloadWithPicks } from './ReloadPrompt';
import { getActiveChunk } from '../chunks/registry';
import { TIER } from '../core/tier';
// reloads from this modal (and the boot's stuck-loader recovery, src/boot/stuck.ts) inside RELOAD_WINDOW_MS before
// RELOAD HERE stops returning to the spot: one shared budget
import { RELOADS_MAX, countReload, recentReloads } from '../core/reloadGuard';

declare const __BUILD_ID__: string; // vite.config.ts define

const CHIP_MS = 7000;

let root: HTMLElement | null = null;
let count = 0;
let firstText = '';
let chipShown = false;
let reporter: ErrorReporter | null = null;
// lib.dom says these always exist; they don't (clipboard needs a secure context, older Safari has no hardwareConcurrency)
const nav: { clipboard?: Clipboard | undefined; hardwareConcurrency?: number | undefined } = navigator;

function buildId(): string { try { return __BUILD_ID__; } catch { return ''; } }
function q(el: ParentNode, sel: string): HTMLElement { const e = el.querySelector<HTMLElement>(sel); if (!e) throw new Error(`ErrorModal: no ${sel}`); return e; }
function session(): Storage | null { try { return sessionStorage; } catch { return null; } }
function local(): Storage | null { try { return localStorage; } catch { return null; } }

const STYLE = `
  #wserr { position: fixed; inset: 0; z-index: 2147482500; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); background: rgba(4, 9, 14, 0.62); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: #e6f2f8; font: 12px/1.5 "JetBrains Mono", ui-monospace, Menlo, monospace; }
  #wserr .box { position: relative; box-sizing: border-box; width: min(440px, 100%); max-height: 100%; overflow: auto; padding: 22px 18px 16px; background: rgba(13, 27, 38, 0.82); border: 1px solid rgba(143, 227, 255, 0.35); box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
  #wserr .br { position: absolute; width: 12px; height: 12px; border: 0 solid #8fe3ff; pointer-events: none; }
  #wserr .br.tl { top: -1px; left: -1px; border-top-width: 2px; border-left-width: 2px; }
  #wserr .br.tr { top: -1px; right: -1px; border-top-width: 2px; border-right-width: 2px; }
  #wserr .br.bl { bottom: -1px; left: -1px; border-bottom-width: 2px; border-left-width: 2px; }
  #wserr .br.bra { bottom: -1px; right: -1px; border-bottom-width: 2px; border-right-width: 2px; }
  #wserr .tag { margin: 0 0 10px; font-size: 10px; letter-spacing: 0.32em; text-transform: uppercase; color: #8fe3ff; }
  #wserr .tag::before { content: ''; display: inline-block; width: 6px; height: 6px; margin: 0 10px 1px 0; background: #ffb86b; box-shadow: 0 0 8px #ffb86b; vertical-align: middle; }
  #wserr h1 { margin: 0 0 8px; font: 700 22px/1.15 Rajdhani, "JetBrains Mono", sans-serif; letter-spacing: 0.1em; text-transform: uppercase; color: #fff; }
  #wserr .line { margin: 0 0 16px; font-size: 12.5px; line-height: 1.55; color: rgba(230, 242, 248, 0.82); }
  #wserr .rule { height: 1px; margin: 0 0 14px; background: rgba(143, 227, 255, 0.18); }
  #wserr .col { display: flex; flex-direction: column; gap: 8px; }
  #wserr button { appearance: none; -webkit-appearance: none; box-sizing: border-box; width: 100%; padding: 13px 16px; cursor: pointer; font: 700 12px/1 "JetBrains Mono", monospace; letter-spacing: 0.24em; text-transform: uppercase; border: 1px solid rgba(143, 227, 255, 0.35); background: rgba(143, 227, 255, 0.06); color: #8fe3ff; }
  #wserr button.go { border-color: #8fe3ff; background: rgba(143, 227, 255, 0.18); color: #fff; box-shadow: 0 0 18px rgba(143, 227, 255, 0.18); }
  #wserr button:active { background: rgba(143, 227, 255, 0.26); }
  #wserr button[hidden] { display: none; }
  #wserr .sent { margin: 12px 0 0; font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(230, 242, 248, 0.55); }
  #wserr .sent.ok { color: #7ef0b0; }
  #wserr details { margin-top: 12px; border-top: 1px solid rgba(143, 227, 255, 0.14); padding-top: 10px; }
  #wserr summary { cursor: pointer; font-size: 10px; letter-spacing: 0.26em; text-transform: uppercase; color: rgba(143, 227, 255, 0.7); list-style: none; }
  #wserr summary::-webkit-details-marker { display: none; }
  #wserr summary::before { content: '+ '; }
  #wserr details[open] summary::before { content: '− '; }
  #wserr .msg { margin: 10px 0 6px; color: #fff; font-weight: 700; white-space: pre-wrap; word-break: break-word; -webkit-user-select: text; user-select: text; }
  #wserr pre { margin: 0 0 8px; padding: 8px; max-height: 32vh; overflow: auto; background: rgba(4, 9, 14, 0.7); border: 1px solid rgba(143, 227, 255, 0.14); color: #b9c4d3; white-space: pre-wrap; word-break: break-word; font-size: 10.5px; -webkit-user-select: text; user-select: text; }
  #wserr .meta { margin-bottom: 8px; color: rgba(230, 242, 248, 0.45); font-size: 10px; white-space: pre-wrap; word-break: break-word; -webkit-user-select: text; user-select: text; }
  #wserr .n { color: #ffb86b; font-size: 10px; letter-spacing: 0.12em; }
  #wserr button.copy { width: auto; padding: 9px 12px; font-size: 10px; }
  #wserr-chip { position: fixed; left: 50%; top: calc(22vh + env(safe-area-inset-top, 0px)); z-index: 2147482400; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 6px 11px; background: rgba(13, 27, 38, 0.72); border: 1px solid rgba(143, 227, 255, 0.35); color: rgba(230, 242, 248, 0.85); font: 10px/1.2 "JetBrains Mono", ui-monospace, monospace; letter-spacing: 0.2em; text-transform: uppercase; white-space: nowrap; cursor: pointer; transition: opacity 0.4s ease; -webkit-user-select: none; user-select: none; }
  #wserr-chip::before { content: ''; width: 5px; height: 5px; background: #ffb86b; box-shadow: 0 0 6px #ffb86b; }
  #wserr-chip.out { opacity: 0; pointer-events: none; }
  #wserr-chip b { color: #7ef0b0; font-weight: 400; }
`;

function ensureStyle(): void {
  if (document.getElementById('wserr-style')) return;
  const s = document.createElement('style');
  s.id = 'wserr-style';
  s.textContent = STYLE;
  const doc: { head: HTMLElement | null } = document;
  (doc.head ?? document.documentElement).append(s);
}

function mount(el: HTMLElement): void {
  const doc: { body: HTMLElement | null } = document; // null when we run from <head>
  (doc.body ?? document.documentElement).append(el);
}

function meta(): string {
  return [`build ${buildId() || 'unknown'} · ${new Date().toISOString()} · loop ${loopState()}`, safeUrl(location.href), navigator.userAgent, `${innerWidth}×${innerHeight} · dpr ${devicePixelRatio} · cores ${nav.hardwareConcurrency ?? '?'}`].join('\n');
}

// ── reloads ──
/** the address without the params that must not follow a reload: a forced crash, the cache-buster */
function cleanHref(): URL { const u = new URL(location.href); u.searchParams.delete('crash'); u.searchParams.delete('v'); return u; }

/** RELOAD HERE: back where the player stood, paused (the GPU-recovery reload's path); at the spawn after a crash loop */
function reloadHere(atSpot: boolean): void {
  countReload();
  const url = cleanHref();
  const pose = atSpot ? currentPose() : null;
  url.searchParams.delete('at'); url.searchParams.delete(RELOAD_PARAM);
  if (pose) {
    url.searchParams.set('at', [pose.x, pose.y, pose.z, pose.yaw, pose.pitch].map((v) => (Math.round(v * 100) / 100).toString()).join(','));
    url.searchParams.set(RELOAD_PARAM, '1'); // index.html's RESUMING screen from the first paint; main.ts skips the title and pauses
  }
  location.replace(url.toString());
}
function toTitle(): void {
  countReload();
  try { history.replaceState(history.state, '', cleanHref()); } catch { /* the crash flag may follow: it only works for reviewers */ }
  reloadWithPicks();
}

function build(): HTMLElement {
  ensureStyle();
  const el = document.createElement('div');
  el.id = 'wserr';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="box">
      <i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br bra"></i>
      <p class="tag">Error</p>
      <h1>Something broke</h1>
      <p class="line"></p>
      <div class="rule"></div>
      <div class="col">
        <button class="here go" type="button">Reload here</button>
        <button class="keep" type="button" hidden>Keep playing</button>
        <button class="title" type="button">Title screen</button>
      </div>
      <p class="sent">Sending report…</p>
      <details>
        <summary>Details</summary>
        <p class="msg"></p>
        <pre class="stack"></pre>
        <div class="meta"></div>
        <button class="copy" type="button">Copy</button> <span class="n"></span>
      </details>
    </div>`;
  const here = el.querySelector<HTMLButtonElement>('.here');
  if (!here) throw new Error('ErrorModal: no .here');
  const looped = recentReloads().length >= RELOADS_MAX;
  const pose = currentPose();
  if (looped) here.textContent = 'Reload at spawn';
  else if (!pose) here.textContent = 'Reload';
  here.onclick = () => { here.disabled = true; here.textContent = 'Reloading…'; reloadHere(!looped); };
  q(el, '.title').onclick = () => { toTitle(); };
  q(el, '.keep').onclick = () => { el.remove(); root = null; };
  const copyBtn = q(el, '.copy');
  const copy = async (): Promise<void> => {
    const clip = nav.clipboard; if (!clip) return;
    const text = `${q(el, '.msg').textContent}\n\n${q(el, '.stack').textContent}\n\n${q(el, '.meta').textContent}`;
    try { await clip.writeText(text); copyBtn.textContent = 'Copied'; } catch { copyBtn.textContent = 'Copy failed'; }
  };
  copyBtn.onclick = () => { void copy(); };
  return el;
}

function setSent(o: ReportOutcome): void {
  if (!root) return;
  const s = root.querySelector<HTMLElement>('.sent');
  if (!s) return;
  s.textContent = o === 'sent' || o === 'dup' ? 'Report sent ✓' : o === 'queued' ? 'Report saved · sends when you are online' : 'Report not sent';
  s.classList.toggle('ok', o === 'sent' || o === 'dup');
}

/** The fatal modal (first error wins the headline; later ones tick the counter). */
function showFatal(message: string, stack: string, sent: Promise<ReportOutcome> | null): void {
  try {
    count++;
    if (!root) {
      root = build();
      mount(root);
      firstText = message;
      const alive = loopState() === 'running';
      const looped = recentReloads().length >= RELOADS_MAX;
      q(root, '.line').textContent = looped
        ? 'It broke again right after a reload. Your progress is saved: try the spawn, or the title screen.'
        : alive
          ? 'The game hit an error. You can keep playing, or reload to be safe. Your progress is saved.'
          : loopState() === 'boot' ? 'The game failed to start. A reload usually fixes it.' : 'The game hit an error it can’t recover from. Your progress is saved.';
      q(root, '.keep').hidden = !alive;
      q(root, '.msg').textContent = message;
      q(root, '.stack').textContent = stack || '(no stack)';
      q(root, '.meta').textContent = meta();
      if (document.pointerLockElement) document.exitPointerLock();
      document.dispatchEvent(new Event('ws:background')); // the world pauses under it (a no-op on the title / the boot)
      if (sent) void sent.then(setSent); else setSent('dropped');
    }
    q(root, '.n').textContent = count > 1 ? `+${count - 1} more (first: ${firstText.slice(0, 40)}…)` : '';
  } catch { /* the modal must never throw */ }
}

/** the quiet chip for a non-fatal error: once a session, fades by itself, a tap dismisses it */
function showChip(sent: Promise<ReportOutcome>): void {
  if (chipShown || root) return;
  chipShown = true;
  try {
    ensureStyle();
    const chip = document.createElement('div');
    chip.id = 'wserr-chip';
    chip.setAttribute('role', 'status');
    chip.textContent = 'A glitch was reported';
    const out = (): void => { chip.classList.add('out'); window.setTimeout(() => { chip.remove(); }, 500); };
    chip.addEventListener('click', out);
    mount(chip);
    window.setTimeout(out, CHIP_MS);
    void (async () => { const o = await sent; if (o === 'sent' || o === 'dup') { const b = document.createElement('b'); b.textContent = ' ✓'; chip.append(b); } })();
  } catch { /* never throw from here */ }
}

function report(system: string, error: unknown, flags: { fatal?: boolean; disabled?: boolean }): Promise<ReportOutcome> {
  try { return reporter?.report(system, error, flags) ?? Promise.resolve('dropped'); } catch { return Promise.resolve('dropped'); }
}

/** a fault from the frame loop or the window: report it; fatal → the modal, non-fatal (once running) → the chip */
function handle(f: Fault): void {
  const fatal = f.verdict === 'fatal' || (f.verdict === 'uncaught' && loopState() === 'boot');
  const sent = report(f.system, f.error, { fatal, disabled: f.verdict === 'off' });
  if (fatal) { const d = describeError(f.error); showFatal(d.message, d.stack, sent); return; }
  if (f.verdict === 'off' || (f.verdict === 'uncaught' && loopState() === 'running')) showChip(sent);
}

/** Show the fatal modal explicitly (main().catch: the boot failed) and report it. */
export function showError(message: string, stack = ''): void {
  try {
    showFatal(message, stack, report('boot', new DescribedError(message, stack), { fatal: true }));
  } catch { /* the modal must never throw */ }
}

function context(): Record<string, string | number | boolean | number[] | null> {
  const pose = currentPose();
  let shard = ''; try { shard = getActiveChunk().slug; } catch { /* before the registry */ }
  const touch = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || new URLSearchParams(location.search).has('touch');
  return {
    build: buildId(), shard, tier: TIER, touch, url: safeUrl(location.href),
    pos: pose ? [pose.x, pose.y, pose.z] : null, yaw: pose?.yaw ?? null, pitch: pose?.pitch ?? null,
    viewport: `${innerWidth}x${innerHeight}`, loop: loopState(),
  };
}

/** Hook `error` + `unhandledrejection` and the frame loop's faults; start the reporter. Idempotent. */
export function installErrorModal(): void {
  const w = window as unknown as { __wsErrorModal?: boolean };
  if (w.__wsErrorModal) return;
  w.__wsErrorModal = true;
  reporter = new ErrorReporter({ send, context, session: session(), local: local(), now: () => performance.now() });
  onFault(handle);
  // the app-switch trace (E135): a long return / a boot after one reports as system `lifecycle` — no chip, no modal
  installLifeTrace((message, trace) => { void report('lifecycle', new DescribedError(message, trace), {}); });
  window.addEventListener('error', (e) => {
    const err: unknown = e.error;
    // An opaque cross-origin error ("Script error.", no file, no error object) is never ours: every game script is
    // same-origin. On iOS it comes from a Safari extension / content blocker injected into the page — log it, keep playing.
    if ((err === undefined || err === null) && e.filename === '' && /^script error\.?$/iu.test(e.message.trim())) {
      console.warn('[error-modal] ignored an opaque cross-origin "Script error." (a browser extension, not the game)');
      return;
    }
    const error = err ?? Object.assign(new Error(e.message), { stack: `${e.filename.split('/').pop() ?? ''}:${e.lineno}:${e.colno}` });
    emitFault({ system: 'window', error, verdict: 'uncaught' });
  });
  window.addEventListener('unhandledrejection', (e) => { emitFault({ system: 'promise', error: e.reason, verdict: 'uncaught' }); });
  // what an offline page queued goes once the network is back (and a little after boot, off the critical path)
  window.addEventListener('online', () => { void reporter?.flushQueue(); });
  window.setTimeout(() => { void reporter?.flushQueue(); }, 8000);
}
