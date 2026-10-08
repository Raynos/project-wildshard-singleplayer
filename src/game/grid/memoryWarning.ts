import type { Scope } from '@wildshard/engine/app/scope';
import { isDev, onDev } from '@wildshard/engine/core/devMode';
import { mountUi } from '@wildshard/engine/ui/ownership';
import type { MemoryAdmission, MemoryAdmissionWarning } from './memoryAdmission';
import './memoryWarning.css';

const mb = (bytes: number): string => `${(bytes / 1_000_000).toFixed(3)} MB`;
/** G216: visible only for a Developer override, showing full claims and original caps rather than an altered allowance. */
export function memoryWarningLines(row: MemoryAdmissionWarning): readonly string[] {
  return [
    `${row.owner} · ${row.id}`,
    `PLAYING ${mb(row.playingBytes)} / ${mb(row.playingCap)} · OVER ${mb(row.playingOverBytes)}`,
    `LOADING ${mb(row.loadingBytes)} / ${mb(row.loadingCap)} · OVER ${mb(row.loadingOverBytes)}`,
    `CLAIM ${mb(row.claimedBytes)} · TOTAL ACCOUNTED ${mb(row.accountedBytes)}`,
    ...(row.categories === undefined ? [] : Object.entries(row.categories).map(([key, bytes]) => `${key.toUpperCase()} ${mb(bytes)}`)),
    ...(row.measured === undefined ? [] : [`MEASURED WEBCONTENT ${mb(row.measured.webContentBytes)} + GL ${mb(row.measured.glBytes)}`,
      `CALIBRATED BASE ${mb(row.measured.engineBaseBytes)} · ${row.measured.rev}`, `${row.measured.device} · ${row.measured.evidence}`]),
  ];
}
/**
 * G216 / E332: one scope-owned warning on an entered shard's HUD. The trusted policy also feeds G217's separate blocked
 * cell screen. The warning starts as a tappable chip; only its chip and expanded details receive pointers. Full numeric reports stay available.
 * No timer, control movement, authored HTML or additional admission runs; public pages create no panel.
 */
export function installMemoryWarning(memory: MemoryAdmission, scope: Scope, hudRoot: HTMLElement): void {
  let surface: { root: HTMLElement; chip: HTMLButtonElement; details: HTMLElement } | undefined;
  const createSurface = (): { root: HTMLElement; chip: HTMLButtonElement; details: HTMLElement } => {
    const root = document.createElement('section'); root.className = 'ws-memory-warning'; root.setAttribute('role', 'status');
    const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'ws-memory-warning-chip';
    chip.setAttribute('aria-expanded', 'false');
    const details = document.createElement('div'); details.className = 'ws-memory-warning-details'; details.hidden = true;
    root.append(chip, details); mountUi(root, scope, hudRoot);
    scope.listen(root, 'pointerdown', (event: Event) => { event.stopPropagation(); });
    scope.listen(chip, 'click', (event: Event) => {
      event.stopPropagation(); const expanded = details.hidden !== false; details.hidden = !expanded; chip.setAttribute('aria-expanded', String(expanded));
    });
    scope.listen(details, 'click', (event: Event) => { event.stopPropagation(); });
    return { root, chip, details };
  };
  const refresh = (): void => {
    if (scope.disposed) return;
    const reports = memory.reports();
    if (!isDev() || reports.length === 0) { if (surface !== undefined) surface.root.hidden = true; return; }
    surface ??= createSurface();
    surface.root.hidden = false;
    const over = Math.max(...reports.map(row => Math.max(row.playingOverBytes, row.loadingOverBytes)));
    surface.chip.textContent = `MEMORY LIMIT · +${(over / 1_000_000).toFixed(1)} MB`;
    const title = document.createElement('b'); title.textContent = 'DEVELOPER · MEMORY LIMIT EXCEEDED';
    const rows = reports.map(report => {
      const section = document.createElement('div'); section.className = 'ws-memory-warning-report';
      section.dataset['owner'] = report.owner; section.dataset['claimedBytes'] = String(report.claimedBytes);
      section.dataset['playingBytes'] = String(report.playingBytes); section.dataset['loadingBytes'] = String(report.loadingBytes);
      section.dataset['playingCap'] = String(report.playingCap); section.dataset['loadingCap'] = String(report.loadingCap);
      section.textContent = memoryWarningLines(report).join('\n'); return section;
    });
    surface.details.replaceChildren(title, ...rows);
  };
  scope.onDispose(memory.subscribe(refresh)); scope.onDispose(onDev(refresh));
}
