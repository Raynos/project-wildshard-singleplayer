import type { Object3D } from 'three';
import type { Placed } from '@wildshard/engine/models/place';
import { parseWorldEntry, type WorldEntryRows, type WorldEntryStep } from '@wildshard/format/worldEntry';
import type { SceneHandles } from './sceneHandles';
import { lentLook } from './lentLooks';

/** What a world entry runs against: the admitted scene handles, the world root it attaches under, and the build's facts. */
export interface WorldEntryPorts {
  readonly scenes: SceneHandles;
  readonly root: Object3D;
  readonly tier: 'phone' | 'desktop';
  /** the world variant this build is (a deck ending, a standalone or grid entry); rows with another `when.variant` skip */
  readonly variant?: string;
}

/**
 * A shard's declared world entry (format/worldEntry): its rows run block by block, in order, as the world build reaches
 * each block. Every `place` keeps its placement for the build to read by id. Users: Driftwood Isle, Nine Dragon Stack.
 */
export class WorldEntry {
  private readonly placements = new Map<string, Placed>();
  private readonly ran = new Set<string>();
  private constructor(private readonly rows: WorldEntryRows, private readonly ports: WorldEntryPorts) {}

  /** Admit `input` (the shard's world entry blob) for one build. */
  static admit(input: unknown, ports: WorldEntryPorts): WorldEntry { return new WorldEntry(parseWorldEntry(input), ports); }

  /** Run one block's rows in order; each block runs once per build. */
  async run(block: string): Promise<void> {
    const rows = this.rows.blocks[block];
    if (rows === undefined) throw new Error(`Missing world entry block: ${block}`);
    if (this.ran.has(block)) throw new Error(`World entry block ran twice: ${block}`);
    this.ran.add(block);
    for (const row of rows) if (this.applies(row)) await this.step(row);
  }

  /** The placement a `place` row loaded. */
  placed(id: string): Placed {
    const placed = this.placements.get(id);
    if (placed === undefined) throw new Error(`World entry has not placed ${id}`);
    return placed;
  }

  private applies(row: WorldEntryStep): boolean {
    const when = row.when;
    return when === undefined || (when.tier === undefined || when.tier === this.ports.tier) && (when.variant === undefined || when.variant === this.ports.variant);
  }

  private async step(row: WorldEntryStep): Promise<void> {
    const { scenes, root } = this.ports;
    if (row.kind === 'place') {
      if (this.placements.has(row.id)) throw new Error(`World entry placed ${row.id} twice`);
      this.placements.set(row.id, await scenes.place(row.id));
      return;
    }
    // plain state keys only (format/worldEntry MaterialStateSchema): assigned as Material.setValues assigns them
    if (row.kind === 'look') { Object.assign(lentLook(row.look), row.state); return; }
    const object = row.as === 'group' ? scenes.group(row.id) : row.as === 'mesh' ? scenes.mesh(row.id) : scenes.object(row.id);
    if (row.name !== undefined) object.name = row.name;
    if (row.nameAfter !== undefined) object.name = this.placed(row.nameAfter).model;
    if (row.castShadow !== undefined) object.castShadow = row.castShadow;
    if (row.userData !== undefined) Object.assign(object.userData, row.userData);
    root.add(object);
  }
}
