const switches = new Set(['help', 'worker', 'quiet', 'devserver', 'gl-time', 'gpu-bisect', 'frame-timeline', 'task-clock', 'road-approach', 'entry-socket', 'wasm-memory-probe']);
const values = new Set(['base', 'cpu-profile', 'deadline', 'developer', 'device', 'frames', 'gl-observer', 'gpu-trace',
  'grid-cell', 'grid-cell-pose', 'grid-routes', 'grid-scenario', 'regrade', 'rev', 'rising-islet', 'safari-profile', 'safari-steady', 'safari-drive', 'safari-prefix', 'safari-window',
  'settle', 'shards', 'surface', 'scratch-dir', 'worker-out', 'device-save', 'expect-system', 'setting', 'output-dir',
  'textures', 'ktx2-probe', 'serve-shard', 'serve-base', 'standing-poses', 'native-memory', 'webkit-timeline', 'webkit-steady', 'native-pressure', 'wasm-constructors']);

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
  if (args.some(arg => arg.startsWith('--wasm-constructors=')) && !args.includes('--surface=sim'))
    throw new Error('Native constructor observations require --surface=sim');
  if (args.includes('--wasm-memory-probe') && (!args.includes('--surface=sim') || args.includes('--quiet')
    || !args.some(arg => arg.startsWith('--wasm-constructors=') && arg.length > '--wasm-constructors='.length)
    || !args.some(arg => arg.startsWith('--webkit-timeline=') && arg.length > '--webkit-timeline='.length)))
    throw new Error('Blank memory probe requires no-quiet Simulator, native constructors and Timeline');
  const timelineSteady = args.filter(arg => arg.startsWith('--webkit-steady='));
  if (timelineSteady.length > 0 && (timelineSteady.length !== 1
    || !/^--webkit-steady=grid-[a-zA-Z0-9_.-]{1,128}(?:,grid-[a-zA-Z0-9_.-]{1,128})?$/u.test(timelineSteady[0] ?? '')
    || new Set((timelineSteady[0] ?? '').slice('--webkit-steady='.length).split(',')).size !== (timelineSteady[0] ?? '').split(',').length
    || !args.includes('--surface=sim') || !args.includes('--shards=grid')
    || !args.some(arg => arg.startsWith('--grid-scenario=') && arg !== '--grid-scenario=baseline')
    || !args.some(arg => arg.startsWith('--webkit-timeline=') && arg.length > '--webkit-timeline='.length)
    || args.some(arg => arg.startsWith('--safari-') || arg.startsWith('--wasm-constructors=') || arg.startsWith('--cpu-profile=') || arg.startsWith('--gpu-trace=') || arg.startsWith('--native-memory='))
    || ['--gl-time', '--gpu-bisect', '--frame-timeline', '--task-clock', '--wasm-memory-probe'].some(arg => args.includes(arg))))
    throw new Error('Steady Timeline requires one or two distinct Simulator grid poses and --webkit-timeline, without other recorders');
  if (args.some(arg => arg.startsWith('--native-pressure=')) && (timelineSteady.length !== 1
    || !args.some(arg => arg.startsWith('--native-pressure=') && arg.length > '--native-pressure='.length)))
    throw new Error('Native pressure probe requires a selected settled Timeline and an output directory');
  const steady = args.filter(arg => arg.startsWith('--safari-steady='));
  const drive = args.filter(arg => arg.startsWith('--safari-drive='));
  const prefix = args.filter(arg => arg.startsWith('--safari-prefix='));
  const window = args.filter(arg => arg.startsWith('--safari-window='));
  if (window.length > 0 && (window.length !== 1 || prefix.length > 0 || steady.length > 0 || drive.length > 0
    || args.some(arg => arg.startsWith('--wasm-constructors=') || arg.startsWith('--webkit-timeline='))
    || !parseSafariWindow(window[0]?.slice('--safari-window='.length) ?? '')
    || !args.includes('--surface=sim') || !args.includes('--shards=grid')
    || !args.some(arg => arg.startsWith('--safari-profile=') && arg.length > '--safari-profile='.length)
    || !args.some(arg => arg.startsWith('--grid-scenario=') && arg !== '--grid-scenario=baseline')))
    throw new Error('Safari window requires one bounded Simulator grid drive and --safari-profile without other sampling selections');
  const selected = [...steady, ...drive];
  const paired = steady.length === 1 && drive.length === 1 && drive[0] !== undefined
    && steady[0] === `--safari-steady=grid-${drive[0].slice('--safari-drive='.length)}`;
  if (selected.length > 0 && (steady.length > 1 || drive.length > 1 || selected.length > 1 && !paired
    || selected.some(selection => !/^[a-zA-Z0-9_.-]{1,128}$/u.test(selection.slice(selection.indexOf('=') + 1)))
    || !args.includes('--surface=sim') || !args.includes('--shards=grid')
    || !args.some(arg => arg.startsWith('--safari-profile=') && arg.length > '--safari-profile='.length)
    || !args.some(arg => arg.startsWith('--grid-scenario=') && arg !== '--grid-scenario=baseline')))
    throw new Error('Selected Safari sampling requires one pose or drive (or a matching pair), Simulator grid travel and --safari-profile');
  if (prefix.length > 0 && (prefix.length !== 1 || selected.length > 0 || args.includes('--quiet') || !args.includes('--surface=sim')
    || !args.includes('--shards=grid') || !/^--safari-prefix=[a-zA-Z0-9_.-]{1,128}$/u.test(prefix[0] ?? '')
    || !args.some(arg => arg.startsWith('--safari-profile=') && arg.length > '--safari-profile='.length)
    || !args.some(arg => arg.startsWith('--grid-scenario=') && arg !== '--grid-scenario=baseline')))
    throw new Error('Safari prefix sampling requires one no-quiet Simulator grid drive and --safari-profile, without steady or extended-drive selection');
}

/** @param {string} value */
export function parseSafariWindow(value) {
  if (value === '') return null;
  const match = /^([a-zA-Z0-9_.-]{1,128}):(\d{1,3}):(\d{1,3})$/u.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
  const from = Number(match[2]), to = Number(match[3]);
  if (from < 0 || to <= from || to > 120 || to - from > 20) return null;
  return { route: match[1], fromMs: from * 1000, toMs: to * 1000 };
}
