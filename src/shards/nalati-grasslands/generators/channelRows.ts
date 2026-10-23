import { parseClientChannels, type ClientChannelProgram } from '@wildshard/format/clientChannels';

/** Reuse identical copied-value expressions offline, remapping every consumer. */
export function compactChannels(input: unknown): ClientChannelProgram[] {
  const programs = parseClientChannels(input);
  for (const program of programs) {
    if (program.numeric === undefined || program.geometry !== undefined || program.connectors !== undefined) continue;
    const constants = new Map<number, number>(), indices = new Map<number, number>();
    const expressions = new Map<string, number>();
    const nodes: ClientChannelProgram['nodes'] = [];
    const ref = (index: number): number => {
      const value = indices.get(index); if (value === undefined) throw new Error('Pose dependency must precede its reader'); return value;
    };
    for (const [index, node] of program.nodes.entries()) {
      const literal = node.op === 'constant' && !Object.is(node.value, -0);
      const known = literal ? constants.get(node.value) : undefined;
      if (known !== undefined) { indices.set(index, known); continue; }
      let rewritten: ClientChannelProgram['nodes'][number];
      if (node.op === 'select') rewritten = { ...node, test: ref(node.test), yes: ref(node.yes), no: ref(node.no) };
      else if ('c' in node) rewritten = { ...node, a: ref(node.a), b: ref(node.b), c: ref(node.c) };
      else if ('b' in node) rewritten = { ...node, a: ref(node.a), b: ref(node.b) };
      else if ('a' in node) rewritten = { ...node, a: ref(node.a) };
      else rewritten = node;
      // Only pure operations over identical copied operand slots are shared.
      // Keep observations, local slots and sample tables in their authored order.
      const key = rewritten.op === 'select' || 'a' in rewritten && rewritten.op !== 'sample'
        ? JSON.stringify(rewritten) : null;
      const previous = key === null ? undefined : expressions.get(key);
      if (previous !== undefined) { indices.set(index, previous); continue; }
      const at = nodes.length; indices.set(index, at);
      if (literal) constants.set(node.value, at);
      if (key !== null) expressions.set(key, at);
      nodes.push(rewritten);
    }
    program.nodes = nodes;
    for (const row of program.channels) row.value = ref(row.value);
    for (const row of program.locals ?? []) row.next = ref(row.next);
  }
  return programs;
}
