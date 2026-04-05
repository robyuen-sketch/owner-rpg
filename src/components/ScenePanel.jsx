import { useMemo } from 'react'
import './ScenePanel.css'

const REALM_CONFIGS = {
  'Top of Funnel Forest': {
    sceneClass: 'scene-forest',
    particles: 'fireflies',
    npcClass: 'npc-sage',
    bgImage: '/storyboard-tof-scene.jpg',
  },
  'The Domain Dungeon': {
    sceneClass: 'scene-dungeon',
    particles: 'torchsparks',
    npcClass: 'npc-urlkeeper',
    bgImage: '/storyboard-dungeon-scene.jpg',
  },
  'The Stripe Sanctuary': {
    sceneClass: 'scene-sanctuary',
    particles: 'coins',
    npcClass: 'npc-coinmaster',
    bgImage: '/storyboard-payment-scene.jpg',
  },
  'The Integration Isles': {
    sceneClass: 'scene-isles',
    particles: 'clouds',
    npcClass: 'npc-connector',
    bgImage: '/storyboard-integration-scene.jpg',
  },
  'Visibility Volcano': {
    sceneClass: 'scene-summit',
    particles: 'stars',
    npcClass: 'npc-oracle',
    bgImage: '/storyboard-volcano-scene.jpg',
  },
  'Conversion Cliffs': {
    sceneClass: 'scene-mountains',
    particles: 'steam',
    npcClass: 'npc-recipemaster',
    bgImage: '/storyboard-cliffs-scene.jpg',
  },
  'Repeat Order Railway': {
    sceneClass: 'scene-marketplace',
    particles: 'lanterns',
    npcClass: 'npc-crier',
    bgImage: '/storyboard-railway-scene.jpg',
  },
  'Delivery Drive': {
    sceneClass: 'scene-desert',
    particles: 'sand',
    npcClass: 'npc-courier',
    bgImage: '/storyboard-delivery-scene.jpg',
  },
  'Hardware Hive': {
    sceneClass: 'scene-hardware',
    particles: 'data',
    npcClass: 'npc-techsmith',
    bgImage: '/storyboard-hive-scene.jpg',
  },
  'Miscellaneous Mountain': {
    sceneClass: 'scene-cave',
    particles: 'crystals',
    npcClass: 'npc-eva',
    bgImage: '/storyboard-misc-scene.jpg',
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
