import { practiceAssetUrl } from '../../src/practiceAssets';
import { readPracticePresentation } from '../../src/practicePresentation';
import type { Game } from '../../src/engine/core/Game';
import { app } from '../../src/engine/app/runtime';
import type { ArenaProduct } from './types';
import { numericCreaturePose as pufferPose } from '../../src/pufferGaitContinuityPreview';
import { runtimeLookMaterials } from '../../src/game/shardfile/runtimeProduct';
import { lendLooks, lentLook, setLentParam } from '../../src/game/shardfile/lentLooks';
import { ToonArms } from '../../src/game/systems/viewmodel/toonArms';
import { SWORD_WOOD } from '../../src/game/weapons/starterMeleeProfile';
import type { SwordOptions } from '../../src/game/weapons/Sword';
import { installPickupCatalogue } from '../../src/game/models/specimenCatalogue';
import { readLootTables, registerLootTable, type LootTableRow } from '../../src/game/loot/tables';
import type { Material } from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { SpeciesLook } from '../../src/engine/entities/species/look';
import { NO_FUR } from '../../src/engine/entities/species/rigs';
import { fetchBuildFile, packedCreatureBodies } from '../../src/game/plugin/geometry';
import { numericCreaturePose } from '../../src/game/plugin/channelPrograms';
import * as v from 'valibot';

function litMaterial(id: string): MeshStandardNodeMaterial {
  const material: Material = lentLook(id);
  const lit = (value: Material): value is MeshStandardNodeMaterial => Reflect.get(value, 'isMeshStandardNodeMaterial') === true;
  if (!lit(material)) throw new Error(`Creature graph is not lit: ${id}`);
  return material;
}

/** Rejected visual fixtures, loaded through the same species, rig, pose and material paths as the game. */
export async function prepareSharedContent(game: Game, entries: readonly ArenaProduct[]): Promise<SwordOptions> {
  const owner = game.levelScope;
  const first = entries[0];
  if (first === undefined) throw new Error('Arena requires admitted products');
  const firstProduct = first.product;
  const firstJson = async (name: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await firstProduct.file(name)));
  installPickupCatalogue(await firstJson('practice/pickups.json'));
  const firstPresentation = readPracticePresentation(await firstJson('practice/looks.json'));
  const ids = firstPresentation.materials;
  lendLooks(owner, await runtimeLookMaterials({ scope: owner, renderer: game.renderer }, firstProduct.shardfile, true, Object.values(ids)));
  const loot = new Map<string, LootTableRow>();
  for (const entry of entries) {
    const product = entry.product;
    const json = async (name: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await product.file(name)));
    const presentation = entry.presentation;
    const bodies = packedCreatureBodies(await json('practice/bodies.json'), undefined,
      url => fetchBuildFile(practiceAssetUrl(url)));
    await bodies.preload();
    const looks: SpeciesLook[] = await Promise.all(presentation.looks.map(async (row): Promise<SpeciesLook> => {
      const clips: unknown = JSON.parse(new TextDecoder().decode(await product.file(row.pose)));
      const look: SpeciesLook = { id: row.id, species: row.species, kind: row.kind, rigContract: row.rigContract,
        fur: NO_FUR, rig: 'custom', faceted: true, build: variant => bodies.copy(row.kind, variant.id), animate: (entry.id === 'puffer' ? pufferPose : numericCreaturePose)(clips),
        material: (_sky, glow, intensity = 1) => {
          if (glow === undefined) return litMaterial(ids.body).clone();
          setLentParam(ids.glowing, 'glow', [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
          return litMaterial(ids.glowing).clone();
        } };
      if (row.rootFlinch !== undefined) look.rootFlinch = row.rootFlinch;
      return look;
    }));
    const program = product.section('actors/species-programs').program;
    if (program === undefined) throw new Error('Demo product has no species program');
    for (const row of program.species) app.species.registerRow(row, owner);
    for (const look of looks) app.species.registerLook(look, owner);
    for (const row of readLootTables(product.section('economy/loot').rows.loot[0]?.economy?.tables)) {
      const prior = loot.get(row.id);
      if (prior !== undefined && (prior.domain !== row.domain || prior.table.mode !== row.table.mode)) throw new Error('Incompatible arena loot');
      loot.set(row.id, prior === undefined ? row : { ...prior, table: { ...prior.table, rows: [...prior.table.rows, ...row.table.rows] } });
    }
  }
  for (const row of loot.values()) registerLootTable(row, owner);
  const heldData = v.parse(v.looseObject({ url: v.string() }), firstProduct.section('held/arms').look);
  const arms = ToonArms.admit({ ...heldData, url: practiceAssetUrl(heldData.url) });
  await arms.prepareProduct({ scope: owner, renderer: game.renderer }, firstProduct);
  const held = await arms.load();
  if (held.arms === undefined) throw new Error('Demo sword arms failed to load');
  return { row: SWORD_WOOD, profile: SWORD_WOOD, blade: 'wood', arms: held.arms };
}
