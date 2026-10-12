const switches = new Set(['help', 'worker', 'devserver', 'gl-time', 'gpu-bisect', 'frame-timeline', 'road-approach', 'entry-socket']);
const values = new Set(['base', 'cpu-profile', 'deadline', 'developer', 'device', 'frames', 'gl-observer', 'gpu-trace',
  'grid-cell', 'grid-cell-pose', 'grid-routes', 'grid-scenario', 'regrade', 'rev', 'rising-islet', 'safari-profile',
  'settle', 'shards', 'surface', 'scratch-dir', 'worker-out', 'device-save', 'expect-system', 'setting', 'output-dir']);

/** Refuse misspelled or incomplete floor commands before a build, browser or Simulator lease is acquired.
 * @param {readonly string[]} args
 */
export function validateFrameFloorArgs(args) {
  for (const arg of args) {
    const equals = arg.indexOf('='), name = arg.slice(2, equals === -1 ? undefined : equals);
    if (!arg.startsWith('--') || !(equals === -1 ? switches : values).has(name))
      throw new Error(`Unknown frame-floor argument: ${arg}`);
  }
  if (args.includes('--grid-scenario=milestone') && !args.includes('--devserver'))
    throw new Error('Milestone floor requires --devserver (the complete Developer catalogue includes Nine)');
}
