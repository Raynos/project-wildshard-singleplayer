import { materialTextureRefs } from './materials';
import { propMaterialsOf, propMaterialTextureRefs } from './propMaterials';
import { splatTerrainOf, splatTextureRefs } from './splatTerrain';
import type { Shardfile } from './shardSchema';

/** Exact required transport roots and their dependencies, shared by pack emission and phone admission.
 * Late is a scheduling hint: commons, critical flags, manifest images/navigation and the global LUT still win. */
export function controlFileHashes(source: Pick<Shardfile, 'files' | 'critical' | 'library' | 'late' | 'presentation' | 'navigation' | 'map' | 'look' | 'requires' | 'props'>): ReadonlySet<string> {
  const card = source.presentation?.card, late = new Set((source.late ?? []).map(row => row.hash));
  const graphFiles = Object.values(source.look.materials).flatMap(material => material.family === 'graph' && 'file' in material ? [material.file] : []);
  const materialFiles = [...materialTextureRefs(source.look.materials), ...graphFiles, ...source.props?.textures.map(row => row.colour) ?? [],
    ...propMaterialTextureRefs(source.props === null ? undefined : propMaterialsOf(source.props)),
    ...splatTextureRefs(source.props === null ? undefined : splatTerrainOf(source.props))];
  const pending = [...materialFiles, ...source.requires.commons, ...source.critical, ...source.library.filter(hash => !late.has(hash)),
    ...source.files.filter(file => file.critical).map(file => file.hash),
    ...source.navigation === null ? [] : [source.navigation.file], ...source.map === undefined ? [] : [source.map.image],
    ...card === undefined ? [] : [card.thumb, card.portrait, card.landscape], ...source.look.grade.lut === null ? [] : [source.look.grade.lut]];
  const needed = new Set<string>(), files = new Map(source.files.map(file => [file.hash, file]));
  while (pending.length > 0) {
    const ref = pending.pop(); if (ref === undefined) break;
    const hash = ref.replace(/^commons:/u, ''); if (needed.has(hash)) continue;
    needed.add(hash);
    const file = files.get(hash);
    if (file === undefined) {
      if (!source.requires.commons.includes(hash)) throw new Error('Control file is not declared');
    } else pending.push(...file.dependencies);
  }
  return needed;
}
