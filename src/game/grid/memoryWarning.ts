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
 * cell screen. No timer, control movement, authored HTML or additional admission runs; public pages create no panel.
 */
export function installMemoryWarning(memory: MemoryAdmission, scope: Scope, hudRoot: HTMLElement): void {
  let root: HTMLElement | undefined;
  const refresh = (): void => {
    if (scope.disposed) return;
    const reports = memory.reports();
    if (!isDev() || reports.length === 0) { if (root !== undefined) root.hidden = true; return; }
    if (root === undefined) {
      root = document.createElement('section'); root.className = 'ws-memory-warning'; root.setAttribute('role', 'status');
      mountUi(root, scope, hudRoot);
    }
    root.hidden = false;
    const title = document.createElement('b'); title.textContent = 'DEVELOPER · MEMORY LIMIT EXCEEDED';
    const rows = reports.map(report => {
      const section = document.createElement('div'); section.className = 'ws-memory-warning-report';
      section.dataset['owner'] = report.owner; section.dataset['claimedBytes'] = String(report.claimedBytes);
      section.dataset['playingBytes'] = String(report.playingBytes); section.dataset['loadingBytes'] = String(report.loadingBytes);
      section.dataset['playingCap'] = String(report.playingCap); section.dataset['loadingCap'] = String(report.loadingCap);
      section.textContent = memoryWarningLines(report).join('\n'); return section;
    });
    root.replaceChildren(title, ...rows);
  };
  scope.onDispose(memory.subscribe(refresh)); scope.onDispose(onDev(refresh));
}
