import { NetRoom, type NetTickInput } from '@wildshard/engine/net/room';
import { SimNetWorld } from '@wildshard/engine/net/simWorld';
import type { Transport } from '@wildshard/engine/net/transport';
import type { SimHost, SimTickCommand } from '@wildshard/engine/sim';
import type { GridAssembly } from '../../shared/grid/assembly';
import type { GridRoom } from './room';
import type { GridSimulation } from './simulation';

interface WorldRoom { readonly host: SimHost; readonly world: SimNetWorld; readonly net: NetRoom }

/**
 * P1-E3.9: the grid on the wire. Positions are cell-local and each world keeps its own clock, so every occupied world has
 * its own NetRoom and a frame names its cell (E5-REPLICATION §3.5). A crossing hands its player's client to the next room.
 */
export class GridNetRooms {
  private readonly rooms = new Map<string | null, WorldRoom>();
  private readonly clients = new Map<string, number>();
  private readonly grid: GridSimulation;
  private readonly room: GridRoom;
  private readonly assembly: GridAssembly;
  constructor(grid: GridSimulation, room: GridRoom, assembly: GridAssembly) { this.grid = grid; this.room = room; this.assembly = assembly; }
  /** A cell's frame id: its place in the catalogue, after the highway's 0. */
  private frame(site: string | null): number { return site === null ? 0 : this.assembly.cells.findIndex(cell => cell.instance === site) + 1; }
  private at(site: string | null): WorldRoom {
    const host = this.grid.hostOf(site), held = this.rooms.get(site);
    if (held?.host === host) return held;
    held?.net.dispose(); // an unloaded world came back as a new host
    const world = new SimNetWorld(host, this.frame(site));
    const net = new NetRoom({ world, step: inputs => { this.grid.stepSite(site, commandsOf(inputs)); } });
    net.open();
    const entry = { host, world, net }; this.rooms.set(site, entry);
    return entry;
  }
  /** Connect the client that owns `player`, in the world they stand in now. */
  connect(player: string, transport: Transport): void {
    const { net, world } = this.at(this.grid.current(player));
    this.clients.set(player, net.join(transport, world.playerOf(player)));
  }
  /** One fixed tick: crossings, then their hand-offs, then each occupied world's room. A seat that crossed has left its old host, so its client must not send that room another command. */
  tick(): void {
    this.room.cross();
    for (const { player, from, to } of this.room.drainTravels()) {
      const client = this.clients.get(player);
      if (client === undefined) continue;
      const source = this.at(from).net, target = this.at(to);
      this.clients.set(player, source.handOff(client, target.net, target.world.playerOf(player)));
    }
    for (const site of this.grid.occupiedSites()) this.at(site).net.tick();
  }
  /** Drop every client and every room. */
  dispose(): void { for (const { net } of this.rooms.values()) net.dispose(); this.rooms.clear(); this.clients.clear(); }
}
function commandsOf(inputs: readonly NetTickInput[]): ReadonlyMap<string, SimTickCommand> {
  const commands = new Map<string, SimTickCommand>();
  for (const { player, command } of inputs) if (command !== null) commands.set(player, command);
  return commands;
}
