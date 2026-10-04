// oxlint-disable-next-line import/no-nodejs-modules -- The closure fixtures own isolated temporary repositories.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Portable temporary fixture paths.
import { join, dirname } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the platform's temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual oxlint plugin, not a mock.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Run subprocesses with the same Node binary.
import { execPath, cwd } from 'node:process';
import { afterEach, describe, expect, it } from 'vitest';
import { simClosure, simRoot } from '../lint/sim-closure.mjs';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sim-closure-')); roots.push(root);
  for (const [file, text] of Object.entries(files)) { const at = join(root, file); mkdirSync(dirname(at), { recursive: true }); writeFileSync(at, text); }
  return root;
}
describe('SF3a headless import closure', () => {
  it('rejects a planted transitive render import through the actual lint rule', () => {
    const root = fixture({ 'src/engine/ai/brain.ts': "import { mesh } from '../entities/helper'; export const brain = mesh;", 'src/engine/entities/helper.ts': "import { Mesh } from 'three'; export const mesh = new Mesh();" });
    const violations = simClosure(root);
    expect(violations.map((v) => v.id)).toEqual(['src/engine/entities/helper.ts:import:three']);
    expect(violations[0]?.trace).toEqual(['src/engine/ai/brain.ts', 'src/engine/entities/helper.ts']);
    const lint = spawnSync(execPath, [join(cwd(), 'node_modules/oxlint/bin/oxlint'), '-c', join(cwd(), '.oxlintrc.ratchet.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8' });
    expect(lint.status, lint.stderr).toBe(1);
    const result = JSON.parse(lint.stdout) as { diagnostics: { code: string; message: string }[] };
    expect(result.diagnostics.some((d) => d.code === 'wildshard(sim-no-render)' && d.message.includes('helper.ts:import:three'))).toBe(true);
  });
  it('follows package imports, cycles and reexports; erased type dependencies stay erased', () => {
    const root = fixture({ 'src/shards/example/behaviour/brain.ts': "import { v } from '@wildshard/engine/ai/helper'; export const brain = v;", 'src/engine/ai/helper.ts': "export { v } from '../entities/value'; import type { Render } from '../entities/render';", 'src/engine/entities/value.ts': "import '../ai/helper'; import { Vector3 } from 'three'; export const v = new Vector3();", 'src/engine/entities/render.ts': "import { Mesh } from 'three'; export type Render = Mesh;" });
    expect(simClosure(root)).toEqual([]);
  });
  it('rejects DOM, runtime, tier, cost, view and dynamic dependencies outside sim folders', () => {
    const root = fixture({ 'src/engine/ai/brain.ts': "import '../entities/helper';", 'src/engine/entities/helper.ts': "import '../app/runtime'; import '../core/tier'; import '../core/frameCost'; import '../ai/view/debug'; document.createElement('div'); void import('./' + 'other');", 'src/engine/app/runtime.ts': 'export {};', 'src/engine/core/tier.ts': 'export {};', 'src/engine/core/frameCost.ts': 'export {};', 'src/engine/ai/view/debug.ts': 'export {};' });
    expect(simClosure(root).map((v) => v.id)).toEqual(expect.arrayContaining(['src/engine/entities/helper.ts:import:src/engine/app/runtime.ts', 'src/engine/entities/helper.ts:import:src/engine/core/tier.ts', 'src/engine/entities/helper.ts:import:src/engine/core/frameCost.ts', 'src/engine/entities/helper.ts:global:document', 'src/engine/entities/helper.ts:import:dynamic', 'src/engine/entities/helper.ts:import:src/engine/ai/view/debug.ts']));
  });
  it('admits only the reviewed pure material schema leaf and guards its transitive dependencies', () => {
    const base = { 'src/engine/ai/brain.ts': "import '../render/families/params';", 'src/engine/render/families/params.ts': "import * as v from 'valibot'; export const schema = v.number();" };
    expect(simClosure(fixture(base))).toEqual([]);
    for (const body of ["import { Vector3 } from 'three';", "document.createElement('div');", "import '../pbr';"]) {
      const root = fixture({ ...base, 'src/engine/render/families/params.ts': body, 'src/engine/render/pbr.ts': 'export {};' });
      expect(simClosure(root)).toHaveLength(1);
    }
    const root = fixture({ ...base, 'src/engine/render/families/params.ts': "import '../../entities/value';", 'src/engine/entities/value.ts': "import { Vector3 } from 'three';" });
    expect(simClosure(root).map((v) => v.id)).toEqual(['src/engine/entities/value.ts:import:three']);
    const reviewed = JSON.parse(readFileSync('lint/sim-schema-leaves.json', 'utf8')) as Record<string, { owner: string; reason: string; removal: string }>;
    expect(Object.keys(reviewed)).toEqual(['src/engine/render/families/params.ts']);
    expect(reviewed['src/engine/render/families/params.ts']?.owner).toBe('SF16');
  });
  it('guards authored template data and behaviour while excluding build-time views', () => {
    expect(simRoot('src/shards/_template/data/creatures.ts')).toBe(true);
    expect(simRoot('src/shards/_template/behaviour/hooks.ts')).toBe(true);
    expect(simRoot('src/shards/_template/generators/world.ts')).toBe(false);
    expect(simRoot('src/engine/combat/view/melee.ts')).toBe(false);
    expect(simRoot('src/engine/quest/view.ts')).toBe(false);
  });
  it('guards every native sim module, including readiness and the pure highway strip generator', () => {
    expect(simRoot('src/engine/sim/readiness.ts')).toBe(true);
    expect(simRoot('src/engine/sim/strips.ts')).toBe(true);
    const root = fixture({ 'src/engine/sim/strips.ts': "import '../entities/helper';", 'src/engine/entities/helper.ts': "import { Mesh } from 'three';" });
    expect(simClosure(root).map((v) => v.id)).toEqual(['src/engine/entities/helper.ts:import:three']);
  });
  it('keeps creature simulation and the remaining engine/kit closure free of rendering', () => {
    expect(simClosure(cwd(), ['src/engine/entities/AnimalSim.ts'])).toEqual([]);
    expect(simClosure(cwd()).filter((site) => /^src\/(?:engine|kit)\//u.test(site.id))).toEqual([]);
  });
  it('measures every allowance and assigns a removing row', () => {
    const list = JSON.parse(readFileSync('lint/sim-closure.json', 'utf8')) as { violations: Record<string, { count: number; row: string }> };
    expect(Object.fromEntries(simClosure(cwd()).map((v) => [v.id, v.count]))).toEqual(Object.fromEntries(Object.entries(list.violations).map(([id, v]) => [id, v.count])));
    for (const v of Object.values(list.violations)) expect(v.row).toMatch(/^SF\d+[a-z]?$/u);
  });
});
