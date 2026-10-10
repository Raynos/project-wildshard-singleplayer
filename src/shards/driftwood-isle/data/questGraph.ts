import { parseInteractionRows } from '@wildshard/sdk/interactions';
import { parseQuestGraph } from '@wildshard/sdk/questGraph';

/** Native prompt command identity; physical controllers retain their shipping update order. */
export const DRIFTWOOD_GRAPH = parseQuestGraph({ actor: 'driftwood.interact', step: 'driftwood.quest.graph', actions: [] });

/** Ordered flag effects of the shipping prompts. Chest contents follow the open event in the native keeper;
 * plates, the barrel, sluice and zipline retain their physical controllers. */
export const DRIFTWOOD_ACTIONS = parseInteractionRows({ marks: [], rows: [
  {"id": "castaway.talk", "act": 0, "at": "castaway", "needs": [{"none": ["talked:castaway"]}], "sets": ["talked:castaway"]},
  {"id": "castaway-chest", "act": 100, "at": "castaway-chest", "needs": [{"all": ["talked:castaway"]}, {"none": ["open:castaway-chest"]}], "sets": ["open:castaway-chest"]},
  {"id": "beacon", "act": 101, "at": "beacon", "needs": [{"all": ["has:flint"]}, {"none": ["lit:beacon"]}], "sets": ["lit:beacon"]},
  {"id": "shard-lookout", "act": 102, "at": "shard-lookout", "needs": [{"all": ["lit:beacon"]}, {"none": ["taken:shard-lookout"]}], "sets": ["taken:shard-lookout", "shard:lookout"]},
  {"id": "hold-key", "act": 103, "at": "hold-key", "needs": [{"all": ["dead:sailor"]}, {"none": ["taken:hold-key"]}], "sets": ["key:hold", "taken:hold-key"]},
  {"id": "hold-pump", "act": 104, "at": "hold-pump", "needs": [{"all": ["key:hold"]}, {"none": ["lever:hold-pump"]}], "sets": ["lever:hold-pump"]},
  {"id": "hold-winch", "act": 105, "at": "hold-winch", "needs": [{"all": ["lever:hold-pump"]}, {"none": ["lever:hold-winch"]}], "sets": ["lever:hold-winch", "winch:up"]},
  {"id": "strongbox", "act": 106, "at": "strongbox", "needs": [{"all": ["winch:up"]}, {"none": ["open:strongbox"]}], "sets": ["open:strongbox"]},
  {"id": "shard-cave", "act": 111, "at": "shard-cave", "needs": [{"all": ["open:sluice"]}, {"none": ["taken:shard-cave"]}], "sets": ["taken:shard-cave", "shard:cave"]},
  {"id": "altar", "act": 112, "at": "altar", "needs": [{"all": ["shard:lookout", "shard:wreck", "shard:cave"]}, {"none": ["used:altar"]}], "sets": ["used:altar", "quest:shrine-set"]},
  {"id": "reef-treasure", "act": 113, "at": "reef-treasure", "needs": [{"none": ["open:reef-treasure"]}], "sets": ["open:reef-treasure"]},
  {"id": "vista-bench", "act": 114, "at": "vista-bench", "needs": [], "sets": ["used:vista-bench"]},
  {"id": "glass-1", "act": 115, "at": "glass-1", "needs": [{"none": ["taken:glass-1"]}], "sets": ["taken:glass-1", "glass:1"]},
  {"id": "glass-2", "act": 116, "at": "glass-2", "needs": [{"none": ["taken:glass-2"]}], "sets": ["taken:glass-2", "glass:2"]},
  {"id": "glass-3", "act": 117, "at": "glass-3", "needs": [{"none": ["taken:glass-3"]}], "sets": ["taken:glass-3", "glass:3"]},
  {"id": "glass-4", "act": 118, "at": "glass-4", "needs": [{"none": ["taken:glass-4"]}], "sets": ["taken:glass-4", "glass:4"]},
  {"id": "glass-5", "act": 119, "at": "glass-5", "needs": [{"none": ["taken:glass-5"]}], "sets": ["taken:glass-5", "glass:5"]},
  {"id": "glass-6", "act": 120, "at": "glass-6", "needs": [{"none": ["taken:glass-6"]}], "sets": ["taken:glass-6", "glass:6"]},
  {"id": "glass-7", "act": 121, "at": "glass-7", "needs": [{"none": ["taken:glass-7"]}], "sets": ["taken:glass-7", "glass:7"]},
  {"id": "glass-8", "act": 122, "at": "glass-8", "needs": [{"none": ["taken:glass-8"]}], "sets": ["taken:glass-8", "glass:8"]},
  {"id": "glass-9", "act": 123, "at": "glass-9", "needs": [{"none": ["taken:glass-9"]}], "sets": ["taken:glass-9", "glass:9"]},
  {"id": "glass-10", "act": 124, "at": "glass-10", "needs": [{"none": ["taken:glass-10"]}], "sets": ["taken:glass-10", "glass:10"]},
  {"id": "glass-11", "act": 125, "at": "glass-11", "needs": [{"none": ["taken:glass-11"]}], "sets": ["taken:glass-11", "glass:11"]},
  {"id": "glass-12", "act": 126, "at": "glass-12", "needs": [{"none": ["taken:glass-12"]}], "sets": ["taken:glass-12", "glass:12"]},
  {"id": "glass-13", "act": 127, "at": "glass-13", "needs": [{"none": ["taken:glass-13"]}], "sets": ["taken:glass-13", "glass:13"]},
  {"id": "glass-14", "act": 128, "at": "glass-14", "needs": [{"none": ["taken:glass-14"]}], "sets": ["taken:glass-14", "glass:14"]},
  {"id": "glass-15", "act": 129, "at": "glass-15", "needs": [{"none": ["taken:glass-15"]}], "sets": ["taken:glass-15", "glass:15"]},
] });
