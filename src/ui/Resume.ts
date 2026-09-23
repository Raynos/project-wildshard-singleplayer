/**
 * The app-switch resume screen (E61): what the player sees between coming back to the app and the first good frame.
 * NOT the first-boot loader — no wordmark, no chunk / tier / download breakdown: a blurred still of the last frame, a
 * small mark, "RESUMING" and a hairline. Styled by src/ui/styles/resume.css (prefix ws-resume-).
 *
 * The markup is in index.html (RESUME_HTML, kept identical by test/resume.test.ts) with an inline script, so on a
 * GPU-recovery reload (`?glreload`, src/core/GpuRecovery.ts) it is up from the first paint — before any bundle runs —
 * and the first-boot loader never shows. In play, GpuRecovery puts it up while the page is HIDDEN (visibilitychange /
 * pagehide), so the first frame after the switch back is already this screen, never a black or broken canvas.
 *
 *   resumeScreen().show(shot)       // busy: a short segment sweeps the hairline
 *   resumeScreen().progress(0.4)    // a fraction: the boot plan's setup, or the in-place shader rebuild
 *   resumeScreen().hide()           // fades out (fast)
 */

export const RESUME_HTML = '<div class="ws-resume-shot"></div><div class="ws-resume-card"><div class="ws-resume-mark"><i></i></div><div class="ws-resume-line">Resuming</div><div class="ws-resume-bar"><i></i></div><button type="button" class="ws-resume-btn">Reload</button></div>';

/** sessionStorage key of the last still (a small JPEG data URL) — survives the recovery reload */
export const SHOT_KEY = 'wsResumeShot';

class ResumeScreen {
  private readonly root: HTMLElement;
  private readonly shot: HTMLElement | null;
  private readonly line: HTMLElement | null;
  private readonly bar: HTMLElement | null;
  private readonly btn: HTMLButtonElement | null;
  private onButton: (() => void) | null = null;
  private outTimer = 0;

  constructor() {
    let root = document.querySelector<HTMLElement>('.ws-resume');
    if (!root) { // a page without the index.html markup (a dev entry): build the same thing
      root = document.createElement('div');
      root.className = 'ws-resume';
      root.innerHTML = RESUME_HTML;
      document.body.append(root);
    }
    this.root = root;
    this.shot = root.querySelector('.ws-resume-shot');
    this.line = root.querySelector('.ws-resume-line');
    this.bar = root.querySelector('.ws-resume-bar');
    this.btn = root.querySelector('.ws-resume-btn');
    this.btn?.addEventListener('click', () => { this.onButton?.(); });
    // nothing behind it takes a touch or a key while it is up
    for (const type of ['pointerdown', 'touchstart', 'keydown', 'wheel']) root.addEventListener(type, (e) => { if (e.target !== this.btn) e.stopPropagation(); });
  }

  get visible(): boolean { return this.root.classList.contains('show') && !this.root.classList.contains('out'); }

  /** Up at once (no fade in). `shot`: a data URL of the last frame, or null for the dark glass alone. */
  show(shot: string | null, line = 'Resuming'): void {
    clearTimeout(this.outTimer);
    if (shot !== null && this.shot) this.shot.style.backgroundImage = `url("${shot}")`;
    if (this.line) this.line.textContent = line;
    this.bar?.classList.add('busy');
    this.btn?.classList.remove('on');
    this.onButton = null;
    this.root.classList.remove('out');
    this.root.classList.add('show');
  }

  progress(f: number): void {
    if (!this.root.classList.contains('show')) return;
    this.bar?.classList.remove('busy');
    const fill = this.bar?.firstElementChild;
    if (fill instanceof HTMLElement) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, f)).toFixed(3)})`;
  }

  /** the dead end: automatic reloads ran out — one button, the save is safe */
  stuck(line: string, onButton: () => void): void {
    this.show(null, line);
    this.bar?.classList.remove('busy');
    this.onButton = onButton;
    this.btn?.classList.add('on');
  }

  hide(): void {
    if (!this.root.classList.contains('show')) return;
    this.root.classList.add('out');
    clearTimeout(this.outTimer);
    this.outTimer = window.setTimeout(() => { this.root.classList.remove('show', 'out'); }, 180);
  }
}

let screen: ResumeScreen | null = null;
export function resumeScreen(): ResumeScreen { screen ??= new ResumeScreen(); return screen; }

/** the boot plan's setup fraction onto the hairline — only while the screen is up (a recovery reload) */
export function resumeProgress(f: number): void {
  if (document.querySelector('.ws-resume.show')) resumeScreen().progress(f);
}
