import campLive from './compare/nalati-camp-live.jpg';
import campTarget from './compare/nalati-camp-target.jpg';
import railLive from './compare/nalati-rail-live.jpg';
import railTarget from './compare/nalati-rail-target.jpg';
import gullyLive from './compare/nalati-gully-live.jpg';
import gullyTarget from './compare/nalati-gully-target.jpg';

/** Original comparison images and note source paths, now owned by the shard. */
export const COMPARE = [
  { id: 'camp', label: 'Camp', live: campLive, image: campTarget, model: '', target: 'art/nalati-grasslands/round-5-paintover/camp-po-phone.jpg' },
  { id: 'rail', label: 'River rail', live: railLive, image: railTarget, model: '', target: 'art/nalati-grasslands/round-5-paintover/rail-po-phone.jpg' },
  { id: 'gully', label: 'Gully', live: gullyLive, image: gullyTarget, model: '', target: 'art/nalati-grasslands/round-5-paintover/gully-po-phone.jpg' },
] as const;
