import { useMemo } from 'react'
import './ScenePanel.css'

const REALM_CONFIGS = {
  'Top of Funnel Forest': {
    sceneClass: 'scene-forest',
    particles: 'fireflies',
    npcClass: 'npc-sage',
    bgImage: '/storyboard-tof-scene.png',
  },
  'The Domain Dungeon': {
    sceneClass: 'scene-dungeon',
    particles: 'torchsparks',
    npcClass: 'npc-urlkeeper',
    bgImage: '/storyboard-dungeon-scene.png',
  },
  'The Stripe Sanctuary': {
    sceneClass: 'scene-sanctuary',
    particles: 'coins',
    npcClass: 'npc-coinmaster',
    bgImage: '/storyboard-payment-scene.png',
  },
  'The Integration Isles': {
    sceneClass: 'scene-isles',
    particles: 'clouds',
    npcClass: 'npc-connector',
  },
  'The SEO Summit': {
    sceneClass: 'scene-summit',
    particles: 'stars',
    npcClass: 'npc-oracle',
  },
  'The Marketing Marketplace': {
    sceneClass: 'scene-marketplace',
    particles: 'lanterns',
    npcClass: 'npc-crier',
  },
  'The Delivery Desert': {
    sceneClass: 'scene-desert',
    particles: 'sand',
    npcClass: 'npc-courier',
  },
  'The Menu Mountains': {
    sceneClass: 'scene-mountains',
    particles: 'steam',
    npcClass: 'npc-recipemaster',
  },
  'The Website Wilds': {
    sceneClass: 'scene-wilds',
    particles: 'data',
    npcClass: 'npc-webweaver',
  },
  'The OLO Outpost': {
    sceneClass: 'scene-hardware',
    particles: 'data',
    npcClass: 'npc-techsmith',
  },
  'The Hardware Haven': {
    sceneClass: 'scene-hardware',
    particles: 'data',
    npcClass: 'npc-techsmith',
  },
  'The Loyalty Labyrinth': {
    sceneClass: 'scene-labyrinth',
    particles: 'sparkles',
    npcClass: 'npc-merchant',
  },
  'The Cave of Miscellany': {
    sceneClass: 'scene-cave',
    particles: 'crystals',
    npcClass: 'npc-eva',
  },
}

function Particles({ type }) {
  const count = type === 'stars' ? 20 : 10
  return (
    <div className="scene-particles">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`particle particle-${type}`}
          style={{
            '--i': i,
            '--x': `${5 + (i * 97 / count) % 95}%`,
            '--delay': `${(i * 0.4) % 3}s`,
            '--duration': `${2 + (i % 3)}s`,
            '--size': `${3 + (i % 4)}px`,
          }}
        />
      ))}
    </div>
  )
}

function NpcCharacter({ npcClass }) {
  return <div className={`character character-npc ${npcClass}`} />
}

function ScenePanel({ realm, npc }) {
  const config = useMemo(() =>
    REALM_CONFIGS[realm] || REALM_CONFIGS['Top of Funnel Forest'],
    [realm]
  )

  return (
    <div className={`scene-panel ${config.sceneClass} ${config.bgImage ? 'scene-has-bg' : ''}`} key={realm}>
      {config.bgImage ? (
        <>
          <img src={config.bgImage} alt="" className="scene-bg-image" />
          <div className="scene-vignette" />
        </>
      ) : (
        <>
          {/* Background layers */}
          <div className="scene-bg-far" />
          <div className="scene-bg-mid" />
          <div className="scene-bg-near" />
          <div className="scene-ground" />

          {/* Particles */}
          <Particles type={config.particles} />

          {/* Characters */}
          <div className="scene-characters">
            <img
              src="/ana-avatar.png"
              alt="Ana de Arepas"
              className="scene-ana-avatar"
              style={{ imageRendering: 'pixelated' }}
            />
            <NpcCharacter npcClass={config.npcClass} />
          </div>

          {/* Dialogue indicator */}
          <div className="scene-speech-indicator">
            <span className="speech-dot" />
            <span className="speech-dot" />
            <span className="speech-dot" />
          </div>

          {/* Vignette overlay */}
          <div className="scene-vignette" />
        </>
      )}

      {/* Realm label */}
      <div className="scene-realm-label">{realm}</div>
    </div>
  )
}

export default ScenePanel
