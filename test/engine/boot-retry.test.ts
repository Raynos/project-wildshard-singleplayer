import { afterEach, describe, expect, it, vi } from 'vitest';
import { retried } from '../../src/engine/boot/retry';

afterEach(() => { vi.useRealTimers(); });
describe('module download retries', () => {
  it('returns a successful first download without scheduling a retry', async () => {
    vi.useFakeTimers(); const load = vi.fn(() => Promise.resolve('loaded'));
    await expect(retried(load)).resolves.toBe('loaded');
    expect(load).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it('retries only after 800 ms and then 2500 ms', async () => {
    vi.useFakeTimers();
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new TypeError('download dropped'))
      .mockRejectedValueOnce(new TypeError('download dropped')).mockResolvedValue('loaded');
    const result = retried(load);
    await vi.advanceTimersByTimeAsync(799); expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2499); expect(load).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); await expect(result).resolves.toBe('loaded');
    expect(load).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves the final failure after three attempts', async () => {
    vi.useFakeTimers(); const failure = new TypeError('module unavailable');
    const load = vi.fn<() => Promise<void>>().mockRejectedValue(failure);
    const rejected = expect(retried(load)).rejects.toBe(failure);
    await vi.runAllTimersAsync(); await rejected;
    expect(load).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
  });
});
