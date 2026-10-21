import { DRIFTWOOD_GRAPH, DRIFTWOOD_ACTIONS } from './questGraph';
import policy from '../data/nativeQuest.json' with { type: 'json' };

/** Native command routes retain page prompt order and borrow each live physical owner. */
export const QUEST_HOST = {
  version: 1, graph: DRIFTWOOD_GRAPH, interactions: DRIFTWOOD_ACTIONS, npcs: [], drive: 'external',
  actors: { ids: [], error: 'Missing Driftwood quest body' },
  observations: [
    { binding: 'event:quest.sword-free', kind: 'owner', owner: 'sword-free' },
    { binding: 'event:quest.zipline-riding', kind: 'cable', cable: policy.cable, state: 'riding' },
  ],
  stages: [], summons: [], commands: { step: 'driftwood.quest.commands',
    inputs: { sword: 'event:quest.sword-free', riding: 'event:quest.zipline-riding' }, routes: [
      {"value": 1, "spot": "iron-sword", "when": "sword", "action": {"kind": "owner", "id": "iron-sword"}},
      {"value": 100, "spot": "castaway-chest", "when": "true", "action": {"kind": "owner", "id": "castaway-chest"}},
      {"value": 101, "spot": "beacon", "when": "true", "action": {"kind": "owner", "id": "beacon"}},
      {"value": 102, "spot": "shard-lookout", "when": "true", "action": {"kind": "owner", "id": "shard-lookout"}},
      {"value": 103, "spot": "hold-key", "when": "true", "action": {"kind": "owner", "id": "hold-key"}},
      {"value": 104, "spot": "hold-pump", "when": "true", "action": {"kind": "owner", "id": "hold-pump"}},
      {"value": 105, "spot": "hold-winch", "when": "true", "action": {"kind": "owner", "id": "hold-winch"}},
      {"value": 106, "spot": "strongbox", "when": "true", "action": {"kind": "owner", "id": "strongbox"}},
      {"value": 110, "spot": "sluice", "when": "true", "action": {"kind": "owner", "id": "sluice"}},
      {"value": 111, "spot": "shard-cave", "when": "true", "action": {"kind": "owner", "id": "shard-cave"}},
      {"value": 112, "spot": "altar", "when": "true", "action": {"kind": "owner", "id": "altar"}},
      {"value": 113, "spot": "reef-treasure", "when": "true", "action": {"kind": "owner", "id": "reef-treasure"}},
      {"value": 114, "spot": "vista-bench", "when": "true", "action": {"kind": "owner", "id": "vista-bench"}},
      {"value": 0, "spot": "castaway.talk", "when": "true", "action": {"kind": "row", "id": "castaway.talk"}},
      {"value": 2, "spot": "zipline", "when": "!riding", "action": {"kind": "cable", "cable": policy.cable, "command": "start"}},
    ] },
};

/** The admitted graph's durable flag vocabulary; it adds no state or save owner. */
export const QUEST_FLAGS = ["talked:castaway", "open:castaway-chest", "lit:beacon", "has:flint", "taken:shard-lookout", "shard:lookout", "key:hold", "taken:hold-key", "dead:sailor", "lever:hold-pump", "lever:hold-winch", "winch:up", "open:strongbox", "taken:shard-cave", "shard:cave", "open:sluice", "used:altar", "quest:shrine-set", "shard:wreck", "open:reef-treasure", "used:vista-bench", "taken:glass-1", "glass:1", "taken:glass-2", "glass:2", "taken:glass-3", "glass:3", "taken:glass-4", "glass:4", "taken:glass-5", "glass:5", "taken:glass-6", "glass:6", "taken:glass-7", "glass:7", "taken:glass-8", "glass:8", "taken:glass-9", "glass:9", "taken:glass-10", "glass:10", "taken:glass-11", "glass:11", "taken:glass-12", "glass:12", "taken:glass-13", "glass:13", "taken:glass-14", "glass:14", "taken:glass-15", "glass:15"];
