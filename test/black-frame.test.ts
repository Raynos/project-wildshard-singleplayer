// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import type { BrowserContext, Page } from 'playwright';
import { captureBootFrame, frameFailure, screenshotPixels, type BootFrameSample } from '../scripts/parity/black-frame.mjs';
import { registerCaptureTrace } from '../scripts/parity/capture-trace.mjs';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
// oxlint-disable-next-line import/no-nodejs-modules -- Match Playwright's PNG Buffer without launching a browser.
import { Buffer } from 'node:buffer';

test('the black-placeholder threshold includes 90%, refusing missing pixels', () => {
  const sample = { width:780, height:1688, pixels:100, darkShare:.89 };
  expect(frameFailure(sample)).toBeNull();
  expect(frameFailure({...sample,darkShare:.9})).toContain('90% near-black');
  expect(frameFailure({...sample,darkShare:1})).toContain('90% near-black');
  for (const invalid of [{pixels:0},{width:0},{darkShare:Number.NaN},{darkShare:-1},{darkShare:1.1}]) {
    expect(frameFailure({...sample,...invalid})).toBe('invalid screenshot sample');
  }
});

test('composited screenshot pixels are read on a detached canvas and the bitmap is closed', async () => {
  const close = vi.fn<() => void>(), drawImage = vi.fn((...args:unknown[]):void => { expect(args).toHaveLength(5); });
  const bitmap = {width:780,height:1688,close};
  const data = new Uint8ClampedArray(32);
  data.set([16,0,0,255],16); // Red at the threshold is a lit sample.
  const context = legacyDouble<CanvasRenderingContext2D>({drawImage,getImageData:()=>({data,width:8,height:1,colorSpace:'srgb'})});
  const getContext = vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context);
  const decode = vi.fn(() => Promise.resolve(bitmap));
  vi.stubGlobal('createImageBitmap',decode);
  try {
    const count = document.querySelectorAll('canvas').length;
    expect(await screenshotPixels([1,2,3])).toEqual({width:780,height:1688,pixels:2,darkShare:.5});
    expect(document.querySelectorAll('canvas')).toHaveLength(count);
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(bitmap,0,0,192,416);
    expect(decode).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    getContext.mockReturnValue(null);
    await expect(screenshotPixels([1])).rejects.toThrow('Missing screenshot analysis context');
    expect(close).toHaveBeenCalledTimes(2);
  } finally { getContext.mockRestore();vi.unstubAllGlobals(); }
});

test('a black boot frame fails with its checkpoint and retained observation', async () => {
  const screenshot=vi.fn<Page['screenshot']>().mockResolvedValue(Buffer.from([1,2,3]));
  const evaluate=vi.fn(() => Promise.resolve({width:780,height:1688,pixels:100,darkShare:.95}));
  const context=legacyDouble<BrowserContext>({browser:()=>null});
  const page=legacyDouble<Page>({screenshot,evaluate,context:()=>context}), frames:BootFrameSample[]=[];
  await expect(captureBootFrame(page,'SHARD SELECT',Date.now()+30000,frames)).rejects.toThrow('SHARD SELECT: frame is at least 90% near-black');
  expect(frames).toEqual([{label:'SHARD SELECT',width:780,height:1688,pixels:100,darkShare:.95}]);
  expect(screenshot).toHaveBeenCalledOnce();
  expect(screenshot.mock.calls[0]?.[0]?.type).toBe('png');
  expect(screenshot.mock.calls[0]?.[0]?.timeout).toBeGreaterThan(0);
  expect(screenshot.mock.calls[0]?.[0]?.timeout).toBeLessThanOrEqual(10000);
  expect(evaluate).toHaveBeenCalledTimes(2);
  expect(evaluate).toHaveBeenLastCalledWith(screenshotPixels,[1,2,3]);
});

test('an exhausted original deadline refuses before requesting a screenshot', async () => {
  const screenshot=vi.fn(), page=legacyDouble<Page>({screenshot});
  await expect(captureBootFrame(page,'grid HOME',Date.now()-1,[])).rejects.toThrow('Boot deadline: grid HOME screenshot');
  expect(screenshot).not.toHaveBeenCalled();
});

test('a screenshot timeout stays red after diagnostic cleanup with no second capture', async () => {
  const original=new Error('page.screenshot: Timeout 10000ms exceeded.');
  const screenshot=vi.fn<Page['screenshot']>().mockRejectedValue(original);
  const start=vi.fn().mockResolvedValue(undefined), stop=vi.fn().mockRejectedValue(new Error('trace lost'));
  const tracing=legacyDouble<BrowserContext['tracing']>({start,stop});
  const context=legacyDouble<BrowserContext>({tracing});
  const page=legacyDouble<Page>({context:()=>context,screenshot,evaluate:()=>Promise.resolve(true)});
  registerCaptureTrace(page,'unused','nine');
  const frames:BootFrameSample[]=[];
  await expect(captureBootFrame(page,'Nine title',Date.now()+30000,frames)).rejects.toBe(original);
  expect(screenshot).toHaveBeenCalledOnce();
  expect(screenshot.mock.calls[0]?.[0]?.type).toBe('png');
  expect(screenshot.mock.calls[0]?.[0]?.timeout).toBeGreaterThan(0);
  expect(screenshot.mock.calls[0]?.[0]?.timeout).toBeLessThanOrEqual(10000);
  expect(start).toHaveBeenCalledExactlyOnceWith({screenshots:false,snapshots:false,sources:false});
  expect(stop).toHaveBeenCalledExactlyOnceWith({path:'unused/nine-capture-1.zip'});
  expect(frames).toEqual([]);
});

test('capture waits one compositor frame and shares the unchanged ten-second allowance', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  let finishFrame: (() => void) | undefined;
  const frame = new Promise<boolean>(resolve => { finishFrame=()=>resolve(true); });
  const sample={width:780,height:1688,pixels:100,darkShare:.2};
  const evaluate=vi.fn().mockReturnValueOnce(frame).mockResolvedValue(sample);
  const screenshot=vi.fn(() => Promise.resolve(Buffer.from([1,2,3])));
  const context=legacyDouble<BrowserContext>({browser:()=>null});
  const page=legacyDouble<Page>({screenshot,evaluate,context:()=>context}), frames:BootFrameSample[]=[];
  try {
    const pending=captureBootFrame(page,'Nine title',30000,frames);
    await vi.advanceTimersByTimeAsync(16);
    expect(screenshot).not.toHaveBeenCalled();
    if (finishFrame === undefined) throw new Error('Missing frame callback');
    finishFrame(); await pending;
    expect(screenshot).toHaveBeenCalledExactlyOnceWith({type:'png',timeout:9984});
    expect(evaluate).toHaveBeenLastCalledWith(screenshotPixels,[1,2,3]);
    expect(frames).toEqual([{label:'Nine title',...sample}]);
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});

test('a stalled compositor refuses within the original boot deadline with no late capture', async () => {
  vi.useFakeTimers(); vi.setSystemTime(0);
  let finishFrame: (() => void) | undefined;
  const frame=new Promise<boolean>(resolve => { finishFrame=()=>resolve(true); });
  const screenshot=vi.fn();
  const context=legacyDouble<BrowserContext>({browser:()=>null});
  const page=legacyDouble<Page>({context:()=>context,screenshot,evaluate:()=>frame});
  try {
    const refused=expect(captureBootFrame(page,'Nine title',1000,[])).rejects.toThrow('Boot deadline: Nine title compositor frame');
    await vi.advanceTimersByTimeAsync(1000); await refused;
    if (finishFrame === undefined) throw new Error('Missing frame callback');
    finishFrame(); await Promise.resolve();
    expect(screenshot).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally { vi.useRealTimers(); }
});
