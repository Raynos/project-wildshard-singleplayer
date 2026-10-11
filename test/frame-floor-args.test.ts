import { describe, expect, it } from 'vitest';
import { validateFrameFloorArgs } from '../scripts/frame-floor-args.mjs';

describe('frame floor resource preflight', () => {
  it.each([
    [],
    ['--help'],
    ['--output-dir=/private/tmp/claude-501/sp-builders/sp-x1'],
    ['--regrade=/tmp/report.json'],
    ['--shards=grid', '--surface=sim', '--grid-scenario=milestone', '--devserver', '--safari-profile=/tmp/profile', '--gl-time', '--grid-routes=pine-hollow-road-entry'],
    ['--shards=grid', '--grid-scenario=cell', '--grid-cell=far-reach', '--entry-socket', '--rising-islet=north', '--road-approach'],
    ['--worker', '--base=http://localhost:4400/', '--deadline=1000', '--worker-out=/tmp/out.json', '--setting=fps=auto', '--setting=buildPacing=on', '--device-save=devMode=true', '--expect-system=platform.grid'],
  ].map(args => ({ args })))('retains an existing command $args', ({ args }) => {
    expect(() => validateFrameFloorArgs(args)).not.toThrow();
  });

  it.each([
    ['--safari-cpu-profile=/tmp/profile'],
    ['--devserver=false'],
    ['--surface', 'sim'],
    ['--unknown-option'],
  ].map(args => ({ args })))('refuses a silently ignored argument $args', ({ args }) => {
    expect(() => validateFrameFloorArgs(args)).toThrow('Unknown frame-floor argument');
  });

  it('requires the entire milestone catalogue before taking a lane, even for a selected route', () => {
    expect(() => validateFrameFloorArgs(['--shards=grid', '--grid-scenario=milestone', '--grid-routes=pine-hollow-road-entry']))
      .toThrow('Milestone floor requires --devserver');
  });
});
