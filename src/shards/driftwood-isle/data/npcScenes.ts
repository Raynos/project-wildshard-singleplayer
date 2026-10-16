/** Existing NPC rest hierarchies. All meshes borrow their original geometry and look ports. */
export const TRADER_SCENE = {
  version: 1, root: 'root', materials: [{ id: 'coat', kind: 'port', source: 'coat' }],
  nodes: [
    { id: 'root', kind: 'group', name: 'trader', children: ['figure'] },
    { id: 'figure', kind: 'group', children: ['body', 'head', 'upper'] },
    { id: 'body', kind: 'mesh', geometry: 'body', material: 'coat', missing: 'empty', castShadow: true, receiveShadow: true },
    { id: 'head', kind: 'mesh', geometry: 'head', material: 'coat', missing: 'empty', position: [0, 1.48, .01] },
    { id: 'upper', kind: 'mesh', geometry: 'upper', material: 'coat', missing: 'empty', position: [-.19, 1.4, 0], children: ['fore'] },
    { id: 'fore', kind: 'mesh', geometry: 'fore', material: 'coat', missing: 'empty', position: [-.03, -.27, .02] },
  ],
} as const;
export const TRADER_PARTS = { figure: 'group', body: 'object', head: 'object', upper: 'object', fore: 'object' } as const;
export const TRADER_BINDINGS = {
  figure: { kind: 'group', part: 'figure' }, body: { kind: 'object', part: 'body' }, head: { kind: 'object', part: 'head' },
  upper: { kind: 'object', part: 'upper' }, fore: { kind: 'object', part: 'fore' },
} as const;

export const CASTAWAY_SCENE = {
  version: 1, root: 'root', materials: [{ id: 'coat', kind: 'port', source: 'coat' }],
  nodes: [
    { id: 'root', kind: 'group', name: 'npc-castaway', children: ['figure', 'camp', 'flames', 'smoke'] },
    { id: 'figure', kind: 'group', children: ['body', 'head', 'arm'] },
    { id: 'body', kind: 'mesh', geometry: 'body', material: 'coat', missing: 'empty', castShadow: true, receiveShadow: true },
    { id: 'camp', kind: 'mesh', geometry: 'camp', material: 'coat', missing: 'empty', castShadow: true, receiveShadow: true },
    { id: 'head', kind: 'mesh', geometry: 'head', material: 'coat', missing: 'empty', position: [0, 1.52, .01] },
    { id: 'arm', kind: 'mesh', geometry: 'arm', material: 'coat', missing: 'empty', position: [-.21, 1.4, 0] },
    { id: 'flames', kind: 'object', source: 'flames', missing: 'refuse' },
    { id: 'smoke', kind: 'object', source: 'smoke', missing: 'refuse' },
  ],
} as const;
export const CASTAWAY_PARTS = { figure: 'group', body: 'object', camp: 'object', head: 'object', arm: 'object' } as const;
export const CASTAWAY_BINDINGS = {
  figure: { kind: 'group', part: 'figure' }, body: { kind: 'object', part: 'body' }, camp: { kind: 'object', part: 'camp' },
  head: { kind: 'object', part: 'head' }, arm: { kind: 'object', part: 'arm' },
} as const;
