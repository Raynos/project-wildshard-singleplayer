import { BossArenaRoom } from '../../src/game/boss/arenaRoom';
import room from '../../src/shards/nalati-grasslands/data/bossArenaRoom.json' with { type: 'json' };
import view from '../../src/shards/nalati-grasslands/data/kurganView.json' with { type: 'json' };
import { shapeBook } from '../../src/game/models/shapeBook';
import shapeRows from '../../src/shards/nalati-grasslands/boot/shapeBook.generated.json' with { type: 'json' };

export function bossArena(): BossArenaRoom {
 return new BossArenaRoom({ ...room, view }, new Map([...view.scene.nodes, ...view.static.nodes].flatMap(row => 'geometry' in row ? [[row.geometry, shapeBook(shapeRows).geometry(row.geometry)]] as const : [])));
}
