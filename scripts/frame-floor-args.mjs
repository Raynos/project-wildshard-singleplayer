const switches = new Set(['help', 'worker', 'quiet', 'devserver', 'gl-time', 'gpu-bisect', 'frame-timeline', 'task-clock', 'road-approach', 'entry-socket']);
const values = new Set(['base', 'cpu-profile', 'deadline', 'developer', 'device', 'frames', 'gl-observer', 'gpu-trace',
  'grid-cell', 'grid-cell-pose', 'grid-routes', 'grid-scenario', 'regrade', 'rev', 'rising-islet', 'safari-profile', 'safari-steady', 'safari-drive',
  'settle', 'shards', 'surface', 'scratch-dir', 'worker-out', 'device-save', 'expect-system', 'setting', 'output-dir',
  'textures', 'ktx2-probe', 'serve-shard', 'serve-base', 'standing-poses', 'native-memory', 'webkit-timeline']);

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
  if (args.includes('--quiet') && (args.filter(arg => arg.startsWith('--surface=')).length !== 1 || !args.includes('--surface=sim')))
    throw new Error('Quiet frame floors require --surface=sim');
  if (args.some(arg => arg.startsWith('--webkit-timeline=')) && !args.includes('--surface=sim'))
    throw new Error('WebKit timelines require --surface=sim');
  const steady = args.filter(arg => arg.startsWith('--safari-steady='));
  const drive = args.filter(arg => arg.startsWith('--safari-drive='));
  const selected = [...steady, ...drive];
  const paired = steady.length === 1 && drive.length === 1 && drive[0] !== undefined
    && steady[0] === `--safari-steady=grid-${drive[0].slice('--safari-drive='.length)}`;
  if (selected.length > 0 && (steady.length > 1 || drive.length > 1 || selected.length > 1 && !paired
    || selected.some(selection => !/^[a-zA-Z0-9_.-]{1,128}$/u.test(selection.slice(selection.indexOf('=') + 1)))
    || !args.includes('--surface=sim') || !args.includes('--shards=grid')
    || !args.some(arg => arg.startsWith('--safari-profile=') && arg.length > '--safari-profile='.length)
    || !args.some(arg => arg.startsWith('--grid-scenario=') && arg !== '--grid-scenario=baseline')))
    throw new Error('Selected Safari sampling requires one pose or drive (or a matching pair), Simulator grid travel and --safari-profile');
}
