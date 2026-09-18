/**
 * ErrorModal — the uncaught-exception screen. Any `error` / `unhandledrejection` on the window
 * (boot or play), or an explicit `showError(...)`, drops a full-screen glass modal over everything
 * with the message, the stack, the build id, the URL and the user agent, plus RELOAD / COPY buttons —
 * so a phone playtest that dies shows *why* instead of a loading bar that never moves.
 *
 *   installErrorModal();              // once, before anything else runs (main.ts)
 *   showError('what', 'detail…');     // explicit
 *
 * Self-contained (its own styles) so it works even when the stylesheet that failed was the problem.
 * Only the first error is shown; later ones append a counter. Errors inside the modal itself are ignored.
 */

declare const __BUILD_ID__: string; // vite.config.ts define

let root: HTMLElement | null = null;
let count = 0;
let firstText = '';

function build(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'ws-error';
  el.setAttribute('role', 'alertdialog');
  el.innerHTML = `
    <style>
      #ws-error { position: fixed; inset: 0; z-index: 100000; background: rgba(6, 9, 14, 0.94); color: #e8eef6; font: 13px/1.45 "JetBrains Mono", ui-monospace, Menlo, monospace; display: flex; align-items: center; justify-content: center; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); -webkit-user-select: text; user-select: text; }
      #ws-error .box { width: min(720px, 100%); max-height: 100%; overflow: auto; border: 1px solid #ff6b6b; box-shadow: 0 0 0 1px rgba(255, 107, 107, 0.25), 0 24px 80px rgba(0, 0, 0, 0.6); background: rgba(14, 18, 26, 0.96); padding: 18px 18px 14px; }
      #ws-error h1 { margin: 0 0 4px; font: 700 20px/1.1 Rajdhani, "JetBrains Mono", sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #ff6b6b; }
      #ws-error .sub { color: #8b96a6; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 12px; }
      #ws-error .msg { color: #fff; font-weight: 700; white-space: pre-wrap; word-break: break-word; margin: 0 0 10px; font-size: 14px; }
      #ws-error pre { margin: 0 0 12px; padding: 10px; background: #0a0d13; border: 1px solid #263140; color: #b9c4d3; white-space: pre-wrap; word-break: break-word; font-size: 11px; max-height: 40vh; overflow: auto; }
      #ws-error .meta { color: #6c7684; font-size: 10.5px; white-space: pre-wrap; word-break: break-word; margin-bottom: 12px; }
      #ws-error .row { display: flex; gap: 10px; flex-wrap: wrap; }
      #ws-error button { appearance: none; border: 1px solid #8fe3ff; background: rgba(143, 227, 255, 0.08); color: #8fe3ff; padding: 10px 16px; font: 700 12px/1 "JetBrains Mono", monospace; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; min-width: 120px; }
      #ws-error button.warn { border-color: #ff6b6b; color: #ff6b6b; background: rgba(255, 107, 107, 0.08); }
      #ws-error button:active { transform: translateY(1px); }
      #ws-error .n { color: #ffb86b; font-size: 11px; margin-left: auto; align-self: center; }
    </style>
    <div class="box">
      <h1>Uncaught exception</h1>
      <div class="sub">the game stopped · this is a bug, not your phone</div>
      <p class="msg"></p>
      <pre class="stack"></pre>
      <div class="meta"></div>
      <div class="row">
        <button class="reload warn" type="button">Reload</button>
        <button class="copy" type="button">Copy report</button>
        <button class="close" type="button">Dismiss</button>
        <span class="n"></span>
      </div>
    </div>`;
  el.querySelector<HTMLButtonElement>('.reload')!.onclick = () => location.reload();
  el.querySelector<HTMLButtonElement>('.close')!.onclick = () => { el.remove(); root = null; };
  el.querySelector<HTMLButtonElement>('.copy')!.onclick = () => {
    const text = `${el.querySelector('.msg')!.textContent}\n\n${el.querySelector('.stack')!.textContent}\n\n${el.querySelector('.meta')!.textContent}`;
    void navigator.clipboard?.writeText(text).then(() => { el.querySelector('.copy')!.textContent = 'Copied'; }, () => { el.querySelector('.copy')!.textContent = 'Copy failed'; });
  };
  return el;
}

function meta(): string {
  let build = ''; try { build = __BUILD_ID__; } catch { /* dev without the define */ }
  return [`build ${build || 'unknown'} · ${new Date().toISOString()}`, location.href, navigator.userAgent, `${innerWidth}×${innerHeight} · dpr ${devicePixelRatio} · cores ${navigator.hardwareConcurrency ?? '?'}`].join('\n');
}

/** Show the modal (first error wins the headline; later ones tick the counter). */
export function showError(message: string, stack = ''): void {
  try {
    count++;
    if (!root) {
      root = build();
      (document.body ?? document.documentElement).appendChild(root);
      firstText = message;
      root.querySelector('.msg')!.textContent = message;
      root.querySelector('.stack')!.textContent = stack || '(no stack)';
      root.querySelector('.meta')!.textContent = meta();
    }
    root.querySelector('.n')!.textContent = count > 1 ? `+${count - 1} more (first: ${firstText.slice(0, 40)}…)` : '';
  } catch { /* the modal must never throw */ }
}

function describe(reason: unknown): { message: string; stack: string } {
  if (reason instanceof Error) return { message: `${reason.name}: ${reason.message}`, stack: reason.stack ?? '' };
  if (typeof reason === 'object' && reason !== null) { try { return { message: JSON.stringify(reason).slice(0, 400), stack: '' }; } catch { /* fallthrough */ } }
  return { message: String(reason), stack: '' };
}

/** Hook `error` + `unhandledrejection` on the window. Idempotent. */
export function installErrorModal(): void {
  const w = window as unknown as { __wsErrorModal?: boolean };
  if (w.__wsErrorModal) return;
  w.__wsErrorModal = true;
  window.addEventListener('error', (e) => {
    const d = e.error ? describe(e.error) : { message: e.message, stack: '' };
    showError(d.message, d.stack || `${e.filename?.split('/').pop() ?? ''}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener('unhandledrejection', (e) => { const d = describe(e.reason); showError(d.message, d.stack); });
}
