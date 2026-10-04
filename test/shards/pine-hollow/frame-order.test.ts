import { describe, expect, it } from 'vitest';
import { App } from '../../../src/engine/app/app';

const source = Object.values(import.meta.glob<string>('../../../src/shards/pine-hollow/combat/install.ts', { query: '?raw', import: 'default', eager: true }))[0] ?? '';

describe('Pine encounter frame order', () => {
  it('spawns the lair actors before the first split world/creature pass synchronizes their hitboxes', () => {
    const declaration = /id: 'elites', phase: 'update', before: \[([^\]]+)\]/u.exec(source)?.[1];
    expect(declaration).toBeDefined();
    const before = Array.from((declaration ?? '').matchAll(/'([^']+)'/gu), (match) => match[1] ?? '');
    const app = new App(), scope = app.engineScope.child('level'), seen: string[] = [];
    let actors = 0, hitboxes = 0;
    app.addSystem({ id: 'main.world', phase: 'update', run: () => { seen.push('world'); } }, scope);
    app.addSystem({ id: 'engine.creatures.update', phase: 'update', after: ['main.world'], before: ['main.frame'], run: () => { hitboxes = actors * 2; seen.push('creatures'); } }, scope);
    app.addSystem({ id: 'main.frame', phase: 'update', after: ['engine.creatures.update'], run: () => { seen.push('frame'); } }, scope);
    // Plugin registration occurs after the shell's passes; the authored edges retain the old order.
    app.addSystem({ id: 'elites', phase: 'update', before, run: () => { actors = 4; seen.push('elites'); } }, scope);
    for (const system of app.systemsByPhase().update) system.run(1 / 60, 1 / 60);
    expect(seen).toEqual(['elites', 'world', 'creatures', 'frame']);
    expect(hitboxes).toBe(8);
    app.engineScope.dispose();
  });
});
