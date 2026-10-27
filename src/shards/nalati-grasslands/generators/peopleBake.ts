import * as THREE from 'three';
import { readSourceModel, skinnedGlb } from '@wildshard/sdk/bake/skinned';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import frames from '../data/peopleFrames.json' with { type: 'json' };
import { fitNpcFigure, mergeNpcFigures, rawFromGltf } from './peopleRig';
import { peopleRows } from './peopleRows.mjs';

type FigureKey = keyof typeof frames;
const isFigure = (key: string): key is FigureKey => Object.hasOwn(frames, key);
const KEYS: readonly FigureKey[] = Object.keys(frames).filter(isFigure);
/** a figure's authored source GLB (committed under public/), as the camp's atlas row lists them in figure order */
const sourceUrl = (key: FigureKey, phone: boolean): string => {
  const url = peopleRows.atlas[phone ? 'phone' : 'desktop'].sources[KEYS.indexOf(key)];
  if (url === undefined) throw new Error(`Missing camp figure source for ${key}`);
  return url;
};
/** A selection's prepared skin's product name (GR6; peopleRows.mjs names the same file as its atlas `url`): the camp's
 *  merged figures, or one figure alone for its Explorer card. */
export const peopleSkinName = (keys: readonly string[], phone: boolean): string =>
  `models/people/${keys.length === 1 ? keys[0] ?? '' : 'camp'}${phone ? '.phone' : ''}.glb`;

/** Same intake, cuts, conditioning, registration order and float32 channel writes as the former page path. */
async function preparePeople(keys: readonly FigureKey[], phone: boolean, read: (url: string) => Uint8Array): Promise<ReturnType<typeof mergeNpcFigures<FigureKey>>> {
  const figures = await Promise.all(keys.map(async key => {
    const row = frames[key], frame = { height: row.height, neck: new THREE.Vector3(...row.neck), shoulder: new THREE.Vector3(...row.shoulder) };
    const source = await readSourceModel(read(sourceUrl(key, phone)));
    const raw = rawFromGltf(source.gltf.scene, `person ${key}`), cuts: number[] = [];
    source.gltf.scene.traverse(object => { const cut: unknown = object.userData['neckCut']; if (typeof cut === 'number') cuts.push(cut * frame.height); });
    return fitNpcFigure(key, raw.geometry, null, frame, cuts[0] ?? null);
  }));
  const rig = mergeNpcFigures(figures, () => new THREE.MeshLambertMaterial(), 'nalati-camp-people-gen', phone ? 256 : 512);
  // The browser only draws the original atlases. Its former UV packing happens offline now.
  const uv = rig.mesh.geometry.getAttribute('uv');
  let offset = 0;
  figures.forEach((figure, i) => {
    const count = figure.head.length;
    for (let j = offset; j < offset + count; j++) uv.setXY(j, (i % 3 + uv.getX(j)) / 3, (Math.floor(i / 3) + uv.getY(j)) / 2);
    offset += count;
  });
  return rig;
}

/** One selection's prepared skin GLB: the merged figures with their root, head and arm joints. */
export async function bakePeople(keys: readonly FigureKey[], phone: boolean, read: (url: string) => Uint8Array): Promise<Uint8Array> {
  const rig = await preparePeople(keys, phone, read);
  const bones = rig.mesh.skeleton.bones.map(bone => {
    const key = bone.name.slice(0, bone.name.lastIndexOf('-')), figure = isFigure(key) ? rig.bones[key] : undefined;
    if (figure === undefined) throw new Error(`Missing camp figure for joint ${bone.name}`);
    const position = bone.name.endsWith('-head') ? figure.neck : bone.name.endsWith('-arm') ? figure.shoulder : new THREE.Vector3();
    return { name: bone.name, parent: null, pos: position.toArray() };
  });
  return skinnedGlb({ name: 'nalati-camp-people-gen', bones,
    parts: [{ name: 'nalati-camp-people-gen', geometry: rig.mesh.geometry, material: new THREE.MeshStandardMaterial() }] }).glb;
}

/** GR6: the camp's prepared skins at build time (the retired nalati-people job's bytes), both tiers, the camp merged and
 *  each figure alone, as named product files over the authored sources read through the build cache. */
export async function nalatiPeopleBlobs(ctx: Pick<ProjectGenerationContext, 'cached'>): Promise<NamedBlob[]> {
  const inputs = [false, true].flatMap(phone => KEYS.map(key => sourceUrl(key, phone)));
  const files = await ctx.cached({ id: 'people-sources', inputs }, read => new Map(inputs.map(url => {
    const bytes = read.get(url);
    if (bytes === undefined || bytes.length === 0) throw new Error(`Missing camp figure source ${url}`);
    return [url, bytes];
  })));
  const read = (url: string): Uint8Array => { const bytes = files.get(url); if (bytes === undefined) throw new Error(`Missing camp figure source ${url}`); return bytes; };
  const blobs: NamedBlob[] = [];
  for (const phone of [false, true]) for (const keys of [KEYS, ...KEYS.map(key => [key])]) blobs.push(nameBlob(peopleSkinName(keys, phone), 'glb', await bakePeople(keys, phone, read)));
  return blobs;
}
