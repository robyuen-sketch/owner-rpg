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
