// R10b: the shared pasture programme's groups: the herd's main rows (data/herdGroup.json) and the wolf pack's profile,
// matching behaviour/pack.as's indices.
import type { GroupStepProfileV2 } from '@wildshard/format/scriptGroupStepV2';
import type { ObservationColumnV2 } from '@wildshard/format/scriptObservationColumnsV2';


const num = (name: string, integer = false, min?: number, max?: number) =>
  ({ name, kind: 'number' as const, ...(integer ? { integer } : {}), ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) });
const bool = (name: string) => ({ name, kind: 'boolean' as const });
export const PACK_BANK: ({ name: string; kind: "boolean"; } | { max?: number; min?: number; integer?: true; name: string; kind: "number"; } | { name: string; kind: "nullable-number"; values?: never; } | { name: string; kind: "enum"; values: string[]; } | { name: string; kind: "reference"; values?: never; })[] = [
  bool('initialized'), { name: 'time', kind: 'nullable-number' as const },
  { name: 'phase', kind: 'enum' as const, values: ['roam', 'shadow', 'encircle', 'regroup', 'break'] },
  num('awareness'), num('homeX'), num('homeZ'), num('phaseT'), num('roamX'), num('roamZ'), num('roamT'), num('nextTokenT'),
  num('boldT'), num('calmT'), num('hpStart'), bool('halfDone'), num('deadSeen', true, 0, 16), num('shadowDur'), bool('howled'),
  num('bites', true, 0, 65535), bool('scared'), num('alpha', true, 0, 16),
  { name: 'prey', kind: 'reference' as const }, { name: 'pendingPrey', kind: 'reference' as const },
  // per-call scratch, 0 at rest (pack.as B_PC..B_CLAIM)
  num('pc', true, 0, 64), num('ret', true, 0, 64), num('try', true, 0, 16), num('candX'), num('candZ'), num('hit', true, 0, 1),
  num('spotX'), num('spotZ'), num('claim', true, 0, 15), num('boundsHalf',false,0),
];
// a never-hit actor's lastHitSeconds is 0 (observationColumnsV2); the native hit stamps keep -Infinity, encoded value + valid
const mem = (key: string, value: number) => ({ kind: 'memory' as const, key, default: { value } });
const stampPart = (key: string, part: 'value' | 'valid') => ({ kind: 'memory' as const, key, default: { value: 0 }, encoding: { kind: 'negative-infinity' as const, part } });
const actor = (field: 'x' | 'z' | 'yaw' | 'alive' | 'speed' | 'attackPhase' | 'lastHitSeconds' | 'lastHitValid' | 'scale' | 'hp' | 'maxHp' | 'seed' | 'stunned' | 'modSpeed') => ({ kind: 'actor' as const, field });
const result = (channel: string) => ({ kind: 'result' as const, channel });
const reference = (binding: string, field: 'x' | 'y' | 'z' | 'yaw' | 'alive') => ({ kind: 'reference' as const, binding, field });
// index order = pack.as C_* / R_* / C_CTX + X_*
const sources: [string, ObservationColumnV2['source']][] = [
  ['alive', actor('alive')], ['attackPhase', actor('attackPhase')], ['bit', mem('bit', 0)], ['hitT', stampPart('hitT', 'value')], ['hitTValid', stampPart('hitT', 'valid')],
  ['hp', actor('hp')], ['lastHit', actor('lastHitSeconds')], ['lastValid', actor('lastHitValid')], ['lhit', stampPart('lhit', 'value')], ['lhitValid', stampPart('lhit', 'valid')],
  ['low', mem('low', 0)], ['lt', mem('lt', 0)], ['lunge', mem('lunge', 0)], ['maxHp', actor('maxHp')], ['ox', mem('ox', 0)], ['oz', mem('oz', 0)],
  ['ring', mem('ring', 14)], ['role', mem('role', 1)], ['scale', actor('scale')], ['seed', actor('seed')], ['snarl', mem('snarl', 0)], ['speed', actor('speed')],
  ['speedMod', actor('modSpeed')], ['st', mem('st', 0)], ['stunned', actor('stunned')],
  ['sx', { kind: 'memory' as const, key: 'sx', default: { value: 0, source: 'x' as const } }], ['sxSet', { kind: 'memory-present' as const, keys: ['sx'] }],
  ['sz', { kind: 'memory' as const, key: 'sz', default: { value: 0, source: 'z' as const } }], ['x', actor('x')], ['yaw', actor('yaw')], ['z', actor('z')],
  ['howl', mem('howl', 0)], ['hidden', mem('hidden', 0)], ['grass', { kind: 'grass' as const, at: 'self' as const }],
  ['vis', result('vis')], ['hear', result('hear')], ['downwind', result('downwind')], ['normal', result('normal')],
  ['grass0', result('grass0')], ['grass1', result('grass1')], ['grass2', result('grass2')], ['grass3', result('grass3')], ['grass4', result('grass4')],
  ['path', result('pathYaw')], ['claimed', result('claimed')], ['found', result('found')],
  ['px', { kind: 'player-position' as const, axis: 'x' as const }], ['py', { kind: 'player-position' as const, axis: 'y' as const }],
  ['pz', { kind: 'player-position' as const, axis: 'z' as const }], ['fwdX', { kind: 'player' as const, field: 'forwardX' as const }],
  ['fwdZ', { kind: 'player' as const, field: 'forwardZ' as const }], ['mounted', { kind: 'player' as const, field: 'mounted' as const }],
  ['health', { kind: 'player' as const, field: 'healthShare' as const }], ['calm', { kind: 'context' as const, field: 'calm' as const }],
  ['playerSpeed', { kind: 'context' as const, field: 'playerSpeed' as const }], ['t', { kind: 'time' as const, field: 't' as const }],
  ['dt', { kind: 'time' as const, field: 'dt' as const }],
  ['preyX', reference('prey', 'x')], ['preyY', reference('prey', 'y')], ['preyZ', reference('prey', 'z')], ['preyYaw', reference('prey', 'yaw')],
  ['preyAlive', reference('prey', 'alive')], ['pendingAlive', reference('pending', 'alive')],
];
export const PACK_COLUMNS: { name: string; id: number; source: ObservationColumnV2['source'] }[] = sources.map(([name, source], index) => ({ name: `c${String(index).padStart(2, '0')}.${name}`, id: index + 1, source }));
export const PACK_RESULT_CHANNELS: string[] = ['vis', 'hear', 'downwind', 'normal', 'grass0', 'grass1', 'grass2', 'grass3', 'grass4', 'pathYaw', 'claimed', 'found'];
const signals = ['init', 'tick', ...Array.from({ length: 16 }, (_, slot) => `drive.${slot}`), ...Array.from({ length: 16 }, (_, slot) => `body.${slot}`)];
export const PACK_KEYS = ['role', 'ox', 'oz', 'ring', 'hitT', 'lunge', 'lt', 'bit', 'lhit', 'st', 'sx', 'sz', 'low', 'snarl', 'howl', 'hidden'] as const;
export const PACK_STATES = ['wander', 'graze', 'stalk', 'attack', 'charge', 'flee', 'alert'] as const;
const actions = [
  ...PACK_KEYS.map((key, index) => key === 'hitT' || key === 'lhit'
    ? { id: index + 1, words: 3, member: 0, native: { kind: 'memory' as const, key, encoding: 'negative-infinity' as const } }
    : { id: index + 1, words: 2, member: 0, native: { kind: 'memory' as const, key } }),
  { id: 17, words: 4, member: 0, native: { kind: 'motion' as const } }, { id: 18, words: 4, member: 0, native: { kind: 'steer' as const } },
  { id: 19, words: 2, member: 0, native: { kind: 'state' as const, states: [...PACK_STATES] } },
  { id: 20, words: 4, member: 0, native: { kind: 'look-position' as const } }, { id: 21, words: 2, member: 0, native: { kind: 'look-weight' as const } },
  { id: 22, words: 4, member: 0, native: { kind: 'path' as const, channel: 'pathYaw' } },
  ...[0, 1, 2, 3, 4].map(k => ({ id: 23 + k, words: 2, native: { kind: 'grass' as const, channel: `grass${k}` } })),
  { id: 28, words: 2, native: { kind: 'normal' as const, channel: 'normal' } },
  { id: 29, words: 1, member: 0, native: { kind: 'visibility' as const, channel: 'vis' } },
  { id: 30, words: 1, member: 0, native: { kind: 'hearing' as const, channel: 'hear', radii: [4, 8, 16, 30] as [number, number, number, number] } },
  { id: 31, words: 1, member: 0, native: { kind: 'downwind' as const, channel: 'downwind' } },
  { id: 32, words: 3, member: 0, native: { kind: 'group-claim' as const, channel: 'claimed' } },
  { id: 33, words: 4, reference: { word: 0 }, native: { kind: 'stagger' as const } }, { id: 34, words: 4, reference: { word: 0 }, native: { kind: 'damage' as const } },
  { id: 35, words: 1, member: 0, native: { kind: 'cancel-attack' as const } }, { id: 36, words: 2, member: 0, native: { kind: 'start-attack' as const } },
  { id: 37, words: 2, member: 0, native: { kind: 'sound' as const, cues: ['wolf_yip', 'wolf_howl', 'wolf_snarl', 'wolf_bite'] } },
  { id: 38, words: 2, member: 0, native: { kind: 'contact' as const } },
  { id: 39, words: 3, native: { kind: 'event' as const, events: ['prey-killed', 'howl', 'rider-bitten', 'pack-break'] } },
  { id: 40, words: 3, native: { kind: 'nearest' as const, channel: 'found', roster: 'foals' } },
];
export const PACK_PROFILE: GroupStepProfileV2 = { id: 'pack', bank: PACK_BANK, columns: PACK_COLUMNS, members: 16, signals, actions };
