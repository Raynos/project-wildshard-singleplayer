import { ENCOUNTER_STATES, type EncounterNetView } from '../sim/encounterRows';
import { netSchema, type NetSchema } from './schema';

// P1-E3.4 (E5-REPLICATION §3.2): what a boss bar or an elite bar shows. No position: a bar is shown anywhere in the cell.
/** The `encounter` class. */
export const ENCOUNTER_NET: NetSchema<EncounterNetView> = netSchema<EncounterNetView>({
  cls: 'encounter',
  fields: {
    state: { kind: 'enum', values: ENCOUNTER_STATES, read: view => view.state },
    hp: { kind: 'f32q', min: 0, max: 1, bits: 10, read: view => Math.max(0, Math.min(1, view.hp)) },
    phase: { kind: 'u8', read: view => view.phase },
    shield: { kind: 'bool', read: view => view.shield },
    body: { kind: 'ref', read: view => view.body },
    kind: { kind: 'text', send: 'initial', read: view => view.kind },
  },
});
