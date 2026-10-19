// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import html from '../practice/shared-arena/arena.html?raw';
import { installArenaPage } from '../practice/shared-arena/controller';

const spies = ({ select: vi.fn(() => Promise.resolve(true)), retry: vi.fn(), back: vi.fn(), dispose: vi.fn(), boot: vi.fn() });
test('one lazy runtime owns Start, change, Retry, Back, re-entry and page teardown without persistence', async () => {
  document.body.innerHTML = html.split('<body>')[1]?.split('</body>')[0]?.replaceAll(/<script[\s\S]*?<\/script>/gu, '') ?? '';
  spies.boot.mockRejectedValueOnce(new Error('Fixture boot failure')).mockResolvedValue({ choices: ['splinter-mantis','conch-duelist','tideRootColossus','brine-puffer'].map(kind => ({ id: `${kind}:${kind}`, label: kind })), ...spies });
  const button = (id: string): HTMLButtonElement => { const value = document.getElementById(id); if (!(value instanceof HTMLButtonElement)) throw new Error(id); return value; };
  const select = document.getElementById('arena-opponent'); if (!(select instanceof HTMLSelectElement)) throw new Error('select');
  installArenaPage(spies.boot);
  expect(spies.boot).not.toHaveBeenCalled();
  expect(select.querySelector('option[value="bellback"]')?.hasAttribute('disabled')).toBe(true);
  const originalCanvas = document.getElementById('game');
  button('arena-start').click();
  await vi.waitFor(() => expect(document.getElementById('arena-status')?.textContent).toBe('Fixture boot failure'));
  expect(document.getElementById('game')).not.toBe(originalCanvas);
  expect(document.querySelectorAll('canvas')).toHaveLength(1);
  button('arena-start').click(); button('arena-start').click();
  await vi.waitFor(() => expect(button('arena-start').hidden).toBe(true));
  expect(spies.boot).toHaveBeenCalledTimes(2); expect(spies.select).toHaveBeenLastCalledWith('splinter-mantis:splinter-mantis');
  select.value = 'conch-duelist'; select.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(button('arena-retry').disabled).toBe(false));
  expect(spies.select).toHaveBeenLastCalledWith('conch-duelist:conch-duelist');
  button('arena-retry').click(); expect(spies.retry).toHaveBeenCalledTimes(1);
  button('arena-back').click(); expect(spies.back).toHaveBeenCalledTimes(1); expect(button('arena-start').hidden).toBe(false);
  button('arena-start').click(); await vi.waitFor(() => expect(button('arena-start').hidden).toBe(true));
  expect(spies.boot).toHaveBeenCalledTimes(2); expect(document.querySelectorAll('canvas')).toHaveLength(1); expect(document.querySelectorAll('iframe')).toHaveLength(0);
  window.dispatchEvent(new Event('pagehide')); expect(spies.dispose).toHaveBeenCalledTimes(1);
});
