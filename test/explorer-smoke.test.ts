// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { explorerCards, explorerCases, explorerFailures } from '../scripts/parity/explorer-smoke.mjs';
import { legacyDouble } from './fake/FakeGame';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify the actual required workflow leg, without dispatching it.
import { readFileSync } from 'node:fs';

const catalogue = [
  {slug:'driftwood-isle',status:'live',legacy:false},
  {slug:'sunscar-dunes',status:'experimental',legacy:false},
  {slug:'nine-dragon-stack',status:'experimental',legacy:false},
  {slug:'_template',status:'hidden',legacy:false},
  {slug:'open-plot-alien-plain',status:'hidden',legacy:false,shardSelect:false},
  {slug:'driftwood-isle-legacy',status:'live',legacy:true},
];

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
