import { SaveStore, type SchemaFailure } from './store';

declare const __BUILD_ID__: string;
let report: ((failure: SchemaFailure) => void) | null = null;
const pending: SchemaFailure[] = [];
let forget: ((keys: readonly string[]) => void) | null = null;
/** The same service exposed as app.saves, available before the app/renderer graph evaluates. */
export const saves = new SaveStore({
  build: (() => { try { return __BUILD_ID__; } catch { return ''; } })(),
  report: (failure) => { if (report) report(failure); else { pending.push(failure); if (pending.length > 32) pending.shift(); } },
  forgetLegacy: (keys) => { forget?.(keys); },
});
export function installSaveReporter(fn: (failure: SchemaFailure) => void): void { report = fn; for (const failure of pending.splice(0)) fn(failure); }
export function installLegacyMirror(fn: (keys: readonly string[]) => void): void { forget = fn; }
let requested = false;
export function persistHomeScreen(store: Pick<SaveStore, 'persist'> = saves): void {
  if (requested || typeof navigator === 'undefined') return;
  const standalone = (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || Reflect.get(navigator, 'standalone') === true;
  if (standalone) { requested = true; void store.persist(); }
}
