/**
 * Realm cutscenes that play at realm transitions.
 *
 * Each realm can have:
 *   - completion: slides that play after finishing that realm's questions (before mini-game)
 *   - intro: slides that play when entering that realm (after previous mini-game)
 *
 * Key: the realm name.
 * Value: object with optional `intro` and `completion` arrays of slide objects.
 */
const REALM_CUTSCENES = {
  'Top of Funnel Forest': {
    // completionBeforeMiniGame: cutscene plays BEFORE the mini-game (sets up the chase)
    completionBeforeMiniGame: true,
    completion: [
      {
        bgImage: '/storyboard-tof-complete.png',
        text: "Ana defeats the Cullen clan in a battle of wits! But Carlisle is furious \u2014 he won't let her leave without a chase. Run, Ana! Run!",
        textColor: '#ff3333',
      },
    ],
  },

  'The Domain Dungeon': {
    intro: [
      {
        bgImage: '/storyboard-dungeon-intro.png',
        text: "Deep beneath the surface, far from the sunlit shores of the Ocean of Effort, lies a gothic fortress of stone, steel, and suffocating contracts. Welcome to the Domain Dungeons.",
        textColor: '#9b59b6',
      },
      {
        bgImage: '/storyboard-dungeon-intro.png',
        text: "A demonic syndicate known as SLICE has ruled these cavernous halls. They are parasites of the digital age, preying on independent restaurants \u2014 capturing digital storefronts and hoarding customer data behind predatory terms of service.",
        textColor: '#ff3333',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-dungeon-complete.png',
        text: "With her domain in hand, freed from the evil clutches of SLICE, Ana at last sees the light and feels the warm embrace of the sun. She's filled with hope as she looks out at the vast body of water \u2014 The Payment Line.",
        textColor: '#ffd700',
      },
    ],
  },

  'The Stripe Sanctuary': {
    intro: [
      {
        bgImage: '/storyboard-payment-intro.png',
        text: "\"Wealth. Fame. Zero-Percent Interchange Fees.\" The King of Fintech left his treasure at the end of the Payment Line. Ana stands at the shore \u2014 the seas swarm with Chargeback Pirates and PCI Marines. She boards the Going Margin and sets sail!",
        textColor: '#ffd700',
      },
      {
        bgImage: '/storyboard-payment-comic.png',
        text: "The Chargeback Pirates sail under the black flag of Friendly Fraud \u2014 villains who devour a three-course meal and instantly file a dispute! Ana must awaken her Encryption Haki to find the legendary One Pie: the perfect payment processor!",
        textColor: '#2d70ff',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-payment-complete.png',
        text: "Against all odds, Ana navigates the treacherous Payment Line! The Chargeback Pirates are defeated, the PCI Marines appeased. With seamless payment processing secured, the Land of Sales Growth awaits on the horizon!",
        textColor: '#ffd700',
      },
    ],
  },

  'The Integration Isles': {
    intro: [
      {
        bgImage: '/storyboard-integration-intro.png',
        text: "Ana sets foot on the glitching, pixelated sands of Integration Island \u2014 the grand API nexus where platforms like Owner shake hands with POS systems. But a massive data-collision rips open a time-vortex and hurls Ana into the year 6767!",
        textColor: '#39ff14',
      },
      {
        bgImage: '/storyboard-integration-comic.png',
        text: "Attacked by robots screaming about integrations, Ana is rescued by a mysterious hero. To return to her timeline, she must unlock the Integration Chip by proving her knowledge of the digital connections that bind the restaurant world together.",
        textColor: '#2d70ff',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-integration-complete.png',
        text: "The wires connect, electricity surges through the chip, and the time-vortex stabilizes! Ana is pulled back through the portal, landing in the desolate Ashlands of Page Two. A massive volcano looms ahead...",
        textColor: '#ffd700',
      },
    ],
  },

  'Visibility Volcano': {
    intro: [
      {
        bgImage: '/storyboard-volcano-intro.png',
        text: "The air is thick with ash and the smell of burned ad budgets. Ana has arrived in the Ashlands of Page Two \u2014 a dark realm where great restaurants go to be entirely forgotten. Looming over this shadow realm is the Visibility Volcano.",
        textColor: '#ff8c00',
      },
      {
        bgImage: '/storyboard-volcano-approach.png',
        text: "Legend says any merchant who braves the ascent and casts their wish into the summit fires will be granted Ultimate Visibility \u2014 the mythical #1 spot on Google! Ana clutches the Stone of Impressions and begins the treacherous climb.",
        textColor: '#ff3333',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-volcano-complete.png',
        text: "As the final SEO secret echoed into the fiery depths, the great Eye of the Algorithm blinked. The dark ash clouds shattered, replaced by a blinding beam of pure organic traffic shooting into the sky. Ana's domain authority surged, locking firmly into the mythical #1 spot on Google. The Visibility Volcano had been conquered!",
        textColor: '#ffd700',
      },
    ],
  },
}

export function getRealmCutscene(realmName, type) {
  const realm = REALM_CUTSCENES[realmName]
  if (!realm) return null
  return realm[type] || null
}

export function isCompletionBeforeMiniGame(realmName) {
  const realm = REALM_CUTSCENES[realmName]
  return realm?.completionBeforeMiniGame === true
}
