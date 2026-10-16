import { beforeAll, expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { readProjectAssets } from '../src/sdk/project';
import { claim, draw, loadBoard, recordKill, saveBoard } from '../src/shards/pine-hollow/quest/contracts';
import { PineLodge, PINE_LODGE_ACT, parseContractCatalogue, type ContractCatalogue } from '../src/shards/pine-hollow/runtime/lodge';

// Captured from the original play-read authoring and actual page board save API.
const originals = {
  "CONTRACT_ROWS": "ac4f313f34d2ec89b419cf9f522f4cbc39481890d49793922da1efb9863ec987",
  "SPECIES": "68e5afb886a30c00c35e65b23c69eac31a299b5c2488fe9537abe3bd454f09bb",
  "RARITY": "052531e9d326ad906bc92f48e8f6b87bb2e3c4f6cf2c5a5543474ab7e8ba047e",
  "ELITE_TARGETS": "94473977420eaad637cd35e30bb7944e84f6998a3deef5f275d4f16af78dc9c8",
  "draws": "7b212bd693172cf7d95794b01edc007ce7c4c0d32d9f5b49f4353b3be65b6ddc"
};
const oldPageSave = "{\"next\":17,\"slots\":[{\"serial\":16,\"kind\":\"rarity\",\"target\":\"uncommon\",\"have\":0},{\"serial\":14,\"kind\":\"elite\",\"target\":\"imperial-bull\",\"have\":0},{\"serial\":15,\"kind\":\"species\",\"target\":\"boar\",\"have\":0}],\"claimed\":9,\"streak\":0,\"best\":2}";
const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

let admitted: ContractCatalogue | undefined;
beforeAll(async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  const row = loaded.output.namedFiles?.find(file => file.name === 'quests/contracts.json');
  const bytes = row === undefined ? undefined : loaded.assets.get(row.hash);
  if (bytes === undefined) throw new Error('The product must publish its contract catalogue');
  admitted = parseContractCatalogue(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
}, 30_000);
function catalogue(): ContractCatalogue {
  if (admitted === undefined) throw new Error('The admitted catalogue is required');
  return admitted;
}

test('compiled contract offers preserve every title, target, reward and deterministic draw', () => {
  const contracts = catalogue();
  expect([hash(contracts.rows), hash(contracts.species), hash(contracts.rarity), hash(contracts.elites)])
    .toEqual([originals.CONTRACT_ROWS, originals.SPECIES, originals.RARITY, originals.ELITE_TARGETS]);
  expect(hash(Array.from({ length: 128 }, (_, serial) => draw(contracts, serial)))).toBe(originals.draws);
});

test('the old board save restores silently on page and native, then claims the same offer and payout', () => {
  const contracts = catalogue();
  let rewritten = '';
  const board = loadBoard(contracts, { getItem: () => oldPageSave, setItem: (_key, value) => { rewritten = value; } });
  saveBoard(board, { getItem: () => null, setItem: (_key, value) => { rewritten = value; } });
  expect(rewritten).toBe(oldPageSave);
  const events: string[] = [];
  const native = new PineLodge({ contracts, prompt: { x: 0, y: 1.68, z: 0 }, radius: 3,
    addItem: (id, n) => { events.push(`${id}:${String(n)}`); }, addBolts: n => { events.push(`bolts:${String(n)}`); },
    ownSkin: id => { events.push(`skin:${id}`); }, streak: n => { events.push(`streak:${String(n)}`); } });
  const saved: unknown = JSON.parse(oldPageSave);
  native.restore({ version: 1, open: true, board: saved });
  expect(events).toEqual([]); expect(native.active).toBe(true);
  expect(native.snapshot().board).toEqual(saved);
  const slot = board.slots[0];
  if (slot === undefined) throw new Error('The captured old save has three contracts');
  const elite = contracts.elites[slot.target];
  const kill = { kind: slot.kind === 'species' ? slot.target : slot.kind === 'elite' ? elite?.kind ?? '' : 'deer',
    variant: elite?.variant, rarity: slot.kind === 'rarity' ? slot.target : 'common',
    elite: slot.kind === 'elite' ? slot.target : null, thrall: slot.kind === 'thrall' };
  for (let i = 0; i < slot.need; i++) { recordKill(board, kill); native.killed(kill); }
  const reward = claim(contracts, board, 0);
  if (reward === null) throw new Error('The restored board must accept the completed offer');
  native.use(PINE_LODGE_ACT.claim0, { x: 0, y: 1.68, z: 0 });
  expect(events).toEqual([...reward.items.map(item => `${item.id}:${String(item.n)}`),
    ...(reward.bolts > 0 ? [`bolts:${String(reward.bolts)}`] : []),
    ...(reward.skin === undefined ? [] : [`skin:${reward.skin}`]), `streak:${String(board.streak)}`]);
  let expected = '';
  saveBoard(board, { getItem: () => null, setItem: (_key, value) => { expected = value; } });
  expect(native.snapshot().board).toEqual(JSON.parse(expected));
});
