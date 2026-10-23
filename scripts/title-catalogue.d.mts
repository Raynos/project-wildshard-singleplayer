import type { TitleManifest } from '../src/game/shard/titleList';

export function titleCatalogueSource(rows: readonly TitleManifest[]): string;
export function readTitleCatalogue(): Promise<string>;
