// oxlint-disable-next-line import/no-nodejs-modules -- The architecture guard reads small isolated source fixtures.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All fixture files stay under the repository's ignored tmp directory.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { clientPlanSchemaViolations } from '../lint/client-plan-boundary.mjs';

function fixture(run: (root: string, nested: (source: string) => void) => void): void {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp/client-plan-schema-'));
  mkdirSync(resolve(root, 'src/format'), { recursive: true });
  mkdirSync(resolve(root, 'src/game/shardfile'), { recursive: true });
  writeFileSync(resolve(root, 'src/format/clientPlan.ts'), 'export const ClientPlanSchema = {version:1};');
  writeFileSync(resolve(root, 'src/game/shardfile/clientPlan.ts'), "export const FEATURES={view:{sections:['fixture/rows']}};");
  writeFileSync(resolve(root, 'src/format/platformDataSections.ts'), "import { Schema } from './nested'; export const PLATFORM_DATA_SECTIONS={'fixture/rows':{schema:Schema}} as const;");
  try { run(root, source => { writeFileSync(resolve(root, 'src/format/nested.ts'), source); }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test('client feature guard follows required section schemas without charging unrelated legacy schemas', () => {
  fixture((root, nested) => {
    nested("const borrowed={owner:'runtime',path:['method']}; export const Legacy=borrowed; export const Schema={name:'safe'};");
    expect(clientPlanSchemaViolations(root)).toEqual([]);
    nested("const borrowed={owner:'runtime',path:['method']}; export const Schema=borrowed;");
    expect(clientPlanSchemaViolations(root)).toEqual([expect.stringContaining('reflected {owner,path}')]);
    writeFileSync(resolve(root, 'src/format/loan.ts'), 'const loan={owner:"runtime",path:[]};export default loan;');
    nested("import loan from './loan'; export const Schema=loan;");
    expect(clientPlanSchemaViolations(root)).toEqual([expect.stringContaining('reflected {owner,path}')]);
  });
});

test('borrowed-owner types and executable dependency lists cannot hide a schema escape', () => {
  fixture((root, nested) => {
    nested('interface BorrowedOwnerPath {owner:string;path:string[]} export const Schema: BorrowedOwnerPath = {owner:"runtime",path:[]};');
    expect(clientPlanSchemaViolations(root)).toEqual(expect.arrayContaining([expect.stringContaining('BorrowedOwnerPath')]));
    nested('export const Schema={name:"safe"};');
    writeFileSync(resolve(root, 'src/game/shardfile/clientPlan.ts'), 'export const FEATURES={view:{sections:getSections()}};');
    expect(clientPlanSchemaViolations(root)).toEqual([expect.stringContaining('literal section names')]);
  });
});
