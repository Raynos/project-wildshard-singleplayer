import { practiceAssetUrl } from './practiceAssets';
import type { Game } from './engine/core/Game';
import { app } from './engine/app/runtime';
import type { ShardProduct } from './game/shardfile/shardProduct';
import { runtimeLookMaterials } from './game/shardfile/runtimeProduct';
import { lendLooks, lentLook, setLentParam } from './game/shardfile/lentLooks';
import { ToonArms } from './game/systems/viewmodel/toonArms';
import { SWORD_WOOD } from './game/weapons/starterMeleeProfile';
import type { SwordOptions } from './game/weapons/Sword';
import { installPickupCatalogue } from './game/models/specimenCatalogue';
import { readLootTables, registerLootTable } from './game/loot/tables';
import type { Material } from 'three';
import type { MeshStandardNodeMaterial } from 'three/webgpu';
import type { SpeciesLook } from './engine/entities/species/look';
import { NO_FUR } from './engine/entities/species/rigs';
import { packedCreatureBodies } from './game/plugin/geometry';
import { numericCreaturePose } from './game/plugin/channelPrograms';
import * as v from 'valibot';

const presentationSchema = v.strictObject({
  materials: v.strictObject({ body: v.string(), glowing: v.string() }),
  looks: v.array(v.strictObject({ id: v.string(), species: v.string(), kind: v.string(), pose: v.string(),
    rigContract: v.strictObject({ skeleton: v.string(), clips: v.tuple([]), sockets: v.array(v.string()) }) })),
});

function litMaterial(id: string): MeshStandardNodeMaterial {
  const material: Material = lentLook(id);
  const lit = (value: Material): value is MeshStandardNodeMaterial => Reflect.get(value, 'isMeshStandardNodeMaterial') === true;
  if (!lit(material)) throw new Error(`Creature graph is not lit: ${id}`);
  return material;
}

/** Rejected visual fixtures, loaded through the same species, rig, pose and material paths as the game. */
export async function preparePracticeContent(game: Game, product: ShardProduct): Promise<SwordOptions> {
  const owner = game.levelScope;
  const json = async (name: string): Promise<unknown> => JSON.parse(new TextDecoder().decode(await product.file(name)));
  installPickupCatalogue(await json('practice/pickups.json'));
  const presentation = v.parse(presentationSchema, await json('practice/looks.json'));
  const ids = presentation.materials;
  lendLooks(owner, await runtimeLookMaterials({ scope: owner, renderer: game.renderer }, product.shardfile, true, Object.values(ids)));
  const bodyData = v.parse(v.looseObject({ file: v.string() }), await json('practice/bodies.json'));
  const bodies = packedCreatureBodies({ ...bodyData, file: practiceAssetUrl(bodyData.file) }); await bodies.preload();
  const looks: SpeciesLook[] = await Promise.all(presentation.looks.map(async (row): Promise<SpeciesLook> => {
    const clips: unknown = JSON.parse(new TextDecoder().decode(await product.file(row.pose)));
    return { id: row.id, species: row.species, kind: row.kind, rigContract: row.rigContract,
      fur: NO_FUR, rig: 'custom', faceted: true, build: variant => bodies.copy(row.kind, variant.id), animate: numericCreaturePose(clips),
      material: (_sky, glow, intensity = 1) => {
        if (glow === undefined) return litMaterial(ids.body).clone();
        setLentParam(ids.glowing, 'glow', [glow[0] * intensity, glow[1] * intensity, glow[2] * intensity]);
        return litMaterial(ids.glowing).clone();
      } };
  }));
  const program = product.section('actors/species-programs').program;
  if (program === undefined) throw new Error('Demo product has no species program');
  for (const row of program.species) app.species.registerRow(row, owner);
  for (const look of looks) app.species.registerLook(look, owner);
  for (const row of readLootTables(product.section('economy/loot').rows.loot[0]?.economy?.tables)) registerLootTable(row, owner);
  const heldData = v.parse(v.looseObject({ url: v.string() }), product.section('held/arms').look);
  const arms = ToonArms.admit({ ...heldData, url: practiceAssetUrl(heldData.url) });
  await arms.prepareProduct({ scope: owner, renderer: game.renderer }, product);
  const held = await arms.load();
  if (held.arms === undefined) throw new Error('Demo sword arms failed to load');
  return { row: SWORD_WOOD, profile: SWORD_WOOD, blade: 'wood', arms: held.arms };
}
