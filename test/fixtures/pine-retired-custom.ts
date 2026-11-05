import * as v from 'valibot';
import type { ProjectOutput } from '../../src/sharddev/projectOutput';
import { outputPlatformPayloads } from '../../src/sharddev/outputProduct';
import { parsePlatformDataSection } from '@wildshard/format/platformDataSections';
import { ForestPageSchema } from '@wildshard/format/forestPage';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { HeldEquipmentSchema } from '@wildshard/format/heldEquipment';
import { RangedPageSchema } from '@wildshard/format/rangedPage';
import { RoamingCombatSchema } from '@wildshard/format/roamingCombat';

type Product = Pick<ProjectOutput, 'platform' | 'namedFiles' | 'assets'>;

/** Test/proof reconstruction only. Shipping readers already consume these full native formats.
 * No generic wrapper, new platform contract or runtime custom-section substitute is installed. */
export function pineRetiredCustomPayloads(output: Product): ReadonlyMap<string, unknown> {
  const named = (name: string): unknown => {
    const file = output.namedFiles?.find(row => row.name === name);
    const bytes = file === undefined ? undefined : output.assets?.get(file.hash);
    if (bytes === undefined) throw new Error(`Missing defining Pine file: ${name}`);
    return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  };
  const platform = outputPlatformPayloads(output.platform, ['world/scenes', 'held/equipment', 'look/hull-book']);
  const forest = v.parse(ForestPageSchema, named('world/forest-page.json'));
  const scenes = parseWorldScenes(platform.get('world/scenes'));
  const held = v.parse(HeldEquipmentSchema, platform.get('held/equipment'));
  const ranged = v.parse(RangedPageSchema, named('client/ranged-page.json'));
  const combat = v.parse(RoamingCombatSchema, named('combat/roaming.json'));
  const hulls = parsePlatformDataSection('look/hull-book', platform.get('look/hull-book'));
  const look = (id: string): string => {
    const row = scenes.materials.find(material => material.id === id);
    if (row?.kind !== 'look') throw new Error(`Missing defining Pine look: ${id}`);
    return row.look;
  };
  const elk = hulls.rows.filter(row => row.kind === 'elk');
  if (elk.length !== 1) throw new Error('Missing unique Pine elk look');
  const row = elk[0], thrall = row?.variants?.['thrall'];
  if (row?.postPose === undefined || thrall?.traits === undefined || thrall.tint === undefined || thrall.traits['antlers'] !== 1) {
    throw new Error('Missing defining Pine thrall pose/variant');
  }
  const rig = combat.projection.socketRig;
  const lanterns = rig.hazards.map(id => {
    const attachment = rig.attachments.find(part => part.id === id);
    if (attachment === undefined) throw new Error('Missing defining King hazard attachment');
    return attachment.at;
  });
  return new Map<string, unknown>([
    ['custom/cabinAppearance', {CABIN_LIFE:forest.buildings.life, CABIN_LIGHT:forest.buildings.light,
      HEARTH_LOOKS:{smoke:look('cabin.smoke'),flame:look('cabin.flame'),ember:look('cabin.ember')}}],
    ['custom/kingKit', {pool:rig.pool, lanterns}],
    ['custom/paintedTextures', {textures:{coatArm:held.coatTextures.armMap,coatMap:held.coatTextures.map,
      coatNormal:held.coatTextures.normalMap,chalk:ranged.collection.texture},chalk:ranged.collection.chalk}],
    ['custom/thrallLook', {pose:row.postPose,traits:Object.fromEntries(Object.entries(thrall.traits).filter(([key]) => key !== 'antlers')),tint:thrall.tint}],
    ['custom/trophyMounts', ranged.collection.pack],
  ]);
}
