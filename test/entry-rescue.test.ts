import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ line: '', telemetry: vi.fn(), guard: vi.fn(), title: vi.fn(), three: vi.fn(), main: vi.fn() }));
vi.mock('#engine/telemetry/runtime', () => ({ startTelemetry: mocks.telemetry }));
vi.mock('#engine/boot/stuck', () => ({ guardBoot: mocks.guard }));
vi.mock('#engine/boot/bootTrace', () => ({ inspectPreviousBoot: vi.fn(), previousBootLine: () => mocks.line, previousBootLevel: () => 'nine-dragon-stack' }));
vi.mock('#engine/ui/StartTitle', () => { mocks.title(); return {}; });
vi.mock('three', () => { mocks.three(); return {}; });
vi.mock('../src/main', () => { mocks.main(); return {}; });

const titleClass = { add: vi.fn() };
const resumeClass = { remove: vi.fn() };
const replaced = vi.fn((_state: unknown, _unused: string, url: URL) => { vi.stubGlobal('location', new URL(url)); });

beforeEach(() => {
  vi.resetModules();
  mocks.line = '';
  mocks.telemetry.mockClear(); mocks.guard.mockClear(); mocks.title.mockClear(); mocks.three.mockClear(); mocks.main.mockClear();
  titleClass.add.mockClear(); resumeClass.remove.mockClear(); replaced.mockClear();
  vi.stubGlobal('document', { documentElement: { classList: titleClass }, querySelector: () => ({ classList: resumeClass }) });
  vi.stubGlobal('history', { state: null, replaceState: replaced });
});

describe('entry after a Nine Dragon page restart', () => {
  it('rescues an abrupt Nine retry to the static title before importing the game', async () => {
    mocks.line = 'Abrupt previous page: Nine Dragon firstFrame 95% (cause unknown)';
    vi.stubGlobal('location', new URL('https://wildshard.example/?chunk=nine-dragon-stack&glreload=1&v=old'));
    const entry = await import('../src/entry');
    await entry.entered;
    expect(mocks.telemetry).toHaveBeenCalledOnce();
    expect(replaced).toHaveBeenCalledOnce();
    expect(location.href).toBe('https://wildshard.example/');
    expect(titleClass.add).toHaveBeenCalledWith('title-first');
    expect(resumeClass.remove).toHaveBeenCalledWith('show');
    expect(mocks.title).toHaveBeenCalledOnce();
    expect(mocks.three).not.toHaveBeenCalled();
    expect(mocks.main).not.toHaveBeenCalled();
  });

  it('loads Nine normally after an intentional title choice', async () => {
    vi.stubGlobal('location', new URL('https://wildshard.example/?chunk=nine-dragon-stack'));
    const entry = await import('../src/entry');
    await entry.entered;
    expect(mocks.telemetry).toHaveBeenCalledOnce();
    expect(replaced).not.toHaveBeenCalled();
    expect(titleClass.add).not.toHaveBeenCalled();
    expect(mocks.title).not.toHaveBeenCalled();
    expect(mocks.three).toHaveBeenCalledOnce();
    expect(mocks.main).toHaveBeenCalledOnce();
  });
});
