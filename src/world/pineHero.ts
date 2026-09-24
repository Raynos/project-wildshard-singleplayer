/**
 * Pine Hollow's image-to-3D hero props (PINE-HOLLOW-REMASTER PH-B3): TRELLIS.2 generations built by
 * scripts/img2mesh/build_props.py (scripts/img2mesh/props/pine-hollow-hero.json) into public/assets/models/pine-hollow-hero/:
 * `<id>/<id>.glb` (LOD0, 1024² PBR), `<id>/<id>.phone.glb` (the same mesh at 512², swapped in by tierUrl) and
 * `<id>-lod1/<id>-lod1.glb` (a quarter of the triangles, 256²). Import-free, so the boot manifest can list the files.
 */
export const PINE_HERO_DIR = '/assets/models/pine-hollow-hero';
/** the props that are built (src/world/PineLandmarks.ts places each; one InstancedMesh per LOD) */
export const PINE_HERO_IDS = ['stone-a', 'stone-b', 'stone-c', 'waystone', 'contract-board', 'cave-arch', 'beaver-dam', 'canoe'] as const;
export type PineHeroId = (typeof PINE_HERO_IDS)[number];
export const pineHeroUrl = (id: string): string => `${PINE_HERO_DIR}/${id}/${id}.glb`;
/** every file the landmarks fetch (desktop names: the boot maps them to the phone's copies) */
export function pineHeroUrls(): string[] { return PINE_HERO_IDS.flatMap((id) => [pineHeroUrl(id), pineHeroUrl(`${id}-lod1`)]); }
