import { nameBlob, emitNamedBlobs, type BlobSourceOptions } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { CABIN_DOOR_LOOK, CABIN_MOSS_LOOKS, CABIN_LIFE } from '../data/cabinLook';
import { CABIN_PBR, CABIN_MATERIALS, CABIN_GLASS_EMISSIVE, CABIN_LIGHT } from '../data/cabinAssembly';
import { HEARTH_LOOKS } from '../data/hearthLook';
import { WEAPON_FINISHES } from '../data/weaponFinishes';
import { TIMBER_DRAWS, TIMBER_GLASS } from '../data/timberDraws';
import lookMaterials from '../data/lookMaterials.generated.json' with { type: 'json' };
import props from '../data/props.json' with { type: 'json' };
import timbers from '../data/timberWorld.generated.json' with { type: 'json' };
import { PINE_OUTPUT } from '../data/output';
import { RUNTIME_MIRRORS } from '../data/runtimeMirrors';

/** Preserve logical names and tier selection while packing named geometry losslessly. */
function meshoptSource<T extends { kind: string; options?: BlobSourceOptions }>(row: T) {
  return row.kind === 'glb' ? { ...row, options: { ...row.options, meshopt: true } } : row;
}

const clientJson=emitNamedBlobs([nameBlob('world/cabins.json','json',new TextEncoder().encode(encodeCanonicalJson({
 CABIN_DOOR_LOOK,CABIN_MOSS_LOOKS,CABIN_LIFE,CABIN_PBR,CABIN_MATERIALS,CABIN_GLASS_EMISSIVE,CABIN_LIGHT,HEARTH_LOOKS,TIMBER_DRAWS,TIMBER_GLASS,
}))), nameBlob('world/prop-shapes.json','json',new TextEncoder().encode(JSON.stringify(timbers.propShapes))), nameBlob('world/props.json','json',new TextEncoder().encode(JSON.stringify(props))), nameBlob('loadout/finishes.json','json',new TextEncoder().encode(JSON.stringify(WEAPON_FINISHES))), nameBlob('look/runtime-graphs.json','json',new TextEncoder().encode(encodeCanonicalJson(lookMaterials.runtime)))]);

/** CLI-only: runtime config imports cannot reach section emission or Node services. */
export const output = { ...PINE_OUTPUT, namedFiles: clientJson.files, assets: clientJson.assets, blobs: PINE_OUTPUT.blobs.map(meshoptSource) };
/** The data/ values runtime/const.ts copies; the build proves the copied runtime still equals them. */
export const mirrors = [...RUNTIME_MIRRORS];
