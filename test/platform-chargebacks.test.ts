import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify retired receipts without touching the shared WIP ledger.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chargePlatformUsers, inlinePlatformPaths, inlinePlatformSpans, platformChargeback, recordPrivateCharge } from '../scripts/platform-chargebacks.mjs';
import { pendingPlatformUsers, partitionPendingPlatformUsers, type PendingPlatformUser } from '../scripts/shard-platform.mjs';
import { componentInventory } from '../scripts/shard-components.mjs';

test('optional shared dispatch does not invent another arena or keeper user', () => {
  const arena = 'src/game/boss/arenaScript.ts', phase = 'src/game/plugin/bossPhase.ts';
  const groups = 'src/game/population/pageGroups.ts';
  const both = new Set(['nalati-grasslands', 'pine-hollow']);
  const modules = new Map([[arena, both], [phase, both], [groups, both]]);
  const bindings = new Map([[`${phase}\0bossFight`, both],
    [`${groups}\0PageGroups`, both], [`${groups}\0FixedPageSpawnTable`, both]]);
  chargePlatformUsers(modules, bindings);
  expect([...modules.get(arena) ?? []]).toEqual(['nalati-grasslands']);
  expect([...bindings.get(`${groups}\0PageGroups`) ?? []]).toEqual(['nalati-grasslands']);
  expect(bindings.get(`${phase}\0bossFight`)).toEqual(both);
  expect(bindings.get(`${groups}\0FixedPageSpawnTable`)).toEqual(both);
  expect(platformChargeback('src/game/looks/staticCapture.ts', 'StaticCapture')).toBeNull();
  expect(platformChargeback('src/game/systems/viewmodel/rigArms.ts', 'RigArms')).toBeNull();
});

test('a non-shard sole user maps to its reviewed owner or reports its excluded lines', () => {
  const arena = { path: 'src/game/boss/arenaScript.ts', lines: 514 };
  const charges = new Map<string, { path: string; lines: number; name?: string }[]>([['nalati-grasslands', []]]);
  const reports: string[] = [], report = (line: string) => { reports.push(line); };
  expect(recordPrivateCharge(charges, 'fixture-only-user', arena, report)).toBe(true);
  expect(charges.get('nalati-grasslands')).toEqual([arena]);
  const outside = new Map<string, typeof arena[]>([['far-reach', []]]);
  expect(recordPrivateCharge(outside, 'fixture-only-user', arena, report)).toBe(false);
  expect(reports[0]).toContain('514 lines owned by nalati-grasslands, outside measured shards');
  expect(recordPrivateCharge(charges, 'fixture-only-user', { path: 'src/game/fixture.ts', name: 'unused', lines: 7 }, report)).toBe(false);
  expect(reports[1]).toContain('src/game/fixture.ts#unused: 7 lines owned by fixture-only-user');
  expect(charges.get('nalati-grasslands')).toEqual([arena]);
});

test('Nine pool spans charge actual source lines while instance packets remain shared', () => {
  const reports: string[] = [], selected: string[] = [];
  const charges = new Map<string, { path: string; name: string; lines: number }[]>([['nine-dragon-stack', []]]);
  for (const path of ['src/game/shardfile/worldScenes.ts', 'src/format/worldScenes.ts']) {
    const source = readFileSync(path, 'utf8'), lines = source.split('\n');
    for (const span of inlinePlatformSpans(path, source, line => { reports.push(line); })) {
      expect(platformChargeback(path, span.name)).toBe('C1');
      recordPrivateCharge(charges, 'fixture-only-user', { path, name: span.name, lines: span.lines.length });
      selected.push(...span.lines.map(line => lines[line] ?? ''));
    }
  }
  expect(reports).toEqual([]);
  expect(charges.get('nine-dragon-stack')?.reduce((sum, row) => sum + row.lines, 0)).toBe(14);
  expect(selected.join('\n')).not.toMatch(/instanceMatrix|instanceAttributes|packet/u);
});

test('reviewed Pine and Driftwood branches charge their actual owners', () => {
  const reports: string[] = [];
  const charges = new Map<string, {path: string; name: string; lines: number}[]>([['pine-hollow', []], ['driftwood-isle', []]]);
  for (const path of inlinePlatformPaths().filter(file => !file.endsWith('/worldScenes.ts'))) {
    const source = readFileSync(path, 'utf8');
    for (const span of inlinePlatformSpans(path, source, line => { reports.push(line); })) {
      expect(span.lines.length).toBeGreaterThan(0);
      expect(platformChargeback(path, span.name)).not.toBeNull();
      expect(recordPrivateCharge(charges, 'fixture-only-user', {path, name: span.name, lines: span.lines.length})).toBe(true);
    }
  }
  expect(reports).toEqual([]);
  expect(platformChargeback('src/game/systems/looks/waterSurface.ts', 'WaterTransition')).toBeNull();
  expect(platformChargeback('src/format/water.ts', 'WaterTransition')).toBeNull();
  const explorer = 'src/game/models/explorerCatalogue.ts', users = new Set(['pine-hollow', 'driftwood-isle']);
  const metadataBindings = new Map([[`${explorer}\0Presentation`, users]]);
  chargePlatformUsers(new Map(), metadataBindings);
  expect(metadataBindings.get(`${explorer}\0Presentation`)).toEqual(users);
  expect(platformChargeback(explorer, 'Presentation')).toBeNull();
  const figure = 'src/game/models/figureCatalogue.ts', hull = 'src/game/looks/speciesBook.ts';
  const both = new Set(['pine-hollow', 'driftwood-isle']);
  const bindings = new Map(['admitted','ProductFigureCatalogue','ProductFigureImports','FigureCatalogue'].map(name=>[`${figure}\0${name}`,both]));
  chargePlatformUsers(new Map([[figure, both]]), bindings);
  for(const name of ['admitted','ProductFigureCatalogue','ProductFigureImports','FigureCatalogue']) {
    expect(bindings.get(`${figure}\0${name}`)).toEqual(both);
    expect(platformChargeback(figure,name)).toBeNull();
  }
  expect(inlinePlatformPaths()).not.toContain(figure);
  expect(platformChargeback(hull, 'HullLookBook')).toBeNull();
  expect(platformChargeback('src/engine/models/geometryPack.ts', 'GeometryPack')).toBeNull();
});

test('the packed geometry loader charges Pine; the product posed loader has a real second user', () => {
  const geometry = 'src/engine/models/geometrySources.ts', posed = 'src/game/looks/posedInstances.ts';
  const both = new Set(['pine-hollow', 'nalati-grasslands']);
  const bindings = new Map([
    [`${geometry}\0registerPackedGeometrySource`, both], [`${geometry}\0readGeometrySource`, both],
    [`${posed}\0PosedLibrary`, both], [`${posed}\0PosedDraw`, both], [`${posed}\0PosedInstances`, both],
  ]);
  const modules = new Map([[geometry, both], [posed, both]]);
  chargePlatformUsers(modules, bindings);
  expect([...bindings.get(`${geometry}\0registerPackedGeometrySource`) ?? []]).toEqual(['pine-hollow']);
  expect(platformChargeback(geometry, 'registerPackedGeometrySource')).toBe('C1');
  // G520 re-score (625514ff80): Driftwood's Explorer gull card is a product posed library row read by the same loader
  for (const [path, name] of [[geometry, 'readGeometrySource'], [posed, 'PosedLibrary'], [posed, 'ProductPosedLibrary'], [posed, 'PosedDraw'], [posed, 'PosedInstances']] as const) {
    if (bindings.has(`${path}\0${name}`)) expect(bindings.get(`${path}\0${name}`)).toEqual(both);
    expect(platformChargeback(path, name)).toBeNull();
  }
  expect(modules.get(geometry)).toEqual(both); expect(modules.get(posed)).toEqual(both);
  expect(inlinePlatformPaths()).not.toContain(posed);
  const driftwood = readFileSync('src/shards/driftwood-isle/generators/explorerCatalogue.ts', 'utf8');
  expect(driftwood).toMatch(/kind:'posed',file:'[^']+',source:'product'/u);
});

test('day-one feature credit cannot erase a G520 chargeback', () => {
  const path = 'src/game/looks/painterlyLook.ts';
  const allowance: PendingPlatformUser = { module: path, documentation: 'docs/HOST-BAR.md',
    approvedFeature: { name: 'painterly look host', decision: { path: 'docs/plans/shard-platform/decisions.md', row: 'G478' } } };
  const painterly = { path, name: 'PainterlyWorld', exported: true, lines: 40 };
  const rows = [painterly,
    { path, name: 'PaintedPanorama', exported: true, lines: 80 }];
  const result = partitionPendingPlatformUsers('nalati-grasslands', [], rows, [allowance]);
  expect(result.exports).toEqual([rows[0]]);
  expect(result.pending.map(row => row.name)).toEqual(['PaintedPanorama']);
  const single = partitionPendingPlatformUsers('nalati-grasslands', [{ path, lines: 200 }], [painterly], [allowance]);
  expect(single.exports).toEqual([rows[0]]);
  expect(single.pending.map(row => row.lines)).toEqual([160]);
  const unapproved = partitionPendingPlatformUsers('nalati-grasslands', [{ path, lines: 200 }], [painterly], []);
  expect(unapproved.modules).toEqual([{ path, lines: 200 }]);
  expect(unapproved.exports).toEqual([]);
});

test('chargebacks retain their exact component after guest admission', () => {
  const sources = [
    { path: 'src/game/models/mountedSpecimen.ts', kind: 'sole-module', lines: 27 },
    { path: 'src/game/looks/painterlyLook.ts', name: 'PainterlyWorld', kind: 'sole-export', lines: 40 },
  ] as const;
  const inventory = componentInventory('.', 'nalati-grasslands', [...sources], 67);
  expect(inventory.counts.C4).toBe(0);
  expect(inventory.counts.C1).toBe(27); expect(inventory.counts.C7).toBe(0);
  expect(inventory.counts.C2).toBe(40);
  expect(inventory.unknown).toEqual([]);
});

test('whole-module cuts retire their old receipts while unknown missing modules still refuse', () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync('tmp/retired-host-test-');
  try {
    mkdirSync(`${root}/lint`); mkdirSync(`${root}/docs/plans/shard-platform`, { recursive: true });
    writeFileSync(`${root}/docs/plans/shard-platform/decisions.md`, '| G475 | approved toon |');
    const receipt = (module: string): PendingPlatformUser => ({ module, documentation: 'docs/ENGINE.md',
      approvedFeature: { name: 'toon look host', decision: { path: 'docs/plans/shard-platform/decisions.md', row: 'G475' } } });
    const put = (modules: string[]) => writeFileSync(`${root}/lint/platform-pending-users.json`, JSON.stringify({
      schema: 'platform-pending-users/1', entries: modules.map(receipt),
    }));
    put(['src/engine/models/glbNodes.ts', 'src/game/shardfile/buildingAssembly.ts']);
    expect(pendingPlatformUsers(root)).toEqual([]);
    put(['src/game/missing.ts']); expect(() => pendingPlatformUsers(root)).toThrow('ENOENT');
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('shared practice lifetime preserves each real controller charge', () => {
  const path = 'src/game/practice/course.ts', both = new Set(['nalati-grasslands', 'nine-dragon-stack']);
  const names = ['PracticeCourse', 'MountedCourseController', 'HookCourseController', 'hookCoursePad'];
  const modules = new Map([[path, both]]), bindings = new Map(names.map(name => [`${path}\0${name}`, both]));
  chargePlatformUsers(modules, bindings);
  expect(modules.get(path)).toEqual(both);
  expect(bindings.get(`${path}\0PracticeCourse`)).toEqual(both);
  for (const name of ['MountedCourseController']) {
    expect([...bindings.get(`${path}\0${name}`) ?? []]).toEqual(['nalati-grasslands']);
    expect(platformChargeback(path, name)).toBe('C6');
  }
  for (const name of ['HookCourseController', 'hookCoursePad']) {
    expect([...bindings.get(`${path}\0${name}`) ?? []]).toEqual(['nine-dragon-stack']);
    expect(platformChargeback(path, name)).toBe('C6');
  }
  const charges = new Map<string, {path: string; name: string; lines: number}[]>([['nalati-grasslands', []], ['nine-dragon-stack', []]]);
  for (const name of names.slice(1)) recordPrivateCharge(charges, 'fixture', {path, name, lines: 1});
  expect(charges.get('nalati-grasslands')?.map(row => row.name)).toEqual(['MountedCourseController']);
  expect(charges.get('nine-dragon-stack')?.map(row => row.name)).toEqual(['HookCourseController', 'hookCoursePad']);
});

test('the single slot roster stays charged despite an optional dispatcher',()=>{
  const path='src/game/boss/encounterView.ts',both=new Set(['nalati-grasslands','pine-hollow']);
  const modules=new Map([[path,both]]),bindings=new Map([[`${path}\0SlotEncounterView`,both],[`${path}\0PatrolEncounterView`,both],[`${path}\0CloudBody`,both]]);
  chargePlatformUsers(modules,bindings);
  expect([...bindings.get(`${path}\0SlotEncounterView`)??[]]).toEqual(['nalati-grasslands']);
  expect([...bindings.get(`${path}\0PatrolEncounterView`)??[]]).toEqual(['nalati-grasslands']);
  expect(bindings.get(`${path}\0CloudBody`)).toEqual(both);expect(platformChargeback(path,'SlotEncounterView')).toBe('C4');
});


test('shared hull imports grant no second user to the packed species adapter',()=>{
  const path='src/game/looks/speciesBook.ts',format='src/format/speciesLooks.ts',both=new Set(['nalati-grasslands','pine-hollow']);
  const modules=new Map([[path,both],[format,both]]),bindings=new Map([
    [`${path}\0HullLookBook`,both],[`${path}\0SpeciesLookBook`,both],[`${path}\0packedRows`,both],
    [`${format}\0HullLookBookSchema`,both],
  ]);
  chargePlatformUsers(modules,bindings);
  for(const [file,name]of [[path,'SpeciesLookBook'],[path,'packedRows']]as const){
    expect([...bindings.get(`${file}\0${name}`)??[]]).toEqual(['nalati-grasslands']);
    expect(platformChargeback(file,name)).toBe('C1');
  }
  expect(bindings.get(`${path}\0HullLookBook`)).toEqual(both);
  expect(bindings.get(`${format}\0HullLookBookSchema`)).toEqual(both);
  expect(platformChargeback(path,'HullLookBook')).toBeNull();
  expect(platformChargeback(format,'HullLookBookSchema')).toBeNull();
  expect(modules.get(path)).toEqual(both);expect(modules.get(format)).toEqual(both);
  const charges=new Map<string,{path:string;name:string;lines:number}[]>([['nalati-grasslands',[]]]);
  expect(recordPrivateCharge(charges,'fixture',{path,name:'SpeciesLookBook',lines:7})).toBe(true);
  expect(charges.get('nalati-grasslands')?.map(row=>row.name)).toEqual(['SpeciesLookBook']);
});


test('G571 placed actor binding is platform while wildlife rules stay charged',()=>{
  const path='src/game/population/pageGroups.ts',broad=new Set(['nalati-grasslands','driftwood-isle','pine-hollow']);
  const names=['Placement','Counts','PageActorGroups','PagePopulationPlanner','PageGroups'];
  const bindings=new Map(names.map(name=>[`${path}\0${name}`,broad]));
  chargePlatformUsers(new Map(),bindings);
  for(const name of names){
    const placed=['Placement','Counts','PageActorGroups'].includes(name);
    expect(bindings.get(`${path}\0${name}`)).toEqual(placed?broad:new Set(['nalati-grasslands']));
    expect(platformChargeback(path,name)).toBe(placed?null:'C4');
    const row={path,name,lines:7},charges=new Map<string,typeof row[]>([['nalati-grasslands',[]]]);
    expect(recordPrivateCharge(charges,'fixture-only-user',row)).toBe(!placed);
    expect(charges.get('nalati-grasslands')).toEqual(placed?[]:[row]);
  }
});


test('coin-enabled users do not lend Driftwood a second rich Bag user',()=>{
 const shared=new Set(['driftwood-isle','ink-cel-valley']),path='src/game/loot/runtime.ts',bindings=new Map([[`${path}\0enteredLootPresentation`,shared],[`${path}\0LootBagProjection`,shared]]);
 chargePlatformUsers(new Map([[path,shared]]),bindings);
 expect(bindings.get(`${path}\0enteredLootPresentation`)).toEqual(shared);
 expect([...bindings.get(`${path}\0LootBagProjection`)??[]]).toEqual(['driftwood-isle']);
 const charges=new Map<string,{path:string;name:string;lines:number}[]>([['driftwood-isle',[]]]),reports:string[]=[],selected:string[]=[];
 for(const file of [path,'src/format/lootEconomy.ts']){const source=readFileSync(file,'utf8'),lines=source.split('\n');
  for(const span of inlinePlatformSpans(file,source,line=>{reports.push(line);})){expect(platformChargeback(file,span.name)).toBe('C6');expect(recordPrivateCharge(charges,'fixture',{path:file,name:span.name,lines:span.lines.length})).toBe(true);selected.push(...span.lines.map(index=>lines[index]??''));}
 }
 expect(reports).toEqual([]);expect(charges.get('driftwood-isle')).toHaveLength(2);
 expect(selected.join('\n')).toContain('health.attributes.maxHealth');expect(selected.join('\n')).toContain('cosmetics.map');
 expect(selected.join('\n')).not.toContain('const basic=');expect(selected.join('\n')).not.toContain('export function enteredLootPresentation');
});


test('optional chapter dispatch preserves the carried and merged-figure owners', () => {
  const carried = 'src/game/quest/carriedProp.ts', figures = 'src/game/systems/npc/figureRows.ts';
  const shared = new Set(['pine-hollow', 'driftwood-isle', 'nalati-grasslands']);
  const moduleUsers = new Map([[carried, shared], [figures, shared]]);
  const names = ['FigureGroupMember', 'FigureGroup', 'memberPose', 'enterFigureGroup'];
  const bindings = new Map([...names, 'FigureRows'].map(name => [`${figures}\0${name}`, shared]));
  chargePlatformUsers(moduleUsers, bindings);
  expect([...moduleUsers.get(carried) ?? []]).toEqual(['nalati-grasslands']);
  expect(moduleUsers.get(figures)).toEqual(shared);
  for (const name of names) expect([...bindings.get(`${figures}\0${name}`) ?? []]).toEqual(['nalati-grasslands']);
  expect(bindings.get(`${figures}\0FigureRows`)).toEqual(shared);
});


test('optional chapter imports retain all native dependency owners', () => {
  const rows: readonly (readonly [string, readonly string[] | null])[] = [["src/engine/physics/heightPatch.ts", null], ["src/engine/combat/effects/types.ts", ["SourceMulDef", "anyTag", "sourceMultiplier"]], ["src/game/loadout/actors.ts", ["EquipmentActorOwner", "owners", "equipmentActorOwner", "equipmentAnimals"]], ["src/game/quest/chapter.ts", ["installChapterStory"]], ["src/game/shardfile/clientTrails.ts", ["ProjectedTrail"]], ["src/game/systems/npc/figureSkins.ts", ["atlasFigureSkin"]], ["src/game/weapons/heldLauncher.ts", ["names", "PoolSchema", "HeldBowFileSchema", "bowLoads", "loadHeldBow"]]];
  const shared = new Set(['pine-hollow', 'driftwood-isle', 'nalati-grasslands']);
  const modules = new Map(rows.map(([path]) => [path, shared]));
  const bindings = new Map(rows.flatMap(([path, names]) => [...(names ?? []), 'unrelatedShared'].map(name => [`${path}\0${name}`, shared])));
  chargePlatformUsers(modules, bindings);
  for (const [path, names] of rows) {
    expect(modules.get(path)).toEqual(names === null ? new Set(['nalati-grasslands']) : shared);
    for (const name of names ?? []) expect(bindings.get(`${path}\0${name}`)).toEqual(new Set(['nalati-grasslands']));
    expect(bindings.get(`${path}\0unrelatedShared`)).toEqual(shared);
  }
});
