import type { Scope } from '@wildshard/engine/app/scope';
import type { InputService } from '@wildshard/engine/input/InputService';
import type { DebugRowSpec, TierKnobSchema } from '@wildshard/engine/level/context';
import { parsePlumbing, type PlumbingData } from '../shardfile/plumbing';

/** Session-owned instance/activity and admitted scene dispatcher; data never calls arbitrary module exports. */
export interface PlumbingPorts {
  instance: string; tier: 'phone' | 'desktop'; scope: Scope; input: InputService;
  active: () => boolean; scene: (id: string) => void;
  knobs: (schema: TierKnobSchema) => void; debugRow: (row: DebugRowSpec) => void;
}
/** Resolve scoped context identities and selected tier values for the loader's declared content builders. */
export interface PlumbingHandles { contexts: ReadonlyMap<string, string>; knobs: Readonly<Record<string, number>> }
/** Install declared input through the normal command path and Debug choices through admitted script scene hooks. */
export function installDeclaredPlumbing(input: PlumbingData, ports: PlumbingPorts): PlumbingHandles {
  const data = parsePlumbing(input), adapters = ports;
  if (ports.scope.disposed || !/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(ports.instance)) throw new Error('Invalid plumbing instance');
  const knobs = Object.fromEntries(data.knobs.map((row) => [row.id, row[ports.tier]]));
  ports.knobs({ id: `${ports.instance}.${data.namespace}`, defaults: knobs });
  const contexts = new Map<string, string>();
  for (const row of data.input) {
    const id = `${ports.instance}.${row.id}`; contexts.set(row.id, id);
    ports.input.register({ id, priority: row.priority, enabled: ports.active, actions: row.actions.map((action) => action.id), keys: Object.fromEntries(row.actions.map((action) => [action.id, action.keys])),
      ...(row.touch === undefined ? {} : { touch: { relabel: {}, verbs: { [row.touch.slot]: { action: row.touch.action, label: row.touch.label, icon: row.touch.icon, show: ports.active } } } }) }, ports.scope);
    for (const action of row.actions) ports.input.bind(action.id, () => { ports.scene(action.scene); }, ports.scope, ports.active);
    ports.input.push(id, ports.scope);
  }
  for (const row of data.debug) adapters.debugRow({ ...row, change: (value) => {
    const choice = row.choices.find((entry) => entry.value === value); if (choice === undefined) throw new Error('Unknown declared Debug choice');
    if (choice.scene !== undefined) ports.scene(choice.scene);
  } });
  return { contexts, knobs };
}
