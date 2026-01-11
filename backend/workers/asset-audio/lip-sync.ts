/**
 * Lip Sync Module
 *
 * Handles audio-to-animation synchronization for character facial animation.
 * Integrates with audio providers and Audio2Face to generate lip-sync data
 * compatible with Godot and other game engines.
 *
 * Features:
 * - Phoneme extraction from audio
 * - Viseme mapping for lip sync
 * - Godot blendshape export
 * - Timeline-based animation data
 * - Support for multiple viseme standards (Oculus, ARKit)
 */

import type {
    TTSRequest,
    TTSResponse,
    Audio2FaceRequest,
    PhonemeTiming,
    AnimationData,
    BlendshapeFrame,
    AudioFormat,
    Locale
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

// Standard frame rates for animation
const FRAME_RATES = [24, 30, 60, 120] as const;

// Viseme standards
type VisemeStandard = 'oculus' | 'arkit' | 'unity' | 'custom';

// Oculus viseme mapping (16 visemes)
const OCULUS_VISEMES = [
    'sil', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS',
    'nn', 'RR', 'aa', 'E', 'ih', 'oh', 'ou', 'bb'
] as const;

// ARKit blendshape names (52 shapes)
const ARKIT_BLENDSHAPE_NAMES = [
    'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
    'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'eyeBlinkLeft', 'eyeBlinkRight',
    'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
    'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight',
    'eyeSquintLeft', 'eyeSquintRight', 'eyeWideLeft', 'eyeWideRight',
    'jawForward', 'jawLeft', 'jawOpen', 'jawRight', 'mouthClose', 'mouthDimpleLeft',
    'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel',
    'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft',
    'mouthPressRight', 'mouthPucker', 'mouthRight', 'mouthRollLower',
    'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper', 'mouthSmileLeft',
    'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight', 'mouthUpperUpLeft',
    'mouthUpperUpRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut'
] as const;

// Phoneme to viseme mappings for different standards
const PHONEME_TO_VISEME: Record<string, number> = {
    // Vowels
    'a': 12, 'aa': 12, 'ae': 12, 'ah': 12, 'aw': 12, 'ay': 12, 'ao': 12, 'ow': 12,
    'e': 13, 'eh': 13, 'er': 13, 'ey': 13,
    'i': 14, 'ih': 14, 'iy': 14, 'y': 14,
    'o': 15, 'oh': 15,
    'u': 15, 'uh': 15, 'uw': 15,
    // Consonants
    'b': 16, 'p': 1,
    'd': 4, 't': 4,
    'f': 2, 'v': 2,
    'g': 5, 'k': 5, 'ng': 9,
    'h': 10, 'l': 9, 'm': 1, 'n': 9,
    's': 7, 'z': 7,
    'ch': 6, 'sh': 6, 'j': 6, 'zh': 6,
    'th': 3, 'dh': 3,
    'r': 10,
    'w': 15,
    'sil': 0, 'pau': 0
};

// Viseme to blendshape intensity mapping (Oculus)
const VISEME_TO_BLENDSHAPE_INTENSITY: Record<number, Record<string, number>> = {
    0: { mouthClose: 1.0 },  // sil
    1: { mouthClose: 0.8, jawOpen: 0.2 },  // PP, B, M
    2: { mouthLowerDownLeft: 0.3, mouthLowerDownRight: 0.3, mouthStretchLeft: 0.3, mouthStretchRight: 0.3 },  // FF, V
    3: { mouthLowerDownLeft: 0.2, mouthLowerDownRight: 0.2, tongueOut: 0.3 },  // TH
    4: { mouthPressLeft: 0.2, mouthPressRight: 0.2, mouthDimpleLeft: 0.2, mouthDimpleRight: 0.2 },  // DD, T
    5: { mouthDimpleLeft: 0.3, mouthDimpleRight: 0.3 },  // KK, G
    6: { mouthStretchLeft: 0.3, mouthStretchRight: 0.3, mouthDimpleLeft: 0.2, mouthDimpleRight: 0.2 },  // CH, SH, J
    7: { mouthDimpleLeft: 0.3, mouthDimpleRight: 0.3 },  // SS, Z
    8: { mouthClose: 0.2, mouthSmileLeft: 0.2, mouthSmileRight: 0.2 },  // NN
    9: { mouthDimpleLeft: 0.2, mouthDimpleRight: 0.2, mouthSmileLeft: 0.1, mouthSmileRight: 0.1 },  // RR, L
    10: { mouthDimpleLeft: 0.1, mouthDimpleRight: 0.1, mouthSmileLeft: 0.1, mouthSmileRight: 0.1 },  // aa
    11: { mouthStretchLeft: 0.4, mouthStretchRight: 0.4 },  // E
    12: { mouthStretchLeft: 0.3, mouthStretchRight: 0.3, jawOpen: 0.3 },  // ih
    13: { mouthFunnel: 0.3, jawOpen: 0.2 },  // oh
    14: { mouthFunnel: 0.4, jawOpen: 0.2 },  // ou
    15: { mouthClose: 0.9, jawOpen: 0.1 }  // bb, P
};

// ============================================================================
// Types
// ============================================================================

interface LipSyncConfig {
    /** Animation frame rate */
    frameRate?: number;
    /** Viseme standard to use */
    visemeStandard?: VisemeStandard;
    /** Include eye animations */
    includeEyes?: boolean;
    /** Include brow animations */
    includeBrows?: boolean;
    /** Smoothing factor for transitions (0-1) */
    smoothing?: number;
    /** Coarticulation strength */
    coarticulation?: number;
}

interface LipSyncResult {
    /** Success status */
    success: boolean;
    /** Animation data */
    animation?: AnimationData;
    /** Phoneme timing data */
    phonemes?: PhonemeTiming[];
    /** Error message */
    error?: string;
}

// ============================================================================
// Lip Sync Class
// ============================================================================

/**
 * Lip Sync Generator
 *
 * Generates lip-sync animation data from audio or phoneme timing.
 * Supports multiple viseme standards and game engine formats.
 */
export class LipSyncGenerator {
    private readonly frameRate: number;
    private readonly visemeStandard: VisemeStandard;
    private readonly includeEyes: boolean;
    private readonly includeBrows: boolean;
    private readonly smoothing: number;
    private readonly coarticulation: number;

    constructor(config: LipSyncConfig = {}) {
        this.frameRate = config.frameRate || 60;
        this.visemeStandard = config.visemeStandard || 'oculus';
        this.includeEyes = config.includeEyes ?? true;
        this.includeBrows = config.includeBrows ?? false;
        this.smoothing = config.smoothing ?? 0.3;
        this.coarticulation = config.coarticulation ?? 0.5;
    }

    // ========================================================================
    // Lip Sync Generation
    // ========================================================================

    /**
     * Generate lip-sync data from TTS response with phonemes
     *
     * @param ttsResponse - TTS response with phoneme data
     * @param duration - Audio duration in seconds
     * @returns Lip sync result with animation data
     */
    generateFromTTSResponse(ttsResponse: TTSResponse, duration: number): LipSyncResult {
        if (!ttsResponse.phonemes || ttsResponse.phonemes.length === 0) {
            return {
                success: false,
                error: 'No phoneme data in TTS response'
            };
        }

        return this.generateFromPhonemes(ttsResponse.phonemes, duration);
    }

    /**
     * Generate lip-sync data from phoneme timing
     *
     * @param phonemes - Array of phoneme timings
     * @param duration - Total duration in seconds
     * @returns Lip sync result with animation data
     */
    generateFromPhonemes(phonemes: PhonemeTiming[], duration: number): LipSyncResult {
        try {
            const frameCount = Math.ceil(duration * this.frameRate);
            const blendshapes: BlendshapeFrame[] = [];

            // Apply coarticulation - extend phoneme influence to neighboring sounds
            const smoothedPhonemes = this.applyCoarticulation(phonemes);

            for (let frame = 0; frame < frameCount; frame++) {
                const time = frame / this.frameRate;

                // Find active phoneme(s) at this time
                const activePhonemes = this.getActivePhonemes(smoothedPhonemes, time);

                // Initialize blendshape values
                const values = new Array(ARKIT_BLENDSHAPE_NAMES.length).fill(0);
                const named: Record<string, number> = {};

                // Blend active phonemes
                if (activePhonemes.length > 0) {
                    const blended = this.blendPhonemes(activePhonemes);

                    // Apply to blendshapes
                    for (const [shapeName, intensity] of Object.entries(blended)) {
                        const index = ARKIT_BLENDSHAPE_NAMES.indexOf(shapeName as any);
                        if (index >= 0) {
                            values[index] = intensity;
                            named[shapeName] = intensity;
                        }
                    }
                }

                // Add natural eye blinks
                if (this.includeEyes && this.shouldBlink(time)) {
                    const blinkLeft = ARKIT_BLENDSHAPE_NAMES.indexOf('eyeBlinkLeft');
                    const blinkRight = ARKIT_BLENDSHAPE_NAMES.indexOf('eyeBlinkRight');
                    if (blinkLeft >= 0) values[blinkLeft] = 0.3;
                    if (blinkRight >= 0) values[blinkRight] = 0.3;
                }

                blendshapes.push({
                    frame,
                    time,
                    values,
                    named: Object.keys(named).length > 0 ? named : undefined
                });
            }

            // Apply smoothing
            const smoothed = this.applySmoothing(blendshapes);

            const animationData: AnimationData = {
                frameRate: this.frameRate,
                duration,
                frameCount,
                blendshapes: smoothed,
                metadata: {
                    generatedAt: Date.now(),
                    visemeStandard: this.visemeStandard
                }
            };

            return {
                success: true,
                animation: animationData,
                phonemes: smoothedPhonemes
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to generate lip sync'
            };
        }
    }

    /**
     * Generate lip-sync data from text (estimates phonemes)
     *
     * @param text - Text to generate phonemes for
     * @param language - Language code
     * @returns Lip sync result with estimated phonemes
     */
    generateFromText(text: string, language: Locale = 'en-US'): LipSyncResult {
        // Estimate duration (average speaking rate: 150 words per minute)
        const wordCount = text.split(/\s+/).length;
        const duration = (wordCount / 150) * 60;

        // Generate estimated phonemes
        const phonemes = this.textToPhonemes(text, duration);

        return this.generateFromPhonemes(phonemes, duration);
    }

    // ========================================================================
    // Export Functions
    // ========================================================================

    /**
     * Export animation data as Godot-compatible JSON
     *
     * @param animation - Animation data
     * @returns Godot Animation resource JSON string
     */
    exportToGodot(animation: AnimationData): string {
        const tracks: any[] = [];

        // Create blendshape tracks
        if (animation.blendshapes && animation.blendshapes.length > 0) {
            for (let i = 0; i < ARKIT_BLENDSHAPE_NAMES.length; i++) {
                const bsName = ARKIT_BLENDSHAPE_NAMES[i];
                const keyframes: any[] = [];

                // Optimize: only include keyframes where value changes significantly
                let lastValue = -1;
                for (const frame of animation.blendshapes) {
                    const value = frame.values[i];
                    if (Math.abs(value - lastValue) > 0.01) {
                        keyframes.push({
                            time: frame.time,
                            value: value
                        });
                        lastValue = value;
                    }
                }

                if (keyframes.length > 0) {
                    tracks.push({
                        type: 'value',
                        path: `Mesh3D:blend_shapes/${bsName}`,
                        interp: 1, // Linear interpolation
                        loop_wrap: true,
                        imported: true,
                        enabled: true,
                        keys: keyframes
                    });
                }
            }
        }

        return JSON.stringify({
            resource_name: 'lip_sync',
            length: animation.duration,
            loop_mode: 0,
            step: 1 / animation.frameRate,
            tracks
        }, null, 2);
    }

    /**
     * Export as JSON format for web use
     *
     * @param animation - Animation data
     * @returns JSON string
     */
    exportToJSON(animation: AnimationData): string {
        return JSON.stringify({
            format: 'lipsync',
            version: '1.0',
            frameRate: animation.frameRate,
            duration: animation.duration,
            blendshapes: animation.blendshapes?.map(frame => ({
                t: frame.time,
                v: frame.named || {}
            }))
        }, null, 2);
    }

    /**
     * Export as binary format for efficient streaming
     *
     * @param animation - Animation data
     * @returns Uint8Array of binary data
     */
    exportToBinary(animation: AnimationData): Uint8Array {
        if (!animation.blendshapes) {
            return new Uint8Array(0);
        }

        // Simple binary format:
        // Header: frameRate (f32), frameCount (u32), blendshapeCount (u32)
        // Per frame: time (f32), values (f32 * blendshapeCount)

        const blendshapeCount = ARKIT_BLENDSHAPE_NAMES.length;
        const headerSize = 4 + 4 + 4;
        const frameSize = 4 + (blendshapeCount * 4);
        const totalSize = headerSize + (animation.blendshapes.length * frameSize);

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;

        // Write header
        view.setFloat32(offset, animation.frameRate, true);
        offset += 4;
        view.setUint32(offset, animation.frameCount, true);
        offset += 4;
        view.setUint32(offset, blendshapeCount, true);
        offset += 4;

        // Write frames
        for (const frame of animation.blendshapes) {
            view.setFloat32(offset, frame.time, true);
            offset += 4;

            for (const value of frame.values) {
                view.setFloat32(offset, value, true);
                offset += 4;
            }
        }

        return new Uint8Array(buffer);
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Apply coarticulation to phonemes
     */
    private applyCoarticulation(phonemes: PhonemeTiming[]): PhonemeTiming[] {
        const result: PhonemeTiming[] = [];
        const windowSize = 3; // Number of adjacent phonemes to consider

        for (let i = 0; i < phonemes.length; i++) {
            const current = phonemes[i];
            const neighbors: PhonemeTiming[] = [];

            // Get neighboring phonemes
            for (let j = Math.max(0, i - windowSize); j <= Math.min(phonemes.length - 1, i + windowSize); j++) {
                neighbors.push(phonemes[j]);
            }

            // Create extended phoneme with coarticulation
            const influence = this.coarticulation;
            const startTime = current.startTime - ((neighbors[0]?.endTime || current.startTime) - current.startTime) * influence;
            const endTime = current.endTime + ((neighbors[neighbors.length - 1]?.startTime || current.endTime) - current.endTime) * influence;

            result.push({
                phoneme: current.phoneme,
                viseme: current.viseme,
                startTime: Math.max(0, startTime),
                endTime: Math.max(current.endTime, endTime)
            });
        }

        return result;
    }

    /**
     * Get active phonemes at a given time
     */
    private getActivePhonemes(phonemes: PhonemeTiming[], time: number): Array<PhonemeTiming & { weight: number }> {
        const active: Array<PhonemeTiming & { weight: number }> = [];

        for (const phoneme of phonemes) {
            if (time >= phoneme.startTime && time < phoneme.endTime) {
                // Calculate weight based on position in phoneme duration
                const duration = phoneme.endTime - phoneme.startTime;
                const position = (time - phoneme.startTime) / duration;

                // Weight curve: ramp up, hold, ramp down
                let weight = 1;
                if (position < 0.2) {
                    weight = position / 0.2; // Ramp up
                } else if (position > 0.8) {
                    weight = (1 - position) / 0.2; // Ramp down
                }

                active.push({ ...phoneme, weight });
            }
        }

        return active;
    }

    /**
     * Blend multiple phonemes into blendshape values
     */
    private blendPhonemes(phonemes: Array<PhonemeTiming & { weight: number }>): Record<string, number> {
        const blended: Record<string, number> = {};

        for (const { viseme, weight } of phonemes) {
            const shapes = VISEME_TO_BLENDSHAPE_INTENSITY[viseme] || {};

            for (const [shapeName, baseIntensity] of Object.entries(shapes)) {
                blended[shapeName] = (blended[shapeName] || 0) + (baseIntensity * weight);
            }
        }

        // Clamp values to 0-1
        for (const key of Object.keys(blended)) {
            blended[key] = Math.max(0, Math.min(1, blended[key]));
        }

        return blended;
    }

    /**
     * Apply smoothing to blendshape frames
     */
    private applySmoothing(frames: BlendshapeFrame[]): BlendshapeFrame[] {
        if (frames.length < 3) {
            return frames;
        }

        const smoothed: BlendshapeFrame[] = [];
        const alpha = this.smoothing;

        for (let i = 0; i < frames.length; i++) {
            const current = frames[i];
            const values = [...current.values];

            if (i > 0 && i < frames.length - 1) {
                const prev = frames[i - 1];
                const next = frames[i + 1];

                for (let j = 0; j < values.length; j++) {
                    const avg = (prev.values[j] + current.values[j] + next.values[j]) / 3;
                    values[j] = current.values[j] * (1 - alpha) + avg * alpha;
                }
            }

            smoothed.push({
                ...current,
                values,
                named: current.named ? { ...current.named } : undefined
            });
        }

        return smoothed;
    }

    /**
     * Convert text to estimated phonemes
     */
    private textToPhonemes(text: string, duration: number): PhonemeTiming[] {
        const phonemes: PhonemeTiming[] = [];
        const words = text.split(/\s+/);
        let currentTime = 0;

        for (const word of words) {
            const wordPhonemes = this.wordToPhonemes(word);
            const wordDuration = (word.length * 0.05); // ~50ms per character
            const phonemeDuration = wordDuration / wordPhonemes.length;

            for (const phoneme of wordPhonemes) {
                const viseme = this.phonemeToViseme(phoneme);
                phonemes.push({
                    phoneme,
                    viseme,
                    startTime: currentTime,
                    endTime: currentTime + phonemeDuration
                });
                currentTime += phonemeDuration;
            }

            // Add small pause between words
            currentTime += 0.05;
        }

        return phonemes;
    }

    /**
     * Convert word to phonemes (simplified)
     */
    private wordToPhonemes(word: string): string[] {
        const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
        const phonemes: string[] = [];

        // Simple letter-to-phoneme mapping
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized[i];
            const next = normalized[i + 1];

            // Handle common combinations
            if (char === 't' && next === 'h') {
                phonemes.push('th');
                i++;
            } else if (char === 's' && next === 'h') {
                phonemes.push('sh');
                i++;
            } else if (char === 'c' && next === 'h') {
                phonemes.push('ch');
                i++;
            } else if ('aeiou'.includes(char)) {
                phonemes.push(char);
            } else if ('bcdfgjklmnpqrstvwxyz'.includes(char)) {
                phonemes.push(char);
            }
        }

        return phonemes.length > 0 ? phonemes : ['sil'];
    }

    /**
     * Map phoneme to viseme
     */
    private phonemeToViseme(phoneme: string): number {
        return PHONEME_TO_VISEME[phoneme.toLowerCase()] ?? 0;
    }

    /**
     * Determine if character should blink at this time
     */
    private shouldBlink(time: number): boolean {
        // Random blinks every ~3-7 seconds
        const blinkInterval = 3 + Math.random() * 4;
        const blinkPhase = (time % blinkInterval) / blinkInterval;
        return blinkPhase > 0.95 && blinkPhase < 0.98;
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a lip sync generator
 *
 * @param config - Generator configuration
 * @returns Configured LipSyncGenerator
 */
export function createLipSyncGenerator(config?: LipSyncConfig): LipSyncGenerator {
    return new LipSyncGenerator(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get ARKit blendshape names
 */
export function getARKitBlendshapeNames(): readonly string[] {
    return ARKIT_BLENDSHAPE_NAMES;
}

/**
 * Get Oculus viseme names
 */
export function getOculusVisemeNames(): readonly string[] {
    return OCULUS_VISEMES;
}

/**
 * Map phoneme to viseme
 */
export function mapPhonemeToViseme(phoneme: string): number {
    return PHONEME_TO_VISEME[phoneme.toLowerCase()] ?? 0;
}

// ============================================================================
// Re-exports
// ============================================================================

export type { LipSyncConfig, LipSyncResult, VisemeStandard };
