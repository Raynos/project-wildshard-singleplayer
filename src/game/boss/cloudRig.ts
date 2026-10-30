/**
 * CI12: a cloud body (encounterView.ts CloudBody) without drawing, for a Node simulation of the fight it embodies. Its
 * scene's nodes become plain groups with the same transforms and children, its root takes the body's scale, and the same
 * channel programs pose the same parts from the same pose and ports, so `focusWorld` (the heart's place, what the
 * fight's target and lock read) is the page body's. The puffs, materials, ring and strip are drawn only and are absent;
 * a scene the rig cannot mirror exactly (an imported object, an anchor, a gate, a mesh without its geometry) refuses.
 *
 *   const body = new HeadlessCloudBody(rows, pose, ports);   // OpenArenaViews.body for a native fight
 */
import * as THREE from 'three';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import type { CloudBodyRows } from '@wildshard/format/encounterRows';
import { installChannelPrograms } from '../plugin/channelPrograms';

/** The scene's parts as groups (createClientScene's transforms, visibility and child order), by node id. */
function rigParts(input: unknown, geometry: ReadonlySet<string>): ReadonlyMap<string, THREE.Object3D> {
  const row = parsePrivateScene(input), parts = new Map<string, THREE.Object3D>();
  for (const node of row.nodes) {
    if (node.kind !== 'group' && node.kind !== 'mesh') throw new Error(`Cloud rig cannot mirror a ${node.kind} node`);
    if ('when' in node || 'whenTexture' in node || node.visibleWhen !== undefined) throw new Error('Cloud rig cannot mirror a gated node');
    if (node.kind === 'mesh' && !geometry.has(node.geometry)) throw new Error(`Cloud rig mesh has no geometry ${node.geometry}`);
    const object = new THREE.Group();
    if (node.name !== undefined) object.name = node.name;
    if (node.position !== undefined) object.position.set(...node.position);
    if (node.rotation !== undefined) object.rotation.set(...node.rotation, node.order ?? object.rotation.order);
    if (node.scale !== undefined) object.scale.set(...node.scale);
    if (node.visible !== undefined) object.visible = node.visible;
    parts.set(node.id, object);
  }
  for (const node of row.nodes) {
    const parent = parts.get(node.id); if (parent === undefined) continue;
    for (const id of node.children) { const child = parts.get(id); if (child !== undefined) parent.add(child); }
  }
  if (!parts.has(row.root)) throw new Error('Cloud rig root unavailable');
  return parts;
}

/** The fight's body port (OpenArenaViews.body) for a Node simulation: CloudBody's pose, visibility and focus, no draw. */
export class HeadlessCloudBody {
  readonly alpha = { value: 1 }; readonly flash = { value: 0 }; readonly glow = { value: 0.4 };
  readonly fogColour: THREE.Color = new THREE.Color(0.3, 0.32, 0.4);
  readonly focusPoint: THREE.Vector3 = new THREE.Vector3();
  visible = false;
  private readonly rows: CloudBodyRows;
  private readonly pose: Readonly<Record<string, number>>;
  private readonly parts: ReadonlyMap<string, THREE.Object3D>;
  private readonly draw: ReturnType<typeof installChannelPrograms>;
  constructor(input: CloudBodyRows, pose: Readonly<Record<string, number>>, ports: ReadonlyMap<string, unknown> = new Map()) {
    const rows = this.rows = input; this.pose = pose;
    this.parts = rigParts(rows.scene, new Set(Object.keys(rows.geometry)));
    this.part(rows.root).scale.setScalar(rows.scale);
    this.draw = installChannelPrograms(rows.poses, rows.group, new Map<string, unknown>([...this.parts, ...ports, ['pose', this.pose]]));
    this.setVisible(false);
  }
  part(key: string): THREE.Object3D { const object = this.parts.get(key); if (object === undefined) throw new Error(`Missing cloud body part ${key}`); return object; }
  setVisible(on: boolean): void {
    this.visible = on;
    for (const key of this.rows.shown) this.part(key).visible = on;
    if (!on) { this.part(this.rows.focus.ring).visible = false; this.part(this.rows.focus.dome).visible = false; }
  }
  /** The strip toward the struck spear is drawn only. */
  aim(_target: THREE.Vector3 | null, _alpha: number): void { /* drawn only */ }
  /** CloudBody.update's pose: the channel programs at `t`, the world matrices, the focus and the ring's shown state. */
  update(t: number, _camera: THREE.Camera): void {
    const rows = this.rows, f = rows.focus, open = this.pose[f.open] ?? 0;
    this.draw.evaluate({ time: t, delta: 0, values: {} });
    this.part(rows.root).updateMatrixWorld(true);
    this.focusWorld(this.focusPoint);
    this.part(f.ring).visible = this.visible && open > 0.02;
  }
  /** the focus's world position (after `update`) */
  focusWorld(out: THREE.Vector3): THREE.Vector3 { return this.part(this.rows.focus.part).getWorldPosition(out); }
}
