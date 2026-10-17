/**
 * The nomad camp's people (NALATI-MERGE Q2; N16 wave 5: "procedural painterly figures now, generated + rigged models
 * later" — row D2). Five figures on the shared painterly POI material (src/shards/nalati-grasslands/world/paint.ts PaintKit → poiMaterial,
 * soft cel bands, the cool painted shade, the warm rim), each baked from smooth lathes, capsules and spheres with
 * per-vertex paint:
 *
 *   elder   Baqyt Ata, the quest giver — an indigo chapan with a gold hem, a red sash, a tall white kalpak with a black
 *           brim, a white beard, a staff (asa-tayaq); by the big yurt's door
 *   herder  Dauren at the corral gate (a fur tymaq with ear flaps, a whip) and Erlan at the hitching rail (a kalpak)
 *   child   Ayan — a green vest, an embroidered taqiya — skipping rings round the ribbon pole
 *   cook    Gulnar Apa at the iron stove — a long red dress, a velvet waistcoat, a white apron and headscarf, a ladle
 *
 * D2: the same five as generated + rigged models (src/shards/nalati-grasslands/campPeopleModels.ts, the image-to-3D pipeline — the user's
 * pick, N20) — one SkinnedMesh on the figures' own root / head / arm pivots, driven by this runtime. The procedural batch
 * below is their frame (heights, pivots), shows while they load, and its readable faces are what NALATI-FINISH B5 moves
 * onto the model bodies.
 *
 * ONE BatchedMesh for all of them (a body, a head and a right arm per figure = 15 instances): 1 draw + 1 shadow draw,
 * whatever the tier (the phone budget, ≤ ~110 calls at the camp). Each figure turns to face you as you come near,
 * breathes, glances about; the head follows you; while talking it gestures (the arm) and nods; the cook stirs, the
 * child skips until you are close. Colliders: a capsule each, registered with the world registry (the still ones as one
 * static piece, the child on a kinematic body that `follows` her), so they are drawn and collide from one `add`
 * (PHYSICS.md; the way P1 registers the Nalati builders). Their Model Explorer card is the People model
 * (src/shards/nalati-grasslands/models/people.ts, E315 M5), listed with the shard's roster.
 *
 *   const people = buildCampPeople(sky, floorAt, registry);
 *   people.update(dt, t, player.position)           // every frame (cheap: skipped past 90 m)
 *   people.fig.elder.talking = true                  // gestures + nods while the dialogue is open
 *   people.fig.elder.headWorld                       // where its "[E] Talk" prompt sits
 */
import * as THREE from 'three';
import * as v from 'valibot';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldRegistry, ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { v3, poiMaterial } from './world/paint';
import content from './data/questContent.json' with { type: 'json' };
import frameRows from './boot/peopleFrames.generated.json' with { type: 'json' };
import { loadPeopleRig, peopleModelUrl, type NpcFigureFrame as PersonFrame, type NpcFigureRig as PeopleRig } from './campPeopleModels';
import { stepNpcFigure, npcFigurePose, type NpcFigureMotionProfile } from './models/npc/figureMotion';
import fallbackRows from './boot/peopleFallback.generated.json' with { type: 'json' };
import { assetBytes } from '@wildshard/sdk/assets';
import { readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';

export type PersonId = keyof typeof content.people;

/** one figure's live state */
export interface Person {
  id: PersonId;
  /** feet, world */
  readonly feet: THREE.Vector3;
  /** the talk prompt's point (head height, world; follows the child) */
  readonly headWorld: THREE.Vector3;
  talking: boolean;
  /** body yaw now (radians; 0 = the figure faces +z) */
  yaw: number;
}

export interface CampPeople {
  /** The play hook waits until the real figures are adopted or loading has failed. */
  ready: Promise<void>;
  group: THREE.Group;
  fig: Record<PersonId, Person>;
  update: (dt: number, t: number, player: THREE.Vector3) => void;
}

const FallbackGeometry = v.object({ attrs: v.array(v.tuple([v.string(), v.literal('f32'), v.number(), v.boolean()])),
  count: v.number(), index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: v.number(), box: v.boolean() });

interface Parts extends PersonFrame { body: THREE.BufferGeometry; head: THREE.BufferGeometry; arm: THREE.BufferGeometry; radius: number }
/** The offline fallback preserves every float, paint channel and pivot. */
function fallbackParts(id: PersonId): Parts {
  const row = fallbackRows[id], frame = frameRows[id];
  const read = (part: typeof row.body): THREE.BufferGeometry => {
    const geometry = readBakedGeometry(assetBytes(part.bytes), 0, v.parse(FallbackGeometry, part.row));
    if (!part.row.expand) return geometry;
    const flat = geometry.toNonIndexed(); geometry.dispose(); return flat;
  };
  return { body: read(row.body), head: read(row.head), arm: read(row.arm), radius: row.radius,
    height: frame.height, neck: new THREE.Vector3(...frame.neck), shoulder: new THREE.Vector3(...frame.shoulder) };
}

/** one procedural figure at rest (feet at the origin, facing +z) — the comparison sheets (scripts/nalati-models-merge-compare.mjs) */
export function personPreview(sky: Sky, id: PersonId): THREE.Group { return personFigure(sky, id).group; }

/** one procedural figure at rest and its frame (the height and pivots the generated figure is fitted to, as the camp's) —
 *  the Model Explorer's specimen (src/shards/nalati-grasslands/models/people.ts, E315 M5) */
export function personFigure(sky: Sky, id: PersonId): { group: THREE.Group; frame: PersonFrame } {
  const p = fallbackParts(id), mat = poiMaterial(sky), g = new THREE.Group();
  g.add(new THREE.Mesh(p.body, mat));
  const headM = new THREE.Mesh(p.head, mat); headM.position.copy(p.neck); g.add(headM);
  const armM = new THREE.Mesh(p.arm, mat); armM.position.copy(p.shoulder); g.add(armM);
  return { group: g, frame: { height: p.height, neck: p.neck, shoulder: p.shoulder } };
}

// ── the runtime ──────────────────────────────────────────────────────────────────────────────────────────────────────

interface Live extends Person {
  profile: { frame: PersonFrame; motion: NpcFigureMotionProfile; model: string; phase: number; glanceAfter: number; collider: { height: number; radius: number } };
  parts: Parts;
  ids: { body: number; head: number; arm: number };
  idleYaw: number;
  headYaw: number; headPitch: number;
  armX: number; armZ: number;
  glanceT: number; glance: number;
  phase: number;
  /** the child's ring round the pole (angle) */
  ring: number;
  anchor: THREE.Object3D | null;
}

const CHILD_RING = 2.3;

/** `loadRig`: the people's rig loader (the shard's by default; a test passes its own) */
export function buildCampPeople(sky: Sky, floorAt: (x: number, z: number) => number, registry: WorldRegistry | null, scope?: Scope, loadRig: typeof loadPeopleRig = loadPeopleRig): CampPeople {
  const built: Record<PersonId, Parts> = { elder: fallbackParts('elder'), herderGate: fallbackParts('herderGate'), herderRail: fallbackParts('herderRail'), child: fallbackParts('child'), cook: fallbackParts('cook') };
  const ids = Object.keys(built) as PersonId[];
  let verts = 0;
  for (const id of ids) { const p = built[id]; verts += p.body.getAttribute('position').count + p.head.getAttribute('position').count + p.arm.getAttribute('position').count; }
  const batch = new THREE.BatchedMesh(ids.length * 3, verts, 0, poiMaterial(sky));
  batch.name = 'nalati-camp-people';
  batch.castShadow = true; batch.receiveShadow = true;
  batch.sortObjects = false; batch.perObjectFrustumCulled = true; batch.frustumCulled = false; // instances move: three culls each one
  const group = new THREE.Group();
  group.name = 'nalati-camp-people';
  group.add(batch);

  const fig = {} as Record<PersonId, Live>;
  for (const id of ids) {
    const parts = built[id], spot = content.people[id], profile = { frame: parts, model: peopleModelUrl(id), motion: fallbackRows[id].motion as NpcFigureMotionProfile,
      phase: ids.indexOf(id) * 1.7, glanceAfter: 2 + ids.indexOf(id), collider: { height: parts.height, radius: parts.radius } };
    const g = { body: batch.addGeometry(parts.body), head: batch.addGeometry(parts.head), arm: batch.addGeometry(parts.arm) };
    parts.body.dispose(); parts.head.dispose(); parts.arm.dispose();
    const x = id === 'child' ? spot.x + CHILD_RING : spot.x, z = spot.z;
    fig[id] = {
      id, parts, profile, feet: v3(x, floorAt(x, z), z), headWorld: new THREE.Vector3(), talking: false, yaw: spot.yaw,
      ids: { body: batch.addInstance(g.body), head: batch.addInstance(g.head), arm: batch.addInstance(g.arm) },
      idleYaw: spot.yaw, headYaw: 0, headPitch: 0, armX: 0, armZ: 0, glanceT: profile.glanceAfter, glance: 0, phase: profile.phase, ring: 0, anchor: null,
    };
  }

  // colliders: a capsule per figure; the four who stay put as one static piece, the child on a body that follows her
  const capsule = (p: Live, local: boolean): ColliderDesc => {
    const { radius: r, height } = p.profile.collider, hh = Math.max(0.05, height / 2 - r);
    return { kind: 'capsule', x: local ? 0 : p.feet.x, y: (local ? 0 : p.feet.y) + height / 2, z: local ? 0 : p.feet.z, halfHeight: hh, radius: r, surface: 'flesh' };
  };
  const still = ids.filter((id) => id !== 'child').map((id) => capsule(fig[id], false));
  const childAnchor = new THREE.Object3D();
  childAnchor.name = 'nalati-camp-child';
  group.add(childAnchor);
  fig.child.anchor = childAnchor;
  const place = (p: Live): void => { p.anchor?.position.copy(p.feet); p.anchor?.updateMatrixWorld(true); };
  place(fig.child);
  if (registry) {
    // (their Model Explorer card is the model, src/shards/nalati-grasslands/models/people.ts, listed with the shard's roster: E315 M5)
    registry.add({ id: 'nalati-camp-people', name: 'Camp people', category: 'people', file: 'src/shards/nalati-grasslands/campPeople.ts', object: group, colliders: still, surface: 'flesh' });
    registry.add({ id: 'nalati-camp-child', name: 'Camp child', category: 'people', file: 'src/shards/nalati-grasslands/campPeople.ts', colliders: [capsule(fig.child, true)], surface: 'flesh', follows: childAnchor });
  }

  // D2: the generated + rigged figures (campPeopleModels.ts) on the procedural figures' frames
  const frames = {} as Record<PersonId, PersonFrame>;
  const models = {} as Record<PersonId, string>;
  for (const id of ids) { frames[id] = fig[id].profile.frame; models[id] = fig[id].profile.model; }
  let rig: PeopleRig<PersonId> | null = null;

  const writePose = npcFigurePose();
  const pose = (p: Live): void => {
    const bones = rig?.bones[p.id];
    writePose(p, p.parts, (bodyMatrix, headMatrix, armMatrix) => {
      if (bones) {
        bones.root.matrixWorld.copy(bodyMatrix); bones.head.matrixWorld.copy(headMatrix); bones.arm.matrixWorld.copy(armMatrix);
      } else {
        batch.setMatrixAt(p.ids.body, bodyMatrix); batch.setMatrixAt(p.ids.head, headMatrix); batch.setMatrixAt(p.ids.arm, armMatrix);
      }
    }, bones);
  };

  // The play hook awaits ready behind the loading screen; the procedural batch remains only on a load failure.
  for (const id of ids) pose(fig[id]);
  const ready = loadRig(sky, frames, models).then((r) => {
    scope?.own(r.mesh.geometry); scope?.own(r.mesh.skeleton);
    for (const material of Array.isArray(r.mesh.material) ? r.mesh.material : [r.mesh.material]) {
      if (material instanceof THREE.MeshLambertMaterial && material.map) scope?.own(material.map);
      scope?.own(material);
    }
    if (scope?.disposed === true) return undefined;
    group.add(r.mesh);
    rig = r; batch.visible = false;
    for (const id of ids) pose(fig[id]);
    return undefined;
  }).catch((e: unknown) => { console.warn('[nalati] camp people models failed: the procedural figures stay', e); });

  let asleep = false;
  const update = (dt: number, t: number, player: THREE.Vector3): void => {
    const far = Math.hypot(player.x - fig.elder.feet.x, player.z - fig.elder.feet.z) > 90;
    if (far) { asleep = true; return; }   // nothing to see from out of the valley: the last pose holds
    if (asleep) asleep = false;
    for (const id of ids) {
      const p = fig[id];
      if (stepNpcFigure(p, p.profile.frame, p.profile.motion, dt, t, player, floorAt)) place(p);
      pose(p);
    }
  };
  return { group, fig, update, ready };
}
