import { expect, test } from 'vitest';
import { parse } from 'valibot';
import { ArenaScriptBossProfileSchema } from '../src/format/bossProfiles';
import { bossFight } from '../src/game/plugin/bossPhase';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { TITAN_SCRIPT } from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };

const frame = { mode: 3, broke: 0, px: 0, pz: 0, cx: 0, cz: 0, radius: 10, mounted: 1 };

test('boss host retains AS lifecycle, heart damage and bounded decisions', () => {
  const host = bossFight(parse(ArenaScriptBossProfileSchema,TITAN_SCRIPT),{ program: ReturnProgram.page(programs.rules) });
  host.reset({ phase: 0,share: 1 }); host.event('begin',{ phase: 0 }); host.event('tie',{ amount: 1 });
  expect(host.step(.05,frame)).toEqual({ dt: 0,values: {} });
  const first = host.step(.05,frame); expect(first.values['enter']).toBe(1); expect(host.value('open')).toBe(1);
  host.event('damage',{ mode: 3,amount: 80 }); expect(host.value('hp')).toBe(2400);
  host.event('invulnerable',{ amount: 1 }); host.event('damage',{ mode: 3,amount: 1000 }); expect(host.value('hp')).toBe(2400);
  host.event('victory'); host.step(4,frame); expect(host.value('victoryT')).toBe(4);
  host.reset({ phase: 1,share: .6 }); expect(host.value('hp')).toBe(1560); expect(host.value('invuln')).toBe(0);
});

test('an orchard boss uses different health and parameters on the same boss host', () => {
  const profile = parse(ArenaScriptBossProfileSchema,{ ...TITAN_SCRIPT,fight: { ...TITAN_SCRIPT.fight,
    initial: { ...TITAN_SCRIPT.fight.initial,hp: 150 },parameters: { fullHp: 150,fullDraw: 40,fullDrawMul: 3 } } });
  const host = bossFight(profile,{ program: ReturnProgram.page(programs.rules) });
  host.reset({ phase: 2,share: .5 }); expect(host.value('hp')).toBe(75);
  host.event('begin',{ phase: 2 }); host.event('damage',{ mode: 0,amount: 20 }); expect(host.value('hp')).toBe(55);
  host.event('clamp',{ share: .2 }); expect(host.value('hp')).toBe(30);
  expect(() => host.event('undeclared')).toThrow('Missing arena script event');
});


test('bounded rider trigonometry stays close to native headings within fixed fuel', () => {
  const program = ReturnProgram.page(programs.attack);
  const base = { dt: .1,px: 0,pz: 0,ax: 1,az: 0,mode: 0,t: 0,theta: 0,hit: 0,x0: 0,z0: 0,x1: 2,z1: 0,lane: 1.2,flank: 2 };
  for (const theta of [-10000,-9,-3,-1,0,.5,2,4,9,10000]) {
    const row = program.project('rider',{ ...base,theta }), angle = row['theta'] ?? 0;
    expect(Math.abs((row['x'] ?? 0)-Math.sin(angle)*26)).toBeLessThan(.000001);
    expect(Math.abs((row['z'] ?? 0)-Math.cos(angle)*26)).toBeLessThan(.000001);
  }
  for (const ax of [-4,-1,0,1,4]) for (const az of [-4,-1,1,4]) {
    const row = program.project('rider',{ ...base,mode: 3,t: 2,ax,az });
    expect(Math.abs((row['theta'] ?? 0)-Math.atan2(ax,az))).toBeLessThan(.00002);
  }
});
