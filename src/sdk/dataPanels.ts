import { DataPanel as NativeDataPanel } from '@wildshard/game/ui/dataPanels';
import { parsePanelDefinition, type PanelDefinition } from '@wildshard/format/panelTemplate';

/** Existing native action owners receive captured form values. */
export type PanelActions = ReadonlyMap<string, (value: unknown) => void>;
/** SDK entry to the native declared panel implementation. */
export class DataPanel extends NativeDataPanel {}

/** Admit each named panel before its caller creates gameplay or modal bindings. */
export async function readDataPanels(product: { file: (name: string) => Promise<Uint8Array> }): Promise<Readonly<Record<string, PanelDefinition>>> {
  const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await product.file('quests/panels.json')));
  if (typeof input !== 'object' || input === null || Array.isArray(input) || Object.keys(input).length > 16) throw new Error('Invalid named panels');
  return Object.fromEntries(Object.entries(input).map(([name, definition]) => [name, parsePanelDefinition(definition)]));
}
