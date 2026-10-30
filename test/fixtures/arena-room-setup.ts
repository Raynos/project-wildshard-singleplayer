// The real room upload/GC child needs original shapes and host registries, not
// every shard's species, pickup and script compilation from test/setup.ts.
import { vi } from 'vitest';
import { installArenaShapes } from './arenaShapes';
import { ENGINE_CONTENT_STRINGS } from '../../src/game/engineStrings';
import { installEngineStrings } from '../../src/engine/strings';

vi.stubGlobal('location', new URL('http://localhost:5173/'));
await import('../../src/identity');
installEngineStrings(ENGINE_CONTENT_STRINGS);
(await import('../../src/engine/world/registry')).installWorldRegistry();
await installArenaShapes();
