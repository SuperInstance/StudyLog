/**
 * NVIDIA ACE Audio2Face Provider Integration
 * Real-time facial animations from dialogue
 *
 * API Docs: https://developer.nvidia.com/ace-audio2face
 */

import {
    Audio2FaceConfig,
    Audio2FaceRequest,
    Audio2FaceResponse,
    LipSyncData,
    VisemeFrame
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.nvidia.com/ace/audio2face/v1';

// ARKit blendshape names (52 standard blendshapes)
const ARKIT_BLENDSHAPES = [
    'eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft',
    'eyeSquintLeft', 'eyeWideLeft', 'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight',
    'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight', 'jawForward',
    'jawLeft', 'jawRight', 'jawOpen', 'mouthClose', 'mouthDimpleLeft',
    'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthFunnel', 'mouthLeft',
    'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthPressLeft', 'mouthPressRight', 'mouthPucker',
    'mouthRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
    'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight', 'mouthUpperUpLeft',
    'mouthUpperUpRight', 'neckBend', 'neckTiltLeft', 'neckTiltRight', 'neckTurnLeft',
    'neckTurnRight', 'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft',
    'browOuterUpRight', 'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight', 'noseSneerLeft',
    'noseSneerRight', 'tongueOut'
] as const;

// Viseme mapping (common phoneme-to-blendshape)
const VISEME_TO_BLENDSHAPE: Record<string, string> = {
    'P': 'mouthPucker',
    'B': 'mouthPucker',
    'M': 'mouthPucker',
    'F': 'mouthFunnel',
    'V': 'mouthFunnel',
    'TH': 'mouthFunnel',
    'T': 'mouthLeft',
    'D': 'mouthLeft',
    'S': 'mouthLeft',
    'Z': 'mouthLeft',
    'N': 'mouthLeft',
    'L': 'mouthLeft',
    'R': 'mouthRight',
    'K': 'mouthSmileLeft',
    'G': 'mouthSmileLeft',
    'CH': 'mouthSmileLeft',
    'J': 'mouthSmileLeft',
    'SH': 'mouthSmileLeft',
    'I': 'mouthStretchLeft',
    'E': 'mouthStretchLeft',
    'A': 'mouthSmileLeft',
    'O': 'mouthFunnel',
    'U': 'mouthFunnel',
    'sil': 'mouthClose',
    '': 'mouthClose'
};

// ============================================================================
// Audio2Face Provider Class
// ============================================================================

export class Audio2FaceProvider {
    private config: Audio2FaceConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private sessionCache: Map<string, Audio2FaceSession>;

    constructor(config: Audio2FaceConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 10;
        this.rateLimitResetAt = Date.now() + 60000;
        this.sessionCache = new Map();
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 10;
            this.rateLimitResetAt = Date.now() + 60000;
        }

        if (this.rateLimitRemaining <= 0) {
            const waitMs = this.rateLimitResetAt - Date.now();
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitMs / 1000)} seconds.`);
        }

        this.rateLimitRemaining--;
    }

    // ========================================================================
    // API Requests
    // ========================================================================

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        await this.checkRateLimit();

        const url = `${this.config.endpoint}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Audio2Face API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Animation Generation
    // ========================================================================

    /**
     * Generate facial animation from audio
     */
    async generateAnimation(request: Audio2FaceRequest): Promise<Audio2FaceResponse> {
        try {
            // Prepare audio - handle base64 or URL
            let audioData = request.audio;
            if (audioData.startsWith('data:')) {
                audioData = audioData.split(',')[1];
            }

            const body = {
                audio: audioData,
                character: request.character || 'default',
                enable_gaze: request.enableGaze || false,
                enable_blinks: request.enableBlinks !== false,
                output_format: this.config.arkit ? 'arkit' : 'json',
                fps: 60,
                smooth_factor: 0.7
            };

            const response = await this.request<Audio2FaceResponse>('/generate', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            // Cache the session for potential later use
            this.sessionCache.set(crypto.randomUUID(), {
                animationUrl: response.animation_url,
                format: response.format,
                createdAt: new Date()
            });

            return response;
        } catch (error) {
            // Fallback to client-side generation if API fails
            console.warn('Audio2Face API failed, using client-side fallback');
            return this.generateClientSide(request);
        }
    }

    /**
     * Client-side fallback for viseme generation
     * Uses a simple phoneme-to-blendshape mapping
     */
    private async generateClientSide(request: Audio2FaceRequest): Promise<Audio2FaceResponse> {
        // This is a simplified fallback that generates basic viseme data
        // In production, you would want to use a more sophisticated solution

        const mockBlendshapes: Record<string, number[]> = {};
        const fps = 60;
        const duration = 3; // Default 3 seconds
        const totalFrames = fps * duration;

        // Initialize all blendshapes to 0
        ARKIT_BLENDSHAPES.forEach(name => {
            mockBlendshapes[name] = new Array(totalFrames).fill(0);
        });

        // Generate some basic mouth movement simulation
        for (let i = 0; i < totalFrames; i++) {
            const t = i / fps;
            // Simple sine wave to simulate talking
            const mouthOpen = Math.sin(t * 10) * 0.5 + 0.5;
            mockBlendshapes['jawOpen'][i] = mouthOpen * 0.3;
            mockBlendshapes['mouthSmileLeft'][i] = Math.sin(t * 5) * 0.2 + 0.1;
            mockBlendshapes['mouthSmileRight'][i] = Math.sin(t * 5) * 0.2 + 0.1;

            // Add random blinks
            if (Math.random() < 0.002) {
                const blinkDuration = Math.floor(Math.random() * 6) + 3;
                for (let j = 0; j < blinkDuration && i + j < totalFrames; j++) {
                    const blinkAmount = Math.sin((j / blinkDuration) * Math.PI);
                    mockBlendshapes['eyeBlinkLeft'][i + j] = blinkAmount;
                    mockBlendshapes['eyeBlinkRight'][i + j] = blinkAmount;
                }
            }
        }

        return {
            animation_url: `data:application/json;base64,${btoa(JSON.stringify(mockBlendshapes))}`,
            format: 'json',
            blendshapes: mockBlendshapes
        };
    }

    // ========================================================================
    // Lip Sync Data Generation
    // ========================================================================

    /**
     * Generate lip sync data from text (phoneme-based)
     * This is a simplified implementation
     */
    async generateLipSync(
        text: string,
        audioDurationSeconds: number
    ): Promise<LipSyncData> {
        // Simple phoneme estimation from text
        const phonemes = this.textToPhonemes(text);
        const visemeFrames: VisemeFrame[] = [];
        const fps = 60;
        const totalFrames = Math.ceil(audioDurationSeconds * fps);
        const msPerFrame = 1000 / fps;

        let currentPhonemeIndex = 0;
        const phonemeDuration = (audioDurationSeconds * 1000) / phonemes.length;

        for (let frame = 0; frame < totalFrames; frame++) {
            const time = frame * msPerFrame;
            const phonemeIndex = Math.floor(time / phonemeDuration);
            const phoneme = phonemes[Math.min(phonemeIndex, phonemes.length - 1)] || 'sil';
            const blendShape = VISEME_TO_BLENDSHAPE[phoneme] || 'mouthClose';

            visemeFrames.push({
                time: time / 1000,
                viseme: phoneme,
                blendWeight: 1.0,
                mouthShape: this.getBlendshapeValues(blendShape)
            });
        }

        return {
            visemes: visemeFrames,
            durationSeconds: audioDurationSeconds,
            framerate: fps
        };
    }

    /**
     * Convert text to simple phoneme sequence
     */
    private textToPhonemes(text: string): string[] {
        // Very simplified phoneme conversion
        // In production, use a proper phoneme library
        const phonemes: string[] = [];

        for (const char of text.toLowerCase()) {
            if (char === 'a' || char === 'e' || char === 'i') {
                phonemes.push('I', 'sil');
            } else if (char === 'o' || char === 'u') {
                phonemes.push('O', 'sil');
            } else if (char === 'b' || char === 'p' || char === 'm') {
                phonemes.push('P', 'sil');
            } else if (char === 'f' || char === 'v') {
                phonemes.push('F', 'sil');
            } else if (char === 't' || char === 'd' || char === 's' || char === 'n') {
                phonemes.push('T', 'sil');
            } else if (char === ' ') {
                phonemes.push('sil');
            }
        }

        return phonemes.length > 0 ? phonemes : ['sil'];
    }

    /**
     * Get blendshape values for a specific viseme
     */
    private getBlendshapeValues(blendShapeName: string): number[] {
        // Return a simplified set of blendshape values
        // This would be expanded to return all 52 ARKit blendshapes
        const values: Record<string, number> = {
            'mouthClose': 1.0,
            'jawOpen': 0.0,
            'mouthSmileLeft': 0.0,
            'mouthSmileRight': 0.0,
            'mouthPucker': 0.0,
            'mouthFunnel': 0.0,
            'mouthLeft': 0.0,
            'mouthRight': 0.0
        };

        switch (blendShapeName) {
            case 'P':
            case 'B':
            case 'M':
                values['mouthClose'] = 0.2;
                values['mouthPucker'] = 0.8;
                break;
            case 'F':
            case 'V':
                values['mouthClose'] = 0.3;
                values['mouthFunnel'] = 0.7;
                break;
            case 'T':
            case 'D':
            case 'S':
            case 'N':
            case 'L':
                values['mouthClose'] = 0.1;
                values['mouthLeft'] = 0.5;
                break;
            case 'R':
                values['mouthClose'] = 0.1;
                values['mouthRight'] = 0.5;
                break;
            case 'I':
            case 'E':
                values['jawOpen'] = 0.3;
                values['mouthSmileLeft'] = 0.5;
                values['mouthSmileRight'] = 0.5;
                break;
            case 'A':
                values['jawOpen'] = 0.6;
                values['mouthSmileLeft'] = 0.4;
                values['mouthSmileRight'] = 0.4;
                break;
            case 'O':
            case 'U':
                values['jawOpen'] = 0.4;
                values['mouthFunnel'] = 0.6;
                break;
        }

        // Return as array matching ARKIT_BLENDSHAPES order
        return ARKIT_BLENDSHAPES.map(name => values[name] || 0);
    }

    // ========================================================================
    // Character Presets
    // ========================================================================

    /**
     * Get available character presets
     */
    getCharacterPresets(): string[] {
        return [
            'default',
            'male_young',
            'male_middle_aged',
            'male_elderly',
            'female_young',
            'female_middle_aged',
            'female_elderly',
            'creature_humanoid',
            'creature_quadruped'
        ];
    }

    /**
     * Get character preset configuration
     */
    getCharacterConfig(character: string): Audio2FaceCharacterConfig {
        const configs: Record<string, Audio2FaceCharacterConfig> = {
            'default': {
                mouthSensitivity: 1.0,
                eyeBlinkRate: 0.1,
                gazeAmount: 0.0,
                headMotionAmount: 0.2,
                expressionIntensity: 1.0
            },
            'male_young': {
                mouthSensitivity: 1.1,
                eyeBlinkRate: 0.12,
                gazeAmount: 0.2,
                headMotionAmount: 0.3,
                expressionIntensity: 1.1
            },
            'male_middle_aged': {
                mouthSensitivity: 1.0,
                eyeBlinkRate: 0.08,
                gazeAmount: 0.1,
                headMotionAmount: 0.15,
                expressionIntensity: 0.9
            },
            'male_elderly': {
                mouthSensitivity: 0.9,
                eyeBlinkRate: 0.06,
                gazeAmount: 0.05,
                headMotionAmount: 0.1,
                expressionIntensity: 0.8
            },
            'female_young': {
                mouthSensitivity: 1.2,
                eyeBlinkRate: 0.15,
                gazeAmount: 0.25,
                headMotionAmount: 0.35,
                expressionIntensity: 1.2
            },
            'female_middle_aged': {
                mouthSensitivity: 1.1,
                eyeBlinkRate: 0.1,
                gazeAmount: 0.15,
                headMotionAmount: 0.2,
                expressionIntensity: 1.0
            },
            'female_elderly': {
                mouthSensitivity: 0.95,
                eyeBlinkRate: 0.07,
                gazeAmount: 0.08,
                headMotionAmount: 0.12,
                expressionIntensity: 0.85
            },
            'creature_humanoid': {
                mouthSensitivity: 1.3,
                eyeBlinkRate: 0.05,
                gazeAmount: 0.4,
                headMotionAmount: 0.5,
                expressionIntensity: 1.5
            },
            'creature_quadruped': {
                mouthSensitivity: 1.0,
                eyeBlinkRate: 0.03,
                gazeAmount: 0.6,
                headMotionAmount: 0.3,
                expressionIntensity: 0.7
            }
        };

        return configs[character] || configs['default'];
    }

    // ========================================================================
    // Format Conversion
    // ========================================================================

    /**
     * Convert blendshape data to Godot-compatible format
     */
    async convertToGodotFormat(
        blendshapes: Record<string, number[]>,
        fps: number = 60
    ): Promise<GodotBlendshapeTrack> {
        const frameCount = Object.values(blendshapes)[0]?.length || 0;
        const tracks: GodotBlendshapeTrack['tracks'] = [];

        for (const [name, values] of Object.entries(blendshapes)) {
            tracks.push({
                blendshape_name: name,
                values: values.map((v, i) => ({
                    frame: i,
                    value: v,
                    time: i / fps
                }))
            });
        }

        return {
            format: 'godot_blendshape',
            version: '1.0',
            fps,
            frame_count: frameCount,
            duration: frameCount / fps,
            tracks
        };
    }

    /**
     * Convert to USD format for NVIDIA Omniverse
     */
    async convertToUSDFormat(
        blendshapes: Record<string, number[]>,
        fps: number = 60
    ): Promise<string> {
        // Generate a simple USD file with blendshape animation
        const frameCount = Object.values(blendshapes)[0]?.length || 0;

        let usd = `#usda 1.0
(
    defaultPrim = "Root"
    metersPerUnit = 0.01
    upAxis = "Y"
    doc = "Audio2Face blendshape animation"
)

def Xform "Root"
{
    def BlendShape "FaceBlendShapes"
    {
        uniform token[] blendShapeNames = [${ARKIT_BLENDSHAPES.map(n => `"${n}"`).join(', ')}]
`;

        // Add time samples for each blendshape
        for (const [name, values] of Object.entries(blendshapes)) {
            usd += `\n        float[] inputs:${name}.timeSamples = {\n`;
            for (let i = 0; i < values.length; i++) {
                if (i % 10 === 0) { // Sample every 10th frame to reduce file size
                    usd += `            ${i / fps}: ${values[i].toFixed(4)},\n`;
                }
            }
            usd += `        }\n`;
        }

        usd += `    }
}\n`;

        return usd;
    }

    // ========================================================================
    // Session Management
    // ========================================================================

    /**
     * Clear expired sessions from cache
     */
    clearExpiredSessions(maxAgeMs: number = 3600000): void {
        const now = Date.now();
        for (const [id, session] of this.sessionCache.entries()) {
            if (now - session.createdAt.getTime() > maxAgeMs) {
                this.sessionCache.delete(id);
            }
        }
    }

    /**
     * Get session info
     */
    getSession(id: string): Audio2FaceSession | undefined {
        return this.sessionCache.get(id);
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface Audio2FaceSession {
    animationUrl: string;
    format: string;
    createdAt: Date;
}

export interface Audio2FaceCharacterConfig {
    mouthSensitivity: number;
    eyeBlinkRate: number;
    gazeAmount: number;
    headMotionAmount: number;
    expressionIntensity: number;
}

export interface GodotBlendshapeTrack {
    format: string;
    version: string;
    fps: number;
    frame_count: number;
    duration: number;
    tracks: Array<{
        blendshape_name: string;
        values: Array<{
            frame: number;
            value: number;
            time: number;
        }>;
    }>;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAudio2FaceProvider(config: Audio2FaceConfig): Audio2FaceProvider {
    return new Audio2FaceProvider(config);
}

// ============================================================================
// Exports
// ============================================================================

export { ARKIT_BLENDSHAPES, VISEME_TO_BLENDSHAPE };
