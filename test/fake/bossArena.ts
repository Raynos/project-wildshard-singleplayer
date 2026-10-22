import { BossArenaRoom } from '../../src/game/boss/arenaRoom';
import room from '../../src/shards/nalati-grasslands/data/bossArenaRoom.json' with { type: 'json' };
import view from '../../src/shards/nalati-grasslands/data/kurganView.json' with { type: 'json' };
import { SHAPES } from '../../src/shards/nalati-grasslands/models/shapes';

export function bossArena(): BossArenaRoom {
 return new BossArenaRoom({ ...room, view }, new Map([...view.scene.nodes, ...view.static.nodes].flatMap(row => 'geometry' in row ? [[row.geometry, SHAPES.handle(row.geometry).copy()]] as const : [])));
}
