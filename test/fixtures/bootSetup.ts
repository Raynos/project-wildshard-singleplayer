/** Opt-in app tables and catalogue, without species, geometry or world installs. */
export async function installAssetFixture(): Promise<void> {
  const [{ installAssetTables }, { PUBLIC_BYTES }, { ASSET_VERSIONS }, audio, { PACKS }] = await Promise.all([
    import('../../src/engine/shared/boot/tables'), import('../../src/game/client/boot/bytes.generated'),
    import('../../src/game/client/boot/versions.generated'), import('../../src/game/client/boot/audio.generated'),
    import('../../src/game/client/boot/packs.generated'),
  ]);
  installAssetTables({ bytes: PUBLIC_BYTES, versions: ASSET_VERSIONS, music: audio.MUSIC_MANIFESTS, sfx: audio.SFX_MANIFESTS, packs: PACKS });
}

/** The same app catalogue used by selected-manifest tests; no world is prepared. */
export async function installCatalogueFixture(): Promise<void> {
  const [{ installShards }, catalogue] = await Promise.all([
    import('../../src/game/client/shard/list'), import('../../src/shards.generated'),
  ]);
  installShards(catalogue.SHARDS);
}
