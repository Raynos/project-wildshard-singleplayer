/**
 * Nalati's quest line — pure data (NALATI-MERGE Q3–Q5, N16 wave 2: three chained chapters TULPAR → THE GOLDEN KING →
 * FATHER OF THE WIND). Chapter 1 is built; each chapter starts when the one before is complete AND the elder has given
 * it (his dialogue raises `talked:elder:<n>`). The runtime is src/nalati/adventure.ts over the shared quest core
 * (core.ts); the camp's people are src/nalati/campPeople.ts.
 *
 * The flags the line reads and who raises them (every one is persisted with the shard's flags, `ws.flags.v1`):
 *   talked:elder          the elder's first talk (the dialogue's `sets`)
 *   tamed:horse           a wild stallion broken and bonded — Tulpar, or Argymaq (src/game/Taming.ts, polled: a horse
 *                         tamed before the quest existed counts on load — the quest catches up from the saved state)
 *   tamed:argymaq         the bonded horse is Argymaq (the elite) — the elder has words for that
 *   won:kokpar            a kokpar round won (src/nalati/kokpar.ts — open any time, mounted, at the kokpar field)
 *   told:tulpar           back at the elder with both done (his dialogue)
 * Every dialogue entry that can be the FIRST talk raises `talked:elder` too, so a player who tamed / won before ever
 * meeting him starts the chapter with those steps already done.
 */
import type { NpcDef, QuestDef } from './quest';
import type { PlacePoint } from './core';
import { NALATI_MAP, CAMP, HORSE_PLAINS, KOKPAR, ARGYMAQ_PASTURE } from '../../chunks/nalatiLayout';

export const TULPAR_DONE = 'quest:tulpar';

/** where the camp's people stand (world x / z, the facing they idle toward; y from the floor) — src/nalati/campPeople.ts */
export const CAMP_PEOPLE = {
  /** Baqyt Ata, the elder — by the big yurt's door (NomadCamp YURTS[1]: 88°, 14.5 m), looking over the yard */
  elder: { x: CAMP.x - 1.4, z: CAMP.z + 8.9, yaw: Math.PI + 0.25 },
  /** Dauren, a herder — leaning at the corral's gate (layout CORRAL: camp + (27, 9), r 9, the gate on its −x side) */
  herderGate: { x: CAMP.x + 17.2, z: CAMP.z + 7.0, yaw: Math.PI / 2 + 0.3 },
  /** Erlan, a herder — among the saddles by the hitching rail, with the camp horses */
  herderRail: { x: CAMP.x - 15, z: CAMP.z + 2.4, yaw: -Math.PI / 2 },
  /** Ayan, the child — runs rings round the ribbon pole (camp + (1.5, −0.5)) */
  child: { x: CAMP.x + 1.5, z: CAMP.z - 0.5, yaw: 0 },
  /** Gulnar Apa — at the iron stove (camp + (4.5, −5.5)), stirring */
  cook: { x: CAMP.x + 3.7, z: CAMP.z - 4.5, yaw: Math.PI * 0.8 },
} as const;

const world = (p: { x: number; z: number }): { poi: 'world'; x: number; z: number } => ({ poi: 'world', x: p.x, z: p.z });
const ELDER_MARK = { id: 'elder', label: 'BAQYT ATA', short: 'BAQYT ATA', at: world(CAMP_PEOPLE.elder) };

export const TULPAR_QUEST: QuestDef = {
  id: 'tulpar',
  title: 'Tulpar',
  startWhen: { all: ['talked:elder'] },
  intro: {
    objective: 'Visit the nomad camp by the Kunes',
    chip: 'Tulpar',
    hint: 'Baqyt Ata sits by the big yurt',
    markers: [ELDER_MARK],
  },
  steps: [
    {
      id: 'tame',
      objective: 'Break a wild stallion on the horse plains',
      hint: 'Crouch, come slow, hold out your hand · or Argymaq, on the Crags\' high pasture, if you are feeling immortal',
      done: { all: ['tamed:horse'] },
      markers: [
        { id: 'plains', label: 'HORSE PLAINS', short: 'HORSE PLAINS', at: world(HORSE_PLAINS) },
        { id: 'argymaq', label: 'ARGYMAQ\'S PASTURE', short: 'ARGYMAQ', at: world(ARGYMAQ_PASTURE) },
      ],
    },
    {
      id: 'kokpar',
      objective: 'Win a round of kokpar',
      hint: 'Ride in, snatch the goat from the middle, drop it in a tai-qazan · keep galloping or the riders take it back',
      done: { all: ['won:kokpar'] },
      markers: [{ id: 'kokpar', label: 'KOKPAR FIELD', short: 'KOKPAR FIELD', at: world(KOKPAR) }],
    },
    {
      id: 'home',
      objective: 'Ride home to Baqyt Ata',
      hint: 'The camp by the Kunes',
      done: { all: ['told:tulpar'] },
      markers: [ELDER_MARK],
    },
  ],
  completeFlag: TULPAR_DONE,
};

/** the chapters in order (the chain) */
export const NALATI_QUESTS: QuestDef[] = [TULPAR_QUEST];

/** flags the line reads that the runtime raises (events, polled stores, dialogue) — for validateQuest */
export const NALATI_QUEST_EXTERNAL = ['talked:elder', 'tamed:horse', 'tamed:argymaq', 'won:kokpar', 'told:tulpar'];

// ── the camp's people ─────────────────────────────────────────────────────────────────────────────────────────────

export const ELDER: NpcDef = {
  id: 'elder',
  name: 'Baqyt Ata, the camp elder',
  dialogue: [
    { when: { all: [TULPAR_DONE] }, lines: [
      'Now you sit a horse like a Kazakh and not like a sack of flour on a camel. Good.',
      'The kurgans on the bowl\'s west side have been restless. When the sun goes down, the old stones talk. I will tell you about them when my knees stop talking louder.',
    ] },
    { when: { all: ['tamed:horse', 'won:kokpar'] }, lines: [
      'Ha! The whole valley heard it — the guest snatched the goat from under the kokpar boys\' noses!',
      'We say: a man without a horse is a man without wings. Today you grew wings. And you did not even fall off them. Much.',
      'The riders have a name for you now. I will not tell you what they called you BEFORE the round.',
      'Tulpar was a winged horse, in the old songs. Ride yours well, and the steppe will open to you.',
    ], sets: ['talked:elder', 'told:tulpar'] },
    { when: { all: ['tamed:argymaq'], none: ['won:kokpar'] }, lines: [
      'ARGYMAQ? You sat on Argymaq? Nobody has sat on that horse since my grandfather\'s grandfather — and he only sat on him once, briefly, and then on the ground for a long time.',
      'Oybai, what a horse! Now go and show the kokpar boys. The field is in the golden bowl, past the horse plains. Let them eat his dust.',
    ], sets: ['talked:elder'] },
    { when: { all: ['tamed:horse'], none: ['won:kokpar'] }, lines: [
      'That is your horse at the rail? Good chest. Proud eyes. He will throw you twice a week and love you the rest of it.',
      'Now the kokpar. The boys play every day on the field in the golden bowl, west of the horse plains. Take the goat from the middle, put it in a tai-qazan. Do not stop moving — they will take it straight back.',
    ], sets: ['talked:elder'] },
    { when: { all: ['won:kokpar'], none: ['tamed:horse'] }, lines: [
      'You won the kokpar on a BORROWED horse? The boys will never live it down. Neither will the horse.',
      'But a guest with no horse of his own is still a guest on foot. Go to the horse plains. Break a stallion who is yours.',
    ], sets: ['talked:elder'] },
    { when: { all: ['talked:elder'] }, lines: [
      'The herd grazes on the horse plains, up in the golden bowl — take the sky road south from the bridge.',
      'Come to the stallion slow, crouched, with an open hand. Shoot anywhere near him and you are walking home, and so is your dignity.',
      'Or — if you want to be a song instead of a rider — Argymaq runs on the Crags\' high pasture. Nobody has broken him. Nobody. Just so you know.',
    ] },
    { lines: [
      'Salem, traveller! Sit, sit — in a Kazakh yurt the kettle is always on, even when the yurt is on fire.',
      'I am Baqyt. Seventy-three winters on this steppe, and every one of them windy.',
      'You came on foot? On FOOT? Across the Kunes? Aynalayin, the steppe is not for feet. Feet are for standing in stirrups.',
      'Go up to the horse plains and win yourself a stallion. Then show the kokpar boys you can ride him. Then come back, and we will talk like two people with horses.',
    ], sets: ['talked:elder'] },
  ],
};

export const HERDER_GATE: NpcDef = {
  id: 'herder-gate',
  name: 'Dauren, herder',
  dialogue: [
    { when: { all: ['won:kokpar'] }, lines: ['You carried the goat all the way into the tai-qazan? My brother says you cheated. My brother also says the moon is a cheese, so.'] },
    { when: { all: ['tamed:argymaq'] }, lines: ['Is that — no. Is that ARGYMAQ at our rail? I am going to go and lie down in the yurt for a while.'] },
    { when: { all: ['tamed:horse'] }, lines: ['Nice horse. When he bites you — and he will — do not bite back. It only encourages them.'] },
    { lines: ['The stallion on the plains? He bit my cousin. Twice. Same afternoon. My cousin went back for the second one, which tells you about my cousin.'] },
  ],
};

export const HERDER_RAIL: NpcDef = {
  id: 'herder-rail',
  name: 'Erlan, herder',
  dialogue: [
    { when: { all: ['won:kokpar'] }, lines: ['Next year you ride for our camp. That is not a question. We have already told the other camps.'] },
    { lines: [
      'Kokpar? It is like polo, except the ball is a goat, and the rules are also a goat.',
      'The camp horses at the rail are for anyone. Be nice to the grey. She remembers.',
    ] },
  ],
};

export const CHILD: NpcDef = {
  id: 'child',
  name: 'Ayan',
  dialogue: [
    { when: { all: ['tamed:horse'] }, lines: ['Can I ride him? Just to the river? Just to the tree? Just to you? I am standing right here, it is not far.'] },
    { lines: ['Is it true you came from the sky? Grandpa Baqyt says everybody comes from the sky. I think he means the rain.'] },
  ],
};

export const COOK: NpcDef = {
  id: 'cook',
  name: 'Gulnar Apa',
  dialogue: [
    { when: { all: [TULPAR_DONE] }, lines: ['Baqyt has not smiled like that since the spring the wolves went north. Take another baursaq. Take two. Your horse can have one.'] },
    { lines: ['Eat first, then talk. The baursaq is hot. No — you cannot say no, it is not a question, it is a baursaq.'] },
  ],
};

export const CAMP_NPCS = { elder: ELDER, herderGate: HERDER_GATE, herderRail: HERDER_RAIL, child: CHILD, cook: COOK } as const;

// ── places (the full map's names, discovered by walking near; saved as `seen:<id>`) ──────────────────────────────────

/** discovery radius per place (metres; the default is 32) — the big open ones need less walking into */
const PLACE_R: Record<string, number> = {
  'KUNES RIVER': 45, 'SKY ROAD': 36, 'HORSE PLAINS': 60, 'KOKPAR FIELD': 38, 'KURGAN FIELD': 40, 'GLACIER': 50, 'THE CRAGS': 55, 'SNOW LOTUS': 36,
};
const slug = (s: string): string => s.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '');

export const NALATI_PLACES: PlacePoint[] = NALATI_MAP.pois.map((p) => ({ id: slug(p.label), label: p.label, x: p.x, z: p.z, r: PLACE_R[p.label] ?? 32 }));
