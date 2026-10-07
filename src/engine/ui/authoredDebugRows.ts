import { isDev } from '../core/devMode';
import type { DebugRowSpec } from '../level/context';
import type { DebugRow } from './debugOptions';

export const authoredRows = new Set<DebugRow>();
/** Global developer buttons run only when pressed; they never persist or replay a choice. */
export type GlobalDebugActionSpec = Pick<DebugRowSpec, 'purpose' | 'id' | 'group' | 'label' | 'note' | 'ask' | 'reviewBy'> & { text: string; run: () => void | Promise<void> };
export function registerGlobalDebugAction(spec: GlobalDebugActionSpec): () => void {
  let live = true;
  const row: DebugRow = { purpose: 'developer', id: spec.id, group: spec.group, label: spec.label, note: spec.note, ask: spec.ask, reviewBy: spec.reviewBy,
    choices: () => [], get: () => '', set: () => undefined, on: () => undefined, reload: false, when: () => true,
    action: { text: spec.text, run: () => live && isDev() ? spec.run() : undefined } };
  authoredRows.add(row);
  return () => { live = false; authoredRows.delete(row); };
}
