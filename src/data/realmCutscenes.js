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
        bgImage: '/storyboard-tof-complete.jpg',
        text: "Ana defeats the Cullen clan in a battle of wits! But Carlisle is furious \u2014 he won't let her leave without a chase. Run, Ana! Run!",
        textColor: '#ff3333',
      },
    ],
  },

  'The Domain Dungeon': {
    intro: [
      {
        bgImage: '/storyboard-dungeon-intro.jpg',
        text: "Deep beneath the surface, far from the sunlit shores of the Ocean of Effort, lies a gothic fortress of stone, steel, and suffocating contracts. Welcome to the Domain Dungeons.",
        textColor: '#9b59b6',
      },
      {
        bgImage: '/storyboard-dungeon-intro.jpg',
        text: "A demonic syndicate known as SLICE has ruled these cavernous halls. They are parasites of the digital age, preying on independent restaurants \u2014 capturing digital storefronts and hoarding customer data behind predatory terms of service.",
        textColor: '#ff3333',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-dungeon-complete.jpg',
        text: "With her domain in hand, freed from the evil clutches of SLICE, Ana at last sees the light and feels the warm embrace of the sun. She's filled with hope as she looks out at the vast body of water \u2014 The Payment Line.",
        textColor: '#ffd700',
      },
    ],
  },

  'The Stripe Sanctuary': {
    intro: [
      {
        bgImage: '/storyboard-payment-intro.jpg',
        text: "\"Wealth. Fame. Zero-Percent Interchange Fees.\" The King of Fintech left his treasure at the end of the Payment Line. Ana stands at the shore \u2014 the seas swarm with Chargeback Pirates and PCI Marines. She boards the Going Margin and sets sail!",
        textColor: '#ffd700',
      },
      {
        bgImage: '/storyboard-payment-comic.jpg',
        text: "The Chargeback Pirates sail under the black flag of Friendly Fraud \u2014 villains who devour a three-course meal and instantly file a dispute! Ana must awaken her Encryption Haki to find the legendary One Pie: the perfect payment processor!",
        textColor: '#2d70ff',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-payment-complete.jpg',
        text: "Against all odds, Ana navigates the treacherous Payment Line! The Chargeback Pirates are defeated, the PCI Marines appeased. With seamless payment processing secured, the Land of Sales Growth awaits on the horizon!",
        textColor: '#ffd700',
      },
    ],
  },

  'The Integration Isles': {
    intro: [
      {
        bgImage: '/storyboard-integration-intro.jpg',
        text: "Ana sets foot on the glitching, pixelated sands of Integration Island \u2014 the grand API nexus where platforms like Owner shake hands with POS systems. But a massive data-collision rips open a time-vortex and hurls Ana into the year 6767!",
        textColor: '#39ff14',
      },
      {
        bgImage: '/storyboard-integration-comic.jpg',
        text: "Attacked by robots screaming about integrations, Ana is rescued by a mysterious hero. To return to her timeline, she must unlock the Integration Chip by proving her knowledge of the digital connections that bind the restaurant world together.",
        textColor: '#2d70ff',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-integration-complete.jpg',
        text: "The wires connect, electricity surges through the chip, and the time-vortex stabilizes! Ana is pulled back through the portal, landing in the desolate Ashlands of Page Two. A massive volcano looms ahead...",
        textColor: '#ffd700',
      },
    ],
  },

  'Visibility Volcano': {
    intro: [
      {
        bgImage: '/storyboard-volcano-intro.jpg',
        text: "The air is thick with ash and the smell of burned ad budgets. Ana has arrived in the Ashlands of Page Two \u2014 a dark realm where great restaurants go to be entirely forgotten. Looming over this shadow realm is the Visibility Volcano.",
        textColor: '#ff8c00',
      },
      {
        bgImage: '/storyboard-volcano-approach.jpg',
        text: "Legend says any merchant who braves the ascent and casts their wish into the summit fires will be granted Ultimate Visibility \u2014 the mythical #1 spot on Google! Ana clutches the Stone of Impressions and begins the treacherous climb.",
        textColor: '#ff3333',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-volcano-complete.jpg',
        text: "As the final SEO secret echoed into the fiery depths, the great Eye of the Algorithm blinked. The dark ash clouds shattered, replaced by a blinding beam of pure organic traffic shooting into the sky. Ana's domain authority surged, locking firmly into the mythical #1 spot on Google. The Visibility Volcano had been conquered!",
        textColor: '#ffd700',
      },
    ],
  },

  'Conversion Cliffs': {
    intro: [
      {
        bgImage: '/storyboard-cliffs-intro.jpg',
        text: "Ana emerges onto the legendary Conversion Cliffs \u2014 a breathtaking precipice above a glowing river of pure digital traffic. Millions of potential customers wander below, but visibility is only half the battle. She must convert them into paying customers!",
        textColor: '#ffd700',
      },
      {
        bgImage: '/storyboard-cliffs-comic.jpg',
        text: "Getting a million people to look means nothing if they just scroll past. Ana must build a bridge of irresistible UX, mouth-watering menu design, and frictionless checkout to guide the hungry masses across the chasm!",
        textColor: '#39ff14',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-cliffs-complete.jpg',
        text: "Ana steps off Charon's airship onto the gold-paved pathways. The swirling abyss of bounced traffic fades behind her. Her visitors are now hungry, paying customers clicking \"Order Now\" \u2014 the sales funnel is officially optimized!",
        textColor: '#ffd700',
      },
    ],
  },

  'Repeat Order Railway': {
    intro: [
      {
        bgImage: '/storyboard-railway-intro.jpg',
        text: "The thunderous blast of a steam engine echoes across the digital frontier! Ana has arrived at the Repeat Order Railway. That first order was huge, but a true empire is built on retention \u2014 turning casual diners into hardcore fanatics.",
        textColor: '#ff8c00',
      },
      {
        bgImage: '/storyboard-railway-comic.jpg',
        text: "The platform is packed with locals waving \"I Love AREPAS\" signs. SMS campaigns, gift cards, and loyalty points fill the boxcars. Ana tips her hat and clutches her loyalty metrics \u2014 it's time to ride!",
        textColor: '#ffd700',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-railway-complete.jpg',
        text: "The Ticket Master pinned a shining Deputy Sheriff star to Ana's vest. The Repeat Orders Express roared to life! Her retention engine is unstoppable \u2014 these aren't just guests anymore, they're lifelong fanatics riding the golden train of loyalty!",
        textColor: '#ffd700',
      },
    ],
  },

  'Delivery Drive': {
    intro: [
      {
        bgImage: '/storyboard-delivery-intro.jpg',
        text: "Ana hitches a ride on a sleek delivery truck cruising the Last Mile Expressway. Owner handles the entire delivery ecosystem \u2014 driver networks, real-time tracking, and seamless handoffs. Her only job now is to focus on making perfect arepas!",
        textColor: '#2d70ff',
      },
    ],
  },

  'Hardware Hive': {
    intro: [
      {
        bgImage: '/storyboard-hive-intro.jpg',
        text: "Ana arrives at the formidable golden hexagonal gates of the Hardware Hive \u2014 a colossal warehouse buzzing with corporate bees in business suits. She needs tablets, printers, and integrated solutions to bring her operational vision to life.",
        textColor: '#ffd700',
      },
      {
        bgImage: '/storyboard-hive-comic.jpg',
        text: "At Owner Operations Bay 7, the hive's industrious workers carry out their technical duties with precision. Ana checks her verification screen \u2014 this is where she acquires the essential hardware for her restaurant empire!",
        textColor: '#39ff14',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-hive-complete.jpg',
        text: "With hardware in hand, Ana has one final feat to finish. The short trek up Miscellaneous Mountain \u2014 the last stop on the way to the fertile valley of Sales Growth. She couldn't help but feel like a completely different person with everything she had learned.",
        textColor: '#ffd700',
      },
    ],
  },

  'Miscellaneous Mountain': {
    intro: [
      {
        bgImage: '/storyboard-misc-intro.jpg',
        text: "The final stretch! Miscellaneous Mountain rises before Ana \u2014 the last obstacle between her and the Land of Sales Growth. She takes a deep breath. The woman who set out on this journey is a completely different person now. She's ready.",
        textColor: '#ff8c00',
      },
    ],
    completion: [
      {
        bgImage: '/storyboard-misc-complete.jpg',
        text: "Ana had crossed many lands, battled pure evil, put her wisdom to the test, leaned on the Owner fellowship, and finally made it to the Land of Sales Growth. Her restaurant empire is complete!",
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
