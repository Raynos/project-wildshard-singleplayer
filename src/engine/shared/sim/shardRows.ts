/** One shard-script body as a client draws it: a mover's pose, in the cell's frame. */
export interface ScriptNetView {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly euler: { readonly x: number; readonly y: number; readonly z: number };
  readonly enabled: boolean;
}
/** One public shared field of a shard's declared state, by its declared name. */
export interface StateNetRow { readonly name: string; readonly value: number }
/** What a host's shard publishes to a room. Read only when a room samples it; the page publishes too and never reads. */
export interface ShardRows {
  readonly bodies: Map<string, () => ScriptNetView>;
  state: (() => readonly StateNetRow[]) | null;
  /** `state` rows a world system publishes for itself, by that system's id (E6: weather). */
  readonly world: Map<string, () => readonly StateNetRow[]>;
}

const books = new WeakMap<object, ShardRows>();
const NO_ROWS: ShardRows = { bodies: new Map<string, () => ScriptNetView>(), state: null, world: new Map<string, () => readonly StateNetRow[]>() };
interface RowHost { readonly scope: { readonly onDispose: (run: () => void) => unknown } }
function bookOf(host: RowHost): ShardRows {
  let book = books.get(host);
  if (book === undefined) { const fresh: ShardRows = { bodies: new Map<string, () => ScriptNetView>(), state: null, world: new Map<string, () => readonly StateNetRow[]>() }; book = fresh; books.set(host, fresh); host.scope.onDispose(() => { fresh.bodies.clear(); fresh.state = null; fresh.world.clear(); }); }
  return book;
}
/** Publish a script body under its stable id for the host's lifetime. */
export function publishScriptBody(host: RowHost, id: string, read: () => ScriptNetView): void {
  const { bodies } = bookOf(host), wire = `script:${id}`;
  if (bodies.has(wire)) throw new Error(`Duplicate script row ${id}`);
  bodies.set(wire, read);
}
/** Publish the shard's public shared state. One lane owns a host's declared state. */
export function publishShardState(host: RowHost, read: () => readonly StateNetRow[]): void {
  const book = bookOf(host);
  if (book.state !== null) throw new Error('Duplicate declared state rows');
  book.state = read;
}
/** Publish a world system's own `state` rows for the host's lifetime. */
export function publishWorldState(host: RowHost, id: string, read: () => readonly StateNetRow[]): void {
  const { world } = bookOf(host);
  if (world.has(id)) throw new Error(`Duplicate world rows ${id}`);
  world.set(id, read);
}
/** Everything a host publishes. */
export function shardRows(host: object): ShardRows { return books.get(host) ?? NO_ROWS; }
