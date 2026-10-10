// oxlint-disable-next-line import/no-nodejs-modules -- Resolve actual defining source modules for the native closure check.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- The closure is rooted in the test checkout, without browser globals.
import { cwd } from 'node:process';
import ts from '@typescript/typescript6';
import { expect, it } from 'vitest';

it('keeps the three migrated weapon defining closures free of kit and build-time commons', () => {
  const root = cwd();
  const config = ts.readConfigFile(resolve(root, 'tsconfig.json'), file => ts.sys.readFile(file));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const files = [
    'src/shards/nalati-grasslands/runtime/weapons/Rifle.ts',
    'src/shards/pine-hollow/runtime/weapons/LeverRifle.ts',
    'src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow.ts',
  ];
  const program = ts.createProgram(files.map(file => resolve(root, file)), { ...parsed.options, noEmit: true });
  const closure = program.getSourceFiles().map(file => file.fileName.replaceAll('\\', '/'));
  expect(closure.filter(file => file.startsWith(`${root}/src/kit/`) || file.startsWith(`${root}/src/commons/`))).toEqual([]);
  for (const file of files) expect(closure).toContain(resolve(root, file));
  expect(closure).toContain(resolve(root, 'src/sdk/runtime/weapons/Firearm.ts'));
  // SF36: the crossbow is a row over the SDK's bolt crossbow family (the family, not a shard subclass, extends the platform Weapon)
  expect(closure).toContain(resolve(root, 'src/sdk/items/boltCrossbow.ts'));
  expect(closure).toContain(resolve(root, 'src/game/systems/items/boltCrossbow.ts'));
  expect(closure).toContain(resolve(root, 'src/engine/combat/Firearm.ts'));
  expect(closure).toContain(resolve(root, 'src/engine/combat/Weapon.ts'));
});
