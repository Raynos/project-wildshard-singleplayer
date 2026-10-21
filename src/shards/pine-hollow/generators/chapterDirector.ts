import PINE_SKY from '../data/sky.json' with { type: 'json' };
import { parseChapterDirector, type ChapterDirectorRows } from '@wildshard/format/chapterDirector';
import native from '../data/nativeStory.json' with { type: 'json' };
import bindings from '../data/directorBindings.json' with { type: 'json' };

/** The director publishes closed chapter effects; the existing sky owns phase keys. */
export const CHAPTER_DIRECTOR = parseChapterDirector({
  "version": 1,
  "quest": "wardens-hollow",
  "caption": {
    "kicker": "Dawn over the Hollow",
    "title": "The Warden's Hollow",
    "subtitle": "Every lantern burns. The fog is going home."
  },
  "observations": {
    "night-request": 0,
    "dawn-request": 0,
    "seen": {
      "flag": "seen:dawn"
    },
    "has-clock": {
      "read": "day-present"
    },
    "night": {
      "read": "night"
    }
  },
  "actions": {
    "night.consume": [
      {
        "kind": "flag",
        "flag": "wait:night",
        "value": false
      }
    ],
    "night.start": [
      {
        "kind": "toast",
        "text": "You sit with Hale on the porch while the light goes out of the Hollow…"
      },
      {
        "kind": "phase",
        "to": PINE_SKY.phases.night,
        "seconds": 6
      }
    ],
    "dawn.start": [
      {
        "kind": "toast",
        "text": "The Antler King falls. In the east, the sky is going grey"
      }
    ],
    "dawn.sunrise": [
      {
        "kind": "phase",
        "to": PINE_SKY.phases.sunrise + 0.012,
        "seconds": 7
      }
    ],
    "dawn.lanterns": [
      {
        "kind": "flag",
        "flag": "lit:pond"
      },
      {
        "kind": "flag",
        "flag": "lit:ridge"
      },
      {
        "kind": "flag",
        "flag": "lit:den"
      },
      {
        "kind": "sting",
        "name": "dawn"
      }
    ],
    "dawn.caption": [
      {
        "kind": "caption",
        "show": true
      },
      {
        "kind": "objective",
        "hide": true
      }
    ],
    "dawn.finish": [
      {
        "kind": "caption",
        "show": false
      },
      {
        "kind": "objective",
        "hide": false
      },
      {
        "kind": "item",
        "item": "amber-resin",
        "count": 4
      },
      {
        "kind": "toast",
        "text": "Hale's thanks · 4 amber resin — and the Warden's bow is yours to keep"
      },
      {
        "kind": "flag",
        "flag": "seen:dawn"
      }
    ],
    "debug.night": [
      {
        "kind": "phase",
        "to": PINE_SKY.phases.night,
        "seconds": 2
      }
    ]
  },
  "source": "matching",
  "initialDt": 0.016666666666666666,
  "changes": [],
  "requests": [
    {
      "step": "dawn",
      "request": "dawn.request"
    },
    {
      "flag": "wait:night",
      "request": "night.request"
    }
  ]
});

/** Preserve the original renderer-free projection, including its quiet
 * presentation-only events, using the same closed chapter contract. */
export const NATIVE_CHAPTER_DIRECTOR = parseChapterDirector({ ...CHAPTER_DIRECTOR,
  actions: Object.fromEntries(Object.entries(bindings.actions).map(([event, calls]) => {
    const effects: ChapterDirectorRows['actions'][string] = [];
    for (const publication of native.clock.publications) if (publication.event === event) {
      if (publication.kind === 'phase' && 'to' in publication) {
        const call = calls.find(row => row.args[0] === event), seconds = call?.args[1];
        if (typeof seconds !== 'number') throw new Error('Missing original native phase duration');
        effects.push({ kind: 'phase', to: publication.to, seconds });
      } else if (publication.kind === 'flags' && 'flags' in publication) {
        for (const flag of publication.flags) effects.push({ kind: 'flag', flag });
      } else if ('flag' in publication) effects.push({ kind: 'flag', flag: publication.flag, ...(publication.kind === 'clear' ? { value: false } : {}) });
    }
    return [event, effects];
  })),
});
