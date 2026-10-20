/** Client-only figure presentation; story decisions remain outside this host. */
import * as THREE from 'three';
import * as v from 'valibot';
import { bindRig } from '@wildshard/engine/anim/rig';
import type { BoxSpec } from '@wildshard/engine/physics/box';
import type { ColliderDesc, WorldRegistry } from '@wildshard/engine/world/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { TIER } from '@wildshard/engine/core/tier';
import { resourceScope } from '@wildshard/engine/app/resources';
import type { Scope } from '@wildshard/engine/app/scope';
import { FigureGroupSchema, FigureRowSchema, type FigureRow, type FigureSkinRow } from '@wildshard/format/figures';
import type { ScenePointRef } from '@wildshard/format/sceneRefs';
import { SceneHandles } from '../../shardfile/sceneHandles';
import { installChannelPrograms } from '../../plugin/channelPrograms';
import { atlasFigureSkin, FigureSkins } from './figureSkins';
import { standingFigure, type FigureSkinState } from './standingFigure';

const skins = new FigureSkins();
const entered = new WeakMap<Scope, Map<string, Set<FigureRows>>>();
function sourceId(ref: ScenePointRef): string {
  if (!('part' in ref)) throw new Error('Figure object requires a scene part');
  return ref.part;
}
function anchorColliders(box: FigureRow['collider']): readonly ColliderDesc[] {
  return box === undefined ? [] : box.kind === 'box' ? [{ kind: 'box', x: 0, y: (box.top - box.bottom) / 2,
    z: 0, hx: box.half, hy: (box.top + box.bottom) / 2, hz: box.half }] : [{ ...box, x: 0, z: 0 }];
}

/** Rows name resources; this owner publishes roots, prompts, joints and sockets.
 * Geometry/material handles are borrowed. Per-instance skeletons and attachment
 * geometry belong to the figure. `resources` is its publication namespace.
 * Eviction cancels late skin publication.
 */
export class FigureRows {
  /** Resolve the actual scoped figure by its admitted identity, never a shard port. */
  static entered(owner: Scope, id: string): FigureRows {
    const figures = [...entered.get(owner)?.get(id) ?? []].filter(figure => figure.active), figure = figures[0];
    if (owner.disposed || figures.length !== 1 || figure === undefined) throw new Error(`Figure is not entered: ${id}`);
    return figure;
  }
  /** Loading-screen intake shares immutable sources with subsequent instances. */
  static async prepareSkins(rows: readonly FigureSkinRow[]): Promise<void> { await Promise.all(rows.map(row => skins.load(row))); }
  /** The same data anchors are usable by the model registry before a draw exists. */
  static collidersFor(input: unknown): readonly ColliderDesc[] { return anchorColliders(v.parse(FigureRowSchema, input).collider); }
  readonly group: THREE.Group;
  readonly talkPoint = new THREE.Vector3();
  readonly collider: BoxSpec;
  readonly colliders: readonly ColliderDesc[];
  readonly ready: Promise<void>;
  talking = false;
  private live = true;
  private releaseEntry: () => void = () => undefined;
  private readonly publications = new Map<string, THREE.Object3D | THREE.Vector3>();
  private readonly draws: THREE.Object3D[];
  private readonly row: FigureRow;
  private readonly person: ReturnType<typeof standingFigure> | undefined;
  private readonly skinState: FigureSkinState = { pending: null, owned: [] };

  constructor(readonly resources: SceneHandles, input: unknown, owner: Scope = resourceScope()) {
    if (owner.disposed) throw new Error('Figure owner is disposed');
    const row = v.parse(FigureRowSchema, input); this.row = row;
    const ids = [`${row.id}.root`, `${row.id}.prompt`, ...row.joints.map(joint => joint.id), ...row.sockets.map(socket => socket.id)];
    if (new Set(ids).size !== ids.length || ids.some(id => resources.has(id))) throw new Error('Duplicate figure publication');
    this.group = row.root === undefined ? new THREE.Group() : resources.group(sourceId(row.root));
    if (row.root === undefined) { this.group.name = row.name; this.group.position.fromArray(row.feet); this.group.rotation.y = row.yaw; }
    const p = this.group.position, box = row.collider;
    this.collider = { x: p.x, z: p.z, hw: box?.kind === 'box' ? box.half : 0, hd: box?.kind === 'box' ? box.half : 0,
      rot: 0, yTop: p.y + (box?.kind === 'box' ? box.top : 0), yBottom: p.y - (box?.kind === 'box' ? box.bottom : 0) };
    this.colliders = anchorColliders(box);
    this.draws = row.visible.map(ref => resources.object(sourceId(ref)));
    const joints = row.joints.flatMap(joint => 'source' in joint ? [{ id: joint.id, object: resources.object(sourceId(joint.source)) }] : []);
    const replacement = row.replacement === undefined ? undefined : {
      target: resources.mesh(sourceId(row.replacement.target)), source: resources.geometry(row.replacement.geometry),
    };
    if (row.fallback !== undefined) {
      if (row.motion === undefined) throw new Error('Standing figure requires motion rows');
      const f = row.fallback; resources.geometry(f.geometry); resources.material(f.material); resources.material(f.glow);
      if (f.glass !== null) resources.geometry(f.glass);
    }
    if (row.skin !== undefined && row.fallback === undefined) throw new Error('Baked skin requires a standing fallback');
    if (row.skin === undefined && row.joints.some(joint => 'bone' in joint)) throw new Error('Baked joint requires a skin');
    const pivotSockets = row.skin !== undefined ? [] : row.sockets.map(socket => ({ id: socket.id,
      object: joints.find(joint => joint.id === socket.joint)?.object ?? resources.object(socket.joint) }));
    bindRig(this.group, [], row.rig, { skeleton: row.rig.skeleton, procedural: row.rig.clips });
    this.publish(`${row.id}.root`, this.group); this.publish(`${row.id}.prompt`, this.talkPoint);
    for (const joint of joints) this.publish(joint.id, joint.object);
    for (const socket of pivotSockets) this.publish(socket.id, socket.object);
    this.person = row.fallback === undefined ? undefined : standingFigure(this.group, resources, row, this.skinState);
    this.refreshPoint();
    const figures = entered.get(owner) ?? new Map<string, Set<FigureRows>>(), group = figures.get(row.id) ?? new Set<FigureRows>();
    group.add(this); figures.set(row.id, group); entered.set(owner, figures);
    this.releaseEntry = () => { group.delete(this); if (group.size === 0) figures.delete(row.id); };
    owner.onDispose(() => { this.dispose(); });
    this.ready = (async () => {
      try {
      if (replacement !== undefined) {
        await Promise.resolve();
        if (!this.live) return;
        const geometry = replacement.source.clone();
        replacement.target.geometry.dispose(); replacement.target.geometry = geometry; this.skinState.owned.push(geometry);
      }
      if (row.skin === undefined) return;
      await skins.load(row.skin);
      if (!this.live) return;
      const rig = skins.rig(row.skin, resources.sky);
      if (rig === null) throw new Error('Baked figure skin was not prepared');
      this.skinState.pending = rig; this.skinState.owned.push(rig.mesh.skeleton);
      for (const joint of row.joints) if ('bone' in joint) {
        const bone = rig.mesh.skeleton.bones.find(candidate => candidate.name === joint.bone);
        if (bone === undefined) throw new Error(`Missing figure joint: ${joint.bone}`);
        this.publish(joint.id, bone);
      }
      for (const socket of row.sockets) {
        const joint = rig.mesh.skeleton.bones.find(bone => bone.name === socket.joint);
        if (joint === undefined) throw new Error(`Missing figure socket: ${socket.joint}`);
        this.publish(socket.id, joint);
      }
      } catch (error: unknown) { this.dispose(); throw error; }
    })();
  }
  private publish(id: string, object: THREE.Object3D | THREE.Vector3): void {
    this.resources.publish(id, object); this.publications.set(id, object);
  }
  private refreshPoint(): void {
    this.group.updateWorldMatrix(true, false);
    this.talkPoint.set(0, this.row.talkHeight, 0).applyMatrix4(this.group.matrixWorld);
  }
  /** Refresh a borrowed pivot figure's world prompt without advancing its law. */
  syncAnchors(): void { if (this.live) this.refreshPoint(); }
  headWorld(out: THREE.Vector3): THREE.Vector3 { this.refreshPoint(); return out.copy(this.talkPoint); }
  get active(): boolean { return this.live; }
  /** Walking updates the same collider and prompt objects read by the quest. */
  walkTo(x: number, y: number, z: number): void { if (this.live) this.person?.walkTo(x, y, z); }
  lod(distance: number): void {
    if (!this.live) return;
    if (this.person !== undefined) this.person.lod(distance);
    else for (const draw of this.draws) draw.visible = distance < this.row.drawDistance;
  }
  update(dt: number, t: number, player: THREE.Vector3): void {
    if (!this.live) return;
    if (this.person !== undefined) {
      this.person.talking = this.talking; this.person.update(dt, t, player);
      this.talkPoint.copy(this.person.talkPoint); Object.assign(this.collider, this.person.collider);
    } else this.refreshPoint();
  }
  /** Late loads cannot attach or publish into an evicted scene. */
  dispose(): void {
    if (!this.live) return;
    this.live = false; this.releaseEntry(); this.skinState.pending = null;
    for (const [id, object] of this.publications) this.resources.release(id, object);
    this.publications.clear();
    for (const owned of this.skinState.owned) owned.dispose(); this.skinState.owned.length = 0;
  }
}

/** One group figure's live pose: the fields its channel programs read and write (owner `person`). */
export interface FigureGroupMember {
  feet: THREE.Vector3; headWorld: THREE.Vector3; talking: boolean; yaw: number; idleYaw: number;
  headYaw: number; headPitch: number; armX: number; armZ: number; glanceT: number; glance: number; phase: number; ring: number;
}
/** A merged figure group's live view (format/figures.ts `FigureGroupSchema`). */
export interface FigureGroup {
  readonly ready: Promise<void>;
  readonly group: THREE.Group;
  readonly figures: ReadonlyMap<string, FigureGroupMember>;
  update: (dt: number, t: number, player: THREE.Vector3) => void;
}

/** The body (a breath of vertical scale), head and arm matrices from a member's pose; matrices reused. */
function memberPose(): (p: FigureGroupMember, neck: THREE.Vector3, write: (body: THREE.Matrix4, head: THREE.Matrix4, arm: THREE.Matrix4) => void, pivots: { neck: THREE.Vector3; shoulder: THREE.Vector3 }) => void {
  const body = new THREE.Matrix4(), head = new THREE.Matrix4(), arm = new THREE.Matrix4();
  const q = new THREE.Quaternion(), hq = new THREE.Quaternion(), aq = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  return (p, neck, write, pivots) => {
    body.compose(p.feet, q.setFromEuler(e.set(0, p.yaw, 0)), s.set(1, 1 + Math.sin(p.phase * 1.3) * 0.012, 1));
    hq.setFromEuler(e.set(p.headPitch, p.headYaw, 0, 'YXZ'));
    aq.setFromEuler(e.set(p.armX, 0, p.armZ));
    s.set(1, 1, 1);
    head.compose(pivots.neck, hq, s).premultiply(body);
    arm.compose(pivots.shoulder, aq, s).premultiply(body);
    write(body, head, arm);
    p.headWorld.copy(neck).applyMatrix4(body); p.headWorld.y += 0.12;
  };
}

/**
 * Enter a merged figure group: every figure is a FigureRows over the root, head and arm joints this group publishes,
 * walked along its orbit, moved by its admitted channel programs (the head, face and arm, group = the figure id) and
 * posed once a frame, all drawn as one atlas skin (`atlasFigureSkin`). The still figures' colliders register as one
 * piece, each moving figure's as its own; the floor is the terrain or a registered deck just above it. The group sleeps
 * beyond `sleep.distance` of `sleep.figure`.
 */
export function enterFigureGroup(w: { scope: Scope; sky: SkyRig; registry: WorldRegistry; channels: unknown }, input: unknown): FigureGroup {
  const rows = v.parse(FigureGroupSchema, input), atlas = rows.atlas[TIER], scope = w.scope;
  const group = new THREE.Group(), resources = new SceneHandles(w.sky);
  group.name = rows.name;
  const floorAt = (x: number, z: number): number => { const y = terrainHeight(x, z), deck = w.registry.floorAt(x, z); return deck !== undefined && deck > y && deck < y + 2 ? deck : y; };
  const bones = atlas.joints.map(name => {
    const bone = new THREE.Bone(); bone.name = name; bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false;
    resources.publish(name.toLowerCase(), bone); return bone;
  });
  const figures = new Map<string, FigureGroupMember>(), still: ColliderDesc[] = [], pose = memberPose();
  const views = Object.entries(rows.figures).map(([id, spec]) => {
    const row = v.parse(FigureRowSchema, spec.row), feet = new THREE.Vector3(...row.feet); feet.y = floorAt(feet.x, feet.z);
    const view = new FigureRows(resources, { ...row, feet: feet.toArray() }, scope);
    const neck = new THREE.Vector3(...spec.frame.neck);
    const p: FigureGroupMember = { feet, headWorld: view.talkPoint, get talking() { return view.talking; }, set talking(value: boolean) { view.talking = value; },
      yaw: row.yaw, idleYaw: row.yaw, headYaw: 0, headPitch: 0, armX: 0, armZ: 0, glanceT: spec.glanceAfter, glance: 0, phase: spec.phase, ring: 0 };
    figures.set(id, p);
    const root = resources.object(`${row.id}.joint.root`), head = resources.object(`${row.id}.joint.head`), arm = resources.object(`${row.id}.joint.arm`);
    head.position.copy(neck); arm.position.fromArray(spec.frame.shoulder);
    const pivots = { neck: head.position, shoulder: arm.position };
    const write = (): void => { pose(p, neck, (body, h, a) => { root.matrixWorld.copy(body); head.matrixWorld.copy(h); arm.matrixWorld.copy(a); }, pivots); };
    const anchor = new THREE.Object3D();
    if (spec.moving) {
      anchor.name = rows.pieces.moving.id; anchor.position.copy(feet); anchor.updateMatrixWorld(true); group.add(anchor);
      w.registry.add({ ...rows.pieces.moving, colliders: view.colliders.map(collider => ({ ...collider, surface: 'flesh' as const })), follows: anchor });
    } else for (const collider of view.colliders) {
      if (!('x' in collider)) throw new Error('Figure collider requires a local pose');
      still.push({ ...collider, surface: 'flesh', x: feet.x, y: feet.y + collider.y, z: feet.z });
    }
    const motion = installChannelPrograms(w.channels, id, new Map([['person', p]])), orbit = spec.motion.orbit;
    write();
    return { write, update: (dt: number, t: number, player: THREE.Vector3): void => {
      p.phase += dt;
      const dx = player.x - feet.x, dz = player.z - feet.z, distance = Math.hypot(dx, dz), toYou = Math.atan2(dx, dz);
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
  const sleeper = figures.get(rows.sleep.figure);
  if (sleeper === undefined) throw new Error(`Missing sleeping figure: ${rows.sleep.figure}`);
  w.registry.add({ ...rows.pieces.still, object: group, colliders: still });
  const ready = atlasFigureSkin(atlas, w.sky, scope).then(mesh => {
    for (const [i, bone] of bones.entries()) {
      const prepared = mesh.skeleton.bones[i]; if (prepared === undefined) throw new Error('Missing prepared pivot');
      bone.position.copy(prepared.position);
    }
    mesh.skeleton.bones = bones; group.add(mesh); for (const view of views) view.write(); return undefined;
  });
  return { group, figures, ready, update: (dt, t, player) => {
    if (Math.hypot(player.x - sleeper.feet.x, player.z - sleeper.feet.z) <= rows.sleep.distance) for (const view of views) view.update(dt, t, player);
  } };
}
