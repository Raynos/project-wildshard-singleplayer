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
/** PH-B2's files (src/world/PineCrags.ts, built by scripts/blender/crags/): the Ridge's granite kit, the bear cave and its data,
 *  and the granite's Poly Haven set (CC0 `mossy_rock`; its grit is the terrain's own `rock_ground`) */
export const PINE_CRAG_DIR = '/assets/models/pine-hollow-crags';
export const PINE_CRAG_URLS: readonly string[] = [`${PINE_CRAG_DIR}/crags.glb`, `${PINE_CRAG_DIR}/cave.glb`, `${PINE_CRAG_DIR}/cave.json`,
  ...['diffuse', 'nor_gl', 'arm'].map((k) => `/assets/tex/mossy_rock/${k}.jpg`)];
/** every file the landmarks fetch (desktop names: the boot maps them to the phone's copies) */
export function pineHeroUrls(): string[] { return [...PINE_HERO_IDS.flatMap((id) => [pineHeroUrl(id), pineHeroUrl(`${id}-lod1`)]), ...PINE_CRAG_URLS]; }
