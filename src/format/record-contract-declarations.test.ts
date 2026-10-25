// oxlint-disable-next-line import/no-nodejs-modules -- Resolve an unwritten record consumer.
import {resolve} from 'node:path';
import ts from '@typescript/typescript6';
import {expect,test} from 'vitest';

const contracts = [
  {
    "name": "worldSceneWeld",
    "aliases": [
      "WorldSceneWeldMaterialRowsInput",
      "WorldSceneWeldMaterialRows",
      "WorldSceneWeld",
      "WorldSceneWeldSourceRows"
    ]
  },
  {
    "name": "forestPage",
    "aliases": [
      "ForestPageRows",
      "ForestGroundLayoutInput",
      "ForestGroundLayout",
      "LivingPageInputRowsInput",
      "LivingPageInputRows",
      "LivingPageSitesRows"
    ]
  },
  {
    "name": "eliteEntryRows",
    "aliases": [
      "EliteEntryRowsInput",
      "EliteEntryRows",
      "EliteEntryPageRowsInput",
      "EliteEntryPageRows"
    ]
  },
  {
    "name": "weaponProfiles",
    "aliases": [
      "MeleeWeaponProfileRows",
      "BowWeaponProfileRows",
      "FirearmWeaponProfileRows",
      "ThrownWeaponProfileRows",
      "LashWeaponProfileRows",
      "HeldBowBaseRowsInput",
      "HeldBowBaseRows",
      "MeleeContactData",
      "NativeMeleeRows",
      "HeldModelData",
      "HeldPresentationRows",
      "HeldFirearmPageRowsInput",
      "HeldFirearmPageRows",
      "HeldBowRows",
      "HeldBowDefinitionRowsInput",
      "HeldBowDefinitionRows",
      "HeldBowFileRowsInput",
      "HeldBowFileRows"
    ]
  },
  {
    "name": "explorerCatalogue",
    "aliases": [
      "ExplorerCatalogue"
    ]
  },
  {
    "name": "encounterRows",
    "aliases": [
      "EncounterSitesRowsInput",
      "EncounterSitesRows",
      "EncounterPatrolRows",
      "EncounterSlotsRows",
      "CoupledEncounterRows",
      "EncounterScheduleRows",
      "ArenaEncounterRowsInput",
      "ArenaEncounterRows",
      "ArenaWhirlsRowsInput",
      "ArenaWhirlsRows",
      "SlotViewRows",
      "PatrolViewRows",
      "ArenaFireRows",
      "CloudBodyRowsInput",
      "CloudBodyRows",
      "ArenaSceneRowsInput",
      "ArenaSceneRows",
      "CloudSpecimenRowsInput",
      "CloudSpecimenRows"
    ]
  },
  {
    "name": "figures",
    "aliases": [
      "FigureMotionRow",
      "FigureSkinRow",
      "FigureRow",
      "FigureCatalogueRowInput",
      "FigureCatalogueRow",
      "FigureAtlasRow",
      "FigureGroupRowsInput",
      "FigureGroupRows"
    ]
  },
  {
    "name": "movers",
    "aliases": [
      "WorldMoversRowsInput",
      "WorldMoversRows",
      "MoverBakeInput",
      "MoverBake"
    ]
  },
  {
    "name": "practiceCourseRows",
    "aliases": [
      "PracticeScene",
      "PracticeControllerRows",
      "RidingPracticeLayoutInput",
      "RidingPracticeLayout"
    ]
  },
  {
    "name": "questFigures",
    "aliases": [
      "QuestFigureRowsInput",
      "QuestFigureRows",
      "QuestFiguresRows",
      "KitFigureCardsRows"
    ]
  },
  {
    "name": "modes",
    "aliases": [
      "ZiplineModeInput",
      "ZiplineMode",
      "UpdraftModeInput",
      "UpdraftMode",
      "LadderModeInput",
      "LadderMode",
      "CableProfileRows",
      "RideGaitsRows",
      "RideModeInput",
      "RideMode",
      "GrappleModeInput",
      "GrappleMode",
      "ModeRowsInput",
      "ModeRows"
    ]
  },
  {
    "name": "collectionDisplay",
    "aliases": [
      "CollectionModelRow",
      "CollectionMountPackInput",
      "CollectionMountPack",
      "CollectionChalk",
      "CollectionKeepsakesInput",
      "CollectionKeepsakes",
      "CollectionDisplaysRowsInput",
      "CollectionDisplaysRows"
    ]
  },
  {
    "name": "npcs",
    "aliases": [
      "NpcDialogueRow",
      "QuestPageTalksRows",
      "NpcMotion",
      "NpcRowInput",
      "NpcRow",
      "QuestNpcBindingInput",
      "QuestNpcBinding",
      "QuestNpcTalkBindingInput",
      "QuestNpcTalkBinding"
    ]
  },
  {
    "name": "lootBag",
    "aliases": [
      "LootPresentationRows",
      "LootProgressionRowsInput",
      "LootProgressionRows",
      "LootFindsRows",
      "LootBagRows"
    ]
  },
  {
    "name": "lootEconomy",
    "aliases": [
      "ClaimedPickupRows",
      "LootEconomyInput",
      "LootEconomy",
      "BarterEconomyInput",
      "BarterEconomy"
    ]
  },
  {
    "name": "groupBrains",
    "aliases": [
      "ShardPackGroup",
      "StalkerGroupRows",
      "ShardHerdGroup",
      "GrazerGroupRows",
      "GroupGuestBindingRows"
    ]
  },
  {
    "name": "riding",
    "aliases": [
      "ReinPresentationRows",
      "RidingControls",
      "RidingPresentationRows",
      "PageTamingBindingRows",
      "PageRidingPresetRowsInput",
      "PageRidingPresetRows",
      "ClientRidingSessionRows"
    ]
  },
  {
    "name": "heldFinishes",
    "aliases": [
      "HeldFinishCardRows",
      "CosmeticFinishBind",
      "CosmeticFinishesRowsInput",
      "CosmeticFinishesRows",
      "HeldFinishesRowsInput",
      "HeldFinishesRows"
    ]
  }
];

test('named data contracts retain typed Object.values and closed record keys',()=>{
 const consumer=resolve('src/format/t4-record-laws-consumer.ts');
 const declarations:string[]=[],negatives:string[]=[];
 let index=0;
 for(const {name,aliases} of contracts){
  declarations.push(`import type {${aliases.join(',')}} from './${name}';`);
  for(const alias of aliases){
   declarations.push(`declare const row${index}:${alias};
export const record${index}:Record<string,unknown>=row${index};
export const values${index}=Object.values(row${index});
type Any${index}=0 extends (1 & (typeof values${index})[number])?true:false;
export const typed${index}:Any${index}=false;`);
   negatives.push(`export const missing${index}:${alias}['__t4_unknown_field__']=0;`);
   index++;
  }
 }
 expect(index).toBe(131);
 let source=declarations.join('\n');
 const options:ts.CompilerOptions={strict:true,exactOptionalPropertyTypes:true,noUncheckedIndexedAccess:true,
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,
  types:[],skipLibCheck:true,noEmit:true};
 const host=ts.createCompilerHost(options),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
 host.fileExists=file=>file===consumer||exists(file);
 host.readFile=file=>file===consumer?source:read(file);
 const diagnostics=():readonly ts.Diagnostic[]=>{
  const program=ts.createProgram([consumer],options,host),file=program.getSourceFile(consumer);
  if(file===undefined)throw new Error('Missing virtual record-law consumer');
  return program.getSemanticDiagnostics(file);
 };
 expect(diagnostics()).toEqual([]);
 source+=negatives.join('\n');
 const refused=diagnostics().map(diagnostic=>diagnostic.code);
 expect(refused).toHaveLength(index);
 expect(refused.every(code=>code===2339)).toBe(true);
});
