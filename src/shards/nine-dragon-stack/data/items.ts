/** Exact shipping swap glyph, copied into pure data; row-equality fixtures guard drift. */
const swapIcon = '<path d="M20.5 3.5 9.2 14.8M20.5 3.5l-.6 4.2M20.5 3.5l-4.2.6"/><path d="M6.6 12.2l5.2 5.2M8.4 15.6 4 20"/>';

/** Native contacts and grapple traversal stay in their trusted recipes; no second combat or lamp controller runs. */
const contact = (id: string) => ({ id, damage: 0, cooldown: 1, range: 0.01, width: 0.01, tags: [], effect: null });
/** The shipping fragment owns exactly one Jian and its Fei Zhua; no quests, fauna or durable progress are invented. */
export const NINE_ITEMS = { version: 1, rows: [
  { id: 'weapon.jian', kind: 'weapon', family: 'nine-dragon-stack.jian', slot: 'declared.weapon.jian', context: 'weapon.melee',
    ui: { name: 'Neon Jian', icon: 'sword', swapIcon, blurb: '' },
    view: { recipe: 'nine-dragon-stack.jian', colour: '#ffffff', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
    light: contact('weapon.jian.light'), heavy: contact('weapon.jian.heavy'), charge: 0.001 },
  { id: 'tool.fei-zhua', kind: 'tool', family: 'nine-dragon-stack.fei-zhua',
    ui: { name: 'Fei Zhua', icon: 'grapple', swapIcon, blurb: 'Lock a hook, then jump' },
    view: { recipe: 'nine-dragon-stack.fei-zhua', colour: '#ffffff', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
    // Native LOCK/JUMP owns traversal; these bounded numeric compatibility fields never drive a lamp or consume fuel.
    action: null, fuelSeconds: 1, intensity: 0 },
], contexts: [], loadout: { primary: 'weapon.jian', secondary: null, tools: ['tool.fei-zhua'] } };
