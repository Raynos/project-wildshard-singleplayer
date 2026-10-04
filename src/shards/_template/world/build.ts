import { boxDesc, heightAt, type Interactable } from '@wildshard/engine';
import type { ShardContext } from '@wildshard/game';
import { BoxGeometry, CircleGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { HUT } from '../layout';
import { STRINGS } from '../strings';
import { ownPrimitives } from '../world/resources';

const cube = (w: number, h: number, d: number, color = 0x888888): Mesh => new Mesh(new BoxGeometry(w, h, d), new MeshStandardMaterial({ color, flatShading: true }));
export function buildWorld(ctx: ShardContext, propCount: number): { door: Interactable; doorAt: Vector3 } {
  const y = ctx.manifest.ground.terrain?.heightAt(HUT.x, HUT.z) ?? 0;
  const hut = new Group(); hut.position.set(HUT.x, y, HUT.z);
  const roof = cube(6, 0.3, 6); roof.position.y = 3; hut.add(roof);
  const colliders = [];
  for (const [x, z, hw, hd] of [[-3, 0, 0.15, 3], [3, 0, 0.15, 3], [0, -3, 3, 0.15], [-2, 3, 1, 0.15], [2, 3, 1, 0.15]]) {
    if (x === undefined || z === undefined || hw === undefined || hd === undefined) continue;
    const wall = cube(hw * 2, 3, hd * 2); wall.position.set(x, 1.5, z); hut.add(wall);
    colliders.push(boxDesc({ x: HUT.x + x, z: HUT.z + z, hw, hd, rot: 0, yBottom: y, yTop: y + 3 }, 'wood'));
  }
  ctx.root.add(hut); ctx.piece({ id: 'template.hut', name: STRINGS.hut, category: 'buildings', file: 'src/shards/_template/world/build.ts', object: hut, colliders, surface: 'wood' });
  const doorAt = new Vector3(HUT.x, y + 1.2, HUT.doorZ), panel = cube(1.8, 2.5, 0.2, 0x555555); panel.position.copy(doorAt); let open = false;
  ctx.root.add(panel); ctx.piece({ id: 'template.door', name: STRINGS.door, category: 'buildings', file: 'src/shards/_template/world/build.ts', object: panel,
    colliders: [boxDesc({ x: HUT.x, z: HUT.doorZ, hw: 0.9, hd: 0.1, rot: 0, yBottom: y, yTop: y + 2.5 }, 'wood')], active: () => !open });
  const door: Interactable = { label: STRINGS.door, position: doorAt, radius: 3,
    onInteract: () => { open = !open; panel.visible = !open; door.label = open ? STRINGS.close : STRINGS.door; } };
  const ramp = new Group(), from: [number, number, number] = [8, heightAt(8, -8), -8], to: [number, number, number] = [8, from[1] + 2, -14];
  for (let i = 0; i < 10; i++) { const tread = cube(3, 0.2, 0.6); tread.position.set(8, from[1] + (i + 1) * 0.2 - 0.1, -8 - (i + 0.5) * 0.6); ramp.add(tread); }
  const slope = cube(3, 0.24, Math.sqrt(40)); slope.position.set(12, from[1] + 0.9, -11); slope.rotation.x = Math.atan2(2, 6); ramp.add(slope);
  ctx.root.add(ramp); ctx.piece({ id: 'template.ramp', name: STRINGS.ramp, category: 'buildings', file: 'src/shards/_template/world/build.ts', object: ramp,
    colliders: [{ kind: 'box', x: 12, y: from[1] + 0.9, z: -11, hx: 1.5, hy: 0.12, hz: Math.sqrt(40) / 2,
      rot: { x: Math.sin(Math.atan2(2, 6) / 2), y: 0, z: 0, w: Math.cos(Math.atan2(2, 6) / 2) }, surface: 'wood' },
      { kind: 'treads', from: { x: from[0], y: from[1], z: from[2] }, to: { x: to[0], y: to[1], z: to[2] }, width: 3, count: 10, surface: 'wood' }], surface: 'wood' });
  const props = new Group(), random = ctx.app.rng.stream('cosmetic');
  for (let i = 0; i < propCount; i++) { const x = random.range(-25, 25), z = random.range(5, 30), prop = cube(0.6, 0.6, 0.6); prop.position.set(x, heightAt(x, z) + 0.3, z); props.add(prop); }
  ctx.root.add(props); ctx.piece({ id: 'template.props', name: STRINGS.props, category: 'props', file: 'src/shards/_template/world/build.ts', object: props });
  const pool = new Mesh(new CircleGeometry(5, 24), new MeshStandardMaterial({ color: 0x9aa6b0, transparent: true, opacity: 0.7 }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(25, 0, 20); ctx.root.add(pool);
  ownPrimitives(ctx.root, ctx.scope);
  return { door, doorAt };
}
