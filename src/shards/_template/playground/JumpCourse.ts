import type { Playground, PlaygroundHost } from '#engine';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { STRINGS } from '../strings';
import { ownPrimitives } from '../world/resources';

export class JumpCourse implements Playground {
  readonly id = 'template.jump'; readonly title = STRINGS.jump; readonly center = { x: 0, z: 0 };
  readonly root = new Group(); readonly map: Playground['map'] = { bounds: { x0: -5, x1: 5, z0: -12, z1: 3 }, shapes: [0, 1, 2].map((i) => ({ kind: 'rect', x0: -1.5, x1: 1.5, z0: -i * 4 - 1.5, z1: -i * 4 + 1.5, fill: '#888888' })), markers: () => [] };
  entered = false; private readonly host: PlaygroundHost; private readonly saved = new Vector3(); private yaw = 0;
  constructor(host: PlaygroundHost) { this.host = host;
    for (let i = 0; i < 3; i++) { const z = -i * 4, y = 3000 + i * 0.3, pad = new Mesh(new BoxGeometry(3, 0.3, 3), new MeshStandardMaterial({ color: 0x888888, flatShading: true })); pad.position.set(0, y, z); this.root.add(pad);
      const piece = host.registry.add({ id: `template.jump.${i}`, name: STRINGS.jump, category: 'ground', file: 'src/shards/_template/playground/JumpCourse.ts', object: pad,
        colliders: [{ kind: 'box', x: 0, y, z, hx: 1.5, hy: 0.15, hz: 1.5 }], active: () => this.entered });
      host.game.levelScope.onDispose(() => { const at = host.registry.pieces.indexOf(piece); if (at !== -1) host.registry.pieces.splice(at, 1); }); }
    host.game.scene.add(this.root); this.root.visible = false;
    ownPrimitives(this.root, host.game.levelScope);
  }
  enter(): void { if (this.entered) return; this.saved.copy(this.host.player.position); this.yaw = this.host.player.yaw; this.entered = true; this.root.visible = true; this.host.player.position.set(0, 3000.15, 0); this.host.player.yaw = 0; }
  exit(): void { if (!this.entered) return; this.entered = false; this.root.visible = false; this.host.player.position.copy(this.saved); this.host.player.yaw = this.yaw; }
}
