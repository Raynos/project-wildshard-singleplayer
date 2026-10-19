import { parseClientChannels, type ClientChannelProgram } from '@wildshard/format/clientChannels';

/** Reuse pose literals offline so the combined declaration stays inside JSON admission. */
export function compactChannels(input: unknown): ClientChannelProgram[] {
  const programs = parseClientChannels(input);
  for (const program of programs) {
    if (program.numeric === undefined || program.geometry !== undefined || program.connectors !== undefined) continue;
    const constants = new Map<number, number>(), indices = new Map<number, number>();
    const nodes: ClientChannelProgram['nodes'] = [];
    const ref = (index: number): number => {
      const value = indices.get(index); if (value === undefined) throw new Error('Pose dependency must precede its reader'); return value;
    };
    for (const [index, node] of program.nodes.entries()) {
      const literal = node.op === 'constant' && !Object.is(node.value, -0);
      const known = literal ? constants.get(node.value) : undefined;
      if (known !== undefined) { indices.set(index, known); continue; }
      const at = nodes.length; indices.set(index, at);
      if (literal) constants.set(node.value, at);
      if (node.op === 'select') nodes.push({ ...node, test: ref(node.test), yes: ref(node.yes), no: ref(node.no) });
      else if ('c' in node) nodes.push({ ...node, a: ref(node.a), b: ref(node.b), c: ref(node.c) });
      else if ('b' in node) nodes.push({ ...node, a: ref(node.a), b: ref(node.b) });
      else if ('a' in node) nodes.push({ ...node, a: ref(node.a) });
      else nodes.push(node);
    }
    program.nodes = nodes;
    for (const row of program.channels) row.value = ref(row.value);
    for (const row of program.locals ?? []) row.next = ref(row.next);
  }
  return programs;
}
