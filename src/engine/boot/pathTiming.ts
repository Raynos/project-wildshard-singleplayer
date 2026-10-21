import { saveStorage } from '../saves/slots';
import { blendLoadingTimings, loadingTimingKey, type LoadingTimingKey, type LoadingTimings } from './weights';

/** The client supplies its tier/path/identity; importing this store never selects a renderer tier. */
export function loadPathTimings(key: LoadingTimingKey): LoadingTimings {
  try {
    const value: unknown = JSON.parse(saveStorage('device').getItem(loadingTimingKey(key)) ?? 'null');
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] =>
      typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0));
  } catch { return {}; }
}
export function savePathTimings(key: LoadingTimingKey, measured: LoadingTimings, baseline: LoadingTimings = {}): void {
  try { saveStorage('device').setItem(loadingTimingKey(key), JSON.stringify(blendLoadingTimings({ ...baseline, ...loadPathTimings(key) }, measured))); }
  catch { /* Denied storage keeps the committed calibration as the next run's baseline. */ }
}
