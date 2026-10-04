import catalogue from './singleplayer.json';

/** Select a shard, explore and the grid resolve one durable first-party identity, without a cell suffix. */
export function firstPartyInstance(slug: string): string {
  const normalize = (name: string): string => name.replace(/^_/u, '');
  const placement = catalogue.placements.find((entry) => normalize(entry.slug) === normalize(slug));
  if (placement === undefined) throw new RangeError(`Unknown first-party instance: ${slug}`);
  return placement.instance;
}
/** Six copies of one template package have independent facts and local state, wherever they are placed. */
export function templateInstance(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 6) throw new RangeError('Template instance must be 1–6');
  return `template-${ordinal}`;
}
