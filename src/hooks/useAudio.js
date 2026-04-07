// Procedural 8-bit audio engine using Web Audio API
// All sounds are synthesized — no external files needed

let audioCtx = null
let masterGain = null
let bgmGain = null
let sfxGain = null
let currentBgm = null
let _muted = false

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = audioCtx.createGain()
    masterGain.gain.value = 0.4
    masterGain.connect(audioCtx.destination)

    bgmGain = audioCtx.createGain()
    bgmGain.gain.value = 0.25
    bgmGain.connect(masterGain)

    sfxGain = audioCtx.createGain()
    sfxGain.gain.value = 0.5
    sfxGain.connect(masterGain)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

// ── Utility helpers ──

function playNote(freq, duration, type = 'square', gainNode = sfxGain, volume = 0.3) {
  const ctx = getCtx()
  if (_muted) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(volume, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  osc.connect(g)
  g.connect(gainNode)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + duration)
}

function playNoise(duration, gainNode = sfxGain, volume = 0.15) {
  const ctx = getCtx()
  if (_muted) return
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const g = ctx.createGain()
  g.gain.setValueAtTime(volume, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  src.connect(g)
  g.connect(gainNode)
  src.start()
}

function scheduleNote(freq, startTime, duration, type = 'square', gainNode = bgmGain, volume = 0.2) {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(volume, startTime)
  g.gain.setValueAtTime(volume, startTime + duration * 0.8)
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.connect(g)
  g.connect(gainNode)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)
  return osc
}

// ── Sound Effects ──

const SFX = {
  correct() {
    // Ascending happy arpeggio
    const ctx = getCtx()
    const t = ctx.currentTime
    const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.25, t + i * 0.08)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.2)
      osc.connect(g)
      g.connect(sfxGain)
      osc.start(t + i * 0.08)
      osc.stop(t + i * 0.08 + 0.25)
    })
  },

  wrong() {
    // Descending buzzy tone
    const ctx = getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.3)
    g.gain.setValueAtTime(0.2, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.connect(g)
    g.connect(sfxGain)
    osc.start(t)
    osc.stop(t + 0.45)
    playNoise(0.15, sfxGain, 0.1)
  },

  gemCollect() {
    // Sparkling upward sweep
    const ctx = getCtx()
    const t = ctx.currentTime
    ;[784, 988, 1175, 1568].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.3, t + i * 0.06)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.15)
      osc.connect(g)
      g.connect(sfxGain)
      osc.start(t + i * 0.06)
      osc.stop(t + i * 0.06 + 0.2)
    })
  },

  damage() {
    // Hit impact
    playNoise(0.12, sfxGain, 0.25)
    playNote(120, 0.2, 'square', sfxGain, 0.2)
  },

  gameOver() {
    // Sad descending melody
    const ctx = getCtx()
    const t = ctx.currentTime
    const notes = [392, 349, 330, 262, 196] // G4 F4 E4 C4 G3
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.25, t + i * 0.25)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.3)
      osc.connect(g)
      g.connect(sfxGain)
      osc.start(t + i * 0.25)
      osc.stop(t + i * 0.25 + 0.35)
    })
  },

  victory() {
    // Triumphant fanfare
    const ctx = getCtx()
    const t = ctx.currentTime
    const melody = [
      [523, 0.15], [523, 0.15], [523, 0.15], [698, 0.4],
      [659, 0.15], [698, 0.15], [784, 0.5],
    ]
    let offset = 0
    melody.forEach(([f, d]) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.2, t + offset)
      g.gain.setValueAtTime(0.2, t + offset + d * 0.7)
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + d)
      osc.connect(g)
      g.connect(sfxGain)
      osc.start(t + offset)
      osc.stop(t + offset + d + 0.01)
      offset += d
    })
  },

  jump() {
    // Quick upward sweep
    const ctx = getCtx()
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(200, t)
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.12)
    g.gain.setValueAtTime(0.2, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.connect(g)
    g.connect(sfxGain)
    osc.start(t)
    osc.stop(t + 0.18)
  },

  hit() {
    // Enemy hit / whip crack
    playNoise(0.08, sfxGain, 0.2)
    playNote(600, 0.08, 'square', sfxGain, 0.15)
  },

  countdown() {
    // Single beep for countdown
    playNote(440, 0.15, 'square', sfxGain, 0.2)
  },

  countdownGo() {
    // Higher beep for GO!
    playNote(880, 0.25, 'square', sfxGain, 0.25)
  },

  buttonClick() {
    playNote(660, 0.06, 'square', sfxGain, 0.1)
  },

  checkpoint() {
    // Checkpoint revival chime
    const ctx = getCtx()
    const t = ctx.currentTime
    ;[440, 554, 659, 880].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.2, t + i * 0.12)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.25)
      osc.connect(g)
      g.connect(sfxGain)
      osc.start(t + i * 0.12)
      osc.stop(t + i * 0.12 + 0.3)
    })
  },

  slideAdvance() {
    // Cutscene slide advance - soft blip
    playNote(880, 0.06, 'triangle', sfxGain, 0.1)
  },

  powerUp() {
    // Mini-game power up / bonus
    const ctx = getCtx()
    const t = ctx.currentTime
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 400 + i * 100
      g.gain.setValueAtTime(0.15, t + i * 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.08)
      osc.connect(g)
      g.connect(sfxGain)
      osc.start(t + i * 0.04)
      osc.stop(t + i * 0.04 + 0.1)
    }
  },

  quickDrawShoot() {
    // Gunshot
    playNoise(0.15, sfxGain, 0.35)
    playNote(80, 0.1, 'sawtooth', sfxGain, 0.2)
  },

  snakeEat() {
    playNote(523, 0.06, 'square', sfxGain, 0.15)
    setTimeout(() => !_muted && playNote(659, 0.06, 'square', sfxGain, 0.15), 60)
  },
}

// ── Background Music ──

// Simple looping chiptune patterns
const BGM_PATTERNS = {
  intro: {
    bpm: 110,
    notes: [
      // Chill mysterious vibe
      [262, 0.5], [0, 0.25], [330, 0.5], [0, 0.25],
      [392, 0.5], [0, 0.25], [330, 0.5], [0, 0.25],
      [294, 0.5], [0, 0.25], [349, 0.5], [0, 0.25],
      [440, 0.5], [0, 0.25], [349, 0.5], [0, 0.25],
    ],
    bass: [
      [131, 1], [0, 0.5], [165, 1], [0, 0.5],
      [147, 1], [0, 0.5], [175, 1], [0, 0.5],
    ],
    type: 'triangle',
  },
  playing: {
    bpm: 95,
    notes: [
      // Calm, steady adventure — low-key background for reading questions
      [330, 1], [0, 0.5], [294, 0.75], [262, 0.75],
      [0, 0.5], [294, 1], [330, 1], [0, 0.5],
      [349, 1], [0, 0.5], [330, 0.75], [294, 0.75],
      [0, 0.5], [262, 1], [294, 1], [0, 0.5],
    ],
    bass: [
      [131, 1.5], [165, 1.5], [0, 0.5],
      [147, 1.5], [165, 1.5], [0, 0.5],
      [175, 1.5], [165, 1.5], [0, 0.5],
      [131, 1.5], [147, 1.5], [0, 0.5],
    ],
    type: 'triangle',
  },
  minigame: {
    bpm: 160,
    notes: [
      // Fast-paced action
      [659, 0.25], [784, 0.25], [880, 0.25], [784, 0.25],
      [659, 0.5], [523, 0.25], [587, 0.25],
      [659, 0.25], [784, 0.25], [880, 0.25], [1047, 0.25],
      [880, 0.5], [784, 0.25], [659, 0.25],
    ],
    bass: [
      [330, 0.5], [330, 0.5], [262, 0.5], [294, 0.5],
      [330, 0.5], [330, 0.5], [440, 0.5], [330, 0.5],
    ],
    type: 'square',
  },
  victory: {
    bpm: 120,
    notes: [
      // Triumphant and celebratory
      [523, 0.5], [659, 0.5], [784, 1],
      [880, 0.5], [784, 0.5], [659, 0.5], [784, 0.5],
      [523, 0.5], [659, 0.5], [784, 1],
      [1047, 1], [0, 0.5], [880, 0.5],
    ],
    bass: [
      [262, 1], [330, 1], [392, 1], [349, 1],
      [262, 1], [330, 1], [392, 1], [523, 1],
    ],
    type: 'triangle',
  },
  gameover: {
    bpm: 70,
    notes: [
      // Dark, somber
      [262, 1], [247, 1], [233, 1], [220, 1],
      [0, 1], [196, 1.5], [0, 0.5],
      [175, 1], [165, 1], [156, 1], [131, 2],
    ],
    bass: [
      [131, 2], [123, 2], [110, 2], [98, 2],
      [87, 2], [82, 2],
    ],
    type: 'triangle',
  },
  cutscene: {
    bpm: 90,
    notes: [
      // Warm, storytelling — gentle and mysterious
      [330, 0.75], [392, 0.75], [440, 1.5],
      [0, 0.5], [392, 0.75], [349, 0.75], [330, 1.5],
      [0, 0.5], [294, 0.75], [330, 0.75], [392, 1.5],
      [0, 0.5], [349, 0.75], [330, 0.75], [262, 1.5], [0, 0.5],
    ],
    bass: [
      [165, 1.5], [196, 1.5], [0, 0.5],
      [196, 1.5], [175, 1.5], [0, 0.5],
      [147, 1.5], [165, 1.5], [0, 0.5],
      [175, 1.5], [131, 1.5], [0, 0.5],
    ],
    type: 'triangle',
  },
}

function stopBgm() {
  if (currentBgm) {
    if (currentBgm.cleanup) currentBgm.cleanup()
    currentBgm.stop = true
    currentBgm = null
  }
  currentTrackName = null
}

let currentTrackName = null

function playBgm(trackName) {
  if (trackName === currentTrackName && currentBgm && !currentBgm.stop) return // already playing
  stopBgm()
  currentTrackName = trackName
  if (_muted) return

  const pattern = BGM_PATTERNS[trackName]
  if (!pattern) return

  const ctx = getCtx()
  const beatDuration = 60 / pattern.bpm

  const handle = { stop: false }
  currentBgm = handle

  function loopOnce() {
    if (handle.stop || _muted) return

    let melodyTime = ctx.currentTime + 0.05
    const oscs = []

    // Melody
    pattern.notes.forEach(([freq, beats]) => {
      const dur = beats * beatDuration
      if (freq > 0) {
        const osc = scheduleNote(freq, melodyTime, dur * 0.9, pattern.type, bgmGain, 0.15)
        oscs.push(osc)
      }
      melodyTime += dur
    })

    // Bass line
    let bassTime = ctx.currentTime + 0.05
    pattern.bass.forEach(([freq, beats]) => {
      const dur = beats * beatDuration
      if (freq > 0) {
        const osc = scheduleNote(freq, bassTime, dur * 0.9, 'triangle', bgmGain, 0.1)
        oscs.push(osc)
      }
      bassTime += dur
    })

    // Schedule next loop
    const totalMelodyBeats = pattern.notes.reduce((sum, [, b]) => sum + b, 0)
    const totalBassBeats = pattern.bass.reduce((sum, [, b]) => sum + b, 0)
    const loopDuration = Math.max(totalMelodyBeats, totalBassBeats) * beatDuration

    const nextLoopTimeout = setTimeout(() => {
      if (!handle.stop && !_muted) loopOnce()
    }, loopDuration * 1000 - 100)

    handle.cleanup = () => {
      clearTimeout(nextLoopTimeout)
      oscs.forEach(o => { try { o.stop() } catch (e) { /* already stopped */ } })
    }
  }

  loopOnce()
}

// ── Public API ──

const audioManager = {
  play(sfxName) {
    if (_muted) return
    getCtx() // ensure context is active
    if (SFX[sfxName]) SFX[sfxName]()
  },

  startBgm(track) {
    playBgm(track)
  },

  stopBgm() {
    if (currentBgm?.cleanup) currentBgm.cleanup()
    stopBgm()
  },

  get muted() {
    return _muted
  },

  setMuted(val) {
    _muted = val
    if (val) {
      if (currentBgm?.cleanup) currentBgm.cleanup()
      stopBgm()
      if (masterGain) masterGain.gain.value = 0
    } else {
      if (masterGain) masterGain.gain.value = 0.4
    }
  },

  toggleMute() {
    audioManager.setMuted(!_muted)
    return _muted
  },

  // Call on first user interaction to unlock audio context
  unlock() {
    getCtx()
  },
}

export default audioManager
