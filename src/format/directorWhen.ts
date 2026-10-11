/** The bounded, JSON-only instruction set for director conditions. No JavaScript evaluation is involved. */
export type DirectorWhenInstruction = { input: string } | { literal: boolean } | { op: 'not' | 'and' | 'or' };

/** Compile !, &&, ||, parentheses and boolean literals over declared input names. Precedence matches JavaScript. */
export function compileDirectorWhen(source: string, names: readonly string[]): readonly DirectorWhenInstruction[] {
  if (source.length === 0 || source.length > 1024) throw new Error('Director condition length');
  const tokens: string[] = [];
  let offset = 0;
  while (offset < source.length) {
    const tail = source.slice(offset), match = /^(?:\s+|&&|\|\||[!()]|[A-Za-z_][A-Za-z0-9_]*)/u.exec(tail);
    if (match === null) throw new Error('Invalid director condition token');
    offset += match[0].length;
    if (match[0].trim() !== '') tokens.push(match[0]);
    if (tokens.length > 128) throw new Error('Director condition token limit');
  }
  const instructions: DirectorWhenInstruction[] = [];
  let cursor = 0;
  function atom(depth: number): void {
    if (depth > 16) throw new Error('Director condition nesting limit');
    const token = tokens[cursor++];
    if (token === '!') { atom(depth + 1); instructions.push({ op: 'not' }); }
    else if (token === '(') { either(depth + 1); if (tokens[cursor++] !== ')') throw new Error('Unclosed director condition'); }
    else if (token === 'true' || token === 'false') instructions.push({ literal: token === 'true' });
    else if (token !== undefined && names.includes(token)) instructions.push({ input: token });
    else throw new Error('Undeclared director condition input');
  }
  function both(depth: number): void {
    atom(depth);
    while (tokens[cursor] === '&&') { cursor++; atom(depth); instructions.push({ op: 'and' }); }
  }
  function either(depth: number): void {
    both(depth);
    while (tokens[cursor] === '||') { cursor++; both(depth); instructions.push({ op: 'or' }); }
  }
  either(0);
  if (cursor !== tokens.length) throw new Error('Trailing director condition token');
  return instructions;
}

/** Execute admitted condition data against complete native boolean observations. Missing or nonboolean inputs refuse. */
export function evaluateDirectorWhen(instructions: readonly DirectorWhenInstruction[], observation: Readonly<Record<string, boolean>>): boolean {
  const stack: boolean[] = [];
  for (const instruction of instructions) {
    if ('input' in instruction) {
      const value = observation[instruction.input];
      if (!Object.hasOwn(observation, instruction.input) || typeof value !== 'boolean') throw new Error('Invalid director condition observation');
      stack.push(value);
    } else if ('literal' in instruction) stack.push(instruction.literal);
    else {
      const right = stack.pop();
      if (right === undefined) throw new Error('Invalid director condition program');
      if (instruction.op === 'not') stack.push(!right);
      else {
        const left = stack.pop();
        if (left === undefined) throw new Error('Invalid director condition program');
        stack.push(instruction.op === 'and' ? left && right : left || right);
      }
    }
  }
  if (stack.length !== 1 || stack[0] === undefined) throw new Error('Invalid director condition program');
  return stack[0];
}
