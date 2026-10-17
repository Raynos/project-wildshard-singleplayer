/**
 * Staged node builds (OP3, E435): a TSL node build run as a sequence of short steps instead of one call.
 *
 * A node material's first program costs one whole node build inside the renderer's synchronous `getProgram`
 * (three's `NodeBuilder.build`): 60-130 ms on the iOS Simulator, one long frame per build of a grid entry's warm-up.
 * The build itself is a fixed sequence of calls on one builder: `prebuild()` (the material's node setup), then for each
 * build stage (setup, analyze, generate) each shader stage's flow nodes, then `buildCode()` and `buildUpdateNodes()`.
 * `stagedNodeBuild` makes the same calls on the same builder in the same order, pausing at the shader-stage seams where
 * three's own `buildAsync` yields (plus one after `prebuild`), so the warm-up can paint a frame between them. The builder
 * that comes out is the one the synchronous build would have made: the same source, uniforms, groups and update nodes.
 *
 * What runs between the steps must not change what the build reads. The engine handler runs each step inside the same
 * render call state the compile will use (target, tone mapping, fog, environment, lights) and pairs the finished builder
 * with the renderer's request only when its build signature (`EngineNodesHandler.stagedSignature`) is unchanged; any
 * other request builds synchronously as before.
 */

const BUILD_STAGES = ['setup', 'analyze', 'generate'] as const;
const SHADER_STAGES = ['fragment', 'vertex', 'compute'] as const;

function call(target: unknown, name: string, ...args: unknown[]): unknown {
  const fn: unknown = typeof target === 'object' && target !== null ? Reflect.get(target, name) : undefined;
  if (typeof fn !== 'function') throw new Error(`Staged node build: missing ${name}`);
  return Reflect.apply(fn, target, args);
}

function flowNodesOf(builder: object, stage: string): readonly unknown[] {
  const flows: unknown = Reflect.get(builder, 'flowNodes');
  const list: unknown = typeof flows === 'object' && flows !== null ? Reflect.get(flows, stage) : undefined;
  if (!Array.isArray(list)) throw new Error(`Staged node build: no ${stage} flow list`);
  return list;
}

/**
 * three r186's `NodeBuilder.build()`, one step per `next()`: `prebuild`, each build stage × shader stage that has flow
 * nodes, then the code. Same calls, same order, same builder state between them.
 */
export function* stagedNodeBuild(builder: object): Generator<void, void, void> {
  call(builder, 'prebuild');
  yield;
  for (const buildStage of BUILD_STAGES) {
    call(builder, 'setBuildStage', buildStage);
    const context: unknown = Reflect.get(builder, 'context');
    const position: unknown = typeof context === 'object' && context !== null ? Reflect.get(context, 'position') : undefined;
    if (typeof position === 'object' && position !== null && Reflect.get(position, 'isNode') === true) call(builder, 'flowNodeFromShaderStage', 'vertex', position);
    for (const shaderStage of SHADER_STAGES) {
      call(builder, 'setShaderStage', shaderStage);
      const flows = flowNodesOf(builder, shaderStage);
      // a live array: setup may append flows, which the stock loop visits too
      for (const node of flows) {
        if (buildStage === 'generate') call(builder, 'flowNode', node);
        else call(node, 'build', builder);
      }
      if (flows.length > 0) yield;
    }
  }
  call(builder, 'setBuildStage', null);
  call(builder, 'setShaderStage', null);
  call(builder, 'buildCode');
  call(builder, 'buildUpdateNodes');
}

/** A small stable number per object for build signatures (no ids on render targets or nodes we can rely on). */
const serials = new WeakMap<object, number>();
let nextSerial = 1;
export function serialOf(value: object | null | undefined): number {
  if (value === null || value === undefined) return 0;
  let serial = serials.get(value);
  if (serial === undefined) { serial = nextSerial++; serials.set(value, serial); }
  return serial;
}
