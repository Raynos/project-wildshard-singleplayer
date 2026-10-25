// oxlint-disable-next-line import/no-nodejs-modules -- Inspect defining contracts without a product build.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten declaration consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

test('Explorer catalogue emits isolated data contracts without variant implementation types',()=>{
 const emitted=ts.transpileDeclaration(readFileSync('src/format/explorerCatalogue.ts','utf8'),{
  fileName:'explorerCatalogue.ts',reportDiagnostics:true,
  compilerOptions:{isolatedDeclarations:true,strict:true,exactOptionalPropertyTypes:true},
 });
 expect(emitted.diagnostics).toEqual([]);
 expect(emitted.outputText.length).toBeLessThan(15_000);
 expect(emitted.outputText).not.toContain('VariantSchema');
 expect(emitted.outputText).toContain('v.GenericSchema<ExplorerCatalogueInput, ExplorerCatalogue>');
});

test('weapon and catalogue consumers keep entry metadata, readonly contacts and discriminated rows',()=>{
 const consumer=resolve('src/format/t4-weapon-catalogue-consumer.ts');
 let source=`import * as v from 'valibot';
import {HeldBowDefinitionSchema,HeldModelRowsSchema,ConeWeaponProfileSchema,MeleeWeaponProfileSchema,BowWeaponProfileSchema,FirearmWeaponProfileSchema,ThrownWeaponProfileSchema,LashWeaponProfileSchema,type MeleeContactRow,type WeaponProfile,type HeldFirearmViewRows} from './weaponProfiles';
import {ExplorerCatalogueSchema,type ExplorerEntryRow} from './explorerCatalogue';
export const families=v.variant('family',[MeleeWeaponProfileSchema,BowWeaponProfileSchema,FirearmWeaponProfileSchema,ThrownWeaponProfileSchema,LashWeaponProfileSchema,ConeWeaponProfileSchema]);
export const bow=v.object(HeldBowDefinitionSchema.entries);
export const model=v.object({...HeldModelRowsSchema.entries});
export const tag=ConeWeaponProfileSchema.entries.gust.entries.tags.pipe[0].item;
declare const contact:MeleeContactRow;
export const times:readonly number[]=contact.lands;
export const tags:readonly \`\${string}.\${string}\`[]=contact.hits[0]?.tags??[];
export function damage(profile:WeaponProfile):number{
 if(profile.family==='melee')return profile.damage;
 if(profile.family==='cone')return profile.gust.damage;
 if(profile.family==='bow'||profile.family==='firearm')return profile.damageScale;
 if(profile.family==='thrown')return profile.damage;
 return profile.timing.pull;
}
export function library(row:ExplorerEntryRow):string|undefined{
 if(row.kind==='library')return row.library;
 if(row.kind==='kit-figure'&&'atlases'in row)return Object.keys(row.atlases)[0];
 return undefined;
}
export const authored:v.InferInput<typeof ExplorerCatalogueSchema>=null;
declare const firearm:HeldFirearmViewRows;
export const extra:unknown=firearm.extra;
export const contactMove:readonly MeleeContactRow[]=[contact];
`;
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual weapon/catalogue consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=`export const wrongKind:ExplorerEntryRow={kind:'unknown'};
export const badTag:v.InferOutput<typeof tag>='plain';
contact.lands.push(1);
export function wrongProfile(profile:WeaponProfile):number{return profile.damage;}`;
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toContain(2322);
 expect(refused).toContain(2339);
});
