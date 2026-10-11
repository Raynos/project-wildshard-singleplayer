import { parseClientChannels, type ClientChannelProgram, type ClientChannelProperty } from '@wildshard/format/clientChannels';

type Node = ClientChannelProgram['nodes'][number];
type Unary = Extract<Node, { a: number }>['op'];
type Binary = Extract<Node, { b: number }>['op'];
/** Readable authoring of bounded straight-line visual expressions; build output is ordinary format data. */
export class ClientChannels {
  private readonly nodes: Node[] = [];
  private readonly reads: string[] = [];
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
  /** One admitted unary arithmetic/trigonometric operation. */
  unary(op: Exclude<Unary, Binary>, a: number): number { return this.append({ op, a }); }
  /** One admitted binary arithmetic/trigonometric operation, preserving operand order. */
  binary(op: Binary, a: number, b: number): number { return this.append({ op, a, b }); }
  /** Select already evaluated scalar nodes without a call, loop or side effect. */
  select(test: number, yes: number, no: number): number { return this.append({ op: 'select', test, yes, no }); }
  /** Bind a scalar result to one private visual property. */
  output(property: ClientChannelProperty, value: number): void { this.channels.push({ property, value }); }
  /** Validate and detach the authored program. */
  build(): ClientChannelProgram {
    const result = parseClientChannels([{ id: this.id, reads: this.reads, nodes: this.nodes, channels: this.channels }])[0];
    if (result === undefined) throw new Error('Missing client channel program'); return result;
  }
}
