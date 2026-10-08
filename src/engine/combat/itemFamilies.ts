import type { Scope } from '../app/scope';
import type { InputService } from '../input/InputService';
import type { AimCommand } from '../input/commands';
import type { ItemRuntime, ItemSpec } from './items';
import type { EquipmentRow, WeaponUi } from './Equipment';
import type { Weapon } from './Weapon';
import type { Tool } from './Tool';

/** Renderer-neutral parameters selecting a registered kit view recipe. */
export interface ItemViewRecipe { recipe: string; colour: string; position: readonly [number, number, number]; rotation: readonly [number, number, number] }
/** A trusted session binds standard input and one authoritative runtime to each kit family. */
export interface ItemFamilyPorts { scope: Scope; runtime: ItemRuntime; input: Pick<InputService, 'bind' | 'held'>; aim: () => AimCommand; view: ItemViewRecipe }
/** Trusted family presentation; declared identity, slot, input context, name, icon and swap glyph remain authoritative. */
export type ItemFamilyPresentation = Pick<EquipmentRow, 'cues' | 'hitStop' | 'rangedFeel'> & {
  ui?: Partial<Omit<WeaponUi, 'name' | 'icon' | 'inputContext' | 'swapIcon'>>;
};
/** Injected kit constructors; the game never imports a kit or constructs a second combat actor. */
export type ItemFamily = ({ kind: 'weapon'; create: (row: EquipmentRow, spec: Extract<ItemSpec, { kind: 'weapon' }>, ports: ItemFamilyPorts) => Weapon }
  | { kind: 'tool'; create: (row: EquipmentRow, spec: Extract<ItemSpec, { kind: 'tool' }>, ports: ItemFamilyPorts) => Tool }) & { presentation?: ItemFamilyPresentation };
