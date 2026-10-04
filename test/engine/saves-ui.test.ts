// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { buildSavePanel } from '../../src/engine/ui/SavePanel';
import * as v from 'valibot';
import { Scope } from '../../src/engine/app/scope';
import { SaveStore } from '../../src/engine/saves/store';
import { MemoryStorage } from '../setup';

afterEach(() => { document.body.replaceChildren(); });
it('exports gameplay saves and imports a picked file with skipped reasons and reload affordance', async () => {
  const local = new MemoryStorage(), store = new SaveStore({ local, session: null });
  const slot = store.define({ scope: 'global', key: 'coins', version: 1, schema: v.number(), initial: () => 0 });
  slot.write(19);
  vi.spyOn(app.saves, 'exportAll').mockImplementation(() => store.exportAll());
  vi.spyOn(app.saves, 'importAll').mockImplementation((raw) => store.importAll(raw));
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:save');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const scope = new Scope('test-save-panel'); app.levelScope = scope;
  const panel = buildSavePanel(); document.body.append(panel);
  const buttons = [...panel.querySelectorAll('button')]; buttons.find((b) => b.textContent === 'EXPORT')?.click();
  expect(create).toHaveBeenCalledTimes(1);
  const json = '{"format":"wildshard.save","version":2,"docs":{"global":{"keys":{"coins":{"v":1,"data":37},"unknown":{"v":1,"data":8}}}}}';
  const input = panel.querySelector('input'); if (!input) throw new Error('Save picker missing');
  Object.defineProperty(input, 'files', { value: [{ text: () => Promise.resolve(json) }] });
  input.dispatchEvent(new Event('change')); await vi.waitFor(() => { expect(slot.read()).toBe(37); });
  expect(panel.querySelector('[role=status]')?.textContent).toContain('Imported 1 keys');
  expect(panel.querySelector('[role=status]')?.textContent).toContain('global/unknown');
  expect(buttons.find((b) => b.textContent === 'RELOAD TO APPLY')?.hidden).toBe(false);
  scope.dispose(); app.levelScope = null;
});
it('lists and exports corrupt gameplay copies while hiding an empty aside list', () => {
  vi.spyOn(app.saves, 'corrupt').mockReturnValue([{ scope: 'pine-hollow', key: 'inventory', at: '2026-10-01', bytes: 42 }]);
  const exportCopy = vi.spyOn(app.saves, 'exportCorrupt').mockReturnValue('raw');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:aside'); vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const panel = buildSavePanel(); expect(panel.textContent).toContain('SET ASIDE'); expect(panel.textContent).toContain('pine-hollow / inventory');
  [...panel.querySelectorAll('button')].filter((b) => b.textContent === 'EXPORT')[1]?.click(); expect(exportCopy).toHaveBeenCalledTimes(1);
  vi.spyOn(app.saves, 'corrupt').mockReturnValue([]); panel.refresh();
  expect(panel.textContent).not.toContain('SET ASIDE');
});
