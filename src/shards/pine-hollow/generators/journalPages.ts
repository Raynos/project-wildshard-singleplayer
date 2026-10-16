/** Authored journal pages for the shared compendium. Matching, progress and saves remain on its existing host. */
export const JOURNAL_ANIMALS = [
  {
    "id": "red-deer",
    "kind": "species",
    "name": "Red Deer",
    "subtitle": "Cervus elaphus",
    "rarity": "common",
    "massKg": 110,
    "match": {
      "kind": "deer",
      "variants": [
        "hind",
        "stag",
        "big-stag"
      ]
    },
    "hint": "Hinds graze the Hollow at dawn.",
    "notes": "Grazes the Hollow in small herds. Heads up, freezes, then bolts: take the shot in the freeze. The great stags carry a rack like a hat stand.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/red-deer.webp",
      "model": {
        "id": "deer",
        "variant": "stag"
      }
    }
  },
  {
    "id": "white-deer",
    "kind": "variant",
    "name": "White Deer",
    "subtitle": "Leucistic red deer",
    "rarity": "uncommon",
    "massKg": 110,
    "match": {
      "kind": "deer",
      "variants": [
        "white-hind",
        "white-stag"
      ]
    },
    "hint": "Something pale moves among the hinds.",
    "notes": "Not an albino: the eyes are dark. Stands out in the pines like a lamp, and knows it. Rarely runs alone.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/white-deer.webp",
      "model": {
        "id": "deer",
        "variant": "white-stag"
      }
    }
  },
  {
    "id": "piebald",
    "kind": "variant",
    "name": "Piebald Hind",
    "subtitle": "Red deer, pied",
    "rarity": "rare",
    "massKg": 105,
    "match": {
      "kind": "deer",
      "variants": [
        "piebald"
      ]
    },
    "hint": "A patched coat, glimpsed once.",
    "notes": "White patches over the red, no two alike. The old hunters called her luck. The old hunters said a lot of things.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/piebald.webp",
      "model": {
        "id": "deer",
        "variant": "piebald"
      }
    }
  },
  {
    "id": "boar",
    "kind": "species",
    "name": "Wild Boar",
    "subtitle": "Sus scrofa",
    "rarity": "common",
    "massKg": 80,
    "match": {
      "kind": "boar",
      "variants": [
        "boar",
        "sow",
        "big"
      ]
    },
    "hint": "Rooted-up ground all over the Hollow.",
    "notes": "Roots, grunts, charges. Does not freeze like a deer: it comes at you. Step aside and put one behind the shoulder.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/boar.webp",
      "model": {
        "id": "boar",
        "variant": "boar"
      }
    }
  },
  {
    "id": "black-boar",
    "kind": "variant",
    "name": "Black Boar",
    "subtitle": "Sus scrofa, melanistic",
    "rarity": "uncommon",
    "massKg": 90,
    "match": {
      "kind": "boar",
      "variants": [
        "black"
      ]
    },
    "hint": "A dark shape in the undergrowth.",
    "notes": "Coal-black and long in the tusk. Hard to see at dusk, easy to hear.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/black-boar.webp",
      "model": {
        "id": "boar",
        "variant": "black"
      }
    }
  },
  {
    "id": "scarback",
    "kind": "variant",
    "name": "Scarback",
    "subtitle": "An old boar",
    "rarity": "rare",
    "massKg": 85,
    "match": {
      "kind": "boar",
      "variants": [
        "scarback"
      ]
    },
    "hint": "Bolts in the bark, none in the boar.",
    "notes": "Every scar on his back is somebody's story. Takes a lot of hitting and holds a grudge.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/scarback.webp",
      "model": {
        "id": "boar",
        "variant": "scarback"
      }
    }
  },
  {
    "id": "elk",
    "kind": "species",
    "name": "Elk",
    "subtitle": "Cervus canadensis",
    "rarity": "common",
    "massKg": 250,
    "match": {
      "kind": "elk",
      "variants": [
        "cow",
        "bull",
        "big-bull"
      ]
    },
    "hint": "A bugle from the old-growth at dusk.",
    "notes": "Moves as a herd: spook one, lose them all. Thick hide: body shots do less. The bulls bugle at dusk.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/elk.webp",
      "model": {
        "id": "elk",
        "variant": "bull"
      }
    }
  },
  {
    "id": "pale-elk",
    "kind": "variant",
    "name": "Pale Elk",
    "subtitle": "Cervus canadensis, pale",
    "rarity": "rare",
    "massKg": 250,
    "match": {
      "kind": "elk",
      "variants": [
        "pale"
      ]
    },
    "hint": "A cream-coloured cow in the herd.",
    "notes": "Cream from nose to tail. The herd keeps her in the middle.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/pale-elk.webp",
      "model": {
        "id": "elk",
        "variant": "pale"
      }
    }
  },
  {
    "id": "black-bear",
    "kind": "species",
    "name": "Black Bear",
    "subtitle": "Ursus americanus",
    "rarity": "common",
    "massKg": 60,
    "match": {
      "kind": "bear",
      "variants": [
        "black",
        "black-blaze"
      ]
    },
    "hint": "Claw marks on the pines near the Den.",
    "notes": "Lives in the Den. Curious, then cross. Do not run: it is faster than you and it enjoys it.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/black-bear.webp",
      "model": {
        "id": "bear",
        "variant": "black"
      }
    }
  },
  {
    "id": "brown-bear",
    "kind": "species",
    "name": "Brown Bear",
    "subtitle": "Ursus arctos",
    "rarity": "uncommon",
    "massKg": 60,
    "match": {
      "kind": "bear",
      "variants": [
        "brown"
      ]
    },
    "hint": "Tracks too big for a black bear.",
    "notes": "The shoulder hump is all muscle. Stands up to look at you, which is the polite part.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/brown-bear.webp",
      "model": {
        "id": "bear",
        "variant": "brown"
      }
    }
  },
  {
    "id": "grizzled-sow",
    "kind": "variant",
    "name": "Grizzled Sow",
    "subtitle": "An old brown bear",
    "rarity": "rare",
    "massKg": 60,
    "match": {
      "kind": "bear",
      "variants": [
        "brown-old"
      ]
    },
    "hint": "Silver hair snagged on the Den's rocks.",
    "notes": "Silver-tipped and the size of a woodshed. Has outlived three rangers. Aim for a fourth.",
    "tab": "beasts",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/grizzled-sow.webp",
      "model": {
        "id": "bear",
        "variant": "brown-old"
      }
    }
  },
  {
    "id": "ironhide",
    "kind": "elite",
    "name": "Old Ironhide",
    "subtitle": "Terror of the Hollow",
    "rarity": "legendary",
    "massKg": 80,
    "match": {
      "kind": "boar",
      "variants": [
        "ironhide"
      ]
    },
    "hint": "Snapped saplings, one tusk-mark deeper than the rest.",
    "notes": "A boar the size of a cart, a hide like a stove. Bolts bounce. He charges, and he does not stop charging.",
    "tab": "elites",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/ironhide.webp",
      "model": {
        "id": "boar",
        "variant": "ironhide"
      }
    }
  },
  {
    "id": "ghost-stag",
    "kind": "elite",
    "name": "The Ghost Stag",
    "subtitle": "The pale one",
    "rarity": "legendary",
    "massKg": 110,
    "match": {
      "kind": "deer",
      "variants": [
        "ghost"
      ]
    },
    "hint": "Hoofprints that end in the middle of the path.",
    "notes": "White as frost, there and gone. It fades, and it comes back behind you. Some say it leads somewhere.",
    "tab": "elites",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/ghost-stag.webp",
      "model": {
        "id": "deer",
        "variant": "ghost"
      }
    }
  },
  {
    "id": "blackpaw",
    "kind": "elite",
    "name": "Old Blackpaw",
    "subtitle": "The Den's landlord",
    "rarity": "legendary",
    "massKg": 60,
    "match": {
      "kind": "bear",
      "variants": [
        "black-old"
      ]
    },
    "hint": "One pawprint, bigger than the other three.",
    "notes": "Grey at the muzzle, one paw like a shovel. Roars you still, then comes out of the cave mouth.",
    "tab": "elites",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/blackpaw.webp",
      "model": {
        "id": "bear",
        "variant": "black-old"
      }
    }
  },
  {
    "id": "imperial-bull",
    "kind": "elite",
    "name": "The Imperial Bull",
    "subtitle": "Seven by seven",
    "rarity": "legendary",
    "massKg": 250,
    "match": {
      "kind": "elk",
      "variants": [
        "imperial"
      ]
    },
    "hint": "A bugle that shakes the needles off the pines.",
    "notes": "The biggest rack in the shard. At dusk his bugle calls rival bulls in, so you are never fighting just him.",
    "tab": "elites",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/imperial-bull.webp",
      "model": {
        "id": "elk",
        "variant": "imperial"
      }
    }
  },
  {
    "id": "antler-king",
    "kind": "boss",
    "name": "The Antler King",
    "subtitle": "The Bark Warden",
    "rarity": "legendary",
    "match": {
      "kind": "antler-king"
    },
    "hint": "Antlers of light walk the old-growth at night.",
    "notes": "Bark for a hide, a skull for a face, lanterns in its antlers. The Hollow's lanterns went dark the night it woke.",
    "tab": "elites",
    "plate": {
      "sketch": "/assets/pine-hollow/journal/antler-king.webp"
    }
  }
] as const;

/** Notes keyed by the layout POI id; positions continue to come from data/layout.ts. */
export const JOURNAL_PLACE_NOTES: Record<string, string> = {
  gate: 'Where the road from the valley comes in. Everyone\'s first page.',
  crossroads: 'Every path in the shard meets here. The signpost is mostly honest.',
  'cabin-1': 'The ranger\'s home, and the trophy wall. There is room on it.',
  'cabin-2': 'West of the crossroads, whatever the old maps say.',
  'cabin-3': 'At the ridge\'s foot on the way to the Den. Bear country from here on.',
  zipline: 'Where the line from the fire lookout comes down. Knees bent.',
  lookout: 'The whole Hollow from up here. The zipline is the fast way down.',
  pond: 'Still water under the ridge. There is an islet out there.',
  waterfall: 'The creek\'s head, spilling off the ridge into the pond.',
  islet: 'You can\'t walk here. Somebody left a canoe.',
  dam: 'Beavers hold the pond back. Take the dam out and see what drains.',
  bridge: 'The east road crosses the creek here.',
  den: 'A bowl of rock in the north-west corner. The bears\' part of town.',
  cave: 'Old Blackpaw\'s front door. Knock loudly. Or don\'t.',
  clearing: 'A ring of standing stones in the old-growth. The trees keep their distance.',
  hamlet: 'The mill, the lodge, the trader. The only neighbours for miles.',
  lodge: 'The hunting lodge: the contract board is by the door.',
  mill: 'The wheel turns on the creek. The miller has an errand, he always does.',
};

