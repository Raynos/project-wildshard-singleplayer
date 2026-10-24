// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { explorerCards, explorerCases, explorerFailures, explorerState, sweepExplorer } from '../scripts/parity/explorer-smoke.mjs';
import type { Browser, BrowserContext, Page } from 'playwright';
import { legacyDouble } from './fake/FakeGame';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual required workflow leg, without dispatching it.
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';

const catalogue = [
  {slug:'driftwood-isle',status:'live',legacy:false},
  {slug:'sunscar-dunes',status:'experimental',legacy:false},
  {slug:'nine-dragon-stack',status:'experimental',legacy:false},
  {slug:'_template',status:'hidden',legacy:false},
  {slug:'open-plot-alien-plain',status:'hidden',legacy:false,shardSelect:false},
  {slug:'driftwood-isle-legacy',status:'live',legacy:true},
];

test('progress records only appended canvases and still requires the whole displayed catalogue', () => {
  document.body.innerHTML='<div class="ws-x show" data-mode="model"><div class="ws-x-grid"><button class="ws-x-model" data-id="first"><canvas></canvas></button><button class="ws-x-model" data-id="pending"></button></div></div>';
  try {
    expect(explorerState()).toEqual({fatal:[],empty:false,ready:false,readyIds:['first']});
    const pending=document.querySelector('[data-id="pending"]');
    if(pending===null)throw new Error('Missing pending card');
    pending.append(document.createElement('canvas'));
    expect(explorerState()).toEqual({fatal:[],empty:false,ready:true,readyIds:['first','pending']});
    document.querySelector('.ws-x')?.classList.remove('show');
    expect(explorerState()).toEqual({fatal:[],empty:false,ready:false,readyIds:[]});
  } finally { document.body.replaceChildren(); }
});

test('the Explorer leg retains every primary, including Signal and Developer-only rows, once', () => {
  expect(explorerCases(catalogue)).toEqual(['driftwood-isle','nine-dragon-stack','sunscar-dunes','_template','open-plot-alien-plain']);
  const workflow = readFileSync('.github/workflows/boot-smoke.yml','utf8');
  expect(workflow).toContain('part: [boot-public, boot-developer, boot-grid, hover-chromium, hover-webkit, explorer]');
  expect(workflow).toContain("if: matrix.part == 'explorer'");
  expect(workflow).toContain('run: node scripts/parity/explorer-smoke.mjs');
  expect(workflow).toContain('needs: [build, boot-smoke]');
});

test('missing, failed, duplicate and black card frames refuse with their real model identity', () => {
  const ready={id:'signal/column',ready:true,pixels:100,darkShare:.89};
  expect(explorerFailures([ready])).toEqual([]);
  expect(explorerFailures([{...ready,darkShare:.9}])).toEqual(['signal/column: thumbnail is at least 90% near-black']);
  expect(explorerFailures([{...ready,ready:false}])).toEqual(['signal/column: thumbnail never drew']);
  expect(explorerFailures([ready,ready])).toContain('Missing or duplicate model identity');
  expect(explorerFailures([{...ready,darkShare:Number.NaN}])).toHaveLength(1);
});

test('the observation reads the ordinary already-drawn card canvas, including an undrawn suffix', () => {
  document.body.innerHTML='<div class="ws-x-grid"><button class="ws-x-model" data-id="signal/column"><canvas width="4" height="1"></canvas></button><button class="ws-x-model" data-id="pending"></button></div>';
  const canvas=document.querySelector('canvas');if(canvas===null)throw new Error('Missing fixture');
  const context=legacyDouble<CanvasRenderingContext2D>({getImageData:()=>({data:Uint8ClampedArray.from([0,0,0,255,0,0,0,255,0,0,0,255,0,0,0,255]),width:4,height:1,colorSpace:'srgb'})});
  const getter=vi.spyOn(canvas,'getContext').mockReturnValue(context);
  try {
    const rows=explorerCards();
    expect(rows).toEqual([{id:'signal/column',ready:true,pixels:1,darkShare:1},{id:'pending',ready:false,pixels:0,darkShare:1}]);
    expect(explorerFailures(rows)).toHaveLength(2);
    expect(getter).toHaveBeenCalledExactlyOnceWith('2d');
  } finally { getter.mockRestore();document.body.replaceChildren(); }
});

test('a model-ready invalidation between presence and pixels waits for the replacement canvas', async () => {
  mkdirSync('tmp/sp-x7-live', { recursive: true });
  const out = mkdtempSync('tmp/sp-x7-live/explorer-redraw-');
  const evaluate = vi.fn<Page['evaluate']>();
  const state = { fatal: [], empty: false, ready: true, readyIds: ['shared/training-dummy'] };
  const missing = { id: 'shared/training-dummy', ready: false, pixels: 0, darkShare: 1 };
  const drawn = { ...missing, ready: true, pixels: 100, darkShare: .2 };
  evaluate.mockResolvedValueOnce(state).mockResolvedValueOnce([missing])
    .mockResolvedValueOnce(state).mockResolvedValueOnce([drawn]);
  const page: Page = legacyDouble<Page>({ evaluate, on: () => page,
    goto: vi.fn<Page['goto']>().mockResolvedValue(null),
    close: vi.fn<Page['close']>().mockResolvedValue(),
    screenshot: vi.fn<Page['screenshot']>().mockRejectedValue(new Error('Unexpected failure capture')) });
  const close = vi.fn<BrowserContext['close']>().mockResolvedValue(undefined);
  const disposable = { dispose: (): Promise<void> => Promise.resolve(), [Symbol.asyncDispose]: (): Promise<void> => Promise.resolve() };
  const context = legacyDouble<BrowserContext>({
    addInitScript: vi.fn<BrowserContext['addInitScript']>().mockResolvedValue(disposable),
    route: vi.fn<BrowserContext['route']>().mockResolvedValue(disposable),
    newPage: vi.fn<BrowserContext['newPage']>().mockResolvedValue({ ...page }),
    close,
  });
  const browser = legacyDouble<Browser>({ newContext: vi.fn<Browser['newContext']>().mockResolvedValue({ ...context }) });
  try {
    await sweepExplorer(browser, 'https://test.example/', 'fixture', out);
    const receipt: unknown = JSON.parse(readFileSync(`${out}/fixture.json`, 'utf8'));
    expect(receipt).toMatchObject({ cards: [drawn], failures: [] });
    expect(evaluate).toHaveBeenCalledTimes(4);
    expect(close).toHaveBeenCalledOnce();
  } finally { rmSync(out, { recursive: true, force: true }); }
});
