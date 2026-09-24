/**
 * Nalati's quest line — pure data (NALATI-MERGE Q3–Q5, N16 wave 2: three chained chapters TULPAR → THE GOLDEN KING →
 * FATHER OF THE WIND). Each chapter starts when the one before is complete AND the elder has given it (his dialogue
 * raises `talked:elder` / `talked:elder:2` / `talked:elder:3`). The runtime is src/nalati/adventure.ts over the shared quest core
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
 *
 * Chapter 2, THE GOLDEN KING (after TULPAR; the elder's next talk raises `talked:elder:2`):
 *   clue:1..3             a balbal warrior toppled at dusk in the kurgan field — its carving tells the story (animals.onKill)
 *   entered:kurgan        inside the great kurgan (the boss module's `inside`, polled)
 *   dead:golden-king      the Golden King beaten (the saved boss state, polled: a King beaten before the chapter counts)
 *   told:king             the gold plaque shown to the elder
 * Chapter 3, FATHER OF THE WIND (after chapter 2; `talked:elder:3`):
 *   felled:<elite>        a named elite beaten (or Argymaq broken) — the saved elite store, polled
 *   feather:1..3          storm feathers: one per elite felled, three wanted
 *   lit:cairn             the strip tied at the Wind Cairn in a storm (the titan's `tied`, polled)
 *   dead:jel-ata          Jel Ata beaten (the saved boss state)
 *   told:wind             home to the elder
 * The bosses stay open any time: a boss beaten before its chapter skips the steps that lead to it.
 */
import type { NpcDef, QuestDef } from './quest';
import type { PlacePoint } from './core';
import { NALATI_MAP, CAMP, HORSE_PLAINS, KOKPAR, ARGYMAQ_PASTURE, KURGANS, CAIRN, KOKBORI_DEN, QARA_CAIRN, LEOPARD_CAVE, EAGLE_ROCK } from '../../chunks/nalatiLayout';

export const TULPAR_DONE = 'quest:tulpar';
export const KING_DONE = 'quest:golden-king';
export const WIND_DONE = 'quest:father-wind';

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
const GREAT = KURGANS.find((k) => k.great === true) ?? { x: -191, z: 75, r: 19 };
/** the great kurgan's doorway: on the mound's west (+x) flank (layout GREAT_KURGAN_DOOR) */
export const GREAT_KURGAN_DOOR_XZ = { x: GREAT.x + GREAT.r + 1.5, z: GREAT.z };
/** the named elites whose storm feathers chapter 3 wants, and where they are found (src/nalati/elites.ts lairs) */
export const FEATHER_ELITES: { id: string; label: string; short: string; at: { x: number; z: number } }[] = [
  { id: 'kokbori', label: 'KOKBORI\'S DEN', short: 'KOKBORI', at: KOKBORI_DEN },
  { id: 'qyran', label: 'QYRAN · EAGLE ROCK', short: 'QYRAN', at: EAGLE_ROCK },
  { id: 'aqbars', label: 'AQBARS · LEOPARD CAVE', short: 'AQBARS', at: LEOPARD_CAVE },
  { id: 'qara-batyr', label: 'QARA BATYR\'S CAIRN', short: 'QARA BATYR', at: QARA_CAIRN },
  { id: 'argymaq', label: 'ARGYMAQ\'S PASTURE', short: 'ARGYMAQ', at: ARGYMAQ_PASTURE },
];

/** Each chapter's `intro.chip` is its SHORT name: the HUD chip's label for the whole chapter (◆ GOLDEN KING 2/4 │ THE KURGAN
 *  230 M — it has to fit a 390 px phone beside the nav half); the map card and the toasts use the full `title`. */
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

export const CLUE_FLAGS = ['clue:1', 'clue:2', 'clue:3'];
export const FEATHER_FLAGS = ['feather:1', 'feather:2', 'feather:3'];

export const KING_QUEST: QuestDef = {
  id: 'golden-king',
  title: 'The Golden King',
  startWhen: { all: [TULPAR_DONE, 'talked:elder:2'] },
  intro: { objective: 'Ask Baqyt Ata about the kurgans', chip: 'Golden King', hint: 'He has been looking west all week', markers: [ELDER_MARK] },
  steps: [
    {
      id: 'clues',
      objective: 'Topple the balbal warriors at dusk · {n} / {of}',
      hint: 'The stones of the kurgan field wake when the sun goes down · each one carries a piece of the story',
      count: [...CLUE_FLAGS],
      done: { any: ['clue:3', 'dead:golden-king'] },
      markers: [{ id: 'field', label: 'KURGAN FIELD', short: 'KURGANS', at: world({ x: -106, z: 83 }) }],
    },
    {
      id: 'door',
      objective: 'Find the way into the great kurgan',
      hint: 'Its door faces west, toward the sky road',
      done: { any: ['entered:kurgan', 'dead:golden-king'] },
      markers: [{ id: 'door', label: 'GREAT KURGAN', short: 'THE KURGAN', at: world(GREAT_KURGAN_DOOR_XZ) }],
    },
    {
      id: 'king',
      objective: 'Defeat the Golden King',
      hint: 'Jump his sunburst · knock his plaques loose, then his chest takes arrows',
      done: { all: ['dead:golden-king'] },
      markers: [{ id: 'king', label: 'THE GOLDEN KING', short: 'THE KURGAN', at: world(GREAT_KURGAN_DOOR_XZ) }],
    },
    {
      id: 'home',
      objective: 'Bring a gold plaque home to Baqyt Ata',
      hint: 'The camp by the Kunes',
      done: { all: ['told:king'] },
      markers: [ELDER_MARK],
    },
  ],
  completeFlag: KING_DONE,
};

export const WIND_QUEST: QuestDef = {
  id: 'father-wind',
  title: 'Father of the Wind',
  startWhen: { all: [KING_DONE, 'talked:elder:3'] },
  intro: { objective: 'Baqyt Ata is watching the sky', chip: 'Father Wind', hint: 'The camp by the Kunes', markers: [ELDER_MARK] },
  steps: [
    {
      id: 'feathers',
      objective: 'Win three storm feathers from the great beasts · {n} / {of}',
      hint: 'Kokbori, Qyran, Aqbars, Qara Batyr — or break Argymaq · any three',
      count: [...FEATHER_FLAGS],
      done: { any: ['feather:3', 'dead:jel-ata'] },
      markers: FEATHER_ELITES.map((e) => ({ id: e.id, label: e.label, short: e.short, at: world(e.at), hideWhen: { all: [`felled:${e.id}`] } })),
    },
    {
      id: 'cairn',
      objective: 'Tie the feathers to the Wind Cairn in a storm',
      hint: 'Ride to the cairn on the south rim when the sky turns · tie the strip',
      done: { any: ['lit:cairn', 'dead:jel-ata'] },
      markers: [{ id: 'cairn', label: 'WIND CAIRN', short: 'THE CAIRN', at: world(CAIRN) }],
    },
    {
      id: 'titan',
      objective: 'Defeat Jel Ata, Father of the Wind',
      hint: 'Stay in the saddle · his heart shows when the lightning does',
      done: { all: ['dead:jel-ata'] },
      markers: [{ id: 'titan', label: 'JEL ATA', short: 'THE CAIRN', at: world(CAIRN) }],
    },
    {
      id: 'home',
      objective: 'Ride home to Baqyt Ata',
      hint: 'The camp by the Kunes',
      done: { all: ['told:wind'] },
      markers: [ELDER_MARK],
    },
  ],
  completeFlag: WIND_DONE,
};

/** the chapters in order (the chain) */
export const NALATI_QUESTS: QuestDef[] = [TULPAR_QUEST, KING_QUEST, WIND_QUEST];

/** flags the line reads that the runtime raises (events, polled stores, dialogue) — for validateQuest */
export const NALATI_QUEST_EXTERNAL = [
  'talked:elder', 'tamed:horse', 'tamed:argymaq', 'won:kokpar', 'told:tulpar',
  'talked:elder:2', ...CLUE_FLAGS, 'entered:kurgan', 'dead:golden-king', 'told:king',
  'talked:elder:3', ...FEATHER_FLAGS, ...FEATHER_ELITES.map((e) => `felled:${e.id}`), 'lit:cairn', 'dead:jel-ata', 'told:wind',
];

/** what each toppled balbal's carving says (chapter 2's clues, in order) */
export const CARVINGS: string[][] = [
  ['A rider with a sun for a face, and nine horses buried standing around him.', 'Under it, scratched later by a less patient hand: "DO NOT DIG HERE. WE MEAN IT."'],
  ['The sun-faced rider again, now on a throne of gold plates, a bow across his knees.', 'Around him, many small men with shovels. None of them look happy about it.'],
  ['A door in a hill, facing the setting sun. Above it the sun-faced rider, sleeping — one eye open.', 'The carving says the king wakes for anyone who knocks. It does not say he is pleased to.'],
];

// ── the camp's people ─────────────────────────────────────────────────────────────────────────────────────────────

export const ELDER: NpcDef = {
  id: 'elder',
  name: 'Baqyt Ata, the camp elder',
  dialogue: [
    { when: { all: [WIND_DONE] }, lines: [
      'Listen. Hear that? Nothing. No thunder over the bowl for three days. The herders are complaining about the quiet.',
      'Stay as long as you like, balam. There is always a place by this stove for the one who calmed the Father of the Wind.',
    ] },
    { when: { all: [KING_DONE, 'dead:jel-ata'], none: ['told:wind'] }, lines: [
      'You rode INTO the storm? On purpose? My grandmother would have tied you to the yurt pole for a week.',
      'Jel Ata is quiet. The rain will come gentle now, the way the grass likes it. The whole steppe owes you, and the steppe is bad at paying debts — so I will: sit, eat, and we sing tonight.',
    ], sets: ['talked:elder:3', 'told:wind'] },
    { when: { all: [KING_DONE, 'talked:elder:3'] }, lines: [
      'The storm feathers: Kokbori in her den, Qyran on Eagle Rock, the pale leopard in his cave, Qara Batyr at night by his cairn — or Argymaq, if he still lets you near. Any three.',
      'Then wait for the sky to turn, ride to the Wind Cairn on the south rim and tie them on. Jel Ata will come. He always comes when someone is rude to his cairn.',
    ] },
    { when: { all: [KING_DONE] }, lines: [
      'Gold in the kurgan, and a king who will not stay dead. And now the sky. Look south — see how the clouds lean over the rim?',
      'That is Jel Ata, Father of the Wind. He has been angry since before my grandfather\'s grandfather, and nobody remembers why. Possibly nobody asked.',
      'The old way: three storm feathers from the great beasts of the steppe, tied to the Wind Cairn in a storm. Then you ask him. Politely. With a sabre.',
    ], sets: ['talked:elder:3'] },
    { when: { all: [TULPAR_DONE, 'dead:golden-king'], none: ['told:king'] }, lines: [
      'Is that — show me. Gold. Real gold, from the great kurgan. And you are still breathing! Oybai, the king must be getting old.',
      'We will not keep it. The dead keep their gold; we keep the story. I will hang it on the ribbon pole for one night, so the camp can see, then it goes back to the steppe.',
    ], sets: ['talked:elder:2', 'told:king'] },
    { when: { all: [TULPAR_DONE, 'talked:elder:2'] }, lines: [
      'The balbals only wake at dusk. Topple them — gently, they are older than all of us — and read what is carved on their backs.',
      'Then find the great kurgan\'s door. It faces the setting sun. They always do, the show-offs.',
    ] },
    { when: { all: [TULPAR_DONE] }, lines: [
      'Now you sit a horse like a Kazakh and not like a sack of flour on a camel. Good.',
      'So. The kurgans on the bowl\'s west side. When the sun goes down the stone warriors on the mounds get up and walk. Every year the young men ride out to prove they are not afraid, and every year they ride back faster.',
      'In the great kurgan sleeps the Golden King. The balbals are his guard, and his story is carved on their backs. Topple three at dusk and read it — then you will know how to find his door.',
      'And if you meet him — bring me back a plaque. Not for the gold. For the proof. Nobody believes me about the king.',
    ], sets: ['talked:elder:2'] },
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
    { when: { all: ['dead:jel-ata'] }, lines: ['No storm for three days. My mother says it is you. My father says it is the season. They have not spoken since breakfast.'] },
    { when: { all: ['dead:golden-king'] }, lines: ['You went INTO the great kurgan. On purpose. And came out. I am telling everyone I taught you to ride.'] },
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
    { when: { all: [WIND_DONE] }, lines: ['Sit! You are the one who shouted at the sky and the sky listened. The sky never listens to me. Eat.'] },
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
