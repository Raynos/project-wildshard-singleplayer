import { Group, Mesh, BoxGeometry, CylinderGeometry, MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { Weapon, type WeaponState, type AimInfo } from '@wildshard/engine/combat/Weapon';
import { Tool } from '@wildshard/engine/combat/Tool';
import type { EquipmentRow, EquipContext } from '@wildshard/engine/combat/Equipment';
import type { ItemFamily, ItemFamilyPorts } from '@wildshard/engine/combat/itemFamilies';
import type { ItemSpec } from '@wildshard/engine/combat/items';
import { buildSword } from './declaredSword'; // SF54: the private iron sword copy, deleted when these families graduate

/**
 * The share of a held item's flat colour that glows (E460). A declared shard's look need not light a camera-held item:
 * the template's neutral look has no environment and a dim sun, so a plain grey item's shade side rendered near black on
 * every renderer (its measure surfaces carry their own lift, families/measure.ts). At 0.5 the sunlit face reads as the
 * declared colour and the shade side a step darker.
 */
export const ITEM_VIEW_LIFT = 0.5;

function itemMesh(ports: ItemFamilyPorts): Group {
  const recipe = ports.view.recipe;
  if (!['kit.whip', 'kit.sword', 'kit.lantern'].includes(recipe)) throw new Error(`Unresolved item view ${recipe}`);
  const model = new Group();
  const material = new MeshStandardMaterial({ color: ports.view.colour, flatShading: true, emissive: ports.view.colour, emissiveIntensity: ITEM_VIEW_LIFT });
  const sword = recipe === 'kit.sword' ? buildSword('iron') : null;
  const geometry = sword?.sword ?? (recipe === 'kit.whip' ? new CylinderGeometry(0.025, 0.04, 0.8, 6) : new BoxGeometry(0.12, 0.18, 0.12));
  sword?.arms.dispose(); model.add(new Mesh(geometry, material));
  model.position.set(...ports.view.position); model.rotation.set(...ports.view.rotation);
  ports.scope.onDispose(() => { model.removeFromParent(); geometry.dispose(); material.dispose(); });
  return model;
}
class DeclaredMelee extends Weapon {
  readonly model: Group;
  readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  holster = 0; enabled = true; aimInfo: AimInfo | null = null;
  private readonly ports: ItemFamilyPorts;
  private held = false;
  private readonly origin = new Vector3(); private readonly direction = new Vector3();
  get adsHeld(): boolean { return this.held; }
  set adsHeld(on: boolean) { this.held = this.enabled && on; this.ports.runtime.hold(this.held, this.ports.aim(), this.enabled); }
  constructor(row: EquipmentRow, _spec: Extract<ItemSpec, { kind: 'weapon' }>, ports: ItemFamilyPorts) {
    super(row); this.ports = ports; this.model = itemMesh(ports); this.setAimSource(ports.aim);
    ports.runtime.observe(ports.scope, (phase, contact) => {
      if (phase === 'fire') this.onFire?.();
      if (phase === 'hit' && contact !== undefined) this.onHit?.(contact.kind, contact.headshot, contact.killed);
    });
  }
  override install(ctx: EquipContext): void {
    super.install(ctx); ctx.scope.onDispose(() => { this.ports.scope.dispose(); });
    this.ports.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.ports.input.bind('heavy', () => { this.ports.runtime.queue(2, this.ports.aim()); }, ctx.scope, () => this.enabled);
  }
  tryFire(): void {
    if (!this.enabled) return;
    this.aimRay(this.origin, this.direction); this.ports.runtime.queue(1, { origin: this.origin, direction: this.direction });
  }
  update(_dt: number, _t: number): void {
    this.model.visible = this.enabled || this.holster > 0;
  }
}
class DeclaredLantern extends Tool {
  readonly id: `tool.${string}`;
  readonly slot = 'offhand'; readonly actions: readonly Extract<ItemSpec, { kind: 'tool' }>['action'][];
  readonly model: Group; readonly light: PointLight;
  holster = 0; enabled = true;
  private readonly ports: ItemFamilyPorts;
  private readonly spec: Extract<ItemSpec, { kind: 'tool' }>;
  constructor(row: EquipmentRow, spec: Extract<ItemSpec, { kind: 'tool' }>, ports: ItemFamilyPorts) {
    super(row);
    if (!row.id.startsWith('tool.')) throw new Error('Tool id required');
    this.id = `tool.${row.id.slice(5)}`; this.actions = [spec.action]; this.spec = spec; this.ports = ports; this.model = itemMesh(ports);
    this.light = new PointLight(0xffe1aa, 0, 8); this.model.add(this.light);
    ports.scope.onDispose(() => { this.light.dispose(); });
    ports.runtime.observe(ports.scope, (phase) => { if (phase === 'light') this.equipEvents?.emit('tool.used', { id: row.id, phase: ports.runtime.lightOn ? 'on' : 'off' }); });
  }
  override install(ctx: EquipContext): void { super.install(ctx); ctx.scope.onDispose(() => { this.ports.scope.dispose(); }); }
  update(_dt: number, _t: number): void { this.light.intensity = this.ports.runtime.lightOn ? this.spec.intensity : 0; }
}
/** Explicit built-in item family registry, injected into the full loader; importing does not install content. */
export function declaredKitItemFamilies(): ReadonlyMap<string, ItemFamily> {
  return new Map<string, ItemFamily>([
    ['kit.melee', { kind: 'weapon', create: (row, spec, ports) => new DeclaredMelee(row, spec, ports) }],
    ['kit.lantern', { kind: 'tool', create: (row, spec, ports) => new DeclaredLantern(row, spec, ports) }],
  ]);
}
