import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeTitleArrival, setTitleArrival } from '#engine-internal/boot/titleArrival';
import { MemoryStorage } from './setup';

describe('title arrival across a fresh PWA document', () => {
  let session: MemoryStorage;
  let local: MemoryStorage;

  beforeEach(() => {
    session = new MemoryStorage();
    local = new MemoryStorage();
    vi.stubGlobal('sessionStorage', session);
    vi.stubGlobal('localStorage', local);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('enters the selected world once even when iOS loses session storage on navigation', () => {
    setTitleArrival({ slug: 'nine-dragon-stack', mode: 'enter' });
    session.clear();
    expect(consumeTitleArrival('nine-dragon-stack')).toEqual({ slug: 'nine-dragon-stack', mode: 'enter' });
    expect(consumeTitleArrival('nine-dragon-stack')).toBeNull();
  });

  it('does not turn the one-shot backup into a remembered last shard', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-27T19:00:00Z'));
    setTitleArrival({ slug: 'nine-dragon-stack', mode: 'explore' });
    session.clear();
    vi.advanceTimersByTime(61_000);
    expect(consumeTitleArrival('nine-dragon-stack')).toBeNull();
  });

  it('does not consume one shard as another shard’s arrival', () => {
    setTitleArrival({ slug: 'nine-dragon-stack', mode: 'enter' });
    expect(consumeTitleArrival('driftwood-isle')).toBeNull();
    expect(consumeTitleArrival('nine-dragon-stack')).toBeNull();
  });
});
