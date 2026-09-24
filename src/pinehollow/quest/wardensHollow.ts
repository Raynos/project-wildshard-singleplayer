/**
 * *The Warden's Hollow* — Pine Hollow's lantern quest (PINE-HOLLOW-REMASTER PH-C1), and the hamlet's two other voices
 * (PH-C6): pure data on Driftwood's quest schema (src/game/quest/quest.ts), read through the shard's flags. No step has
 * code; the runtime (index.ts) raises the flags the table (table.ts) does not.
 *
 * THE BEATS (each is a `?quest=<beat>` dev jump, beats.ts):
 *   ranger  Hale at the Ranger's cabin: the three waystones went dark the night the fog came out of the old-growth
 *   pond    the POND lantern: its glass is in the beaver pool — heave the two logs off the dam's sluice, the pool drains
 *           through it, the glass washes out onto the gravel below the dam; carry it to the waystone on the W shore
 *   ridge   the RIDGE lantern: climb the fire lookout, take the fire-watcher's flint off the fire finder, light the
 *           waystone by the stair door …
 *   zip     … and ride the zipline back down to the Hollow
 *   den     the DEN lantern at the bear cave's mouth (Old Blackpaw's turf: he waits in the mouth)
 *   stag    follow the Ghost Stag after dark: a pale apparition leads you down the W road into the old-growth, fading
 *           ahead of you (Hale waits with you till nightfall if you ask him by day)
 *   king    the Antler King — HIS FIGHT STAYS OPEN-WORLD (antlerKing.ts: any night, in the clearing); the quest only
 *           counts his death (`dead:king`, raised on the kill whenever it happens)
 *   dawn    on his death (or the moment the quest reaches this beat after an early kill) the clock runs to dawn, every
 *           lantern on the shard is lit, the dawn sting plays, the reward: the caption, amber heartwood, the title
 */
import type { NpcDef, QuestDef } from '../../game/quest/quest';

export const QUEST_DONE = 'quest:warden-done';
/** the lanterns' flags (index.ts raises them at the waystone prompts; PineLandmarks.setLit follows them) */
export const LANTERN_FLAGS = ['lit:pond', 'lit:ridge', 'lit:den'] as const;
export type LanternId = 'pond' | 'ridge' | 'den';

/** the flags the quest reads that the runtime raises (the dialogue, the prompts, the ride, the stag, the kill, the dawn) */
export const QUEST_EXTERNAL = ['talked:ranger', ...LANTERN_FLAGS, 'used:ph-zip', 'followed:stag', 'dead:king', 'seen:dawn'];

const at = (x: number, z: number) => ({ poi: 'world' as const, x, z });

export const WARDENS_HOLLOW: QuestDef = {
  id: 'wardens-hollow',
  title: "The Warden's Hollow",
  startWhen: { all: ['talked:ranger'] },
  intro: {
    objective: "Find the ranger at his cabin in the Hollow",
    chip: 'Find the ranger',
    hint: 'Up the south road to the crossroads, then east',
    markers: [{ id: 'ranger', label: "RANGER'S CABIN", short: 'RANGER', at: at(-4, -38) }],
  },
  steps: [
    {
      id: 'pond', objective: 'Relight the pond lantern', chip: 'The pond lantern',
      hint: 'Its glass is in the beaver pool — drain the pool at the dam, then light the waystone on the W shore',
      done: { all: ['lit:pond'] },
      markers: [
        { id: 'dam', label: 'BEAVER DAM', short: 'BEAVER DAM', at: at(-138, 64), hideWhen: { all: ['taken:pond-glass'] } },
        { id: 'pond-lantern', label: 'POND LANTERN', short: 'POND LANTERN', at: at(-63, 104), hideWhen: { none: ['taken:pond-glass'] } },
      ],
    },
    {
      id: 'ridge', objective: 'Relight the ridge lantern', chip: 'The ridge lantern',
      hint: "Climb the fire lookout; the fire-watcher's flint is on the fire finder in the cab",
      done: { all: ['lit:ridge'] },
      markers: [{ id: 'lookout', label: 'FIRE LOOKOUT', short: 'FIRE LOOKOUT', at: at(36, 214) }],
    },
    {
      id: 'zip', objective: 'Ride the zipline back to the Hollow', chip: 'Ride the zipline',
      hint: 'The launch is off the lookout deck, on the Hollow side',
      done: { all: ['used:ph-zip'] },
      markers: [{ id: 'launch', label: 'ZIPLINE', short: 'ZIPLINE', at: at(35, 206) }],
    },
    {
      id: 'den', objective: 'Relight the den lantern', chip: 'The den lantern',
      hint: "At the bear cave's mouth, in the north-west. Old Blackpaw sleeps light",
      done: { all: ['lit:den'] },
      markers: [{ id: 'den', label: 'BEAR CAVE', short: 'BEAR CAVE', at: at(196, 196) }],
    },
    {
      id: 'stag', objective: 'Follow the Ghost Stag after dark', chip: 'Follow the stag',
      hint: 'It walks the west road at night — Hale will wait with you till dark',
      done: { all: ['followed:stag'] },
      markers: [{ id: 'stag', label: 'THE WEST ROAD', short: 'WEST ROAD', at: at(30, -2) }],
    },
    {
      id: 'king', objective: 'Face the Antler King', chip: 'The Antler King',
      hint: 'In the clearing of standing stones, at night',
      done: { all: ['dead:king'] },
      markers: [{ id: 'clearing', label: "KING'S CLEARING", short: 'THE CLEARING', at: at(150, -30) }],
    },
    {
      id: 'dawn', objective: 'Dawn over the Hollow', chip: 'Dawn',
      hint: 'Watch the east',
      done: { all: ['seen:dawn'] },
    },
  ],
  completeFlag: QUEST_DONE,
};

export const RANGER: NpcDef = {
  id: 'ranger',
  name: 'Hale, ranger of the Hollow',
  dialogue: [
    { when: { all: [QUEST_DONE] }, lines: [
      'Dawn, and every lantern burning. I have not seen the Hollow this quiet in thirty winters.',
      'The old Warden kept a bow for a night like that one. It is yours now. He would want it used, not hung on a wall.',
    ] },
    { when: { all: ['dead:king'] }, lines: ['It is over? Then watch the east. Dawn comes to the Hollow the way it used to.'] },
    { when: { all: ['followed:stag'] }, lines: [
      'The stag took you to the stones. He is there — only at night, and only if you stand inside the ring.',
      'Mind his antlers when they swing, and jump his roots. When the fog closes behind you, it will not open until one of you falls.',
    ] },
    { when: { all: [...LANTERN_FLAGS, 'used:ph-zip'] }, lines: [
      'Three lanterns. I watched them come up one by one from this porch.',
      'Now the pale stag will walk. Follow it after dark down the west road and it will take you to him.',
      'If you would rather not wait for the dark on your own, sit a while. I will keep watch with you.',
    ], sets: ['wait:night'] },
    { when: { all: ['lit:pond', 'lit:ridge', 'used:ph-zip'] }, lines: [
      'You came down the line — I heard you from here. The last lantern is at the bear cave, in the north-west corner.',
      'Old Blackpaw sleeps in the mouth of it. He sleeps light.',
    ] },
    { when: { all: ['lit:pond', 'lit:ridge'] }, lines: ['The ridge lantern is burning. Now take the line down off the deck — it is faster than the trail, and louder.'] },
    { when: { all: ['lit:pond'] }, lines: [
      'The pond is lit. Next, the ridge: climb the fire lookout on the pass.',
      'The fire-watcher kept her flint on the fire finder in the cab. Light the waystone at the foot of the stair, then take the zipline home.',
    ] },
    { when: { all: ['talked:ranger'] }, lines: [
      'The pond lantern\'s glass went into the beaver pool behind the dam, north-east of here.',
      'Heave the two logs off the dam\'s sluice and the pool will drain through it. The glass will wash out below.',
    ] },
    { lines: [
      'Easy. You are not one of them. Good. Not many come up the south road any more.',
      'I am Hale. I keep the lanterns in the Hollow. Kept. Three waystones: the pond, the ridge, the den. They went dark the night the fog came up out of the old-growth.',
      'Since then something walks the big trees after dark. Antlers of light. The elk and the boar that wander in there come out wrong: moss on them, glass for eyes.',
      'Light the lanterns again and we will see what is what. Start at the pond. Its glass is in the beaver pool, under the dam.',
    ], sets: ['talked:ranger'] },
  ],
};

export const MILLER: NpcDef = {
  id: 'miller',
  name: 'Brandt, the miller',
  dialogue: [
    { when: { all: ['errand:thanked'] }, lines: ['Hear that? The wheel is singing. Come by for bread when the fog lifts for good.'] },
    { when: { all: ['errand:done'] }, lines: [
      'You cleared the race. The wheel turned the moment the last of them went down. First time since the fog.',
      'The lodge pays in ribbons and I have a drawer full of them. Take these, and the resin I scraped off the sluice boards.',
    ], sets: ['errand:thanked'] },
    { when: { all: ['errand:asked'] }, lines: [
      'They come up the millrace after dark and stand in the water, like they are listening for something.',
      'The wheel will not turn with them in it. Clear the race after nightfall and it will.',
    ] },
    { lines: [
      'You carry a bow. Good. Something has jammed my wheel, and it is not a branch.',
      'It is them. The mossy ones. They stand in the millrace at night and the wheel will not turn with them in it.',
      'Clear the race after dark, would you? I will make it worth the walk.',
    ], sets: ['errand:asked'] },
  ],
};

export const TRADER: NpcDef = {
  id: 'trader',
  name: 'Mott, the trader',
  dialogue: [
    { when: { all: ['talked:trader'] }, lines: ['Hides, horn, resin. Let us see what you have.'] },
    { lines: [
      'No coin, no credit, no questions. I swap. Hides, horn, the amber the old pines weep: I take it all.',
      'Bolts for your bow, and a finish or two for the particular. Let us see what you have.',
    ], sets: ['talked:trader'] },
  ],
};

/** the miller's errand: its flags (the runtime raises `errand:done` when the millrace thralls are down) */
export const ERRAND_EXTERNAL = ['errand:asked', 'errand:done', 'errand:thanked', 'talked:trader', 'wait:night'];
