/**
 * G571 / WASM-HOST H9: a walkable deck's camera sway as a view module (SCRIPT-ABI v2, lane 3) on the engine's view
 * lane. Data only: the admitted rows (`DeckCameraSwaySchema`: the deck's registry piece, its update system and order,
 * nine finite parameters) and the module's bytes. Each update, in the rows' system and order, it samples whether the
 * deck has a floor under the player, the player's y, that floor's y and the player's horizontal speed, then the
 * parameters, runs the module and adds its channel bank (roll, dip) to the camera's z rotation and y. Between scheduled
 * frames (the view lane's own rate) the last landed pair is added again; a frozen module adds nothing. A deck absent
 * from the registry installs nothing. Client-only; nothing reaches the sim or a save.
 */
import * as v from 'valibot';
import { DeckCameraSwaySchema } from '@wildshard/format/deckCameraSway';
import { ViewLane } from '@wildshard/engine/script/viewLane';
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import type { ShardContext } from '../../plugin/context';

/** The view module's fixed memory and I/O bytes, fuel per call and the call-time budget its rate policy holds to. */
const PAGES = 1, IO_BYTES = 4096, FUEL = 100_000, TARGET_MS = 0.5;

/** Install one deck's camera sway from its admitted rows and module bytes. */
export function installDeckCameraSway(ctx: ShardContext, input: unknown, module: Uint8Array): void {
  const rows = v.parse(DeckCameraSwaySchema, input), world = ctx.game.runtime?.world;
  if (world === undefined || world === null) throw new Error('Deck camera sway requires its entered world');
  const deck = world.registry.get(rows.piece);
  if (deck === undefined) return;
  const bytes = Uint8Array.from(module);
  admitScriptV2(bytes, { lane: 'view', ioBytes: IO_BYTES });
  const landed = [0, 0];
  const lane = new ViewLane(bytes, PAGES, { bindings: [{ handle: 1, columns: 4 + rows.parameters.length }], transforms: [], channels: 2,
    bounds: { translation: 0, scale: [1, 1], shear: 0 }, targetMs: TARGET_MS, fuel: FUEL },
  { write: () => undefined, channels: (values) => { landed[0] = values[0] ?? 0; landed[1] = values[1] ?? 0; }, upload: () => undefined });
  const columns = new Float64Array(2 * (4 + rows.parameters.length)), half = columns.length / 2;
  for (const [i, value] of rows.parameters.entries()) { columns[4 + i] = value; columns[half + 4 + i] = value; }
  let tick = 0;
  ctx.system({ id: rows.system, phase: 'update', before: [...rows.before], run: (dt) => {
    const p = world.player.position, floor = deck.floor?.(p.x, p.z), speed = Math.hypot(world.player.velocity.x, world.player.velocity.z);
    const sample = [floor === undefined ? 0 : 1, p.y, floor ?? 0, speed];
    for (let k = 0; k < 4; k++) { columns[k] = sample[k] ?? 0; columns[half + k] = sample[k] ?? 0; }
    tick++;
    lane.frame(dt, 0, tick, [{ previousTick: tick - 1, currentTick: tick, values: columns }], 60, () => performance.now());
    if (lane.isFrozen) return;
    world.game.camera.rotation.z += landed[0] ?? 0;
    world.game.camera.position.y += landed[1] ?? 0;
  } });
}
