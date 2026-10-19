// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { arenaUrlOpponent } from '../practice/shared-arena/selection';
import { installArenaPage } from '../practice/shared-arena/controller';
import html from '../practice/shared-arena/arena.html?raw';

test.each([
  ['mantis', 'splinter-mantis'], ['splinter-mantis', 'splinter-mantis'],
  ['conch', 'conch-duelist'], ['conch-duelist', 'conch-duelist'],
  ['colossus', 'tideRootColossus'], ['tideRootColossus', 'tideRootColossus'], ['tide-root-colossus', 'tideRootColossus'],
  ['puffer', 'brine-puffer'], ['brine-puffer', 'brine-puffer'], ['bellback', 'bellback'],
  ['matriarch', 'brine-pitcher-matriarch'], ['brine-pitcher-matriarch', 'brine-pitcher-matriarch'],
  ['medusa', 'pearlglass-medusa'], ['pearlglass-medusa', 'pearlglass-medusa'],
  ['keelmaw', 'keelmaw'], ['iguana', 'bloomthroat-iguana'], ['bloomthroat-iguana', 'bloomthroat-iguana'],
])('allowlisted alias %s selects %s from explicit queries or the legacy hash', (alias, kind) => {
  expect(arenaUrlOpponent('', `#${alias}`)).toBe(kind);
  expect(arenaUrlOpponent(`?opponent=${alias}`, '')).toBe(kind);
  expect(arenaUrlOpponent(`?enemy=${alias}`, '')).toBe(kind);
});
test('encoding, precedence, malformed and unknown inputs stay bounded', () => {
  expect(arenaUrlOpponent('', '#%70uffer')).toBe('brine-puffer');
  expect(arenaUrlOpponent('?enemy=%63onch', '')).toBe('conch-duelist');
  expect(arenaUrlOpponent('?opponent=mantis&enemy=puffer', '#conch')).toBe('splinter-mantis');
  expect(arenaUrlOpponent('?opponent=unknown', '#puffer')).toBeUndefined();
  for (const value of ['', 'unknown', '%', '%E0%A4%A', '%2570uffer', 'constructor', '__proto__', '<script>alert(1)</script>', 'puffer&start=true']) {
    expect(arenaUrlOpponent('', `#${value}`)).toBeUndefined();
    expect(arenaUrlOpponent(`?enemy=${encodeURIComponent(value)}`, '')).toBeUndefined();
  }
  expect(arenaUrlOpponent('?start=true&script=puffer', '')).toBeUndefined();
  expect(arenaUrlOpponent('?enemy=%E0%A4%A', '')).toBeUndefined();
});
test.each(['#puffer', '?opponent=conch', '#bellback', '?enemy=brine-pitcher-matriarch', '#pearlglass-medusa', '?opponent=keelmaw', '#bloomthroat-iguana'])('URL %s only preselects; unavailable entries cannot boot', async suffix => {
  location.href = `http://localhost/${suffix}`;
  document.body.innerHTML = html.split('<body>')[1]?.split('</body>')[0]?.replaceAll(/<script[\s\S]*?<\/script>/gu, '') ?? '';
  const select = document.getElementById('arena-opponent');
  const start = document.getElementById('arena-start');
  if (!(select instanceof HTMLSelectElement) || !(start instanceof HTMLButtonElement)) throw new Error('controls');
  const demo = { choices: [{ id: 'brine-puffer:default', label: 'Puffer' }], select: vi.fn(() => Promise.resolve(true)), retry: vi.fn(), back: vi.fn(), dispose: vi.fn() };
  const boot = vi.fn(() => Promise.resolve(demo));
  installArenaPage(boot);
  expect(boot).not.toHaveBeenCalled();
  expect(start.hidden).toBe(false);
  expect(select.value).toBe(arenaUrlOpponent(location.search, location.hash));
  expect(select.querySelectorAll('option')).toHaveLength(9);
  expect(select.querySelectorAll('option[disabled]')).toHaveLength(5);
  if (!['brine-puffer', 'conch-duelist'].includes(select.value)) {
    expect(start.disabled).toBe(true); start.dispatchEvent(new Event('click')); expect(boot).not.toHaveBeenCalled();
    expect(document.getElementById('arena-status')?.textContent).toContain('unavailable');
  }
  select.value = 'brine-puffer'; select.dispatchEvent(new Event('change'));
  expect(start.disabled).toBe(false); expect(boot).not.toHaveBeenCalled();
  start.click(); await vi.waitFor(() => expect(demo.select).toHaveBeenCalledWith('brine-puffer:default'));
  expect(boot).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('pagehide')); location.href = 'http://localhost/';
});
