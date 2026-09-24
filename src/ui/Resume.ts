/**
 * The app-switch resume screen (E61): what the player sees between coming back to the app and the first good frame.
 * NOT the first-boot loader (no chunk / tier / download breakdown), but branded (E99, the user: "I don't want a black
 * resuming screen I want a branded resuming screen"): the PROJECT WILDSHARD wordmark, RESUMING and a hairline, in one of
 * three looks the user picks from pause ▸ Settings ▸ Debug (Settings option `resume`):
 *
 *   A  title   the shard's title-screen art full-bleed, the wordmark where the title has it, RESUMING low
 *   B  glass   the blurred still of the last frame under a navy glass card holding the wordmark
 *   C  plate   brand navy, the shard mark, the wordmark and the tagline — no picture at all
 *
 * Styled by src/ui/styles/resume.css (prefix ws-resume-). The markup is in index.html (RESUME_HTML, kept identical by
 * test/resume.test.ts) with an inline script, so on a GPU-recovery reload (`?glreload`, src/core/GpuRecovery.ts) it is
 * up from the first paint — before any bundle runs — and the first-boot loader never shows. In play, GpuRecovery puts it
 * up while the page is HIDDEN (visibilitychange / pagehide), so the first frame after the switch back is this screen.
 *
 *   resumeScreen().brand(name, hero)  // the shard's name + portrait title art (main.ts, once at boot)
 *   resumeScreen().show(shot)         // busy: a short segment sweeps the hairline
 *   resumeScreen().progress(0.4)      // a fraction: the boot plan's setup, or the in-place shader rebuild
 *   resumeScreen().hide()             // fades out (fast)
 *   resumeScreen().preview()          // up for a moment (the Debug picker shows the look it just picked)
 */
import { OPTION_VALUES, onSettingChange, setting, type OptionValue } from './Settings';

export const RESUME_HTML = '<div class="ws-resume-shot"></div><div class="ws-resume-hero"></div><div class="ws-resume-card"><div class="ws-resume-panel"><div class="ws-resume-word">Project <b>Wildshard</b></div><div class="ws-resume-mark"><i></i></div><div class="ws-resume-line">Resuming</div><div class="ws-resume-bar"><i></i></div><div class="ws-resume-shard"></div><div class="ws-resume-tag">A world that does not exist yet, arriving one chunk at a time.</div><button type="button" class="ws-resume-btn">Reload</button></div></div>';

/** sessionStorage key of the last still (a small JPEG data URL) — survives the recovery reload */
export const SHOT_KEY = 'wsResumeShot';
/** sessionStorage key of `{ name, hero }` — the shard's name and title art for index.html's first paint of a recovery reload */
export const BRAND_KEY = 'wsResumeBrand';
/** the look class on .ws-resume is this + the Settings `resume` value (index.html's inline script adds the same) */
export const LOOK_CLASS = 'look-';

class ResumeScreen {
  private readonly root: HTMLElement;
  private readonly shot: HTMLElement | null;
  private readonly line: HTMLElement | null;
  private readonly bar: HTMLElement | null;
  private readonly btn: HTMLButtonElement | null;
  private heroImg: HTMLImageElement | null = null; // keeps the title art decoded: a hidden page loads nothing
  private previewTimer = 0;
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
    const look = (v: OptionValue<'resume'>): void => {
      for (const o of OPTION_VALUES.resume) this.root.classList.toggle(LOOK_CLASS + o, o === v);
    };
    look(setting('resume'));
    onSettingChange('resume', (v) => { look(v); this.preview(); });
    this.btn?.addEventListener('click', () => { this.onButton?.(); });
    // nothing behind it takes a touch or a key while it is up
    for (const type of ['pointerdown', 'touchstart', 'keydown', 'wheel']) root.addEventListener(type, (e) => { if (e.target !== this.btn) e.stopPropagation(); });
  }

  get visible(): boolean { return this.root.classList.contains('show') && !this.root.classList.contains('out'); }

  /** the shard this page plays: its name under the hairline and its portrait title art (look A) */
  brand(name: string, hero: string): void {
    const shard = this.root.querySelector('.ws-resume-shard');
    if (shard) shard.textContent = name;
    const art = this.root.querySelector<HTMLElement>('.ws-resume-hero');
    if (art && hero !== '') {
      art.style.backgroundImage = `url("${hero}")`;
      this.heroImg = new Image();
      this.heroImg.src = hero;
      void this.heroImg.decode().catch(() => undefined);
    }
    // a blob: URL dies with the page: the recovery reload then shows the still behind the wordmark instead
    try { sessionStorage.setItem(BRAND_KEY, JSON.stringify({ name, hero: hero.startsWith('blob:') ? '' : hero })); } catch { /* no first-paint brand */ }
  }

  /** up for a moment over the game: what the look just picked in Settings looks like */
  preview(): void {
    if (this.visible) return;
    this.show(null);
    this.previewTimer = window.setTimeout(() => { this.hide(); }, 1400);
  }

  /** Up at once (no fade in). `shot`: a data URL of the last frame, or null for the dark glass alone. */
  show(shot: string | null, line = 'Resuming'): void {
    clearTimeout(this.outTimer);
    clearTimeout(this.previewTimer);
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
