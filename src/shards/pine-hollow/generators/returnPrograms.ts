import lead from '../data/questLead.json' with { type: 'json' };

/** One stateless return guest's declared row, before compilation names its module (the retired bake-life.mjs and
 *  bake-shelter.mjs rows; GR8: `output.ts` compiles them in the product). */
export interface ReturnScriptRow {
  id: string; abi: string; side: string; module: string; source: string; binding: { shard: boolean }; pages: number;
  onFail: string; on: string[]; tick: null; stateVersion: number; state: never[]; params: Record<string, number>;
  reads: string[]; commands: string[]; fields: Record<string, string>; channels: Record<string, string>; signals: Record<string, string>;
}
/** Each guest's authored sources (the `ctx.cached` inputs) and its declared names. */
interface ReturnGuest { sources: string[]; row: ReturnScriptRow }

const aliases = (values: readonly string[]): Record<string, string> => Object.fromEntries(values.map(name => [name, name]));
const unset = `blobs/wasm/${'0'.repeat(64)}.wasm`;
const first = lead.path[0], last = lead.path.at(-1);
if (first === undefined || last === undefined) throw new Error('Pine quest lead needs a path');

const GUESTS: Record<'life' | 'shelter', ReturnGuest> = {
  life: { sources: ['behaviour/life.as', 'behaviour/stag.as'], row: {
    id: 'pine.life', abi: '1.0', side: 'sim', module: unset, source: 'behaviour/life.as', binding: { shard: true }, pages: 1, onFail: 'hold',
    on: ['signal'], tick: null, stateVersion: 1, state: [],
    params: { firstX: first[0] ?? 0, firstZ: first[1] ?? 0, lastX: last[0] ?? 0, lastZ: last[1] ?? 0, length: lead.path.length, first: lead.first,
      near: lead.near, past: lead.past, trot: lead.trot, gone: lead.gone, nightAbove: lead.nightAbove },
    reads: ['field'], commands: ['channel'],
    fields: aliases(['candidates', 'now', 'minimum', 'maximum', 'draw', 'scale', 'kill', 'arrival', 'harvest', 'site', 'visit', 'distance', 'reach', 'giveUp', 'present', 'night', 'combat',
      'heightBias', 'height', 'coverBias', 'cover', 'radius', 'clear', 'homeX', 'homeZ', 'x', 'z',
      'i', 'mode', 'elapsed', 'begin', 'dt', 'leadStep', 'playerX', 'playerZ', 'atX', 'atZ', 'playerY', 'atY', 'floorY', 'taken']),
    channels: aliases(['arrival', 'gather', 'remove', 'fade', 'dim', 'eligible', 'index', 'score', 'x', 'z', 'i', 'mode', 'elapsed', 'event', 'accept', 'leadAppear', 'leadDone']),
    signals: aliases(['arrival', 'carcass', 'guide', 'shelterScore', 'shelterPlace', 'lead', 'secret']),
  } },
  shelter: { sources: ['behaviour/shelter.as'], row: {
    id: 'pine.shelter', abi: '1.0', side: 'sim', module: unset, source: 'behaviour/shelter.as', binding: { shard: true }, pages: 1, onFail: 'hold',
    on: ['signal'], tick: null, stateVersion: 1, state: [], params: {}, reads: ['field'], commands: ['channel'],
    fields: aliases(['candidates', 'heightBias', 'coverBias', 'distance', 'height', 'cover', 'x', 'z', 'radius', 'clear', 'homeX', 'homeZ',
      'present', 'spot', 'spotX', 'spotZ', 'hold', 'dt', 'rain', 'wet', 'dry', 'homeHold', 'spotR', 'homeR']),
    channels: aliases(['index', 'score', 'x', 'z', 'r', 'accept', 'create', 'keep', 'apply', 'hold']),
    signals: aliases(['shelterScore', 'shelterPlace', 'shelterStep', 'shelterGoal']),
  } },
};

/** A guest's declared row and sources (a copy). */
export function returnGuest(name: 'life' | 'shelter'): ReturnGuest { return structuredClone(GUESTS[name]); }

/** The registry ids the generated ABI header uses: each sorted alias numbered from 1. */
export function returnRegistries(row: ReturnScriptRow): { fields: Map<string, number>; channels: Map<string, number>; signals: Map<string, number> } {
  const ids = (values: Readonly<Record<string, string>>) => new Map(Object.values(values).sort().map((value, index): [string, number] => [value, index + 1]));
  return { fields: ids(row.fields), channels: ids(row.channels), signals: ids(row.signals) };
}
