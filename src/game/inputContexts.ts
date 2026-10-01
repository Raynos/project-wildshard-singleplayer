import { engineString, type InputContextDef, type Action } from '#engine';

declare module '#engine' { interface ActionMap { bag: true } }

const movement = ['move', 'look', 'move.forward', 'move.back', 'move.left', 'move.right'] as const;
const moveKeys = { 'move.forward': ['KeyW'], 'move.back': ['KeyS'], 'move.left': ['KeyA'], 'move.right': ['KeyD'] };
const slots = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const slotKeys = Object.fromEntries(slots.map((slot) => [`swap.slot.${slot}`, [`Digit${slot}`]]));
export const INPUT_CONTEXTS: readonly InputContextDef[] = [
  { id: 'onFoot', actions: [...movement, 'jump', 'sprint', 'crouch', 'crouch.hold', 'dodge', 'use', 'swap', 'swap.next', 'swap.prev',
      ...slots.map((slot): Action => `swap.slot.${slot}`), 'lock', 'pause', 'bag', 'map', 'journal', 'note', 'hover'],
    keys: { ...moveKeys, ...slotKeys, jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], crouch: ['KeyC'], 'crouch.hold': ['ControlLeft', 'ControlRight'],
      dodge: ['AltLeft'], use: ['KeyE'], swap: ['KeyQ'], lock: ['Mouse1', 'KeyZ'], pause: ['Escape'], bag: ['Tab', 'KeyI'], map: ['KeyM'], journal: ['KeyJ'], note: ['KeyN'], hover: ['KeyH'] } },
  { id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], keys: { attack: ['Mouse0', 'KeyF'], heavy: ['Mouse2'] }, touch: { relabel: { r0: { label: engineString('s_852b889c1d23'), tone: 'rest' } } } },
  { id: 'weapon.ranged', actions: ['attack', 'aim', 'reload'], keys: { attack: ['Mouse0', 'KeyF'], aim: ['Mouse2'], reload: ['KeyR'] }, touch: { relabel: { r0: { label: engineString('s_8c1280a20004'), tone: 'rest' }, aim: { label: engineString('s_3c421fac5f36'), tone: 'rest' } } } },
  { id: 'weapon.bow', actions: ['attack', 'aim', 'autoFire'], keys: { attack: ['Mouse0'], aim: ['Mouse2'], autoFire: ['KeyF'] }, touch: { relabel: { r0: { label: engineString('s_8c1280a20004'), tone: 'rest' }, aim: { label: engineString('s_3c421fac5f36'), tone: 'rest' } } } },
  { id: 'weapon.spear', actions: ['attack', 'aim', 'heavy'], keys: { attack: ['Mouse0', 'KeyF'], aim: ['Mouse2'], heavy: ['Space'] }, touch: { relabel: { r0: { label: engineString('s_fbd474bd18c4'), tone: 'rest' }, aim: { label: engineString('s_9871e517137d'), tone: 'rest' }, jump: { label: engineString('s_52267059c196'), tone: 'rest' } } } },
  { id: 'swim', actions: [...movement, 'dive', 'surface'], blocks: ['attack', 'heavy', 'aim', 'reload', 'jump', 'dodge', 'sprint', 'crouch'],
    keys: { dive: ['Space'], surface: ['ShiftLeft', 'ShiftRight'] }, touch: { relabel: { jump: { label: engineString('s_1d7cf9037135'), tone: 'rest' }, r1: { label: engineString('s_15c0f7da1543'), tone: 'rest' } } } },
  { id: 'board', actions: ['hover', 'jump'], blocks: ['dodge', 'crouch', 'crouch.hold', 'sprint'], keys: { hover: ['KeyH'], jump: ['Space'] } },
  { id: 'menu', actions: ['nav.left', 'nav.right', 'tab', 'confirm', 'back', 'pause', 'bag', 'map', 'journal', 'note'], blocks: 'below',
    keys: { 'nav.left': ['ArrowLeft'], 'nav.right': ['ArrowRight'], tab: ['Tab'], confirm: ['Enter'], back: ['Escape'], map: ['KeyM'], journal: ['KeyJ'], note: ['KeyN'] } },
  { id: 'dialog', actions: ['use', 'confirm', 'back'], blocks: ['attack', 'heavy', 'aim', 'reload', 'swap', 'jump', 'dodge'], keys: { use: ['KeyE'], confirm: ['Enter'], back: ['Escape'] } },
  { id: 'explore', actions: [...movement, 'fly.up', 'fly.down', 'fly.boost', 'pane.1', 'pane.2', 'pane.3', 'map', 'back'], blocks: 'below',
    keys: { ...moveKeys, 'fly.up': ['KeyE', 'Space'], 'fly.down': ['KeyQ', 'ControlLeft'], 'fly.boost': ['ShiftLeft', 'ShiftRight'], 'pane.1': ['Digit1'], 'pane.2': ['Digit2'], 'pane.3': ['Digit3'], map: ['KeyM'], back: ['Escape'] } },
];
