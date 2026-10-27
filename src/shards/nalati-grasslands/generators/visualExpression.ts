/** The closed expression language authored by weatherFxChannels and skyPresentation.
 * Parsing produces data only: no TypeScript service, filesystem or evaluated JavaScript. */
export type VisualExpression =
  | { kind: 'number'; value: number }
  | { kind: 'read'; name: string }
  | { kind: 'negative'; value: VisualExpression }
  | { kind: 'binary'; op: string; left: VisualExpression; right: VisualExpression }
  | { kind: 'select'; condition: VisualExpression; yes: VisualExpression; no: VisualExpression }
  | { kind: 'call'; name: string; args: VisualExpression[] };

const precedence: Readonly<Record<string, number>> = { '||': 1, '&&': 2, '>': 3, '<': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5 };

/** Preserve JavaScript arithmetic precedence and left association for the original bounded recipes. */
export function visualExpression(source: string): VisualExpression {
  if (source.length > 4096) throw new Error('Visual expression exceeds source bound');
  const tokens: string[] = [];
  let offset = 0;
  while (offset < source.length) {
    if (/\s/u.test(source[offset] ?? '')) { offset++; continue; }
    const token = /^(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|(?:\[\d+\]))*|&&|\|\||[()+*/%<>?:,-])/u.exec(source.slice(offset))?.[0];
    if (token === undefined) throw new Error(`Unsupported visual expression at ${String(offset)}`);
    tokens.push(token); offset += token.length;
    if (tokens.length > 1024) throw new Error('Visual expression exceeds token bound');
  }
  let at = 0, depth = 0;
  const take = (value: string): void => { if (tokens[at++] !== value) throw new Error(`Expected visual token ${value}`); };
  const expression = (minimum = 0): VisualExpression => {
    if (++depth > 128) throw new Error('Visual expression exceeds nesting bound');
    const token = tokens[at++];
    if (token === undefined) throw new Error('Missing visual expression');
    let left: VisualExpression;
    if (token === '(') { left = expression(); take(')'); }
    else if (token === '-') left = { kind: 'negative', value: expression(6) };
    else if (/^(?:\d|\.)/u.test(token)) left = { kind: 'number', value: Number(token) };
    else if (/^[A-Za-z_]/u.test(token)) {
      if (tokens[at] !== '(') left = { kind: 'read', name: token.replaceAll(/\[(\d+)\]/gu, '.$1') };
      else {
        at++; const args: VisualExpression[] = [];
        if (tokens[at] !== ')') {
          args.push(expression());
          while (tokens[at] === ',') { at++; args.push(expression()); }
        }
        take(')'); left = { kind: 'call', name: token, args };
      }
    } else throw new Error(`Unsupported visual token ${token}`);
    for (;;) {
      const op = tokens[at], priority = op === undefined ? undefined : precedence[op];
      if (op === undefined || priority === undefined || priority <= minimum) break;
      at++; left = { kind: 'binary', op, left, right: expression(priority) };
    }
    if (minimum === 0 && tokens[at] === '?') {
      at++; const yes = expression(); take(':'); left = { kind: 'select', condition: left, yes, no: expression() };
    }
    depth--; return left;
  };
  const result = expression();
  if (at !== tokens.length) throw new Error('Trailing visual expression tokens');
  return result;
}
