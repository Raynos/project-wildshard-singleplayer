import type { Scope } from '../app/scope';
import type { AttributeSet, CueId } from './effects/types';
import type { CombatTag } from './pipeline';
import type { HitStopProfile } from './cues';


/** Hosts declare their slot, icon and touch-layout vocabularies without importing content into simulation. */
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- Host extension point populated by declaration merging.
export interface EquipmentSlotMap {}
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- Host extension point populated by declaration merging.
export interface EquipmentIconMap {}
export interface EquipmentTouchMap { melee: true; bow: true; ranged: true }
export type WeaponId = keyof EquipmentSlotMap;
export type EquipmentIcon = keyof EquipmentIconMap;
export type ToolId = `tool.${string}`;
export type EquipmentId = `weapon.${string}` | ToolId;
export interface WeaponUi {
  name: string; icon: EquipmentIcon;
  ammo?: { label: string; segments: number; bagLabel?: string; bagLabelFor?: string };
  touch: keyof EquipmentTouchMap;
  lockOn: boolean; melee: boolean; tracers: boolean;
  /** The existing 24px swap glyph and short label; menu icons use the shared 64px icon library. */
  swapIcon: string; swapName?: string;
  huntersEye?: boolean;
}
export interface EquipmentMeta { name: string; icon: EquipmentIcon; blurb: string; category: 'weapon' | 'tool' }
export interface EquipmentCues { fire: CueId; reload: CueId; impact: CueId; dry?: CueId; hit?: CueId; heavy?: CueId; charge?: Readonly<Record<string, CueId>> }
export interface EquipmentRow { cues?: EquipmentCues; hitStop?: HitStopProfile; tags?: readonly CombatTag[]; id: EquipmentId; legacySlot?: WeaponId; ui: WeaponUi; meta: EquipmentMeta }
export interface EquipmentBlock { dispose: () => void }
export type BlockSet = Partial<Record<'vm' | 'aim' | 'ads' | 'melee' | 'projectile' | 'hitStop' | 'ammo' | 'brass', EquipmentBlock>>;
/** The scope is sufficient for the legacy families; block/input/combat ports expand as their migration rows land. */
export interface EquipContext { scope: Scope }

export abstract class Equipment {
  readonly attributes: AttributeSet = {};
  effectTags: readonly CombatTag[] = [];
  abstract readonly id: WeaponId | ToolId;
  abstract holster: number;
  abstract enabled: boolean;
  protected readonly blocks: BlockSet = {};
  private owner: Scope | undefined;
  row: EquipmentRow;
  constructor(row: EquipmentRow) { this.row = row; }
  get meta(): EquipmentMeta { return this.row.meta; }
  get name(): string { return this.row.ui.name; }
  install(ctx: EquipContext): void {
    if (this.owner) throw new Error(`Equipment ${this.row.id} is already installed`);
    this.owner = ctx.scope;
    ctx.scope.onDispose(() => { this.enabled = false; for (const block of Object.values(this.blocks)) block.dispose(); });
  }
  abstract update(dt: number, t: number): void;
  dispose(): void { this.owner?.dispose(); }
}
