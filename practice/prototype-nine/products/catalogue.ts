/** Separate WIP products. Pins preserve actual source assets; these are not native admission receipts. */
export const PROTOTYPE_PRODUCTS = [
  {
    "id": "bellback",
    "label": "Bellback · WIP prototype",
    "kind": "bellback",
    "variant": "bellback",
    "metadataPath": "art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate5/metadata.json",
    "metadataSha256": "7279947529a1c4147782a1171d54597e735136e9bd99c7a4f87f402a64806de6",
    "payloadPath": "art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/frame2-native/payload.bin",
    "payloadSha256": "b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c",
    "bodyFile": "/assets/driftwood-isle/bellback-native-b97a9df5437062aa2eb490340663c2b35ecf22ba83c83b834082d8ffe7ae7e9c.bin",
    "hp": 120,
    "damage": 12,
    "reach": 2.8,
    "speed": 0.6,
    "hoverHeight": 0,
    "scale": 1,
    "description": "Simplified stalker AI and attack; simple despawn. Not quality-complete."
  },
  {
    "id": "pitcher",
    "label": "Brine Pitcher Matriarch · WIP prototype",
    "kind": "brine-pitcher-matriarch",
    "variant": "brine-pitcher-matriarch",
    "metadataPath": "test/proof/brine-pitcher-native-owner/source/core-runtime-study/metadata.json",
    "metadataSha256": "a1badfcd0a4039ca031356b4d5963450e1f3e472ae1ff427f95276da828cfdfa",
    "payloadPath": "test/proof/brine-pitcher-native-owner/source/v3/payload.bin",
    "payloadSha256": "70cc84fae55360f410433857685713a2475a0974cf853740f1ccbde725e6957e",
    "bodyFile": "/assets/driftwood-isle/brine-pitcher-native-70cc84fae55360f410433857685713a2475a0974cf853740f1ccbde725e6957e.bin",
    "hp": 90,
    "damage": 12,
    "reach": 2.6,
    "speed": 0.35,
    "hoverHeight": 0,
    "scale": 1,
    "description": "Simplified stalker AI and attack; simple despawn. Not quality-complete."
  },
  {
    "id": "medusa",
    "label": "Pearlglass Medusa · WIP prototype",
    "kind": "pearlglass-medusa",
    "variant": "pearlglass-medusa",
    "metadataPath": "art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/metadata.json",
    "metadataSha256": "eb1346054c4f93010ccbdedd98a7a5a933be60b36d47dcc9fb831af99357b765",
    "payloadPath": "art/driftwood-isle/approved-pearlglass-medusa/complete-character-next/payload.bin",
    "payloadSha256": "982033aaacb7d90feaa0b01ae7413df43def2157b9c6312e66f1ea75fdff0abc",
    "bodyFile": "/assets/driftwood-isle/pearlglass-medusa-native-982033aaacb7d90feaa0b01ae7413df43def2157b9c6312e66f1ea75fdff0abc.bin",
    "hp": 70,
    "damage": 10,
    "reach": 2.8,
    "speed": 0.7,
    "hoverHeight": 4.571428571428572,
    "scale": 0.35,
    "description": "Grounded AI with hover presentation; original flight unimplemented. Simple attack and despawn; not quality-complete."
  },
  {
    "id": "keelmaw",
    "label": "Keelmaw · WIP prototype",
    "kind": "keelmaw",
    "variant": "keelmaw",
    "metadataPath": "test/proof/keelmaw-native-owner/refined/metadata.json",
    "metadataSha256": "6736293d157d30d1416e0033196dcb5479acff7a0100778d12a350831636b58d",
    "payloadPath": "test/proof/keelmaw-native-owner/refined/payload.bin",
    "payloadSha256": "69fa4a3b91d819cd6ad0cbd6aba6477f62def3bebde598a8b138f8f50d6ce012",
    "bodyFile": "/assets/driftwood-isle/keelmaw-native-69fa4a3b91d819cd6ad0cbd6aba6477f62def3bebde598a8b138f8f50d6ce012.bin",
    "hp": 120,
    "damage": 16,
    "reach": 2.8,
    "speed": 0.8,
    "hoverHeight": 0,
    "scale": 1,
    "description": "Simplified stalker AI and attack; simple despawn. Not quality-complete."
  },
  {
    "id": "iguana",
    "label": "Bloomthroat Iguana · WIP prototype",
    "kind": "bloomthroat-iguana",
    "variant": "bloomthroat-iguana",
    "metadataPath": "art/driftwood-isle/approved-bloomthroat-iguana/complete-character-next/metadata.json",
    "metadataSha256": "b1dfd298135f609f01ad8195c242617073f0d184b79be6636bc1a0c961111b14",
    "payloadPath": "art/driftwood-isle/approved-bloomthroat-iguana/complete-character-next/payload.bin",
    "payloadSha256": "6f53f402e8574c985f87b95fe80bd5b98a445a2e221688686f1b1714ec17e219",
    "bodyFile": "/assets/driftwood-isle/bloomthroat-iguana-native-6f53f402e8574c985f87b95fe80bd5b98a445a2e221688686f1b1714ec17e219.bin",
    "hp": 90,
    "damage": 12,
    "reach": 2.4,
    "speed": 0.8,
    "hoverHeight": 0,
    "scale": 1,
    "description": "Simplified stalker AI and attack; simple despawn. Not quality-complete."
  }
] as const;

export type PrototypeId = (typeof PROTOTYPE_PRODUCTS)[number]['id'];
export type PrototypeDefinition = (typeof PROTOTYPE_PRODUCTS)[number];

export function prototypeDefinition(id: PrototypeId): PrototypeDefinition {
  const row = PROTOTYPE_PRODUCTS.find(entry => entry.id === id);
  if (row === undefined) throw new Error(`Unknown prototype: ${id}`);
  return row;
}
