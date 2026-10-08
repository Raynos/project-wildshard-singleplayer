// Runs only in the existing plain-Node schema loader, with no app/session/world allocation.
import { ShardfileSchema } from '../../src/game/shardfile/schema.ts';
import { SCRIPT_ABI, SCRIPT_IMPORTS, SCRIPT_EXPORTS } from '../../src/engine/script/abi.ts';
import { schemaInventory, abiInventory } from './schema-reference.mjs';

process.stdout.write(JSON.stringify({ fields: schemaInventory(ShardfileSchema), abi: abiInventory(SCRIPT_IMPORTS, SCRIPT_EXPORTS), contract: SCRIPT_ABI }));
