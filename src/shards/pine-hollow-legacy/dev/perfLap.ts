import type { Scope } from '@wildshard/engine/app/scope';
import type { Music } from '@wildshard/engine/audio/Music';
import type { Game } from '@wildshard/engine/core/Game';
import { perfLap, type LapSpot } from '@wildshard/engine/core/perfLap';
import { practiceRoom } from '@wildshard/engine/core/practiceRoom';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { HUD } from '@wildshard/engine/ui/HUD';
import type { Elites } from '@wildshard/game/Elite';
import type { AntlerKing } from '../runtime/antlerKing';

/**
 * Pine Hollow's PERF LAP host (E350 F-J1; src/engine/core/perfLap.ts, src/engine/ui/perfLap.ts): the six spots of PINE-HOLLOW-FOLLOWUPS
 * F-J1, the same poses the headless rulers stand at (scripts/pine-hollow-fps.mjs, pine-hollow-gpu.mjs), so the phone's
 * reading lines up with theirs. yaw faces (−sin yaw, −cos yaw); +z is north, +x is west.
 *
 * While the lap runs, `perfLap.active` holds the quest's discovery / secrets / stag / thralls (quest/index.ts), the
 * elites and the King (index.ts) and the journal (compendium/install.ts); `hold` calms the herds here (nothing notices,
 * charges or flees the player the lap drops among them).
 */
export const PINE_LAP_SPOTS: readonly LapSpot[] = [
  { id: 'gate', x: 0, z: -200, yaw: Math.PI },
  { id: 'cabin', x: -14, z: -62, yaw: Math.PI },
  { id: 'pond', x: -56, z: 95, yaw: Math.PI },
  { id: 'hamlet', x: -150, z: -130, yaw: 0 },
  // the fire lookout's south catwalk, facing down the zipline over the Hollow (pine-hollow-gpu.mjs's `lookout`)
  { id: 'lookout', x: 35.53, z: 211.14, yaw: 0.1635, y: 57.46 },
  // inside the King's standing stones, facing W into the old-growth giants (Jake's E142 spot, pine-hollow-gpu.mjs `stones`)
  { id: 'king', x: 140, z: -30, yaw: -Math.PI / 2 },
];

/** animals within this of the player in a chase / attack state = a fight is on (main.ts's perf COUNTS `chase`) */
const FIGHT_R = 80;

export function registerPineLap(o: { game: Game; player: Player; animals: AnimalManager; music: Music; hud: HUD; elites: Elites; king: AntlerKing }, scope: Scope = o.game.levelScope): void {
  const { game, player, animals, music, hud, elites, king } = o;
  let calmBefore = false;
  const previous = perfLap.host;
  perfLap.host = {
    game, shard: 'pine-hollow', spots: PINE_LAP_SPOTS, player,
    busy: () => {
      if (practiceRoom.open) return 'not in a practice room';
      const boss = king.boss.state;
      if (boss !== 'dormant' && boss !== 'armed') return 'not mid-fight (the Antler King)';
      if (elites.focus?.state === 'engaged') return 'not mid-fight (an elite)';
      if (music.state.mode === 'combat') return 'not mid-fight';
      const p = player.position;
      for (const a of animals.animals) {
        if (!a.alive || a.hidden) continue;
        if ((a.state === 'charge' || a.state === 'stalk' || a.state === 'attack') && a.position.distanceTo(p) < FIGHT_R) return 'not mid-fight (something is charging you)';
      }
      if (player.ride !== null || player.hover || player.carried) return 'not while riding / held';
      if (player.swimming) return 'not while swimming';
      return null;
    },
    hold: (on) => {
      if (on) { calmBefore = animals.calm; animals.calm = true; } else animals.calm = calmBefore;
    },
    toast: (text) => { hud.toast(text); },
  };
  const host = perfLap.host;
  scope.onDispose(() => { if (perfLap.host === host) { if (perfLap.active) { host.hold(false); perfLap.active = false; } perfLap.host = previous; } });
}
