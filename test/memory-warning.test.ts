// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { app } from '../src/engine/app/runtime';
import { setDev } from '../src/engine/core/devMode';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { installMemoryWarning } from '../src/game/grid/memoryWarning';

afterEach(() => { setDev(false); document.body.replaceChildren(); });
it('shows all real admitted totals only in Developer, without interpreting author text as markup, and cleans up', () => {
  const scope = app.engineScope.child('test.memory-warning'), root = document.createElement('div'); document.body.append(root);
  const memory = new MemoryAdmission(() => true);
  setDev(false); installMemoryWarning(memory, scope, root);
  memory.accept({ stage: 'runtime', owner: '<img onerror=bad>', id: 'sim:over', claimedBytes: 900_000_000, accountedBytes: 900_000_000,
    playingBytes: 1_379_000_000, loadingBytes: 1_459_000_000,
    measured: { webContentBytes: 1_000_000_000, glBytes: 300_000_000, engineBaseBytes: 299_000_000, rev: '123456789', device: 'fixture', evidence: 'progress/memory/fixture/summary.json' } });
  expect(root.querySelector('.ws-memory-warning')).toBeNull();
  setDev(true);
  const panel = root.querySelector<HTMLElement>('.ws-memory-warning'); expect(panel?.hidden).toBe(false);
  expect(panel?.textContent).toContain('PLAYING 1379.000 MB / 1000.000 MB · OVER 379.000 MB');
  expect(panel?.textContent).toContain('MEASURED WEBCONTENT 1000.000 MB + GL 300.000 MB');
  expect(panel?.querySelector('img')).toBeNull();
  expect(panel?.querySelector<HTMLElement>('[data-owner]')?.dataset['claimedBytes']).toBe('900000000');
  setDev(false); expect(panel?.hidden).toBe(true);
  scope.dispose(); expect(root.querySelector('.ws-memory-warning')).toBeNull();
});
