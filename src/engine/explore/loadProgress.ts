import { engineString } from '../strings';

interface Attempt { readonly total: number; done: number; failed: boolean }

/** Progress counts completed preparations, never elapsed time or estimated bytes.
 * A replacement or closed view cannot be painted by an older pending decoder. */
export class ExploreLoadProgress {
  readonly element = document.createElement('div');
  private readonly label = document.createElement('span');
  private readonly bar = document.createElement('progress');
  private active: Attempt | undefined;

  constructor(host: HTMLElement) {
    this.element.className = 'ws-x-load'; this.element.hidden = true;
    this.element.setAttribute('role', 'status'); this.element.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('i'); spinner.setAttribute('aria-hidden', 'true');
    this.element.append(spinner, this.label, this.bar); host.append(this.element);
  }

  async watch(label: string, tasks: readonly Promise<unknown>[]): Promise<void> {
    this.clear();
    if (tasks.length === 0) return;
    const attempt: Attempt = { total: tasks.length, done: 0, failed: false };
    this.active = attempt; this.element.hidden = false;
    this.element.classList.remove('failed'); this.element.setAttribute('aria-busy', 'true');
    this.bar.max = attempt.total; this.bar.value = 0;
    const text = (): string => engineString('s_explore_load_count', [label, attempt.done, attempt.total]);
    const paint = (): void => { this.label.textContent = text(); this.bar.value = attempt.done; };
    paint();
    try {
      await Promise.all(tasks.map(async task => {
        await task;
        if (this.active !== attempt || attempt.failed) return;
        attempt.done++; paint();
      }));
      if (this.active === attempt) this.clear();
    } catch (error) {
      if (this.active === attempt) {
        attempt.failed = true; this.element.classList.add('failed');
        this.element.setAttribute('aria-busy', 'false');
        this.label.textContent = engineString('s_explore_load_failed', [text()]);
      }
      throw error;
    }
  }

  clear(): void { this.active = undefined; this.element.hidden = true; this.element.setAttribute('aria-busy', 'false'); }
  dispose(): void { this.clear(); this.element.remove(); }
}
