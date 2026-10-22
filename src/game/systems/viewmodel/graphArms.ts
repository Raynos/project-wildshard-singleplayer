/**
 * G571: a held view dressed in graph looks from rows (`format/graphArmsRows`, a product's weapon row file `view`): the
 * shared rig arms (RigArms) with each mesh's graph look, maps and channels, the weave and decal textures, back-face and
 * additive looks, the pendants' client scene on their socket, the swing trail in its own look and the frame rows that
 * write time, buffer size, pixel ratio and projection into the looks. The product admits its rows before the rig, looks
 * and textures are borrowed. Nine Dragon Stack's jian arms are the first user.
 */
import { BackSide, type BufferGeometry, BufferGeometryLoader, ClampToEdgeWrapping, DataTexture, DoubleSide, LinearMipmapLinearFilter, Mesh, NoColorSpace,
  type Object3D, RedFormat, RepeatWrapping, Texture, UnsignedByteType, Vector2, Vector3 } from 'three';
import { retainCachedResources } from '@wildshard/engine/app/cachedAssets';
import { ownSceneResource } from '@wildshard/engine/app/sceneOwnership';
import { resourceScope } from '@wildshard/engine/app/resources';
import { app } from '@wildshard/engine/app/runtime';
import { fetchImage, phoneUrl } from '@wildshard/engine/boot/bytes';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';
import { loadTextureRow } from '@wildshard/engine/core/assets';
import { SlashTrail } from '@wildshard/engine/combat/view/slashTrail';
import type { Renderer } from '@wildshard/engine/render/renderer';
import type { GraphArmsRow } from '@wildshard/format/graphArmsRows';
import type { GraphLiteral } from '@wildshard/format/materialGraph';
import { loadFirstPartyProduct, runtimeLookMaterials } from '../../shardfile/runtimeProduct';
import { createClientScene } from '../../plugin/ui';
import { BLEND_ADD_KEEP_ALPHA } from '../../plugin/shaderFamily';
import type { ShardSword } from '../../shard/manifest';
import { ARM_CLIPS, armClipNames } from './armClips';
import { RigArms, swordArmsOf, type RigState } from './rigArms';

type Looks = Awaited<ReturnType<typeof runtimeLookMaterials>>;
/** decoded maps and decals by immutable path, while some rig still holds them */
const images = new Map<string, Promise<Texture>>(), resolved = new Map<string, Texture>(), atlases = new Map<string, Texture>();

/** A rig's maps: the tier's KTX2 stand-in, else the image; numeric data, file orientation, trilinear. */
function loadMap(path: string, anisotropy: number): Promise<Texture> {
  const kept = resolved.get(path); if (kept !== undefined && !app.assets.isAcquired(kept)) images.delete(path);
  let loading = images.get(path);
  if (loading === undefined) {
    loading = (async () => {
      const value = await ktx2Texture(phoneUrl(path)) ?? new Texture(await fetchImage(path, Infinity, false));
      value.colorSpace = NoColorSpace; value.flipY = false; value.minFilter = LinearMipmapLinearFilter; value.anisotropy = anisotropy; value.needsUpdate = true;
      resolved.set(path, value);
      return retainCachedResources(value);
    })();
    images.set(path, loading);
  }
  return loading;
}

/** An R8 weave of size² texels, repeating and mipmapped. */
function weave(data: Uint8Array, size: number): DataTexture {
  if (data.length !== size * size) throw new Error(`Held weave must contain ${size} × ${size} R8 texels`);
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
  texture.wrapS = texture.wrapT = RepeatWrapping; texture.minFilter = LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

/** A RigArms dressed in graph looks from its row, with the swing trail and per-frame look writes. */
export class GraphArms {
  readonly root: RigArms['root'];
  readonly trail: { readonly mesh: Mesh };
  private readonly ribbon: SlashTrail;
  private trailLife: number;
  private t = 0;
  private readonly base = new Vector3();
  private readonly tip = new Vector3();
  private readonly buffer = [0, 0];
  private readonly projection = [0, 0, 0, 0];
  /** each loaded look's declared params */
  private readonly params: readonly (readonly [string, ReadonlySet<string>])[];

  private constructor(readonly rig: RigArms, private readonly row: GraphArmsRow, private readonly looks: Looks, ids: readonly string[]) {
    this.params = ids.map(id => [id, new Set(row.params[id])] as const);
    this.root = rig.root;
    const material = looks.materials.get(row.trail.look);
    if (material === undefined) throw new Error(`Missing held trail look ${row.trail.look}`);
    this.ribbon = new SlashTrail({ samples: row.trail.samples, subdivisions: row.trail.subdivisions, movementSq: row.trail.movementSq, channel: 'age' });
    this.trailLife = row.trail.total * row.trail.life;
    this.trail = { mesh: new Mesh(this.ribbon.geometry, material) };
    this.trail.mesh.frustumCulled = false; this.trail.mesh.renderOrder = row.trail.order; this.trail.mesh.visible = false;
  }

  /** Admit the product's row, then load the rig, its looks, maps and pendants under a fresh resource scope. */
  static async load(slug: string, file: string): Promise<GraphArms> {
    const render = app.render;
    if (render === null) throw new Error('Held graphs require the render service');
    const owner = resourceScope(), product = await loadFirstPartyProduct(slug), tier = render.tier;
    const row = (await product.json<{ readonly view: GraphArmsRow }>(file)).view;
    const ids = [...new Set([...row.meshes.map(mesh => mesh.look), ...row.pendants.materials, row.trail.look])];
    const looks = await runtimeLookMaterials({ scope: owner, renderer: render.renderer }, product.shardfile, true, ids);
    const R = row.rig;
    const rig = await RigArms.load(R.url, { skeleton: R.skeleton, clips: armClipNames(ARM_CLIPS), sockets: R.sockets }, { skeleton: R.skeleton, clips: ARM_CLIPS, joints: R.joints }, false,
      { aliases: ARM_CLIPS, holdRight: R.holdRight, holdLeft: R.holdLeft, walkRate: R.walkRate, lag: R.lag, blade: row.blade });
    const silk = owner.own(weave(await product.file(row.weave.file), row.weave.size));
    const key = product.url(row.decal.files[tier]);
    let decal = atlases.get(key);
    if (decal !== undefined && !app.assets.isAcquired(decal)) decal = undefined;
    if (decal === undefined) { decal = retainCachedResources(await loadTextureRow({ url: key, srgb: true, anisotropy: 8, wrapS: ClampToEdgeWrapping, wrapT: ClampToEdgeWrapping })); atlases.set(key, decal); }
    ownSceneResource(decal, owner, app.assets);
    const maps = new Map(await Promise.all(row.maps.names.map(async name => [name, await Promise.all((['maps', 'nrm'] as const).map(async kind => {
      const texture = await loadMap(`${row.maps.base}${name}-${kind}.webp`, row.maps.anisotropy);
      ownSceneResource(texture, owner, app.assets); return texture;
    }))] as const)));
    const back = new Set(row.back), additive = new Set(row.additive);
    for (const id of ids) {
      const names = new Set(row.params[id]), material = looks.materials.get(id);
      if (material === undefined) throw new Error(`Missing held material ${id}`);
      if (names.has(row.weave.param)) looks.setTexture(id, row.weave.param, silk);
      if (names.has(row.decal.param)) looks.setTexture(id, row.decal.param, decal);
      if (back.has(id)) material.side = BackSide;
      if (additive.has(id)) material.setValues({ ...BLEND_ADD_KEEP_ALPHA, transparent: true, depthWrite: false });
    }
    for (const mesh of rig.meshes()) {
      const entry = row.meshes.find(candidate => candidate.name === mesh.name), material = entry === undefined ? undefined : looks.materials.get(entry.look);
      if (entry === undefined || material === undefined) throw new Error(`Missing held mesh row ${mesh.name}`);
      for (const [name, source] of Object.entries(entry.channels)) if (mesh.geometry.hasAttribute(source)) { mesh.geometry.setAttribute(name, mesh.geometry.getAttribute(source)); if (source.startsWith('_')) mesh.geometry.deleteAttribute(source); }
      mesh.material = material; material.side = entry.hull ? BackSide : entry.doubleSide ? DoubleSide : material.side;
      if (entry.hull) mesh.renderOrder = -1;
      const [map, normal] = entry.maps === undefined ? [] : maps.get(entry.maps) ?? [];
      if (map !== undefined) looks.setTexture(entry.look, row.maps.kinds.maps, map);
      if (normal !== undefined) looks.setTexture(entry.look, row.maps.kinds.nrm, normal);
    }
    const result = new GraphArms(rig, row, looks, ids);
    result.root.add(result.trail.mesh);
    const loader = new BufferGeometryLoader(), geometry = new Map<string, BufferGeometry>();
    for (const source of row.pendants.geometry) {
      const parts = await product.json<Record<string, unknown>>(source.file);
      if ('field' in source) geometry.set(source.name, owner.own(loader.parse(parts[source.field])));
      else for (const [name, value] of Object.entries(parts)) geometry.set(name, owner.own(loader.parse(value)));
    }
    const socket = rig.nodes.get(row.pendants.socket);
    if (socket === undefined) throw new Error(`Held pendant socket ${row.pendants.socket} is missing`);
    socket.add(createClientScene(row.pendants.scene, { geometry, materials: looks.materials }).root);
    const projection = row.frame.filter(entry => entry.source === 'projection');
    if (projection.length > 0) for (const material of looks.materials.values()) material.onBeforeRender = (_renderer, _scene, camera) => {
      const p = camera.projectionMatrix.elements, out = result.projection;
      out[0] = p[0]; out[1] = p[5]; out[2] = p[10]; out[3] = p[14];
      for (const entry of projection) result.write(entry, out);
    };
    owner.own(result.ribbon.geometry);
    return result;
  }

  /** a frame row's value to its look, or to every look that declares its param */
  private write(entry: GraphArmsRow['frame'][number], value: GraphLiteral): void {
    if (entry.look !== undefined) { this.looks.setParam(entry.look, entry.param, value); return; }
    for (const [id, names] of this.params) if (names.has(entry.param)) this.looks.setParam(id, entry.param, value);
  }

  /** a swing began: a fresh ribbon, its life from the clip's timing, a new seed */
  beginTrail(): void {
    const name = this.rig.move ?? 'light'; this.ribbon.reset();
    this.trailLife = (this.rig.meta.clips[name]?.timing?.total ?? this.row.trail.total) * this.row.trail.life;
    this.looks.setParam(this.row.trail.look, this.row.trail.seed, Math.random() * 100);
  }

  setClawVisible(on: boolean): void { for (const mesh of this.rig.meshes()) if (mesh.name.startsWith(this.row.claw)) mesh.visible = on; }

  /** the drawing buffer's size and pixel ratio, to the `buffer` and `pixels` frame rows */
  resize(bw: number, bh: number, pr: number): void {
    this.buffer[0] = bw; this.buffer[1] = bh;
    for (const entry of this.row.frame) {
      if (entry.source === 'buffer') this.write(entry, this.buffer);
      else if (entry.source === 'pixels') this.write(entry, Math.max(entry.min ?? -Infinity, pr * (entry.scale ?? 1)));
    }
  }

  update(dt: number, s: RigState): void { this.rig.update(dt, s); this.advanceLook(dt); }

  /** the look's clock, and the trail sampled along the blade through the move's swing window */
  advanceLook(dt: number): void {
    this.t += dt;
    for (const entry of this.row.frame) if (entry.source === 'time') this.write(entry, this.t);
    const name = this.rig.move, clip = name === null ? undefined : this.rig.meta.clips[name], timing = clip?.timing;
    if (timing !== null && timing !== undefined && this.rig.time >= timing.windup && this.rig.time <= timing.slashEnd) {
      const from = clip !== undefined && 'trailFrom' in clip && typeof clip.trailFrom === 'number' ? clip.trailFrom : this.row.trail.from;
      this.rig.blade(this.base, this.tip, from); this.ribbon.sample(this.base, this.tip, this.t);
    }
    this.trail.mesh.visible = this.ribbon.rebuild(this.t, this.trailLife);
  }
}

/** The shard's sword: the graph arms on the shared rig player, with their own trail (not the engine's). */
export async function graphSword(slug: string, file: string): Promise<ShardSword> {
  const rig = await GraphArms.load(slug, file); rig.root.traverse(node => { node.userData['treatAsOpaque'] = true; });
  const arms = swordArmsOf(rig.rig, {});
  return { arms: { ...arms, engineTrail: false,
    play: move => { arms.play(move); rig.beginTrail(); },
    playLeft: name => { rig.rig.playLeft(name); }, setClawVisible: visible => { rig.setClawVisible(visible); },
    update: (dt, state) => { const r = state.renderer; rig.resize(r.domElement.width, r.domElement.height, r.getPixelRatio()); arms.update(dt, state); rig.advanceLook(dt); },
  } };
}

/**
 * A Model Explorer card: the arms stepped `settleFrames` through the idle with no walk or look so the cloth hangs, without
 * the swing trail; every mesh re-reads the drawing buffer it is drawn into. Out of the AO's transparency pre-pass, as held.
 */
export async function graphArmsSpecimen(slug: string, file: string, settleFrames: number, renderer: Renderer | null): Promise<Object3D> {
  const rig = await GraphArms.load(slug, file), still = { speed: 0, lookVel: new Vector2() };
  for (let i = 0; i < settleFrames; i++) rig.update(1 / 60, still);
  let bw = 0, bh = 0, pr = 0;
  const fit = (r: Renderer): void => {
    const c = r.domElement, p = r.getPixelRatio();
    if (c.width === bw && c.height === bh && p === pr) return;
    bw = c.width; bh = c.height; pr = p;
    rig.resize(bw, bh, pr);
  };
  if (renderer !== null) fit(renderer);
  rig.trail.mesh.removeFromParent();
  rig.root.traverse(node => {
    node.userData['treatAsOpaque'] = true;
    if (node instanceof Mesh) node.onBeforeRender = (r: Renderer) => { fit(r); };
  });
  return rig.root;
}
