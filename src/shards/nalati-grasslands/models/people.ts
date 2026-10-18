import * as THREE from 'three';
import { creatureFactory } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { FigureRows } from '@wildshard/game/systems/npc/figureRows';
import { SceneHandles } from '@wildshard/game/shardfile/sceneHandles';
import { installChannelPrograms } from '@wildshard/game/plugin/channelPrograms';
import type { ShardContext } from '@wildshard/game/shard/context';
import type { WorldRegistry, ColliderDesc } from '@wildshard/engine/world/registry';
import { FigureSkins } from '@wildshard/game/systems/npc/figureSkins';
import { bindRig, loadRigFile } from '@wildshard/engine/anim/rig';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { Scope } from '@wildshard/engine/app/scope';
import * as v from 'valibot';
import { resourceScope } from '@wildshard/engine/app/resources';
import { TIER } from '@wildshard/engine/core/tier';
import population from '../boot/peopleFrames.generated.json' with { type: 'json' };
import { shepherdRider } from '../creatures/sheepRaid';

const finite = v.pipe(v.number(), v.finite()), text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
/** A prepared skin and its original atlas images. Joint names and canvas cells
 * are author data; no fitting, fallback, motion law or callback is admitted. */
const FigureAtlasSchema = v.strictObject({
  url: text, name: text, skeleton: text,
  columns: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
  rows: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(8)),
  cell: v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(2048)),
  sources: v.pipe(v.array(text), v.minLength(1), v.maxLength(64)),
  joints: v.pipe(v.array(text), v.minLength(1), v.maxLength(128)),
  rim: finite, bands: finite,
});

/** Client-only merged draw intake. The original source images are packed on
 * the same canvas cells as their offline UVs. Every joint is a borrowed scene
 * handle; the supplied owner owns the draw and cancels late publication. */
export async function peopleSkin(input: unknown, sky: SkyRig, owner: Scope): Promise<THREE.SkinnedMesh> {
  const row = v.parse(FigureAtlasSchema, input);
  if (row.sources.length > row.columns * row.rows || new Set(row.joints).size !== row.joints.length)
    throw new Error('Invalid figure atlas layout');
  const [mesh, sources] = await Promise.all([FigureSkins.prepared(row.url), Promise.all(row.sources.map(url => loadRigFile(url)))]);
  owner.own(mesh.geometry); owner.own(mesh.skeleton);
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  if (owner.disposed) throw new Error('Figure left during skin admission');
  if (mesh.skeleton.bones.length !== row.joints.length || mesh.skeleton.bones.some((bone, i) => bone.name !== row.joints[i]))
    throw new Error('Prepared figure joint order differs');
  const canvas = document.createElement('canvas'); canvas.width = row.cell * row.columns; canvas.height = row.cell * row.rows;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Figure atlas canvas unavailable');
  context.imageSmoothingQuality = 'high';
  sources.forEach((source, i) => {
    const object = source.scene.getObjectByProperty('isMesh', true);
    if (!(object instanceof THREE.Mesh)) throw new Error('Missing figure atlas source');
    const material: unknown = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!(material instanceof THREE.MeshStandardMaterial) || material.map === null) throw new Error('Missing figure atlas image');
    context.drawImage(material.map.image as CanvasImageSource, i % row.columns * row.cell, Math.floor(i / row.columns) * row.cell, row.cell, row.cell);
  });
  const map = owner.own(new THREE.CanvasTexture(canvas)); map.flipY = false; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const material = owner.own(painterlyMaterial(sky, { map, rim: row.rim, bands: row.bands })); material.side = THREE.DoubleSide;
  mesh.material = material; mesh.name = row.name; mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  for (const bone of mesh.skeleton.bones) { bone.removeFromParent(); bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false; }
  bindRig(mesh, [], { skeleton: row.skeleton, clips: [], sockets: [] }, { skeleton: row.skeleton, joints: [row.joints] });
  return mesh;
}

/** Reusable world matrices are the remaining per-frame skin drawing code. */
export function npcFigurePose(): (p: { feet: THREE.Vector3; headWorld: THREE.Vector3; yaw: number; phase: number; headYaw: number; headPitch: number; armX: number; armZ: number }, frame: { neck: THREE.Vector3; shoulder: THREE.Vector3 }, write: (body: THREE.Matrix4, head: THREE.Matrix4, arm: THREE.Matrix4) => void, pivots?: { neck: THREE.Vector3; shoulder: THREE.Vector3 }) => void {
  const body = new THREE.Matrix4(), head = new THREE.Matrix4(), arm = new THREE.Matrix4();
  const q = new THREE.Quaternion(), hq = new THREE.Quaternion(), aq = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  return (p, frame, write, pivots = frame) => {
    body.compose(p.feet, q.setFromEuler(e.set(0, p.yaw, 0)), s.set(1, 1 + Math.sin(p.phase * 1.3) * 0.012, 1));
    hq.setFromEuler(e.set(p.headPitch, p.headYaw, 0, 'YXZ'));
    aq.setFromEuler(e.set(p.armX, 0, p.armZ));
    s.set(1, 1, 1);
    head.compose(pivots.neck, hq, s).premultiply(body);
    arm.compose(pivots.shoulder, aq, s).premultiply(body);
    write(body, head, arm);
    p.headWorld.copy(frame.neck).applyMatrix4(body); p.headWorld.y += 0.12;
  };
}

interface NpcFigureState { feet: THREE.Vector3; headWorld: THREE.Vector3; talking: boolean; yaw: number; idleYaw: number; headYaw: number; headPitch: number; armX: number; armZ: number; glanceT: number; glance: number; phase: number; ring: number }
export type PersonId = keyof typeof population.figures;
type Person = NpcFigureState & { readonly id: PersonId };
export interface CampPeople { ready: Promise<void>; group: THREE.Group; fig: Record<PersonId, Person>; update: (dt: number, t: number, player: THREE.Vector3) => void }

/** Per-frame view binding only: the row host owns every draw, joint and prompt. */
export function enteredPeople(w: { ctx: Pick<ShardContext, 'scope'> & { product: Pick<ShardContext['product'], 'shardfile'> }; sky: SkyRig; registry?: WorldRegistry | undefined }, floorAt: (x: number, z: number) => number): CampPeople {
  const channels = w.ctx.product.shardfile.clientChannels;
  if (channels === undefined) throw new Error('Missing admitted camp motion');
  const scope = w.ctx.scope, group = new THREE.Group(), resources = new SceneHandles(w.sky);
  group.name = population.name;
  const bones = population.atlas[TIER].joints.map(name => {
    const bone = new THREE.Bone(); bone.name = name; bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false;
    resources.publish(name.toLowerCase(), bone); return bone;
  });
  const fig = {} as Record<PersonId, Person>, still: ColliderDesc[] = [], moving: { colliders: ColliderDesc[]; follows: THREE.Object3D }[] = [], pose = npcFigurePose();
  const views = (Object.keys(population.figures) as PersonId[]).map(id => {
    const spec = population.figures[id], row = spec.row, feet = new THREE.Vector3(...row.feet); feet.y = floorAt(feet.x, feet.z);
    const view = new FigureRows(resources, { ...row, feet: feet.toArray() }, scope);
    const frame = { height: spec.frame.height, neck: new THREE.Vector3(...spec.frame.neck), shoulder: new THREE.Vector3(...spec.frame.shoulder) };
    const p: Person = { id, feet, headWorld: view.talkPoint, talking: false, yaw: row.yaw, idleYaw: row.yaw,
      headYaw: 0, headPitch: 0, armX: 0, armZ: 0, glanceT: spec.glanceAfter, glance: 0, phase: spec.phase, ring: 0 };
    fig[id] = p;
    const root = resources.object(`${row.id}.joint.root`), head = resources.object(`${row.id}.joint.head`), arm = resources.object(`${row.id}.joint.arm`);
    head.position.copy(frame.neck); arm.position.copy(frame.shoulder);
    const pivots = { neck: head.position, shoulder: arm.position };
    const write = (): void => { pose(p, frame, (body, h, a) => { root.matrixWorld.copy(body); head.matrixWorld.copy(h); arm.matrixWorld.copy(a); }, pivots); };
    const anchor = new THREE.Object3D();
    if (spec.moving) {
      anchor.name = population.pieces.moving.id; anchor.position.copy(feet); anchor.updateMatrixWorld(true); group.add(anchor);
      moving.push({ colliders: view.colliders.map(collider => ({ ...collider, surface: 'flesh' as const })), follows: anchor });
    } else for (const collider of view.colliders) {
      if (!('x' in collider)) throw new Error('Figure collider requires a local pose');
      still.push({ ...collider, surface: 'flesh', x: feet.x, y: feet.y + collider.y, z: feet.z });
    }
    const programs = channels.filter(program => program.numeric?.group === id);
    if (programs.length === 0) throw new Error('Missing admitted camp motion');
    const motion = installChannelPrograms(programs, id, new Map([['person', p]]));
    write();
    return { write, update: (dt: number, t: number, player: THREE.Vector3): void => {
      p.phase += dt;
      const dx = player.x - feet.x, dz = player.z - feet.z, distance = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz);
      const orbit = 'orbit' in spec.motion ? spec.motion.orbit : undefined;
      if (orbit !== undefined) {
        if (distance >= orbit.stopDistance && !p.talking) {
          p.ring += dt * orbit.speed;
          const x = orbit.x + Math.cos(p.ring) * orbit.radius, z = orbit.z + Math.sin(p.ring) * orbit.radius;
          feet.set(x, floorAt(x, z) + Math.abs(Math.sin(p.phase * orbit.frequency)) * orbit.lift, z);
          p.idleYaw = Math.atan2(-Math.sin(p.ring), Math.cos(p.ring)); anchor.position.copy(feet); anchor.updateMatrixWorld(true);
        } else feet.y += (floorAt(feet.x, feet.z) - feet.y) * (1 - Math.exp(-10 * dt));
      }
      motion.evaluate({ time: t, delta: dt, values: { distance, toYou, talk: Number(p.talking), playerY: player.y,
        decayFace: 1 - Math.exp(-(p.talking ? 5 : 2.5) * dt), decay4: 1 - Math.exp(-4 * dt), decay6: 1 - Math.exp(-6 * dt) } });
      write();
    } };
  });
  w.registry?.add({ ...population.pieces.still, category: 'people', surface: 'flesh', object: group, colliders: still });
  for (const piece of moving) w.registry?.add({ ...population.pieces.moving, category: 'people', surface: 'flesh', ...piece });
  const ready = peopleSkin(population.atlas[TIER], w.sky, scope).then(mesh => {
    for (const [i, bone] of bones.entries()) {
      const prepared = mesh.skeleton.bones[i]; if (prepared === undefined) throw new Error('Missing prepared pivot');
      bone.position.copy(prepared.position);
    }
    mesh.skeleton.bones = bones; group.add(mesh); for (const view of views) view.write(); return undefined;
  });
  return { group, fig, ready, update: (dt, t, player) => {
    const at = fig[population.sleep.figure as PersonId].feet;
    if (Math.hypot(player.x - at.x, player.z - at.z) <= population.sleep.distance) for (const view of views) view.update(dt, t, player);
  } };
}

export interface CampPersonParams { readonly person: PersonId }

const ID = 'nalati-grasslands/camp-people';

/** who the variant row offers, in the camp's order (src/shards/nalati-grasslands/quest.ts CAMP_PEOPLE) */
const PEOPLE: readonly { readonly id: PersonId; readonly label: string }[] = [
  { id: 'elder', label: 'Baqyt Ata, the elder' },
  { id: 'herderGate', label: 'Dauren, herder (corral gate)' },
  { id: 'herderRail', label: 'Erlan, herder (hitching rail)' },
  { id: 'child', label: 'Ayan, the child' },
  { id: 'cook', label: 'Gulnar Apa, the cook' },
];

export const campPeople: ModelDef<CampPersonParams> = defineModel<CampPersonParams>({
  id: 'nalati-grasslands/camp-people', name: 'Camp people', category: 'people', pipeline: ['hunyuan', 'code'],
  file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh',
  defaults: { person: 'elder' },
  variants: PEOPLE.map((p) => ({ id: p.id, label: p.label, params: { person: p.id } })),
  build: (ctx, p) => {
    const group = new THREE.Group(), owner = resourceScope();
    void peopleSkin(population.figures[p.person].atlas[TIER], ctx.sky, owner).then(mesh => {
      const [root, head, arm] = mesh.skeleton.bones;
      if (root === undefined || head === undefined || arm === undefined) throw new Error('Missing figure pivots');
      for (const bone of [root, head, arm]) { bone.matrixAutoUpdate = true; bone.matrixWorldAutoUpdate = true; }
      root.add(head, arm); mesh.add(root); group.add(mesh);
      group.updateMatrixWorld(true); mesh.skeleton.update(); mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: ID } }));
      return undefined;
    });
    return group;
  },
});

/** the mounted shepherd: his seated figure on the saddled camp horse's body bone, as the raid seats him (the horse is the
 *  Hunyuan3D-2 saddled hull on the horse's rig, the code horse until it loads; he is code) */
export const shepherd: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/shepherd', name: 'The mounted shepherd', category: 'people', pipeline: ['hunyuan', 'code'],
  file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh',
  defaults: {},
  build: (ctx) => {
    const f = creatureFactory(ctx);
    const rig = f.instantiate(f.model('horse', 'camp-bay'), 0.5);
    rig.bones['body']?.add(shepherdRider().rider);
    return rig.mesh;
  },
});
