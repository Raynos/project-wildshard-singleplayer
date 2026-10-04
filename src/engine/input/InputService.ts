import type { AimCommand } from './commands';
import { Bindings } from './bindings';
import type { Scope } from '../app/scope';
import { withOwner } from '../app/ownership';
import type { EquipmentAction } from '../combat/Tool';
import type { InputContextDef } from '../level/context';
import type { DiscSpot, TouchRelabel } from '../ui/hudSlots';

// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- The host contributes actions through declaration merging.
export interface ActionMap {}
export type Action = Extract<keyof ActionMap, string> | EquipmentAction | 'crouch' | 'crouch.hold' | 'sprint' | 'use'
  | 'move.forward' | 'move.back' | 'move.left' | 'move.right'
  | 'move' | 'look' | 'dodge' | 'pause' | 'map' | 'journal' | 'note' | 'confirm' | 'back' | 'nav.left' | 'nav.right' | 'tab'
  | 'dive' | 'surface' | 'fly.up' | 'fly.down' | 'fly.boost' | 'pane.1' | 'pane.2' | 'pane.3'
  | 'skip' | 'focus' | 'quickNote' | 'help' | 'ride.whistle' | 'ride.offer' | 'ride.gallop' | 'ride.horseTab' | 'lean.left' | 'lean.right';
export interface TouchVerb { action: Action; label: string; icon: string; hold?: boolean; element?: HTMLButtonElement; show?: () => boolean }
export type TouchVerbSpec = Action | TouchVerb;
/** Semantic input accepted by the host. UI gestures, interact and traversal all use this boundary. */
export type ActionCommand = (
  | { kind: 'press' | 'queue' | 'release'; action: Action; at: number }
  | { kind: 'held'; action: Action; on: boolean; at: number }
  | { kind: 'axis'; action: Action; x: number; y: number; at: number }
  | { kind: 'physical'; code: string; on: boolean; at: number }
  | { kind: 'look'; x: number; y: number; at: number }
  | { kind: 'clear'; at: number }) & { aim?: AimCommand };
/** Serializable held actions, press buffer and context order; callbacks remain host-owned. */
export interface InputState {
  version: number; physical: string[]; manual: Action[]; down: Action[]; ups: Action[];
  presses: { action: Action; at: number }[]; axes: { action: Action; x: number; y: number }[];
  bufferMs: number; contexts: string[]; recent: { action: Action; at: number }[];
}
interface Context { def: InputContextDef; scope: Scope }
/** Additive contexts and a shared press buffer. Consuming a press removes it for every later system. */
export class InputService {
  recordCommand: ((command: ActionCommand) => void) | null = null;
  private commandDepth = 0;
  private activeAim: AimCommand | undefined;
  captureAim: (() => AimCommand) | null = null;
  get commandAim(): AimCommand | undefined { return this.activeAim; }
  /** Replay invokes precisely the same semantic action path as a device or UI gesture. */
  executeCommand(command: ActionCommand): void {
    if (!Number.isFinite(command.at) || command.at < 0 || ((command.kind === 'axis' || command.kind === 'look') && ![command.x, command.y].every(Number.isFinite))) throw new RangeError('Invalid input command');
    const previousAim = this.activeAim, aim = command.aim ?? previousAim ?? this.captureAim?.();
    this.activeAim = aim;
    if (this.commandDepth === 0) this.recordCommand?.({ ...command, ...(aim === undefined ? {} : { aim: { origin: { ...aim.origin }, direction: { ...aim.direction } } }) });
    this.commandDepth++;
    try {
      switch (command.kind) {
        case 'press':
          this.presses.set(command.action, command.at);
          this.recent.push({ action: command.action, at: command.at }); if (this.recent.length > 20) this.recent.shift();
          if (this.allowed(command.action)) for (const binding of this.callbacks) if (binding.action === command.action && binding.enabled()) binding.run();
          break;
        case 'physical': if (command.on) this.physical.add(command.code); else this.physical.delete(command.code); this.refresh(); break;
        case 'look': {
          const previous = this.axes.get('look') ?? { x: 0, y: 0 }; this.axes.set('look', { x: previous.x + command.x, y: previous.y + command.y });
          if (this.allowed('look')) for (const run of this.motion) run(command.x, command.y);
          break;
        }
        case 'queue': this.presses.set(command.action, command.at); break;
        case 'held': if (command.on) this.manual.add(command.action); else this.manual.delete(command.action); this.refresh(); break;
        case 'release': this.release(command.action); break;
        case 'axis': this.axes.set(command.action, { x: command.x, y: command.y }); break;
        case 'clear':
          this.physical.clear(); this.manual.clear(); this.refresh(); this.presses.clear(); this.axes.clear(); for (const reset of this.resets) reset();
          break;
        default: throw new Error('Unsupported input command');
      }
    } finally { this.commandDepth--; this.activeAim = previousAim; }
  }
  snapshot(): InputState {
    return { version: 1, physical: [...this.physical], manual: [...this.manual], down: [...this.down], ups: [...this.ups],
      presses: [...this.presses].map(([action, at]) => ({ action, at })), axes: [...this.axes].map(([action, axis]) => ({ action, x: axis.x, y: axis.y })),
      bufferMs: this.buffer.ms, contexts: this.stack.map(({ def }) => def.id), recent: this.recent.map((entry) => ({ ...entry })) };
  }
  restore(state: InputState): void {
    if (state.version !== 1 || !Number.isFinite(state.bufferMs) || state.bufferMs < 0
      || [...state.presses, ...state.recent].some((entry) => !Number.isFinite(entry.at) || entry.at < 0)
      || state.axes.some((entry) => ![entry.x, entry.y].every(Number.isFinite))
      || state.contexts.some((id) => !this.definitions.has(id))) throw new RangeError('Invalid input snapshot');
    this.physical.clear(); for (const code of state.physical) this.physical.add(code);
    this.manual.clear(); for (const action of state.manual) this.manual.add(action);
    this.down.clear(); for (const action of state.down) this.down.add(action);
    this.ups.clear(); for (const action of state.ups) this.ups.add(action);
    this.presses.clear(); for (const entry of state.presses) this.presses.set(entry.action, entry.at);
    this.axes.clear(); for (const entry of state.axes) this.axes.set(entry.action, { x: entry.x, y: entry.y });
    this.buffer.ms = state.bufferMs; this.recent.splice(0, this.recent.length, ...state.recent.map((entry) => ({ ...entry })));
    // Keep scope ownership and disposers; only the stack order is saved data.
    const removed = this.stack.filter((entry) => !state.contexts.includes(entry.def.id));
    for (const entry of removed) this.pop(entry.def.id);
    this.stack.length = 0;
    for (const id of state.contexts) { const entry = this.definitions.get(id); if (entry !== undefined) { this.stack.push(entry); if (!this.pushed.has(id)) this.pushed.set(id, entry.scope.capture('disposers', () => { this.pop(id); })); } }
    this.repaint();
  }
  private release(action: Action): void {
    this.ups.add(action); for (const binding of this.releases) if (binding.action === action) binding.run(); this.down.delete(action);
  }
  private readonly definitions = new Map<string, Context>();
  private readonly stack: Context[] = [];
  private readonly physical = new Set<string>();
  private readonly manual = new Set<Action>();
  private readonly callbacks = new Set<{ action: Action; run: () => void; enabled: () => boolean }>();
  private readonly releases = new Set<{ action: Action; run: () => void }>();
  private readonly motion = new Set<(x: number, y: number) => void>();
  private readonly wheels = new Set<(dy: number) => void>();
  private readonly gestures = new Set<() => void>();
  private readonly resets = new Set<() => void>();
  private readonly axes = new Map<Action, { x: number; y: number }>();
  readonly bindings = new Bindings(() => { this.refresh(); });
  readonly recent: { action: Action; at: number }[] = [];
  private keyCapture: ((code: string) => void) | undefined;
  private installed = false;
  private stackPaint: ((layout: TouchStack) => void) | undefined;
  private readonly pushed = new Map<string, () => void>();
  private readonly presses = new Map<Action, number>();
  private readonly down = new Set<Action>();
  private readonly ups = new Set<Action>();
  readonly buffer = { ms: 120 };
  private readonly now: () => number;
  private paint: ((labels: Partial<Record<DiscSpot, TouchRelabel>>) => void) | undefined;
  constructor(now: () => number) { this.now = now; }
  register(def: InputContextDef, scope: Scope): void {
    if (this.definitions.has(def.id)) throw new Error(`Duplicate input context: ${def.id}`);
    if (def.keysFrom !== undefined && !this.definitions.has(def.keysFrom)) throw new Error(`Unknown key source context: ${def.keysFrom}`);
    const entry = { def, scope }; this.definitions.set(def.id, entry);
    const actions = Array.isArray(def.actions) ? def.actions as readonly Action[] : Object.keys(def.actions) as Action[];
    this.bindings.define(def.id, def.keys ?? {}, def.keysFrom === undefined ? undefined : { context: def.keysFrom, actions });
    scope.onDispose(() => { this.pop(def.id); this.definitions.delete(def.id); this.bindings.remove(def.id); });
  }
  push(id: string, scope: Scope): void {
    const entry = this.definitions.get(id);
    if (entry === undefined) throw new Error(`Unknown input context: ${id}`);
    if (scope.disposed || this.stack.includes(entry)) return;
    this.stack.push(entry); this.refresh(false); this.repaint();
    this.pushed.set(id, scope.capture('disposers', () => { this.pop(id); }));
  }
  pop(id: string): void { const at = this.stack.findIndex((entry) => entry.def.id === id); if (at === -1) return; this.stack.splice(at, 1); this.refresh(false); this.pushed.get(id)?.(); this.pushed.delete(id); this.repaint(); }
  get top(): string { return this.stack.at(-1)?.def.id ?? ''; }
  allowed(action: Action): boolean {
    for (const { def } of [...this.stack].reverse()) {
      if (def.enabled?.() === false) continue;
      if (Array.isArray(def.actions) && def.actions.includes(action)) return true;
      if (def.blocks === 'below' || def.blocks?.includes(action)) return false;
    }
    return true;
  }
  queue(action: Action): void { this.executeCommand({ kind: 'queue', action, at: this.now() }); }
  press(action: Action): void { this.executeCommand({ kind: 'press', action, at: this.now() }); }
  /** A real touch gesture unlocks audio before its interaction; scripted actions do not. */
  pressGesture(action: Action): void { this.gesture(); this.press(action); }
  bind(action: Action, run: () => void, scope: Scope, enabled: () => boolean = () => true): void {
    const binding = { action, run: () => { withOwner(scope, run); }, enabled }; this.callbacks.add(binding); scope.onDispose(() => { this.callbacks.delete(binding); });
  }
  bindRelease(action: Action, run: () => void, scope: Scope): void {
    const binding = { action, run: () => { withOwner(scope, run); } }; this.releases.add(binding); scope.onDispose(() => { this.releases.delete(binding); });
  }
  observeLook(run: (x: number, y: number) => void, scope: Scope): void { const owned = (x: number, y: number): void => { withOwner(scope, () => run(x, y)); }; this.motion.add(owned); scope.onDispose(() => { this.motion.delete(owned); }); }
  observeWheel(run: (dy: number) => void, scope: Scope): void { const owned = (dy: number): void => { withOwner(scope, () => run(dy)); }; this.wheels.add(owned); scope.onDispose(() => { this.wheels.delete(owned); }); }
  firstGesture(run: () => void, scope: Scope): void { const owned = (): void => { withOwner(scope, () => run()); }; this.gestures.add(owned); scope.onDispose(() => { this.gestures.delete(owned); }); }
  private gesture(): void { const callbacks = [...this.gestures]; this.gestures.clear(); for (const run of callbacks) run(); }
  onReset(run: () => void, scope: Scope): void { const owned = (): void => { withOwner(scope, () => run()); }; this.resets.add(owned); scope.onDispose(() => { this.resets.delete(owned); }); }
  hasContext(id: string): boolean { return this.has(id); }
  has(id: string): boolean { return this.definitions.has(id); }
  active(id: string): boolean { return this.stack.some(({ def }) => def.id === id && def.enabled?.() !== false); }
  get contexts(): readonly string[] { return this.stack.filter(({ def }) => def.enabled?.() !== false).map(({ def }) => def.id); }
  refresh(edges = true): void {
    const wanted = new Set(this.manual);
    for (const { def } of this.stack) if (def.enabled?.() !== false) for (const [action, codes] of Object.entries(this.bindings.keys(def.id))) {
      if (codes.some((code) => code === '*' ? [...this.physical].some((key) => !['Escape', 'ArrowLeft', 'ArrowRight', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight'].includes(key)) : this.physical.has(code))) wanted.add(action as Action);
    }
    for (const action of new Set([...this.down, ...wanted])) this.transition(action, wanted.has(action), edges);
  }
  setHeld(action: Action, on: boolean): void { this.executeCommand({ kind: 'held', action, on, at: this.now() }); }
  private transition(action: Action, on: boolean, edges: boolean): void {
    const newlyDown = on && !this.down.has(action);
    if (on) this.down.add(action);
    if (newlyDown && edges) this.press(action);
    if (!on && this.down.has(action)) this.executeCommand({ kind: 'release', action, at: this.now() });
    if (on) this.down.add(action); else this.down.delete(action);
  }
  pressed(action: Action): boolean {
    const at = this.presses.get(action);
    if (at === undefined) return false;
    if (this.now() - at > this.buffer.ms) { this.presses.delete(action); return false; }
    return this.allowed(action);
  }
  held(action: Action): boolean { return this.allowed(action) && this.down.has(action); }
  released(action: Action): boolean { return this.allowed(action) && this.ups.has(action); }
  consume(action: Action): boolean { if (!this.pressed(action)) return false; this.presses.delete(action); return true; }
  clear(): void { this.executeCommand({ kind: 'clear', at: this.now() }); }
  endFrame(): void { this.ups.clear(); this.axes.delete('look'); }
  setAxis(action: Action, x: number, y: number): void { this.executeCommand({ kind: 'axis', action, x, y, at: this.now() }); }
  axis2(action: Action): { x: number; y: number } {
    if (!this.allowed(action)) return { x: 0, y: 0 };
    const axis = this.axes.get(action) ?? { x: 0, y: 0 };
    if (action !== 'move') return axis;
    return { x: Math.max(-1, Math.min(1, axis.x + Number(this.held('move.right')) - Number(this.held('move.left')))),
      y: Math.max(-1, Math.min(1, axis.y + Number(this.held('move.forward')) - Number(this.held('move.back')))) };
  }
  captureNextKey(run: (code: string) => void, scope: Scope): void {
    const owned = (code: string): void => { withOwner(scope, () => run(code)); }; this.keyCapture = owned; scope.onDispose(() => { if (this.keyCapture === owned) this.keyCapture = undefined; });
  }
  install(scope: Scope, canvas?: HTMLCanvasElement, look?: (x: number, y: number) => void): void {
    if (this.installed) throw new Error('Input listeners already installed'); this.installed = true;
    if (look !== undefined) this.observeLook(look, scope);
    const keyboard = (event: Event, on: boolean): void => {
      if (!(event instanceof KeyboardEvent)) return;
      if (this.keyCapture !== undefined && on) { event.preventDefault(); event.stopImmediatePropagation(); const run = this.keyCapture; this.keyCapture = undefined; run(event.code); return; }
      const target = event.target;
      // a key typed into a text field never presses an action; its release always lands, so a key held when a field took
      // focus (W walking into a name box) is not stuck down after it (E355)
      if (on && event.code !== 'Escape' && target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (on && (event.repeat || event.metaKey || event.ctrlKey)) return;
      if (on) this.gesture();
      this.executeCommand({ kind: 'physical', code: event.code, on, at: this.now() });
      if (['Space', 'AltLeft', 'Tab'].includes(event.code)) event.preventDefault();
    };
    scope.listen(document, 'keydown', (event) => { keyboard(event, true); }, { capture: true });
    scope.listen(document, 'keyup', (event) => { keyboard(event, false); }, { capture: true });
    const mouse = (event: Event, on: boolean): void => {
      if (!(event instanceof MouseEvent)) return;
      if (on && document.pointerLockElement === null && !(event.target instanceof HTMLCanvasElement)) return;
      if (on) this.gesture();
      this.executeCommand({ kind: 'physical', code: `Mouse${event.button}`, on, at: this.now() });
    };
    const pointers = new Set<number>();
    scope.listen(document, 'pointerdown', (event) => { pointers.add(event.pointerId); this.setHeld('skip', true); });
    const endPointer = (event: PointerEvent): void => { pointers.delete(event.pointerId); this.setHeld('skip', pointers.size > 0); };
    scope.listen(document, 'pointerup', endPointer); scope.listen(document, 'pointercancel', endPointer);
    this.onReset(() => { pointers.clear(); }, scope);
    scope.listen(document, 'mousedown', (event) => { mouse(event, true); });
    scope.listen(document, 'mouseup', (event) => { mouse(event, false); });
    scope.listen(document, 'mousemove', (event) => {
      if (!(event instanceof MouseEvent) || (canvas !== undefined && document.pointerLockElement !== canvas)) return;
      this.executeCommand({ kind: 'look', x: event.movementX, y: event.movementY, at: this.now() });
    });
    scope.listen(document, 'contextmenu', (event) => { if (document.pointerLockElement !== null || event.target instanceof HTMLCanvasElement) event.preventDefault(); });
    let wheel = 0, wheelAt = 0;
    scope.listen(document, 'wheel', (event) => {
      if (!(event instanceof WheelEvent) || (document.pointerLockElement === null && !(event.target instanceof HTMLCanvasElement))) return;
      for (const run of this.wheels) run(event.deltaY);
      if (Math.sign(event.deltaY) !== Math.sign(wheel)) wheel = 0;
      wheel += event.deltaMode === 1 ? event.deltaY * 20 : event.deltaY;
      if (Math.abs(wheel) < 60 || event.timeStamp - wheelAt < 180) return;
      wheelAt = event.timeStamp; this.press(wheel > 0 ? 'swap.next' : 'swap.prev'); wheel = 0;
    }, { passive: true });
    scope.listen(window, 'blur', () => { this.clear(); });
    scope.listen(document, 'pointerlockchange', () => { if (document.pointerLockElement === null) this.clear(); });
    scope.onDispose(() => { this.installed = false; this.clear(); });
  }
  touchStackSink(paint: (layout: TouchStack) => void, scope: Scope): void {
    this.stackPaint = paint; this.repaint(); scope.onDispose(() => { if (this.stackPaint === paint) this.stackPaint = undefined; });
  }
  touchLayout(): TouchStack {
    const labels: TouchStack['labels'] = {}, verbs: TouchStack['verbs'] = {}, actions = new Set<Action>();
    for (const { def } of this.stack) if (def.enabled?.() !== false) {
      if (def.blocks === 'below') { actions.clear(); for (const spot of Object.keys(labels) as DiscSpot[]) delete labels[spot]; delete verbs['verb.1']; delete verbs['verb.2']; }
      else for (const action of def.blocks ?? []) actions.delete(action);
      if (Array.isArray(def.actions)) for (const action of def.actions as readonly Action[]) actions.add(action);
      Object.assign(labels, def.touch?.relabel); Object.assign(verbs, def.touch?.verbs);
    }
    for (const slot of ['verb.1', 'verb.2'] as const) { const verb = verbs[slot]; if (verb !== undefined && !this.allowed(typeof verb === 'string' ? verb : verb.action)) delete verbs[slot]; }
    const active = this.stack.filter(({ def }) => def.enabled?.() !== false);
    let mode = '', lockable = false;
    for (const { def } of active) { if (def.blocks === 'below') { mode = ''; lockable = false; } if (def.touch?.mode !== undefined) mode = def.touch.mode; if (def.touch?.lockable !== undefined) lockable = def.touch.lockable; }
    return { labels, verbs, mode, lockable, actions: [...actions].filter((action) => this.allowed(action)), contexts: this.contexts };
  }
  touchSink(paint: (labels: Partial<Record<DiscSpot, TouchRelabel>>) => void, scope: Scope): void {
    this.paint = paint; this.repaint(); scope.onDispose(() => { if (this.paint === paint) { paint({}); this.paint = undefined; } });
  }
  repaint(): void { const layout = this.touchLayout(); this.paint?.(layout.labels); this.stackPaint?.(layout); }
}
export interface TouchStack {
  labels: Partial<Record<DiscSpot, TouchRelabel>>;
  verbs: Partial<Record<'verb.1' | 'verb.2', TouchVerbSpec>>; mode: string; lockable: boolean;
  actions: readonly Action[]; contexts: readonly string[];
}
