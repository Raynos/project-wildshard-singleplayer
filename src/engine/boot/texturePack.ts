import type { Scope } from '../app/scope';
import type { PackDef, PackPart, PackFile } from './tables';

const MAX_BYTES = 4_194_304;
const digestOf = (path: string): string | undefined => /-([a-f0-9]{8})\.ktx2$/u.exec(path)?.[1];
interface Member { readonly part: PackPart; readonly row: PackFile; readonly index: number }
interface Group { readonly controller: AbortController; readonly entries: readonly Pending[] }
interface Pending {
  readonly path: string; readonly member: Member; readonly net: typeof fetch;
  readonly promise: Promise<Uint8Array>; readonly resolve: (bytes: Uint8Array) => void; readonly reject: (error: unknown) => void;
  consumers: number; group?: Group;
}
const aborted = (): DOMException => new DOMException('Texture pack owner or reader retired', 'AbortError');

/** Demand-only reads of existing boot-pack textures. Adjacent requested members
 * share complete parts of at most 4 MiB; other files and future requests never join the read.
 * Only pending callers own bytes, and each receives an independent response. */
export class TexturePackReads {
  private readonly members = new Map<string, Member>();
  private readonly active = new Map<string, Pending>();
  private readonly queued = new Map<string, Pending>();
  private readonly groups = new Set<Group>();
  private scheduled = false;
  private disposed = false;
  private readonly owner: Pick<Scope, 'listen'>;
  private readonly cached: (path: string) => Promise<Response | undefined>;
  constructor(pack: PackDef, owner: Pick<Scope, 'listen'>, cached: (path: string) => Promise<Response | undefined> = cachedPart) {
    this.owner = owner; this.cached = cached;
    for (const part of pack.parts) for (const [index, row] of part.files.entries()) {
      if (digestOf(row[0]) !== undefined && row[2] > 0 && row[2] <= MAX_BYTES) this.members.set(row[0], { part, row, index });
    }
  }
  read(path: string, net: typeof fetch, signal?: AbortSignal): Promise<Response> | undefined {
    const member = this.members.get(path);
    if (member === undefined || this.disposed) return undefined;
    if (signal?.aborted === true) return Promise.reject(aborted());
    let pending = this.active.get(path);
    if (pending === undefined) {
      let complete: Pending['resolve'] = () => undefined, fail: Pending['reject'] = () => undefined;
      const promise = new Promise<Uint8Array>((resolve, reject) => { complete = resolve; fail = reject; });
      pending = { path, member, net, promise, resolve: complete, reject: fail, consumers: 0 };
      this.active.set(path, pending); this.queued.set(path, pending);
      if (!this.scheduled) { this.scheduled = true; queueMicrotask(() => { this.flush(); }); }
    }
    const entry = pending; entry.consumers++;
    return new Promise<Response>((resolve, reject) => {
      let live = true, stop = (): void => undefined;
      const finish = (): boolean => {
        if (!live) return false;
        live = false; stop(); entry.consumers--;
        if (entry.group?.entries.every(row => row.consumers === 0) === true) entry.group.controller.abort();
        return true;
      };
      const cancel = (): void => { if (finish()) reject(aborted()); };
      if (signal !== undefined) stop = this.owner.listen(signal, 'abort', cancel, { once: true });
      const consume = async (): Promise<void> => {
        try { const bytes = await entry.promise; if (finish()) resolve(new Response(bytes.slice(), { headers: { 'content-type': entry.member.row[3], 'content-length': String(bytes.length) } })); }
        catch (error) { if (finish()) reject(error instanceof Error ? error : new Error('Texture pack read failed', { cause: error })); }
      };
      void consume();
    });
  }
  dispose(): void {
    this.disposed = true;
    for (const group of this.groups) group.controller.abort();
    for (const entry of this.active.values()) entry.reject(aborted());
    this.active.clear(); this.queued.clear(); this.members.clear();
  }
  private flush(): void {
    this.scheduled = false;
    for (const entry of [...this.queued.values()].sort((a, b) => a.member.part.url.localeCompare(b.member.part.url) || a.member.index - b.member.index)) {
      if (!this.queued.has(entry.path)) continue;
      this.queued.delete(entry.path);
      const complete = entry.member.part.bytes <= MAX_BYTES && entry.member.part.files.length > 1
        && entry.member.part.files.every(row => {
          const wanted = row[0] === entry.path ? entry : this.queued.get(row[0]); return wanted !== undefined && wanted.consumers > 0;
        });
      const entries = complete ? entry.member.part.files.map(row => row[0] === entry.path ? entry : this.queued.get(row[0])) : [entry];
      const demanded: Pending[] = [];
      for (const row of entries) { if (row === undefined) throw new Error('Missing complete texture demand'); demanded.push(row); this.queued.delete(row.path); }
      const group: Group = { controller: new AbortController(), entries: demanded };
      for (const row of demanded) row.group = group;
      this.groups.add(group);
      void this.run(group).finally(() => {
        this.groups.delete(group);
        for (const row of demanded) if (this.active.get(row.path) === row) this.active.delete(row.path);
      });
    }
  }
  private async run(group: Group): Promise<void> {
    try {
      if (this.disposed || group.entries.every(row => row.consumers === 0)) throw aborted();
      const first = group.entries[0], last = group.entries.at(-1);
      if (first === undefined || last === undefined) throw new Error('Missing texture pack demand');
      const part = first.member.part, together = group.entries.length > 1;
      // Complete cached parts can also supply one later/offline member. Cache
      // lookup never triggers a new part download or retains its backing.
      const cached = !together && part.bytes <= MAX_BYTES ? await this.cached(part.url) : undefined;
      const envelope = together || cached !== undefined;
      const response = cached ?? await first.net(together ? part.url : first.path, { signal: group.controller.signal });
      if (response.status !== 200) { await response.body?.cancel(); throw new Error('Texture pack response differs'); }
      if (group.controller.signal.aborted) { await response.body?.cancel(); throw aborted(); }
      const bytes = new Uint8Array(envelope ? part.bytes : first.member.row[2]);
      const reader = response.body?.getReader(); if (reader === undefined) throw new Error('Missing texture pack body');
      let offset = 0;
      try {
        for (;;) {
          const chunk = await reader.read(); if (group.controller.signal.aborted) throw aborted(); if (chunk.done) break;
          if (offset + chunk.value.length > bytes.length) throw new Error('Texture pack body exceeds demand');
          bytes.set(chunk.value, offset); offset += chunk.value.length;
        }
        if (offset !== bytes.length) throw new Error('Texture pack body is truncated');
      } catch (error) { await reader.cancel(); throw error; }
      finally { reader.releaseLock(); }
      if (envelope && !(await hash(bytes)).startsWith(/-([a-f0-9]{8})\.bin$/u.exec(part.url)?.[1] ?? 'invalid')) throw new Error('Texture pack hash differs');
      const members = await Promise.all(group.entries.map(async entry => {
        const at = envelope ? entry.member.row[1] : 0, wire = bytes.slice(at, at + entry.member.row[2]);
        const digest = await hash(wire);
        if (!digest.startsWith(digestOf(entry.path) ?? 'invalid')) throw new Error('Texture pack member hash differs');
        return wire;
      }));
      if (this.disposed || group.controller.signal.aborted) throw aborted();
      for (const [index, entry] of group.entries.entries()) {
        const member = members[index]; if (member === undefined) throw new Error('Missing texture pack member');
        entry.resolve(member);
      }
    } catch (error) { for (const entry of group.entries) entry.reject(error); }
  }
}

async function hash(bytes: Uint8Array<ArrayBuffer>): Promise<string> { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join(''); }
async function cachedPart(path: string): Promise<Response | undefined> {
  try { return typeof caches === 'undefined' ? undefined : await caches.match(path, { ignoreVary: true }); }
  catch { return undefined; } // Storage denial preserves the ordinary direct read.
}
const readers = new Set<TexturePackReads>();
/** Explicit session installation: no fetch, service or byte owner is installed by import. */
export function installTexturePackReads(pack: PackDef, owner: Pick<Scope, 'onDispose' | 'listen'>): void {
  const reader = new TexturePackReads(pack, owner); readers.add(reader);
  owner.onDispose(() => { readers.delete(reader); reader.dispose(); });
}
/** Below byte accounting: a virtual member response still credits its original
 * URL. Custom requests, ranges, queries and cross-origin reads remain direct. */
export function demandTextureResponse(input: RequestInfo | URL, init: RequestInit | undefined, net: typeof fetch): Promise<Response> | undefined {
  if (readers.size === 0) return undefined;
  const value = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (digestOf(value) === undefined) return undefined;
  const request = input instanceof Request ? input : undefined;
  if (init !== undefined && Object.keys(init).some(key => key !== 'signal') || (request?.method ?? 'GET') !== 'GET'
    || new Headers(request?.headers).keys().next().done === false
    || request !== undefined && (request.credentials !== 'same-origin' || request.cache !== 'default' || request.integrity !== ''
      || request.mode !== 'cors' || request.redirect !== 'follow' || request.referrerPolicy !== '')) return undefined;
  let url: URL; try { url = new URL(value, location.href); } catch { return undefined; }
  if (url.origin !== location.origin || url.search !== '' || url.hash !== '') return undefined;
  for (const reader of readers) {
    const response = reader.read(url.pathname, net, init?.signal ?? request?.signal);
    if (response !== undefined) return response;
  }
  return undefined;
}
