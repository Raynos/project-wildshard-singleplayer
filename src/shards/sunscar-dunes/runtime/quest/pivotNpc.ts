import type { BufferGeometry } from 'three';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { NpcRow } from '@wildshard/sdk/questGraph';
import { installPivotNpc as install, pivotNpcParts as parts, type PivotNpc, type PivotNpcParts, type PivotNpcPorts } from '@wildshard/sdk/looks/modelLibrary';

/** Sefa's figure on its pivots: the shared pivot NPC host's (SF27, `@wildshard/sdk/looks/modelLibrary`). */
export function pivotNpcParts(row: NpcRow, source: BufferGeometry): PivotNpcParts { return parts(row, source); }
/** Sefa in the world through the shared pivot NPC host: her figure, solid column and motion. */
export function installPivotNpc(ctx: Pick<LevelContext, 'root' | 'piece' | 'system'>, row: NpcRow, ports: PivotNpcPorts): PivotNpc { return install(ctx, row, ports); }
