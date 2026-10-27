import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { compileScriptV2 } from '@wildshard/sdk/compileScriptV2';
import { compileBehaviourModule } from '@wildshard/sdk/buildBehaviour';
import { generateDirectorAbi } from '@wildshard/sdk/directorAbi';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';

const PREFIX = '/src/shards/driftwood-isle/';
const text = new TextEncoder(), decode = new TextDecoder('utf-8', { fatal: true });
/** The return ABI's original registration order; numeric registries sort these names before assigning IDs. */
export const DRIFTWOOD_RETURN_FIELDS = ['candidates', 'away', 'draw', 'due', 'fixed', 'maximum', 'minimum', 'night', 'nocturnal', 'now', 'playerX', 'playerZ', 'water', 'x', 'z',
  'ground', 'awayDistance', 'distance', 'occupied', 'y', 'dead', 'alive', 'deadDt', 'delay', 'hidden'];
export const DRIFTWOOD_RETURN_CHANNELS = ['due', 'eligible', 'retry', 'x', 'z', 'index', 'score', 'perchH', 'dead', 'action'];
export const DRIFTWOOD_RETURN_SIGNALS = ['eligible', 'place', 'schedule', 'perchScore', 'perchHeight', 'practice'];
const aliases = (values: readonly string[]): Record<string, string> => Object.fromEntries(values.map(name => [name, name]));
const registry = (values: readonly string[]): ReadonlyMap<string, number> => new Map([...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((name, index) => [name, index + 1]));

/** Compile the original three guest programs from explicit authored bytes; no copied metadata or module is read. */
export async function driftwoodGuestBytes(inputs: ReadonlyMap<string, Uint8Array>): Promise<ReadonlyMap<string, Uint8Array>> {
  const read = (path: string): string => {
    const bytes = inputs.get(`${PREFIX}${path}`);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing Driftwood guest input: ${path}`);
    return decode.decode(bytes);
  };
  const authored = new Map<string, string>();
  for (const [url, bytes] of inputs) {
    if (!url.startsWith(PREFIX)) throw new Error('Guest input is outside Driftwood');
    const path = url.slice(PREFIX.length);
    if (path.startsWith('behaviour/') && path.endsWith('.as')) authored.set(path, decode.decode(bytes));
    else if (path !== 'data/director.json') throw new Error(`Unexpected Driftwood guest input: ${path}`);
  }
  const source = { id: 'driftwood.returns', abi: '1.0', side: 'sim', module: `blobs/wasm/${'0'.repeat(64)}.wasm`, source: 'behaviour/returns.as',
    binding: { shard: true }, pages: 1, onFail: 'hold', on: ['signal'], tick: null, stateVersion: 1, state: [], params: {},
    reads: ['field', 'random', 'groundHeight', 'radial'], commands: ['channel'], fields: aliases(DRIFTWOOD_RETURN_FIELDS),
    channels: aliases(DRIFTWOOD_RETURN_CHANNELS), signals: aliases(DRIFTWOOD_RETURN_SIGNALS) };
  const built = await compileDecisionScripts([source], { fields: registry(DRIFTWOOD_RETURN_FIELDS), channels: registry(DRIFTWOOD_RETURN_CHANNELS),
    signals: registry(DRIFTWOOD_RETURN_SIGNALS) }, authored, { asLineCeiling: 1716 });
  const script = built.rows[0], blob = built.blobs[0];
  if (built.rows.length !== 1 || built.blobs.length !== 1 || script === undefined || blob === undefined) throw new Error('Invalid owned return module inventory');
  const files = new Map<string, Uint8Array>([
    ['behaviour/returns.generated.wasm', blob.bytes],
    ['behaviour/returns.generated.json', text.encode(`${JSON.stringify({ script, bytes: '', compiled: { source: 'behaviour/returns.generated.wasm', bytes: blob.bytes.length, hash: hashImmutableBytes(blob.bytes) } }, null, 2)}\n`)],
  ]);
  const sway = await compileScriptV2(read('behaviour/bridgeSway.as'), { lane: 'view', ioBytes: 4096 });
  files.set('behaviour/bridgeSway.generated.wasm', sway);
  files.set('behaviour/bridgeSway.generated.json', text.encode(`${JSON.stringify({ lane: 'view', pages: 1, ioBytes: 4096, bytes: '',
    compiled: { source: 'behaviour/bridgeSway.generated.wasm', bytes: sway.length, hash: hashImmutableBytes(sway) } }, null, 2)}\n`));
  const declaration: unknown = JSON.parse(read('data/director.json'));
  const director = await compileBehaviourModule(read('behaviour/director.as'), 1, { 'wildshard-director.ts': generateDirectorAbi(declaration) });
  if (typeof declaration !== 'object' || declaration === null || !('module' in declaration) || declaration.module !== director.module)
    throw new Error('Driftwood director author module hash differs');
  const notice = 'DO NOT EDIT: behaviour/director.as -> scripts/bake/directorSource.ts (@wildshard/sdk/compileScript); regenerate with node scripts/bake/directors.mjs';
  files.set(`assets/${director.module}`, director.bytes);
  files.set('behaviour/director.json', text.encode(`${JSON.stringify({ generated: notice, module: director.module, bytes: '' }, null, 2)}\n`));
  return files;
}

/** Capture every authored AS source for the unchanged line budget, then retain only owned program files in the cache. */
export function driftwoodGuestFiles(ctx: Pick<ProjectGenerationContext, 'cached' | 'inputFiles'>): Promise<ReadonlyMap<string, Uint8Array>> {
  if (ctx.inputFiles === undefined) throw new Error('Guest programs require their complete authored input inventory');
  const inputs = [...ctx.inputFiles([`${PREFIX}behaviour/`]).filter(url => url.endsWith('.as')), `${PREFIX}data/director.json`];
  return ctx.cached({ id: 'guest-programs', native: true, inputs }, driftwoodGuestBytes);
}
