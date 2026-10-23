import { EliteCore, memoryElitePersistence, type EliteCoreScript } from '../../src/game/eliteSystem';
import type { AnimalSim } from '../../src/engine/entities/AnimalSim';
import type { SimHost } from '../../src/engine/sim';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import admission from '../../src/shards/nalati-grasslands/behaviour/admission.generated.json' with { type: 'json' };

export function nativeEliteCore(host: SimHost, phase = 'day', storm = false): EliteCore<EliteCoreScript<AnimalSim>> {
  const program = ReturnProgram.native(host, admission), rules = { always: 0, storm: 1, night: 2, dusk: 3 };
  return new EliteCore({ player: host.player, condition: rule => program.project('eliteRule', {
    rule: rules[rule], phase: phase === 'night' ? 2 : phase === 'dusk' ? 1 : 0, storm: Number(storm),
  })['accept'] === 1 }, {}, host.level.id, memoryElitePersistence());
}
