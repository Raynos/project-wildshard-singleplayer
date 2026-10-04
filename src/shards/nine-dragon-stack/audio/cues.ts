import { tap, type CuePlayer, type CueMap, type CueOpts } from '@wildshard/engine';

/** The cue map is content: the engine knows only the generic method cue, never an instrument or weapon name. */
export function ndCueMap(player: Pick<CuePlayer, 'play'>, random: () => number): CueMap {
  let step = 0;
  return (id, opts) => {
    switch (id) {
      case 'step': {
        step = (step % 4) + 1;
        const gain = opts.sprinting ? 1 : 0.7;
        if (opts.surface === 'planks') { tap.sound?.('nd.step.wood'); return player.play(`step.wood.${String(step)}`, { ...opts, gain }); }
        if (opts.surface === 'metal') { tap.sound?.('nd.step.metal'); return player.play(`step.metal.${String(step)}`, { ...opts, gain }); }
        tap.sound?.('nd.step.stone'); return player.play(`step.stone.${String(step)}`, { ...opts, gain });
      }
      case 'cue.jian.swing': case 'cue.sword.swing': case 'melee.swing': tap.sound?.('nd.jian.swing'); return player.play('jian.swing', opts);
      case 'cue.jian.heavy': case 'cue.sword.heavy': case 'melee.heavy': tap.sound?.('nd.jian.heavy'); return player.play('jian.swing.heavy', opts);
      case 'cue.jian.hit': case 'cue.sword.hit': case 'melee.hit':
        if (opts.surface === 'wood' || opts.surface === 'planks') { tap.sound?.('nd.jian.hit.wood'); return player.play('jian.hit.wood', opts); }
        if (opts.surface === 'metal') { tap.sound?.('nd.jian.clang'); return player.play('jian.clang', opts); }
        if (opts.surface === 'flesh') return false;
        tap.sound?.('nd.jian.hit.stone'); return player.play('jian.hit.stone', opts);
      case 'cue.grapple.fire': case 'grapple.fire': tap.sound?.('nd.feizhua.fire'); return player.play('feizhua.fire', opts);
      case 'cue.grapple.bite': case 'grapple.bite': tap.sound?.('nd.feizhua.bite'); return player.play('feizhua.bite', opts);
      case 'cue.grapple.reel': case 'grapple.reel': tap.sound?.('nd.feizhua.reel'); return player.play('feizhua.reel', opts);
      case 'cue.grapple.dock': case 'grapple.dock': tap.sound?.('nd.feizhua.dock'); return player.play('feizhua.dock', opts);
      case 'cue.grapple.zip': case 'grapple.zip': tap.sound?.('nd.feizhua.zip'); return player.play('feizhua.zip', opts);
      case 'chime.gust': tap.sound?.('nd.chime.gust'); return player.play('chime.gust', { ...opts, pan: opts.pan ?? (random() - 0.5) * 0.6 });
      // The generated set has no hurt/pickup family; keep today's synth and score sting.
      case 'hurt': case 'pickup': return false;
      default: return false;
    }
  };
}
/** Traversal owns its event boundaries; this callback keeps that path independent of the shell. */
let traversalCue: CueMap | undefined;
export function bindTraversalCue(map: CueMap): () => void {
  traversalCue = map;
  return () => { if (traversalCue === map) traversalCue = undefined; };
}
export function grappleCue(id: 'grapple.fire' | 'grapple.bite' | 'grapple.reel' | 'grapple.dock' | 'grapple.zip', opts: CueOpts = {}): void { traversalCue?.(id, opts); }
