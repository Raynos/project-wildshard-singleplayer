import * as v from 'valibot';
import type { Scope } from '../app/scope';
import { appIdentity } from '../app/identity';
import { saves } from '../saves/runtime';
import type { SaveSlot } from '../saves/store';
import { DownloadAccounting, observeDownloadAccounting, type DownloadSnapshot } from '../boot/download';
import { engineString } from '../strings';
import { hudSlots } from './hudSlots';
import { listenPage } from '../input/dom';
import { diagnosticNow } from '../core/clock';

const phaseSchema = v.picklist(['found', 'download', 'install', 'reload']);
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const stateSchema = v.nullable(v.object({
  started: count, source: v.string(), target: v.nullable(v.string()), phase: phaseSchema,
  packReady: v.boolean(), files: count, network: count, cached: count,
}));
type State = v.InferOutput<typeof stateSchema>;
type Phase = v.InferOutput<typeof phaseSchema>;
type Storage = Pick<SaveSlot<State>, 'read' | 'write' | 'reset'>;
let stored: Storage | undefined;
function storage(): Storage {
  stored ??= saves.define({ key: 'update.progress', scope: 'session', version: 1, schema: stateSchema, initial: () => null });
  return stored;
}
const MAX_AGE_MS = 5 * 60 * 1000;
const phases: readonly Phase[] = ['found', 'download', 'install', 'reload'];
const labels = ['s_update_found', 's_update_download', 's_update_install', 's_update_reload'] as const;

/** Renderer-free update handoff. Only producer receipts credit bytes; navigation
 * retains validated session state until the requested build publishes ws:ready. */
export class UpdateProgress {
  private readonly scope: Scope;
  private state: State;
  private root: HTMLElement | undefined;
  private fact: HTMLElement | undefined;
  private clock: HTMLElement | undefined;
  private retry: HTMLButtonElement | undefined;
  private readonly rows: HTMLElement[] = [];
  private baseline = { files: 0, network: 0, cached: 0 };
  private incoming: boolean;
  private failed = false;
  private tracking: Scope | undefined;
  private view: Scope | undefined;
  private readonly build: string;
  private readonly retryUpdate: () => void;
  private readonly store: Storage;
  private readonly now: () => number;

  constructor(owner: Scope, build: string, retryUpdate: () => void,
    store: Storage = storage(), now: () => number = Date.now) {
    this.build = build; this.retryUpdate = retryUpdate; this.store = store; this.now = now;
    this.scope = owner.child('update-progress');
    this.state = this.store.read();
    this.incoming = this.state !== null;
    if (this.state !== null && (this.state.started > this.now() || this.now() - this.state.started > MAX_AGE_MS)) {
      this.state = null; this.store.reset(); this.incoming = false;
    }
    if (this.state !== null) {
      this.baseline = { files: this.state.files, network: this.state.network, cached: this.state.cached };
      this.mount(); this.track(0);
    }
    this.scope.listen(document, 'ws:ready', () => { this.titleReady(); });
    this.scope.listen(window, 'pagehide', () => { this.scope.dispose(); }, { once: true });
  }

  start(target: string | null, packReady: boolean): void {
    if (this.scope.disposed || this.scope.disposing) return;
    this.incoming = false;
    this.failed = false;
    this.baseline = { files: 0, network: 0, cached: 0 };
    this.state = { started: this.now(), source: this.build, target, phase: 'found', packReady, files: 0, network: 0, cached: 0 };
    this.store.write(this.state); this.mount(); this.track(diagnosticNow()); this.paint();
  }

  /** Give the covering screen a paint before starting a navigation. Disposal
   * settles this wait rather than abandoning a cancelled RAF promise. */
  present(): Promise<boolean> {
    const view = this.view;
    if (view === undefined || view.disposed || view.disposing) return Promise.resolve(false);
    return new Promise(resolve => {
      const forget = view.capture('disposers', () => { resolve(false); });
      view.raf(() => { view.raf(() => { forget(); resolve(true); }); });
    });
  }

  phase(phase: Phase): void {
    if (this.scope.disposed || this.scope.disposing || this.state === null || phases.indexOf(phase) <= phases.indexOf(this.state.phase)) return;
    this.state.phase = phase; this.store.write(this.state); this.paint();
  }

  /** Current document totals are added once to the previous document's receipts. */
  downloads(snapshot: DownloadSnapshot): void {
    if (this.scope.disposed || this.scope.disposing || this.state === null) return;
    const files = Math.max(this.state.files, this.baseline.files + snapshot.filesDone);
    const network = Math.max(this.state.network, this.baseline.network + snapshot.networkBytes);
    const cached = Math.max(this.state.cached, this.baseline.cached + snapshot.cachedBytes);
    if (files === this.state.files && network === this.state.network && cached === this.state.cached) return;
    Object.assign(this.state, { files, network, cached });
    this.store.write(this.state); this.paint();
  }

  private titleReady(): void {
    if (!this.incoming || this.state === null) return;
    if ((this.state.target !== null && this.state.target !== this.build)
      || (this.state.target === null && this.state.packReady && this.state.source === this.build)) {
      this.failed = true; this.showRetry(); return;
    }
    // Title dispatches this only after its real DOM has replaced the inline shell.
    // Keep the covering modal through the next paint opportunity.
    this.scope.raf(() => { this.scope.raf(() => {
      this.store.reset(); this.state = null; this.incoming = false;
      this.tracking?.dispose(); this.view?.dispose();
      this.root = undefined; this.fact = undefined; this.clock = undefined; this.retry = undefined;
      this.rows.length = 0;
    }); });
  }

  private track(since: number): void {
    this.tracking?.dispose();
    const tracking = this.scope.child('receipts'); this.tracking = tracking;
    const accounting = new DownloadAccounting(location.href, since);
    tracking.onDispose(observeDownloadAccounting(accounting));
    tracking.interval(250, () => { this.downloads(accounting.snapshot()); });
  }

  private mount(): void {
    if (this.root !== undefined) return;
    const view = this.scope.child('dialog'); this.view = view;
    const root = document.createElement('section');
    root.className = 'ws-update-screen'; root.tabIndex = -1;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'ws-update-heading');
    const head = document.createElement('header'); head.className = 'ws-update-screen-head';
    const brand = document.createElement('div'); brand.className = 'ws-wordmark'; brand.innerHTML = appIdentity().wordmark;
    head.append(brand);
    const panel = document.createElement('div'); panel.className = 'ws-update-screen-panel ws-glass';
    const heading = document.createElement('h1'); heading.id = 'ws-update-heading'; heading.textContent = engineString('s_update_heading');
    const clock = document.createElement('span'); clock.className = 'ws-update-screen-clock'; heading.append(clock);
    const steps = document.createElement('ol');
    for (const label of labels) {
      const row = document.createElement('li'); row.textContent = engineString(label); steps.append(row); this.rows.push(row);
    }
    const fact = document.createElement('p'); fact.className = 'ws-update-screen-fact';
    fact.setAttribute('role', 'status'); fact.setAttribute('aria-live', 'polite');
    const retry = document.createElement('button'); retry.type = 'button'; retry.hidden = true;
    retry.textContent = engineString('s_update_retry');
    view.listen(retry, 'click', () => { this.retryUpdate(); });
    panel.append(heading, steps, fact, retry); root.append(head, panel);
    hudSlots.widget('band.1', root, 0, view, document.body);
    this.root = root; this.fact = fact; this.clock = clock; this.retry = retry;
    // Prevent input/focus from reaching the world or title behind the dialog.
    view.listen(document, 'focusin', event => { if (event.target instanceof Node && !root.contains(event.target)) root.focus(); });
    listenPage(view, 'keydown', event => {
      if (event.key !== 'Tab') { event.stopImmediatePropagation(); return; }
      event.preventDefault(); if (retry.hidden === true) root.focus(); else retry.focus();
    }, { on: 'document', capture: true });
    root.focus();
    view.interval(250, () => { this.paint(); });
    this.paint();
  }

  private showRetry(): void {
    if (this.fact !== undefined) this.fact.textContent = engineString('s_update_waiting');
    if (this.retry !== undefined) this.retry.hidden = false;
  }

  private paint(): void {
    const state = this.state;
    if (state === null) return;
    const current = phases.indexOf(state.phase), elapsed = Math.max(0, this.now() - state.started);
    if (this.root !== undefined) this.root.dataset['phase'] = state.phase;
    if (this.retry !== undefined) this.retry.hidden = !this.failed && elapsed < 30000;
    this.rows.forEach((row, index) => {
      row.dataset['state'] = index < current ? 'done' : index === current ? 'active' : 'pending';
      if (index === current) row.setAttribute('aria-current', 'step'); else row.removeAttribute('aria-current');
      if (index === 0) row.textContent = engineString(state.target !== null || state.packReady ? 's_update_found' : 's_update_requested');
      if (index === 1) {
        row.textContent = engineString(state.packReady ? 's_update_pack_ready' : 's_update_download');
        if (!state.packReady && state.phase === 'reload') row.dataset['state'] = 'active';
      }
      if (index === 2) {
        const skipped = !state.packReady && state.phase === 'reload';
        row.textContent = engineString(skipped ? 's_update_no_handoff' : 's_update_install');
        if (skipped) row.dataset['state'] = 'pending';
      }
    });
    if (this.clock !== undefined) this.clock.textContent = engineString('s_update_elapsed', [(elapsed / 1000).toFixed(1)]);
    if (this.fact !== undefined) this.fact.textContent = state.files > 0 && state.network === 0 && state.cached === 0
      ? engineString('s_update_files_only', [state.files])
      : engineString('s_update_bytes', [state.files, Math.round(state.network / 1024), Math.round(state.cached / 1024)]);
    if (this.failed || elapsed >= 30000) this.showRetry();
  }
}
