import { parseClientChannels, type ClientChannelProgram, type ClientChannelProperty } from '@wildshard/format/clientChannels';

type Node = ClientChannelProgram['nodes'][number];
type Unary = Extract<Node, { a: number }>['op'];
type Binary = Exclude<Extract<Node, { b: number }>['op'], 'hypot3'>;
/** Readable authoring of bounded straight-line visual expressions; build output is ordinary format data. */
export class ClientChannels {
  private readonly nodes: Node[] = [];
  private readonly reads: string[] = [];
  private readonly locals: NonNullable<ClientChannelProgram['locals']> = [];
  private readonly bindings: NonNullable<ClientChannelProgram['bindings']> = [];
  private promptRow: ClientChannelProgram['prompt'];
  private moverId: string | undefined;
  private readonly channels: ClientChannelProgram['channels'] = [];
  private readonly id: string;
  constructor(id: string) { this.id = id; }
  private append(node: Node): number { const at = this.nodes.length; this.nodes.push(node); return at; }
  /** Literal scalar, retained exactly as authored. */
  constant(value: number): number { return this.append({ op: 'constant', value }); }
  /** Continuous presentation time or the caller's original frame interval. */
  clock(value: 'time' | 'delta'): number { return this.append({ op: 'clock', value }); }
  /** Name an explicitly copied numeric observation; there is no state object or write port. */
  read(name: string): number {
    let index = this.reads.indexOf(name); if (index < 0) { index = this.reads.length; this.reads.push(name); }
    return this.append({ op: 'read', index });
  }
  /** Read a private previous-frame scalar, initially a literal or a copied first-frame observation. */
  local(initial: number | { readonly read: string }): number {
    let seed: NonNullable<ClientChannelProgram['locals']>[number]['initial'];
    if (typeof initial === 'number') seed = { op: 'constant', value: initial };
    else {
      let index = this.reads.indexOf(initial.read);
      if (index < 0) { index = this.reads.length; this.reads.push(initial.read); }
      seed = { op: 'read', index };
    }
    const index = this.locals.length, at = this.append({ op: 'local', index });
    this.locals.push({ initial: seed, next: at });
    return at;
  }
  /** Commit a finite node to this private slot after every frame calculation succeeds. */
  retain(local: number, next: number): void {
    const node = this.nodes[local];
    if (node?.op !== 'local') throw new Error('Expected a private client slot');
    const slot = this.locals[node.index];
    if (slot === undefined) throw new Error('Missing private client slot');
    slot.next = next;
  }
  /** One admitted unary arithmetic/trigonometric operation. */
  unary(op: Exclude<Unary, Binary | 'hypot3'>, a: number): number { return this.append({ op, a }); }
  /** One admitted binary arithmetic/trigonometric operation, preserving operand order. */
  binary(op: Binary, a: number, b: number): number { return this.append({ op, a, b }); }
  /** The original three-axis Math.hypot operation, without nested binary rounding. */
  hypot3(a: number, b: number, c: number): number { return this.append({ op: 'hypot3', a, b, c }); }
  /** Declare a normal input prompt; channel evaluation never dispatches its separate trusted action. */
  prompt(row: NonNullable<ClientChannelProgram['prompt']>): void { this.promptRow = structuredClone(row); }
  /** Select already evaluated scalar nodes without a call, loop or side effect. */
  select(test: number, yes: number, no: number): number { return this.append({ op: 'select', test, yes, no }); }
  /** Bind a scalar result to one private visual property. */
  output(property: ClientChannelProperty, value: number): void { this.channels.push({ property, value }); }
  /** Bind a visual channel to a named private scene object; rotations may specify their original Euler order. */
  bind(property: NonNullable<ClientChannelProgram['bindings']>[number]['property'], target: string,
    order?: NonNullable<ClientChannelProgram['bindings']>[number]['order']): void {
    this.bindings.push({ property, target, ...(order === undefined ? {} : { order }) });
  }
  /** Observe a declared mover's copied pose/fields; this source has no additional clock or private recurrence. */
  fromMover(id: string): void { this.moverId = id; }
  /** Validate and detach the authored program. */
  build(): ClientChannelProgram {
    const result = parseClientChannels([{ id: this.id, reads: this.reads, nodes: this.nodes, channels: this.channels, ...(this.locals.length === 0 ? {} : { locals: this.locals }), ...(this.bindings.length === 0 ? {} : { bindings: this.bindings }), ...(this.moverId === undefined ? {} : { mover: this.moverId }), ...(this.promptRow === undefined ? {} : { prompt: this.promptRow }) }])[0];
    if (result === undefined) throw new Error('Missing client channel program'); return result;
  }
}
