import { expect, test, vi } from 'vitest';
import { devices } from 'playwright';
import { openNativeRaster } from './nativeRaster';

function fixture() {
  const page = {
    setContent: vi.fn<(html: string) => Promise<void>>(() => Promise.resolve()),
    addScriptTag: vi.fn<(input: { content: string; type?: string }) => Promise<void>>(() => Promise.resolve()),
  };
  const context = { newPage: vi.fn(() => Promise.resolve(page)) };
  const browser = {
    newContext: vi.fn((_options: unknown) => Promise.resolve(context)),
    close: vi.fn(() => Promise.resolve()),
  };
  const launch = vi.fn((_options: { headless: true }) => Promise.resolve(browser));
  return { page, context, browser, launch, host: { launch } };
}

test('native raster retains the original phone profile and owns browser release', async () => {
  const native = fixture();
  const session = await openNativeRaster({ html: '<title>Reference</title>', source: 'paint()' }, native.host);
  expect(native.launch).toHaveBeenCalledWith({ headless: true });
  expect(native.browser.newContext).toHaveBeenCalledWith(devices['iPhone 16 Pro']);
  expect(native.page.setContent).toHaveBeenCalledWith('<title>Reference</title>');
  expect(native.page.addScriptTag).toHaveBeenCalledWith({ content: 'paint()' });
  expect(session.page).toBe(native.page);
  expect(native.browser.close).not.toHaveBeenCalled();
  await session.dispose();
  expect(native.browser.close).toHaveBeenCalledTimes(1);
});

test('native raster snapshots the document/code and preserves explicit module tags', async () => {
  const native = fixture();
  const input = { html: '<title>Original</title>', source: 'original()', module: true };
  const pending = openNativeRaster(input, native.host);
  input.html = '<title>Changed</title>'; input.source = 'changed()'; input.module = false;
  const session = await pending;
  expect(native.page.setContent).toHaveBeenCalledWith('<title>Original</title>');
  expect(native.page.addScriptTag).toHaveBeenCalledWith({ type: 'module', content: 'original()' });
  await session.dispose();
});

test.each(['context', 'document', 'script'] as const)('native raster closes partial resources when %s refuses', async step => {
  const native = fixture();
  const error = new Error(`Reference ${step} refused`);
  if (step === 'context') native.browser.newContext.mockRejectedValueOnce(error);
  else if (step === 'document') native.page.setContent.mockRejectedValueOnce(error);
  else native.page.addScriptTag.mockRejectedValueOnce(error);
  await expect(openNativeRaster({ html: '', source: '' }, native.host)).rejects.toBe(error);
  expect(native.browser.close).toHaveBeenCalledTimes(1);
});

test('native raster preserves close refusal instead of publishing a successful cleanup', async () => {
  const native = fixture();
  const session = await openNativeRaster({ html: '', source: '' }, native.host), error = new Error('Reference browser close refused');
  native.browser.close.mockRejectedValueOnce(error);
  await expect(session.dispose()).rejects.toBe(error);
});
