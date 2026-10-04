import { Tool } from '@wildshard/engine';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, PointLight } from 'three';
import { LANTERN_ROW } from './rows';

export class TemplateLantern extends Tool {
  override readonly id = 'tool.template-lantern'; override readonly slot = 'offhand';
  override readonly actions = ['template.lantern.toggle'] as const;
  override holster = 0; override enabled = true;
  readonly model = new Group(); readonly light = new PointLight(0xffe1aa, 0, 8); oil = 1; lit = false;
  constructor() { super(LANTERN_ROW); const lamp = new Mesh(new BoxGeometry(0.12, 0.18, 0.12), new MeshStandardMaterial({ color: 0x888888, flatShading: true }));
    this.model.add(lamp, this.light); this.model.position.set(-0.3, -0.3, -0.55); }
  toggle(): void { if (this.oil > 0) this.lit = !this.lit; this.light.intensity = this.lit ? 2 : 0; }
  override update(dt: number): void { if (this.lit) this.oil = Math.max(0, this.oil - dt / 120); if (this.oil === 0) { this.lit = false; this.light.intensity = 0; } }
}
