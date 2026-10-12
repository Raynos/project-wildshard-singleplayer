import type { BufferGeometry } from 'three';
import type { NpcRow } from '@wildshard/sdk/questGraph';
import { installPivotNpc as install, pivotNpcParts as parts, type PivotNpc, type PivotNpcLevel, type PivotNpcParts, type PivotNpcPorts } from '@wildshard/game/plugin/geometry';

/** Sefa's figure on its pivots: the shared pivot NPC host's (SF27, `@wildshard/game/plugin/geometry`). */
export function pivotNpcParts(row: NpcRow, source: BufferGeometry): PivotNpcParts { return parts(row, source); }
/** Sefa in the world through the shared pivot NPC host: her figure, solid column and motion. */
export function installPivotNpc(ctx: PivotNpcLevel, row: NpcRow, ports: PivotNpcPorts): PivotNpc { return install(ctx, row, ports); }
