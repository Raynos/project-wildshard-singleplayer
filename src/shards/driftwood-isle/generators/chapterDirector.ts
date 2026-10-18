import { NATIVE_VIEW } from './nativeView';
import { parseChapterDirector } from '@wildshard/format/chapterDirector';

/** Same baked reward pose as the native keeper; stage decisions remain in its director. */
export const CHAPTER_DIRECTOR = parseChapterDirector({
  "version": 1,
  "quest": "sealed-ring",
  "caption": {
    "kicker": "The Sealed Ring · opened",
    "title": "Driftwood Isle",
    "subtitle": "The planet in the ring, at golden hour"
  },
  "reward": NATIVE_VIEW.FINALE_REWARD,
  "observations": {
    "altar": {
      "flag": "used:altar"
    },
    "dead": {
      "flag": "dead:captain"
    },
    "seen": {
      "flag": "seen:reward"
    },
    "player-x": {
      "read": "player-x"
    },
    "player-z": {
      "read": "player-z"
    },
    "reward-x": {
      "read": "reward-x"
    },
    "reward-z": {
      "read": "reward-z"
    }
  },
  "actions": {
    "captain.restore": [
      {
        "kind": "cue",
        "id": "captain.restore"
      }
    ],
    "captain.wake": [
      {
        "kind": "cue",
        "id": "captain.wake"
      }
    ],
    "captain.dead": [
      {
        "kind": "cue",
        "id": "captain.dead"
      }
    ],
    "reward.start": [
      {
        "kind": "reward",
        "state": "started"
      }
    ],
    "reward.finish": [
      {
        "kind": "reward",
        "state": "completed"
      },
      {
        "kind": "flag",
        "flag": "seen:reward"
      }
    ]
  },
  "source": "optional",
  "initialDt": 0,
  "changes": [
    "used:altar",
    "dead:captain"
  ],
  "requests": []
});
