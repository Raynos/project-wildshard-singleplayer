import { PINE_HOLLOW_POIS } from '../data/layout';
import { JOURNAL_ANIMALS, JOURNAL_PLACE_NOTES } from './journalPages';
import { PINE_HOLLOW_TROPHIES, RANGER_WALL } from './trophyWall';

const art = '/assets/pine-hollow/journal';
/** Author-only assembly. The immutable output holds every entry, match, display rule and wall coordinate. */
export const JOURNAL = {
  kind: 'journal', id: 'pine.journal', chunkId: 'chunk://local/pine-hollow', className: 'journal', title: "Hunter's Journal",
  tabs: [{ id: 'beasts', label: 'Beasts' }, { id: 'elites', label: 'Elites' }, { id: 'places', label: 'Places' }, { id: 'trophies', label: 'Trophies' }],
  trophyTab: 'trophies', stamp: { place: 'Visited', default: 'Taken' },
  icons: [{ entryKind: 'boss', icon: 'antlers' }, { entryKind: 'elite', matchKind: 'deer', icon: 'ghost' },
    { entryKind: 'elite', matchKind: 'boar', icon: 'ironhide' },
    ...(['deer', 'boar', 'elk', 'bear'] as const).map(kind => ({ matchKind: kind, icon: kind }))],
  stats: {
    place: [{ label: 'Visits', value: 'seen' }, { label: 'Status', value: 'status', fallback: 'Heard of', words: { unknown: '???', seen: 'Visited' } }],
    default: [{ label: 'Seen', value: 'seen' }, { label: 'Taken', value: 'taken' }, { label: 'Best', value: 'best', suffix: ' kg', fallback: '—' },
      { label: 'Rarity', value: 'rarity', fallback: '???', words: { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' } }],
  },
  chalk: { atlas: `${art}/chalk.webp`, cells: {
    stag: { x: 0, y: 0, w: 0.2, h: 1 }, elk: { x: 0.2, y: 0, w: 0.2, h: 1 }, boar: { x: 0.4, y: 0, w: 0.2, h: 1 },
    bear: { x: 0.6, y: 0, w: 0.2, h: 1 }, king: { x: 0.8, y: 0, w: 0.2, h: 1 },
  } },
  entries: [...JOURNAL_ANIMALS, ...PINE_HOLLOW_POIS.map(place => ({
    id: place.id, kind: 'place', tab: 'places', name: place.name, notes: JOURNAL_PLACE_NOTES[place.id] ?? '',
    place: { x: place.x, z: place.z, r: place.r }, plate: { sketch: `${art}/place-${place.id}.webp` },
  }))], trophies: PINE_HOLLOW_TROPHIES, wall: RANGER_WALL,
} as const;
