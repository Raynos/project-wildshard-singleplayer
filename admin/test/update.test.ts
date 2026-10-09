// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { installUpdates } from '../src/update.ts';

afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

it('checks new data on foreground, survives offline checks, and reloads once per tap', async () => {
  vi.useFakeTimers();
  const reload = document.createElement('button'), banner = document.createElement('button');
  reload.id = 'reload'; banner.id = 'data-update'; banner.hidden = true;
  document.body.append(reload, banner);
  const read = vi.fn<() => Promise<unknown>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ build: 'old' }).mockResolvedValue({ build: 'new' });
  const navigate = vi.fn<() => void>();
  const dispose = installUpdates('old', { read, reload: navigate });
  await vi.advanceTimersByTimeAsync(0);
  expect(banner.hidden).toBe(true);
  window.dispatchEvent(new Event('pageshow'));
  await vi.advanceTimersByTimeAsync(0);
  expect(banner.hidden).toBe(true);
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(banner.hidden).toBe(false);
  banner.dispatchEvent(new Event('pointerup')); banner.click();
  expect(navigate).toHaveBeenCalledOnce();
  dispose();
  await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  expect(read).toHaveBeenCalledTimes(3);
});

it('does not publish a late version check after disposal', async () => {
  const banner = document.createElement('button'); banner.id = 'data-update'; banner.hidden = true; document.body.append(banner);
  let deliver: ((value: unknown) => void) | undefined;
  const result = new Promise<unknown>((resolve) => { deliver = resolve; });
  const dispose = installUpdates('old', { read: () => result, reload: vi.fn<() => void>() });
  dispose(); deliver?.({ build: 'new' });
  await result; await Promise.resolve();
  expect(banner.hidden).toBe(true);
});
