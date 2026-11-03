import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Bind actual fixture image bytes to their capture receipts.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the CLI's real file admission and stale-image refusal.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine generated fixtures to an owned repository scratch root.
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseDomeCameras } from '../scripts/dome-cameras.mjs';
import { readCapturePlans, ringJunctionPlan, selectCapturePlots } from '../scripts/open-plots/capture-inputs.mjs';
import { admitBoardCapture, boardText, makeDomeBoards } from '../scripts/open-plots/boards.mjs';

const registry = [
  { slug: 'open-plot-night-market', instance: 'open-plot-nw', cameras: 'art/open-plots/night-market/domes' },
  { slug: 'open-plot-lantern-bayou', instance: 'open-plot-0-1', cameras: 'art/open-plots/lantern-bayou/domes' },
  { slug: 'open-plot-showcase-template', instance: 'open-plot-2-4', cameras: 'art/open-plots/showcase-template/domes' },
] as const;

test('plot selection preserves caller order and refuses ambiguous, missing and unsafe identities', () => {
  const input = {schema:'open-plot-captures/1',plots:registry};
  expect(selectCapturePlots(input, [registry[2].slug, registry[0].slug])).toEqual([registry[2], registry[0]]);
  for (const names of [[], ['missing'], [registry[0].slug, registry[0].slug]]) expect(() => selectCapturePlots(input, names)).toThrow();
  for (const rows of [[...registry, registry[0]], [{ ...registry[0], cameras: '../foreign' }],
    [{ ...registry[0], instance: '../out' }], [{ ...registry[0], extra: true }],
    [registry[0], { ...registry[1], instance: registry[0].instance }]]) expect(() => selectCapturePlots({...input,plots:rows}, [registry[0].slug])).toThrow();
  for (const changed of [registry,{...input,schema:'foreign'},{...input,extra:true}]) expect(() => selectCapturePlots(changed,[registry[0].slug])).toThrow();
});

const capture = {
  source: 'a'.repeat(40), slug: registry[0].slug, instance: registry[0].instance, milestone: 'OP4',
  domes: [{ dome: 'A1-road-stand', complete: true, errors: [], cameras:{convention:'TEMPLATE camera method'},
    views: Array.from({ length: 9 }, (_, index) => ({ n: index + 1, name: `View ${index + 1}`, imageSha256: 'b'.repeat(64) })) }],
} as const;

test('board admission cannot turn a partial, duplicate, failed or reordered capture into a sheet', () => {
  expect(admitBoardCapture(capture)).toEqual(capture);
  const dome = capture.domes[0];
  for (const changed of [{ ...dome, complete: false }, { ...dome, errors: ['context lost'] },
    { ...dome, views: dome.views.slice(1) }, { ...dome, views: [...dome.views].reverse() },
    { ...dome, views: dome.views.map(view => ({ ...view, imageSha256: '' })) }]) {
    expect(() => admitBoardCapture({ ...capture, domes: [changed] })).toThrow();
  }
  expect(() => admitBoardCapture({ ...capture, domes: [dome, dome] })).toThrow();
  expect(() => admitBoardCapture({ ...capture, slug: '../other' })).toThrow();
});

test('plot and view labels remain literal text on the board', () => {
  expect(boardText('<plot & "view">')).toBe('&lt;plot &amp; &quot;view&quot;&gt;');
});

test('ring junction selection binds all four real neighbours and the served pitch', () => {
  const cells = ([[-2,-2],[-1,-2],[-2,-1],[-1,-1]] as const).map((cell, index) => ({
    instance: `cell-${index}`, slug: registry[index % 3]?.slug ?? registry[0].slug, cell: [cell[0], cell[1]] as const,
  }));
  const grid = {pitch:562.5, cells}, duplicate = cells[1];
  if (duplicate === undefined) throw new Error('Missing junction fixture');
  expect(ringJunctionPlan(grid, {x:-1.5,z:-1.5})).toEqual({anchor:{x:-843.75,z:-843.75,instance:null}, neighbours:cells});
  for (const at of [{x:-1,z:-1.5},{x:Number.NaN,z:-1.5},{x:-0.5,z:-1.5}]) expect(() => ringJunctionPlan(grid, at)).toThrow();
  expect(() => ringJunctionPlan({...grid,cells:cells.slice(1)}, {x:-1.5,z:-1.5})).toThrow('four');
  expect(() => ringJunctionPlan({...grid,cells:[...cells.slice(1),duplicate]}, {x:-1.5,z:-1.5})).toThrow('distinct');
  expect(() => ringJunctionPlan({...grid,pitch:500}, {x:-1.5,z:-1.5})).toThrow('lattice');
});

// Camera fixtures remain available in the sparse CI checkout; no browser or new art input.
test('all eight manifests are admitted in requested order with exact source hashes', () => {
  mkdirSync('tmp', {recursive:true});
  const folder = mkdtempSync(join(resolve('tmp'), 'op4-camera-test-'));
  try {
    const fixtures = import.meta.glob<unknown>('./fixtures/night-market-domes/*.json', {eager:true,import:'default'});
    for (const value of Object.values(fixtures)) {
      const cameras = parseDomeCameras(value), directory = join(folder, cameras.dome);
      mkdirSync(directory); writeFileSync(join(directory, 'cameras.json'), JSON.stringify(cameras));
    }
    const target = { ...registry[0], cameras: '.' };
    const rows = readCapturePlans(target, undefined, folder);
    expect(rows.map(row => row.cameras.dome.slice(0, 2))).toEqual(['A1','A2','B1','B2','C1','C2','D1','D2']);
    expect(rows.every(row => /^[a-f0-9]{64}$/u.test(row.sha256))).toBe(true);
    expect(readCapturePlans(target, ['D2','A1'], folder).map(row => row.cameras.dome.slice(0, 2))).toEqual(['D2','A1']);
    expect(() => readCapturePlans(target, [], folder)).toThrow('selection');
    expect(() => readCapturePlans(target, ['A1', 'A1'], folder)).toThrow('selection');
    expect(() => readCapturePlans(target, ['E1'], folder)).toThrow('selection');
  } finally {rmSync(folder,{recursive:true,force:true});}
});

test('the independent board maker binds real image bytes and refuses changed captures', async () => {
  mkdirSync('tmp', {recursive:true});
  const folder = mkdtempSync(join(resolve('tmp'), 'op4-board-test-'));
  try {
    const dome = capture.domes[0], directory = join(folder, dome.dome);
    mkdirSync(directory);
    const views = [];
    for (const view of dome.views) {
      const bytes = await sharp({create:{width:402,height:603,channels:3,background:{r:view.n*20,g:40,b:70}}}).jpeg().toBuffer();
      writeFileSync(join(directory, `view-${view.n}.jpg`), bytes);
      views.push({...view,imageSha256:createHash('sha256').update(bytes).digest('hex')});
    }
    writeFileSync(join(folder, 'capture.json'), JSON.stringify({...capture,domes:[{...dome,views}]}));
    const sheets = await makeDomeBoards(folder), sheet = sheets[0];
    expect(sheets).toHaveLength(1);
    if (sheet === undefined) throw new Error('Missing board');
    expect(sheet.bytes).toBeLessThanOrEqual(500000);
    expect(createHash('sha256').update(readFileSync(sheet.file)).digest('hex')).toBe(sheet.sha256);
    expect(await sharp(sheet.file).metadata()).toMatchObject({width:1206,height:1849,format:'jpeg'});
    writeFileSync(join(directory,'view-1.jpg'), 'changed');
    await expect(makeDomeBoards(folder)).rejects.toThrow('Changed capture image');
  } finally {rmSync(folder,{recursive:true,force:true});}
});
