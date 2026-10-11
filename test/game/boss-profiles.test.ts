import * as v from 'valibot';
import { expect, it } from 'vitest';
import { BossProfileSchema, parseBossProfile } from '../../src/format/bossProfiles';
import { EliteScriptSchema } from '../../src/format/eliteScripts';
import type { BossFightProfile } from '../../src/game/plugin/bossPhase';
import { ANTLER_KING_FIGHT } from '../../src/shards/pine-hollow/data/kingFight';
import { GOLDEN_KING_ROW } from '../../src/shards/nalati-grasslands/combat/goldenKingRow';
import { MATRIARCH_FIGHT } from '../../src/shards/sunscar-dunes/runtime/quest/matriarchFight';
import { ROC_FIGHT } from '../../src/shards/far-reach/data/rocFight';
import { formatJsonSchema } from '../../src/sdk/formatJsonSchema';
import { schemaInventory } from '../../scripts/docs/schema-reference.mjs';

// The clearing also carries layout dimensions; the wire includes only the interpreted frame.
const pine = { kind: 'boss', pattern: 'roaming', fight: { ...ANTLER_KING_FIGHT, origin: { x: ANTLER_KING_FIGHT.origin.x, z: ANTLER_KING_FIGHT.origin.z } } } as const;
const nalati = { kind: 'boss', pattern: 'arena', fight: GOLDEN_KING_ROW } as const;
const sky = { kind: 'boss', pattern: 'held', fight: ROC_FIGHT } as const;
const signal = { kind: 'boss', pattern: 'spawned', fight: MATRIARCH_FIGHT } as const;
const script = { kind: 'boss', pattern: 'script', fight: { id: 'boss.fixture', kind: 'elite-script', module: 'a'.repeat(64),
  parameters: [1,-1], slots: [{field:'phase',initial:0}], modes: ['idle','strike'], voices: ['growl'], lanes: [], contacts: [],
  actions: ['roar'], maxSpeed: 4, maxTurnRate: 3 } } as const;
for (const [name, profile] of Object.entries({ pine, nalati, sky, signal })) it(`admits ${name} native parameters without defaults, rounding or dropped fields`, () => {
  const parsed = parseBossProfile(profile);
  if (parsed.pattern === 'script') throw new Error('Unexpected script');
  const native: BossFightProfile = parsed;
  expect(native).toEqual(profile);
  const wire = JSON.stringify(profile), decoded: unknown = JSON.parse(wire);
  expect(parseBossProfile(decoded)).toEqual(profile);
});
it('keeps the complete existing AS declaration and never bridges a caller-added check', () => {
  const parsed = parseBossProfile(script);
  expect(parsed).toEqual(script);
  if (parsed.pattern !== 'script') throw new Error('Unexpected native profile');
  expect(v.parse(EliteScriptSchema, parsed.fight)).toEqual(script.fight);
  expect(() => formatJsonSchema(v.pipe(BossProfileSchema, v.check(() => true, 'another check')))).toThrow();
});
it('refuses unresolved modes, phases, adds and view names before a host exists', () => {
  const row = nalati.fight;
  for (const fight of [
    {...row,modeNames:{...row.modeNames,fight:'unknown'}}, {...row,crown:{...row.crown,to:'unknown'}},
    {...row,phases:[{...row.phases[0],at:0.5}]}, {...row,views:[]}, {...row,views:row.views.filter(name => name !== 'hazard.ring.off')},
    {...row,adds:{...row.adds,pairs:[[row.adds.spots.length],[]]}},
    {...row,attacks:{...row.attacks,combo:{...row.attacks.combo,count:[row.attacks.combo.cuts.length+1,1]}}},
    {...row,attacks:{...row.attacks,burst:{...row.attacks.burst,fireAt:0}}},
  ]) expect(() => parseBossProfile({...nalati,fight})).toThrow();
  expect(() => parseBossProfile({...pine,fight:{...pine.fight,names:{...pine.fight.names,strike:'unknown'}}})).toThrow();
  expect(() => parseBossProfile({...pine,fight:{...pine.fight,hazards:{...pine.fight.hazards,fallSeconds:0}}})).toThrow();
});
it('refuses nonfinite scalars, oversized arrays/records/calls, unknown fields and invalid checkpoint shares', () => {
  for (const value of [
    {...sky,extra:true}, {...sky,fight:{...sky.fight,arena:{...sky.fight.arena,r:Number.NaN}}},
    {...sky,fight:{...sky.fight,hpShares:[1,0.7,0.8]}}, {...sky,fight:{...sky.fight,hpShares:[1,0]}},
    {...signal,fight:{...signal.fight,stormFade:0}}, {...signal,fight:{...signal.fight,stormPhases:[3]}},
    {...nalati,fight:{...nalati.fight,modes:Object.fromEntries(Array.from({length:65},(_,i)=>[String(i),rowMode()]))}},
    {...nalati,fight:{...nalati.fight,reset:{...nalati.fight.reset,views:[['boss.glow',...Array.from({length:17},()=>0)]]}}},
    {...script,fight:{...script.fight,slots:Array.from({length:9},(_,i)=>({field:`field${String(i)}`,initial:0}))}},
  ]) expect(() => parseBossProfile(value)).toThrow();
});
function rowMode(): (typeof GOLDEN_KING_ROW.modes)[string] {
  const mode = Object.values(GOLDEN_KING_ROW.modes)[0];
  if (mode === undefined) throw new Error('Missing native mode');
  return mode;
}
it('generates every branch and documents bounded rest tuple arguments without executing predicates', () => {
  const schema = formatJsonSchema(BossProfileSchema), inventory = schemaInventory(BossProfileSchema, '$boss');
  const json = JSON.stringify(schema);
  expect(json).toContain('additionalProperties'); expect(json).toContain('maxProperties'); expect(json).toContain('x-wildshard-checks'); expect(json).toContain('@wildshard/format/bossProfiles#');
  expect(inventory.some(row => row.path.endsWith('[rest]'))).toBe(true);
  expect(inventory.some(row => row.constraints.some(value => value.startsWith('max_entries')))).toBe(true);
});
