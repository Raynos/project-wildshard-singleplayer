import type { CuePlayer, CueMap, CueOpts } from '@wildshard/engine/audio/Cues';
import { tap } from '@wildshard/engine/core/harnessTap';

import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCueOpts } from '@wildshard/engine/combat/cues';
import source from '../../shard.config';

/** The shardfile owns the cue aliases; trusted recipes retain taps, footfall sequence and chime randomness. */
export function ndCueMap(player: Pick<CuePlayer, 'play'>, random: () => number): CueMap {
  let step = 0;
  const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>();
  voices.set('nd.step', (opts) => {
    step = (step % 4) + 1;
    const gain = opts.sprinting ? 1 : 0.7;
    if (opts.surface === 'planks') { tap.sound?.('nd.step.wood'); return player.play(`step.wood.${String(step)}`, { ...opts, gain }); }
    if (opts.surface === 'metal') { tap.sound?.('nd.step.metal'); return player.play(`step.metal.${String(step)}`, { ...opts, gain }); }
    tap.sound?.('nd.step.stone'); return player.play(`step.stone.${String(step)}`, { ...opts, gain });
  });
  voices.set('nd.jian.swing', (opts) => { tap.sound?.('nd.jian.swing'); return player.play('jian.swing', opts); });
  voices.set('nd.jian.heavy', (opts) => { tap.sound?.('nd.jian.heavy'); return player.play('jian.swing.heavy', opts); });
  voices.set('nd.jian.hit.wood', (opts) => { tap.sound?.('nd.jian.hit.wood'); return player.play('jian.hit.wood', opts); });
  voices.set('nd.jian.clang', (opts) => { tap.sound?.('nd.jian.clang'); return player.play('jian.clang', opts); });
  voices.set('nd.jian.hit.stone', (opts) => { tap.sound?.('nd.jian.hit.stone'); return player.play('jian.hit.stone', opts); });
  voices.set('nd.feizhua.fire', (opts) => { tap.sound?.('nd.feizhua.fire'); return player.play('feizhua.fire', opts); });
  voices.set('nd.feizhua.bite', (opts) => { tap.sound?.('nd.feizhua.bite'); return player.play('feizhua.bite', opts); });
  voices.set('nd.feizhua.reel', (opts) => { tap.sound?.('nd.feizhua.reel'); return player.play('feizhua.reel', opts); });
  voices.set('nd.feizhua.dock', (opts) => { tap.sound?.('nd.feizhua.dock'); return player.play('feizhua.dock', opts); });
  voices.set('nd.feizhua.zip', (opts) => { tap.sound?.('nd.feizhua.zip'); return player.play('feizhua.zip', opts); });
  voices.set('nd.chime.gust', (opts) => { tap.sound?.('nd.chime.gust'); return player.play('chime.gust', { ...opts, pan: opts.pan ?? (random() - 0.5) * 0.6 }); });
  voices.set('nd.unhandled', () => false);
  return createCueRouter(source.audio.routing, { voices });
}
/** Traversal owns its event boundaries; this callback keeps that path independent of the shell. */
let traversalCue: CueMap | undefined;
export function bindTraversalCue(map: CueMap): () => void {
  traversalCue = map;
  return () => { if (traversalCue === map) traversalCue = undefined; };
}
export function grappleCue(id: 'grapple.fire' | 'grapple.bite' | 'grapple.reel' | 'grapple.dock' | 'grapple.zip', opts: CueOpts = {}): void { traversalCue?.(id, opts); }
