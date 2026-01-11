/**
 * Audio State Module
 *
 * Handles procedural audio transformations for being states.
 * Integrates with audio generation APIs and Godot audio buses.
 */

import type {
  BeingStateEnv,
  AudioState,
  AudioStateConfig,
  AudioModification,
  MusicPrompt,
  AmbientLayer,
  SFXReplacement,
  AudioMix,
  AudioModType,
} from './types';

// ============================================================================
// Audio State Presets
// ============================================================================

interface AudioPreset {
  musicPrompts: MusicPrompt[];
  ambientLayers: AmbientLayer[];
  sfxReplacements: SFXReplacement[];
  mix: AudioMix;
}

const AUDIO_PRESETS: Record<AudioState, AudioPreset> = {
  eerie: {
    musicPrompts: [
      {
        mood: 'unsettling, mysterious, whispering',
        tempo: 60,
        key: 'D minor',
        instruments: ['whisper choir', 'soft strings', 'distant bells'],
        style: 'ambient horror',
      },
    ],
    ambientLayers: [
      {
        name: 'whispers',
        sound: 'ambient/whispers_low',
        volume: 0.15,
        loop: true,
        randomPitch: { min: 0.9, max: 1.1 },
        randomInterval: { min: 3, max: 8 },
      },
      {
        name: 'wind_creaks',
        sound: 'ambient/wind_creep',
        volume: 0.2,
        loop: true,
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_frost', pitchMod: 0.8 },
      { original: 'ui_click', replacement: 'ui_whisper', filter: 'lowpass' },
    ],
    mix: {
      masterVolume: 0.7,
      musicVolume: 0.4,
      sfxVolume: 0.6,
      ambientVolume: 0.8,
      voiceVolume: 0.7,
    },
  },

  triumphant: {
    musicPrompts: [
      {
        mood: 'victorious, soaring, powerful',
        tempo: 120,
        key: 'C major',
        instruments: ['orchestra', 'brass', 'timpani', 'choir'],
        style: 'epic orchestral',
      },
    ],
    ambientLayers: [
      {
        name: 'cheer_distant',
        sound: 'ambient/crowd_cheer_distant',
        volume: 0.2,
        loop: true,
        randomPitch: { min: 0.95, max: 1.05 },
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_armored', pitchMod: 1.0 },
      { original: 'ui_click', replacement: 'ui_triumph', pitchMod: 1.2 },
    ],
    mix: {
      masterVolume: 1.0,
      musicVolume: 0.8,
      sfxVolume: 0.9,
      ambientVolume: 0.5,
      voiceVolume: 1.0,
    },
  },

  muted: {
    musicPrompts: [
      {
        mood: 'quiet, minimal, sparse',
        tempo: 40,
        instruments: ['piano', 'soft pads'],
        style: 'minimal ambient',
      },
    ],
    ambientLayers: [
      {
        name: 'silence_hiss',
        sound: 'ambient/room_tone',
        volume: 0.05,
        loop: true,
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_soft', pitchMod: 0.7 },
      { original: 'ui_click', replacement: 'ui_soft', filter: 'lowpass' },
    ],
    mix: {
      masterVolume: 0.4,
      musicVolume: 0.2,
      sfxVolume: 0.3,
      ambientVolume: 0.1,
      voiceVolume: 0.5,
    },
  },

  chaotic: {
    musicPrompts: [
      {
        mood: 'dissonant, overwhelming, intense',
        tempo: 140,
        key: 'atonal',
        instruments: ['distorted synths', 'percussion', 'industrial noise'],
        style: 'industrial chaos',
      },
    ],
    ambientLayers: [
      {
        name: 'machinery_clamor',
        sound: 'ambient/industrial_chaos',
        volume: 0.4,
        loop: true,
        randomPitch: { min: 0.8, max: 1.2 },
      },
      {
        name: 'alarms_distant',
        sound: 'ambient/siren_ambient',
        volume: 0.15,
        loop: true,
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_metal', pitchMod: 1.3 },
      { original: 'ui_click', replacement: 'ui_glitch', filter: 'distortion' },
    ],
    mix: {
      masterVolume: 0.9,
      musicVolume: 0.7,
      sfxVolume: 1.0,
      ambientVolume: 0.6,
      voiceVolume: 0.7,
    },
  },

  serene: {
    musicPrompts: [
      {
        mood: 'peaceful, harmonic, floating',
        tempo: 70,
        key: 'F major',
        instruments: ['soft pads', 'gentle piano', 'nature sounds'],
        style: 'ambient peace',
      },
    ],
    ambientLayers: [
      {
        name: 'nature_ambience',
        sound: 'ambient/forest_peaceful',
        volume: 0.3,
        loop: true,
        randomPitch: { min: 0.95, max: 1.05 },
      },
      {
        name: 'birds_distant',
        sound: 'ambient/birds_distant',
        volume: 0.15,
        loop: true,
        randomInterval: { min: 2, max: 6 },
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_grass_soft', pitchMod: 0.9 },
      { original: 'ui_click', replacement: 'ui_gentle', filter: 'lowpass' },
    ],
    mix: {
      masterVolume: 0.8,
      musicVolume: 0.5,
      sfxVolume: 0.6,
      ambientVolume: 0.7,
      voiceVolume: 0.8,
    },
  },

  intense: {
    musicPrompts: [
      {
        mood: 'driving, rhythmic, urgent',
        tempo: 130,
        key: 'E minor',
        instruments: ['drums', 'bass', 'synth leads'],
        style: 'electronic action',
      },
    ],
    ambientLayers: [
      {
        name: 'tension_drone',
        sound: 'ambient/tension_build',
        volume: 0.25,
        loop: true,
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_urgent', pitchMod: 1.1 },
      { original: 'ui_click', replacement: 'ui_snappy', pitchMod: 1.2 },
    ],
    mix: {
      masterVolume: 0.95,
      musicVolume: 0.8,
      sfxVolume: 0.9,
      ambientVolume: 0.4,
      voiceVolume: 0.9,
    },
  },

  mystical: {
    musicPrompts: [
      {
        mood: 'otherworldly, reverb-heavy, magical',
        tempo: 80,
        key: 'C# minor',
        instruments: ['choir', 'bells', 'ethereal pads', 'crystal bowls'],
        style: 'mystical ambient',
      },
    ],
    ambientLayers: [
      {
        name: 'mystical_chimes',
        sound: 'ambient/chimes_random',
        volume: 0.2,
        loop: true,
        randomInterval: { min: 1, max: 5 },
        randomPitch: { min: 0.8, max: 1.2 },
      },
      {
        name: 'ethereal_drone',
        sound: 'ambient/ethereal_drone',
        volume: 0.15,
        loop: true,
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_magic', pitchMod: 1.0 },
      { original: 'ui_click', replacement: 'ui_chime', filter: 'reverb' },
    ],
    mix: {
      masterVolume: 0.85,
      musicVolume: 0.7,
      sfxVolume: 0.5,
      ambientVolume: 0.7,
      voiceVolume: 0.8,
    },
  },

  mechanical: {
    musicPrompts: [
      {
        mood: 'industrial, repetitive, metallic',
        tempo: 100,
        instruments: ['metal percussion', 'hydraulics', 'steam', 'gears'],
        style: 'industrial mechanical',
      },
    ],
    ambientLayers: [
      {
        name: 'machinery_hum',
        sound: 'ambient/machinery_low',
        volume: 0.3,
        loop: true,
      },
      {
        name: 'steam_hisses',
        sound: 'ambient/steam_random',
        volume: 0.1,
        loop: true,
        randomInterval: { min: 4, max: 12 },
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_metal_heavy', pitchMod: 0.9 },
      { original: 'ui_click', replacement: 'ui_mechanical', filter: 'bandpass' },
    ],
    mix: {
      masterVolume: 0.8,
      musicVolume: 0.5,
      sfxVolume: 0.8,
      ambientVolume: 0.6,
      voiceVolume: 0.7,
    },
  },

  natural: {
    musicPrompts: [
      {
        mood: 'environmental, organic, breathing',
        tempo: 60,
        instruments: ['nature sounds', 'flute', 'hand drums'],
        style: 'nature ambient',
      },
    ],
    ambientLayers: [
      {
        name: 'forest_full',
        sound: 'ambient/forest_complete',
        volume: 0.4,
        loop: true,
        randomPitch: { min: 0.95, max: 1.05 },
      },
      {
        name: 'water_flow',
        sound: 'ambient/stream_gentle',
        volume: 0.2,
        loop: true,
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_natural', pitchMod: 1.0 },
      { original: 'ui_click', replacement: 'ui_wood', filter: 'lowpass' },
    ],
    mix: {
      masterVolume: 0.9,
      musicVolume: 0.4,
      sfxVolume: 0.7,
      ambientVolume: 0.9,
      voiceVolume: 0.8,
    },
  },

  digital: {
    musicPrompts: [
      {
        mood: 'synthesized, glitchy, electronic',
        tempo: 110,
        key: 'A minor',
        instruments: ['synth leads', 'arpeggios', 'digital noise'],
        style: 'synthwave digital',
      },
    ],
    ambientLayers: [
      {
        name: 'digital_hum',
        sound: 'ambient/server_room',
        volume: 0.2,
        loop: true,
      },
      {
        name: 'data_streams',
        sound: 'ambient/data_flow',
        volume: 0.1,
        loop: true,
        randomPitch: { min: 0.9, max: 1.1 },
      },
    ],
    sfxReplacements: [
      { original: 'footstep_grass', replacement: 'footstep_digital', pitchMod: 1.0 },
      { original: 'ui_click', replacement: 'ui_digital', filter: 'highpass' },
    ],
    mix: {
      masterVolume: 0.85,
      musicVolume: 0.6,
      sfxVolume: 0.8,
      ambientVolume: 0.5,
      voiceVolume: 0.9,
    },
  },
};

// ============================================================================
// Procedural Audio Generation
// ============================================================================

/**
 * Procedural audio configuration
 */
interface ProceduralAudioConfig {
  // Waveform type
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  // Frequency (Hz)
  frequency: number;
  // Duration (seconds)
  duration: number;
  // Envelope
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  // Effects
  effects?: {
    reverb?: number;
    delay?: number;
    distortion?: number;
    filter?: {
      type: 'lowpass' | 'highpass' | 'bandpass';
      frequency: number;
      resonance: number;
    };
  };
}

// ============================================================================
// Audio State Manager Class
// ============================================================================

export class AudioStateManager {
  private env: BeingStateEnv;
  private audioCache: Map<string, string> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Audio State Generation
  // ========================================================================

  /**
   * Generate audio state configuration
   */
  async generateConfig(
    state: AudioState,
    intensity: number
  ): Promise<AudioStateConfig> {
    const preset = AUDIO_PRESETS[state];

    return {
      state,
      musicPrompts: preset.musicPrompts,
      ambientLayers: this.scaleAmbientLayers(preset.ambientLayers, intensity),
      sfxReplacements: preset.sfxReplacements,
      mix: this.scaleMix(preset.mix, intensity),
    };
  }

  /**
   * Generate procedural audio effect
   */
  async generateProceduralAudio(
    config: ProceduralAudioConfig
  ): Promise<ArrayBuffer> {
    // Sample rate and duration
    const sampleRate = 48000;
    const numSamples = Math.floor(config.duration * sampleRate);
    const buffer = new Float32Array(numSamples);

    // Generate waveform
    const phase = { value: 0 };
    const phaseIncrement = config.frequency / sampleRate;

    for (let i = 0; i < numSamples; i++) {
      const time = i / sampleRate;
      const envelope = this.calculateEnvelope(config.envelope, time, config.duration);

      let sample = 0;
      switch (config.waveform) {
        case 'sine':
          sample = Math.sin(2 * Math.PI * phase.value);
          break;
        case 'square':
          sample = Math.sin(2 * Math.PI * phase.value) > 0 ? 1 : -1;
          break;
        case 'sawtooth':
          sample = 2 * (phase.value - Math.floor(phase.value + 0.5));
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * (phase.value - Math.floor(phase.value + 0.5))) - 1;
          break;
        case 'noise':
          sample = Math.random() * 2 - 1;
          break;
      }

      sample *= envelope;
      buffer[i] = sample;

      phase.value = (phase.value + phaseIncrement) % 1;
    }

    // Apply effects
    let processedBuffer = buffer;
    if (config.effects) {
      processedBuffer = this.applyEffects(buffer, config.effects, sampleRate);
    }

    // Convert to 16-bit PCM
    const pcmBuffer = new Int16Array(processedBuffer.length);
    for (let i = 0; i < processedBuffer.length; i++) {
      pcmBuffer[i] = Math.max(-32768, Math.min(32767, processedBuffer[i] * 32767));
    }

    return pcmBuffer.buffer;
  }

  // ========================================================================
  // Audio Modification Generation
  // ========================================================================

  /**
   * Generate audio modifications for state transition
   */
  async generateTransitionModifications(
    fromState: AudioState,
    toState: AudioState,
    intensity: number,
    duration: number = 2000
  ): Promise<AudioModification[]> {
    const mods: AudioModification[] = [];

    // Get preset configs
    const fromPreset = AUDIO_PRESETS[fromState];
    const toPreset = AUDIO_PRESETS[toState];

    // Volume transition
    mods.push({
      id: crypto.randomUUID(),
      type: 'volume',
      config: {
        from: fromPreset.mix.masterVolume,
        to: toPreset.mix.masterVolume,
        duration,
      },
    });

    // Music transition
    if (fromPreset.musicPrompts[0]?.mood !== toPreset.musicPrompts[0]?.mood) {
      mods.push({
        id: crypto.randomUUID(),
        type: 'music',
        config: {
          fadeOut: duration * 0.3,
          fadeIn: duration * 0.7,
          newTrack: toPreset.musicPrompts[0],
        },
      });
    }

    // Ambient layer transition
    mods.push({
      id: crypto.randomUUID(),
      type: 'filter',
      config: {
        layers: toPreset.ambientLayers.map((layer) => ({
          name: layer.name,
          volume: layer.volume * intensity,
          fadeIn: duration,
        })),
      },
    });

    // Special effects for specific transitions
    if (toState === 'eerie' || toState === 'chaotic') {
      mods.push({
        id: crypto.randomUUID(),
        type: 'distortion',
        config: {
          amount: intensity * 0.5,
          duration: duration * 0.5,
        },
      });
    }

    if (toState === 'mystical') {
      mods.push({
        id: crypto.randomUUID(),
        type: 'reverb',
        config: {
          roomSize: 0.8,
          damping: 0.5,
          duration,
        },
      });
    }

    if (toState === 'muted') {
      mods.push({
        id: crypto.randomUUID(),
        type: 'filter',
        config: {
          type: 'lowpass',
          frequency: 400,
          duration: duration * 0.5,
        },
      });
    }

    return mods;
  }

  // ========================================================================
  // AI Music Generation Prompts
  // ========================================================================

  /**
   * Generate prompt for AI music service (Suno, Udio, etc.)
   */
  generateMusicPrompt(
    state: AudioState,
    context: {
      duration?: number;
      loop?: boolean;
      variation?: string;
    } = {}
  ): string {
    const preset = AUDIO_PRESETS[state];
    const primary = preset.musicPrompts[0];

    const parts: string[] = [];

    // Mood/style
    parts.push(`Style: ${primary.style}`);
    parts.push(`Mood: ${primary.mood}`);

    // Musical details
    if (primary.tempo) parts.push(`Tempo: ${primary.tempo} BPM`);
    if (primary.key) parts.push(`Key: ${primary.key}`);
    if (primary.instruments) parts.push(`Instruments: ${primary.instruments.join(', ')}`);

    // Context
    if (context.duration) parts.push(`Duration: ${context.duration}s`);
    if (context.loop !== false) parts.push('Loop: seamless');
    if (context.variation) parts.push(`Variation: ${context.variation}`);

    return parts.join('\n');
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Scale ambient layers by intensity
   */
  private scaleAmbientLayers(
    layers: AmbientLayer[],
    intensity: number
  ): AmbientLayer[] {
    return layers.map((layer) => ({
      ...layer,
      volume: layer.volume * (0.5 + intensity * 0.5),
    }));
  }

  /**
   * Scale mix by intensity
   */
  private scaleMix(mix: AudioMix, intensity: number): AudioMix {
    const scale = 0.5 + intensity * 0.5;
    return {
      masterVolume: Math.min(1, mix.masterVolume * scale),
      musicVolume: Math.min(1, mix.musicVolume * scale),
      sfxVolume: Math.min(1, mix.sfxVolume * scale),
      ambientVolume: Math.min(1, mix.ambientVolume * scale),
      voiceVolume: mix.voiceVolume, // Voice stays consistent
    };
  }

  /**
   * Calculate ADSR envelope
   */
  private calculateEnvelope(
    envelope: ProceduralAudioConfig['envelope'],
    time: number,
    duration: number
  ): number {
    const { attack, decay, sustain, release } = envelope;
    const attackEnd = attack;
    const decayEnd = attack + decay;
    const releaseStart = duration - release;

    if (time < attackEnd) {
      return time / attack;
    } else if (time < decayEnd) {
      return 1 - ((time - attackEnd) / decay) * (1 - sustain);
    } else if (time < releaseStart) {
      return sustain;
    } else {
      return sustain * (1 - (time - releaseStart) / release);
    }
  }

  /**
   * Apply audio effects
   */
  private applyEffects(
    buffer: Float32Array,
    effects: NonNullable<ProceduralAudioConfig['effects']>,
    sampleRate: number
  ): Float32Array {
    let result = buffer;

    // Apply filter
    if (effects.filter) {
      result = this.applyFilter(result, effects.filter, sampleRate);
    }

    // Apply distortion
    if (effects.distortion) {
      result = this.applyDistortion(result, effects.distortion);
    }

    // Note: Reverb and delay would require more complex processing
    // For now, we'll apply simple versions

    return result;
  }

  /**
   * Apply filter to buffer
   */
  private applyFilter(
    buffer: Float32Array,
    filter: NonNullable<ProceduralAudioConfig['effects']>['filter']!,
    sampleRate: number
  ): Float32Array {
    // Simple first-order filter implementation
    const result = new Float32Array(buffer.length);
    const rc = 1 / (filter.frequency * 2 * Math.PI);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);

    let prev = 0;

    for (let i = 0; i < buffer.length; i++) {
      if (filter.type === 'lowpass') {
        prev = alpha * prev + (1 - alpha) * buffer[i];
      } else if (filter.type === 'highpass') {
        prev = alpha * (prev + buffer[i] - (i > 0 ? buffer[i - 1] : 0));
      } else {
        // Bandpass as combination
        const low = alpha * prev + (1 - alpha) * buffer[i];
        const high = alpha * (prev + buffer[i] - (i > 0 ? buffer[i - 1] : 0));
        prev = (low + high) * 0.5;
      }
      result[i] = prev;
    }

    return result;
  }

  /**
   * Apply distortion to buffer
   */
  private applyDistortion(buffer: Float32Array, amount: number): Float32Array {
    const result = new Float32Array(buffer.length);

    for (let i = 0; i < buffer.length; i++) {
      const sample = buffer[i];
      // Soft clipping
      const sign = Math.sign(sample);
      const abs = Math.abs(sample);
      result[i] = sign * (1 - Math.exp(-amount * abs)) / (1 - Math.exp(-amount));
    }

    return result;
  }

  // ========================================================================
  // Godot Bridge Integration
  // ========================================================================

  /**
   * Convert audio modifications to Godot commands
   */
  toGodotCommands(modifications: AudioModification[]): string[] {
    const commands: string[] = [];

    for (const mod of modifications) {
      switch (mod.type) {
        case 'volume':
          commands.push(
            `rpc_call("/root/AudioManager", "fade_volume", ${JSON.stringify(mod.config)})`
          );
          break;

        case 'music':
          commands.push(
            `rpc_call("/root/AudioManager", "transition_music", ${JSON.stringify(mod.config)})`
          );
          break;

        case 'filter':
          commands.push(
            `rpc_call("/root/AudioManager", "set_bus_filter", ${JSON.stringify(mod.config)})`
          );
          break;

        case 'reverb':
          commands.push(
            `rpc_call("/root/AudioManager", "set_reverb", ${JSON.stringify(mod.config)})`
          );
          break;
      }
    }

    return commands;
  }

  /**
   * Generate audio bus configuration for Godot
   */
  generateAudioBusConfig(state: AudioState, mix: AudioMix): string {
    // Generate Godot audio bus layout
    return `
[AudioBus]
name = "Master"
send = "Master"
volume_db = ${20 * Math.log10(mix.masterVolume)}
solo = false
mute = false
bypass_fx = false

[Effect]
resource_name = "AudioEffectReverb"
params/room_size = 0.5
params/damping = 0.5

[AudioBus]
name = "Music"
send = "Master"
volume_db = ${20 * Math.log10(mix.musicVolume)}

[AudioBus]
name = "SFX"
send = "Master"
volume_db = ${20 * Math.log10(mix.sfxVolume)}

[AudioBus]
name = "Ambient"
send = "Master"
volume_db = ${20 * Math.log10(mix.ambientVolume)}

[AudioBus]
name = "Voice"
send = "Master"
volume_db = ${20 * Math.log10(mix.voiceVolume)}
`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAudioStateManager(env: BeingStateEnv): AudioStateManager {
  return new AudioStateManager(env);
}
