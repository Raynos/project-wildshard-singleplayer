// oxlint-disable-next-line import/no-nodejs-modules -- Node test invokes the offline Python CLI without models.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test reads the frozen pre-refactor JSON goldens.
import { existsSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Find the optional analysis venv for local sprite checks.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test resolves fixture and script paths.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Report the optional Python dependency skip in CI.
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const fixtures = resolve('test/fixtures/audio-scripts');
const scripts = resolve('scripts/music/gen');
const analysisPython = resolve(homedir(), 'ml/music/analysis/.venv/bin/python');
const python = existsSync(analysisPython) ? analysisPython : 'python3';
const run = (script: string, args: string[]) => execFileSync(python, [script, ...args], { encoding: 'utf8', maxBuffer: 2_000_000 });
const fixture = (name: string) => run(resolve(fixtures, 'check.py'), [name]);
const json = (output: string): unknown => JSON.parse(output);
const object = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
};

describe('audio generation scripts without models', () => {
  it('reproduces the pre-S15g Nalati rank JSON byte for byte, including voice exceptions and preview sizes', () => {
    expect(fixture('nalati')).toBe(readFileSync(resolve(fixtures, 'nalati-score.expected.json'), 'utf8'));
  });

  it('reproduces Pine Hollow merge JSON byte for byte, including ties, synth, kept-round-2 and missing takes', () => {
    expect(fixture('pine-merge')).toBe(readFileSync(resolve(fixtures, 'pine-merge.expected.json'), 'utf8'));
  });

  it('routes dot IDs and nd-tag rankings into Nine Dragon with its own decision round', () => {
    const writes = object(json(fixture('nd-merge')));
    const encoded = writes['public/assets/sfx/nine-dragon-stack/sfx.json'];
    expect(typeof encoded).toBe('string');
    if (typeof encoded !== 'string') throw new Error('Missing manifest');
    const manifest = object(json(encoded));
    expect(manifest['set']).toBe('nine-dragon-stack');
    expect(object(manifest['beds'])['nd.market']).toBeDefined();
    expect(object(manifest['hums'])['lantern']).toBeDefined();
    expect(manifest['synth_keeps']).toEqual(['skip']);
    expect(writes['public/assets/sfx/best/sfx.json']).toBeUndefined();
    expect(writes['scripts/music/gen/sfx-best.json']).toBeUndefined();
    const table = writes['scripts/music/gen/sfx-nd-best.json'];
    if (typeof table !== 'string') throw new Error('Missing decisions');
    const families = object(object(json(table))['families']);
    expect(object(families['tie'])['winner']).toBe('sa3-medium');
    expect(object(families['tie'])['round']).toBe('nine-dragon-stack');
  });

  it('ranks the three Nine Dragon slots with the Chinese-instrument probes and a 20% voice ceiling', () => {
    const doc = object(json(fixture('nd-score')));
    expect(Object.keys(object(doc['slots']))).toEqual(['nd-market', 'nd-well', 'nd-fight']);
    expect(object(doc['weights'])['instruments']).toBe(0.35);
    expect(Object.keys(object(doc['test']))).toEqual([]);
    expect(fixture('nd-score')).toContain('voice 25% of the energy');
  });

  it('leaves shared best audio and its ledger byte-identical in real full and partial own-set writes', () => {
    const output = object(json(fixture('nd-merge-write')));
    expect(output['unchanged']).toBe(true);
    expect(object(object(output['table'])['families'])['shot']).toBeDefined();
  });

  it('validates all job definitions without importing the model packages', () => {
    for (const jobs of ['sfx-ph-jobs.json', 'sfx-nd-jobs.json']) {
      expect(Object.keys(object(json(run(resolve(scripts, 'sfx_build.py'), ['--jobs', jobs, '--list'])))).length).toBeGreaterThan(0);
      expect(run(resolve(scripts, 'sfx_merge.py'), ['--jobs', jobs, '--list'])).toBe(run(resolve(scripts, 'sfx_build.py'), ['--jobs', jobs, '--list']));
    }
    const jobs = object(object(json(run(resolve(scripts, 'own_score.py'), ['list', '--set', 'nine-dragon-stack'])))['jobs']);
    expect(Object.keys(object(object(json(run(resolve(scripts, 'own_score.py'), ['list', '--set', 'nalati'])))['jobs']))).toContain('test/dombra');
    expect(Object.keys(jobs)).toEqual(['nd/nd-market', 'nd/nd-well', 'nd/nd-fight']);
    const sfx = object(json(run(resolve(scripts, 'sfx_build.py'), ['--jobs', 'sfx-nd-jobs.json', '--list'])));
    for (const surface of ['stone', 'wood', 'metal']) {
      expect(Object.keys(sfx).filter((key) => key.startsWith(`step.${surface}.`))).toHaveLength(4);
    }
    expect(Object.keys(sfx)).toHaveLength(26);
  });

  it('plans an MP3 board with shipped two-layer loops, an ear-picked alternate, stings and both sound engines', () => {
    const plan = object(json(fixture('nd-page')));
    const encodes = plan['encodes'];
    if (!Array.isArray(encodes)) throw new Error('Missing encode plan');
    expect(encodes).toHaveLength(63); // 3 built + 3 alternatives + 3 stings + 2 shipped beds + 26 families x 2 engines
    const rows = (encodes as unknown[]).map(object);
    expect(rows.every((row) => typeof row['file'] === 'string' && row['file'].endsWith('.mp3'))).toBe(true);
    expect(rows.some((row) => row['file'] === 'score/nd-market-alt-1.mp3')).toBe(true);
    expect(rows.some((row) => row['file'] === 'score/nd-market-alt-2.mp3')).toBe(false);
    const html = plan['html'];
    if (typeof html !== 'string') throw new Error('Missing page');
    expect(html).toContain('As shipped: calm, then calm + tension');
    expect(html).toContain('Powered by Stability AI');
    expect(html).not.toMatch(/src="[^"]+\.m4a"/);
  });
});

if (!existsSync(analysisPython)) process.stderr.write('audio-scripts: analysis venv missing; skipping sprite dry replay (numpy required).\n');
describe.skipIf(!existsSync(analysisPython))('existing Pine Hollow audio decisions', () => {
  it('replays cached rankings and the packed manifest without changing their JSON', () => {
    const ranks = object(json(run(resolve(scripts, 'sfx_build.py'), ['--jobs', 'sfx-ph-jobs.json', '--stage', '/tmp/unused-s15g-stage', '--dry'])));
    for (const [path, bytes] of Object.entries(ranks)) expect(bytes).toBe(readFileSync(path, 'utf8'));
    const sprite = object(json(run(resolve(scripts, 'sfx_sprite.py'), ['--set', 'pine-hollow', '--dry'])));
    expect(Object.values(sprite)).toEqual([readFileSync(resolve('public/assets/sfx/pine-hollow/sfx.json'), 'utf8')]);
  });
});
