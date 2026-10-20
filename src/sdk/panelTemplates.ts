import type { PanelAction, PanelCondition, PanelTemplate, PanelValue } from '@wildshard/format/panelTemplate';
import type { PanelNode } from '@wildshard/engine/ui/panel';
import { panelValue as nativeValue, panelCondition as nativeCondition, expandPanelTemplates as nativeExpand } from '@wildshard/game/ui/panelTemplates';

/** Evaluate a scalar through the native bounded panel formatter. */
export function panelValue(value: PanelValue, values: unknown): string | number | boolean | undefined { return nativeValue(value, values); }
/** Evaluate a panel condition without changing lent values. */
export function panelCondition(condition: PanelCondition, values: unknown): boolean { return nativeCondition(condition, values); }
/** Expand finite markup and captured action values through the native formatter. */
export function expandPanelTemplates(templates: readonly PanelTemplate[], values: unknown): {
  nodes: PanelNode[]; actions: { ref: string; action: PanelAction; value: unknown }[];
} { return nativeExpand(templates, values); }
