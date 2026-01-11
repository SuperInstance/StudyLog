/**
 * NVIDIA ACE Audio2Face Provider Implementation
 *
 * Integration with NVIDIA ACE Audio2Face for generating facial animations
 * from audio input. This enables realistic lip-sync and facial expressions
 * for AI characters in StudyLoG.AI and DMLoG.AI.
 *
 * Reference: https://developer.nvidia.com/ace
 * Documentation: https://docs.nvidia.com/ace/
 *
 * Features:
 * - Audio-driven facial animation
 * - Blendshape generation
 * - Bone rotation output
 * - Multiple face mesh support
 * - Godot-compatible output format
 */

import type {
    Audio2FaceRequest,
    Audio2FaceResponse,
    AnimationData,
    BlendshapeFrame,
    BoneFrame,
    BoneRotation,
    AceAudio2FaceConfig,
    PhonemeTiming,
    AudioFormat
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const ACE_AUDIO2FACE_DEFAULT_ENDPOINT = 'https://api.nvidia.com/ace/audio2face/v1';

// Standard ARKit blendshape count (52 shapes)
const ARKIT_BLENDSHAPE_COUNT = 52;

// Standard blendshape names (ARKit)
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
];

// Viseme to blendshape mapping (simplified)
const VISEME_TO_BLENDSHAPE: Record<number, string[]> = {
    0: ['jawOpen', 'mouthFunnel'],           // A, ah
    1: ['mouthStretchLeft', 'mouthStretchRight'], // E
    2: ['mouthStretchLeft', 'mouthStretchRight', 'jawOpen'], // I
    3: ['mouthPucker', 'mouthFunnel'],       // O
    4: ['mouthPucker', 'mouthFunnel'],       // U
    5: ['mouthClose', 'jawOpen'],            // B, P
    6: ['mouthClose'],                       // M
    7: ['mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthStretchLeft', 'mouthStretchRight'], // F, V
    8: ['mouthTongueOut'],                   // TH
    9: ['mouthDimpleLeft', 'mouthDimpleRight'], // S, Z
    10: ['mouthPressLeft', 'mouthPressRight'], // D, T
    11: ['mouthSmileLeft', 'mouthSmileRight'], // N
    12: ['mouthStretchLeft', 'mouthStretchRight', 'mouthDimpleLeft', 'mouthDimpleRight'], // CH, SH, J
    13: ['mouthDimpleLeft', 'mouthDimpleRight', 'mouthPressLeft', 'mouthPressRight'], // K, G
    14: ['mouthDimpleLeft', 'mouthDimpleRight'], // NG
    15: ['mouthStretchLeft', 'mouthStretchRight', 'mouthFunnel'], // W
    16: ['mouthDimpleLeft', 'mouthDimpleRight', 'mouthSmileLeft', 'mouthSmileRight'], // R
    17: ['browInnerUp', 'browOuterUpLeft', 'browOuterUpRight'], // Sil
    18: ['mouthClose', 'jawOpen']            // Pau
};

// ============================================================================
// Types
// ============================================================================

interface Audio2FaceJobRequest {
    audio: string; // base64 encoded audio
    character_id?: string;
    face_mesh?: string;
    output_format?: 'blendshapes' | 'bones' | 'both';
    frame_rate?: number;
    quality?: 'draft' | 'standard' | 'high';
    include_phonemes?: boolean;
}

interface Audio2FaceJobResponse {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    estimated_time?: number;
}

interface Audio2FaceResultResponse {
    job_id: string;
    status: 'completed' | 'failed';
    animation?: AnimationData;
    error?: string;
    processing_time_ms?: number;
}

// ============================================================================
// ACE Audio2Face Client Class
// ============================================================================

/**
 * NVIDIA ACE Audio2Face Client
 *
 * Generates facial animations from audio input using NVIDIA's ACE technology.
 * Supports both blendshape-based and bone-based animation output.
 */
export class AceAudio2FaceClient {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultMesh: string;
    private readonly animationServer: string;

    // Job tracking cache
    private readonly activeJobs = new Map<string, {
        startTime: number;
        status: 'pending' | 'processing' | 'completed' | 'failed';
    }>();

    constructor(config: AceAudio2FaceConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.endpoint || ACE_AUDIO2FACE_DEFAULT_ENDPOINT;
        this.defaultMesh = config.defaultMesh || 'arkit';
        this.animationServer = config.animationServer || this.baseUrl;
    }

    // ========================================================================
    // Audio2Face Generation
    // ========================================================================

    /**
     * Generate facial animation from audio
     *
     * @param request - Audio2Face request parameters
     * @returns Promise resolving to animation response
     */
    async generateAnimation(request: Audio2FaceRequest): Promise<Audio2FaceResponse> {
        const startTime = Date.now();

        try {
            // Convert audio to base64 if needed
            let audioBase64: string;
            if (request.audio instanceof ArrayBuffer) {
                audioBase64 = this.arrayBufferToBase64(request.audio);
            } else {
                audioBase64 = request.audio;
            }

            // Determine output format
            const outputFormat = request.outputFormat || 'blendshapes';
            const includeBones = outputFormat === 'bones' || outputFormat === 'both';
            const includeBlendshapes = outputFormat === 'blendshapes' || outputFormat === 'both';

            // Submit job
            const body: Audio2FaceJobRequest = {
                audio: audioBase64,
                character_id: request.characterId,
                face_mesh: this.defaultMesh,
                output_format: outputFormat === 'json' ? 'both' : outputFormat,
                frame_rate: request.frameRate || 60,
                quality: request.quality || 'standard',
                include_phonemes: request.includeBlendshapes !== false
            };

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/generate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `ACE Audio2Face error: ${response.status}`);
            }

            const data = await response.json() as Audio2FaceJobResponse;

            // Track job
            this.activeJobs.set(data.job_id, {
                startTime: Date.now(),
                status: data.status
            });

            // If processing, return job ID
            if (data.status === 'pending' || data.status === 'processing') {
                return {
                    success: true,
                    animationId: data.job_id,
                    provider: 'ace_audio2face',
                    processingTimeMs: Date.now() - startTime,
                    costUsd: this.calculateCost(0) // Will be calculated when job completes
                };
            }

            // If completed, fetch result
            if (data.status === 'completed') {
                const result = await this.getJobResult(data.job_id);
                if (result.animation) {
                    return {
                        success: true,
                        animationId: data.job_id,
                        animationData: result.animation,
                        provider: 'ace_audio2face',
                        duration: result.animation.duration,
                        frameCount: result.animation.frameCount,
                        processingTimeMs: result.processing_time_ms || Date.now() - startTime,
                        costUsd: this.calculateCost(result.animation.duration)
                    };
                }
            }

            throw new Error('Unexpected job status');
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Animation generation failed'
            };
        }
    }

    /**
     * Get the result of a previously submitted job
     *
     * @param jobId - The job ID
     * @returns Promise resolving to job result
     */
    async getJobResult(jobId: string): Promise<Audio2FaceResultResponse> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/jobs/${jobId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch job result: ${response.status}`);
            }

            const data = await response.json() as Audio2FaceResultResponse;

            // Update job tracking
            if (this.activeJobs.has(jobId)) {
                this.activeJobs.get(jobId)!.status = data.status;
            }

            return data;
        } catch (error) {
            return {
                job_id: jobId,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Failed to fetch result'
            };
        }
    }

    /**
     * Wait for job completion
     *
     * @param jobId - The job ID
     * @param timeout - Maximum wait time in milliseconds
     * @param pollInterval - Polling interval in milliseconds
     * @returns Promise resolving to final result
     */
    async waitForJob(
        jobId: string,
        timeout: number = 30000,
        pollInterval: number = 500
    ): Promise<Audio2FaceResultResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const result = await this.getJobResult(jobId);

            if (result.status === 'completed') {
                return result;
            }

            if (result.status === 'failed') {
                return result;
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return {
            job_id: jobId,
            status: 'failed',
            error: 'Job timeout'
        };
    }

    // ========================================================================
    // Direct Animation Generation (Synchronous)
    // ========================================================================

    /**
     * Generate animation synchronously (for shorter audio)
     *
     * @param request - Audio2Face request parameters
     * @returns Promise resolving to animation response with data
     */
    async generateAnimationSync(request: Audio2FaceRequest): Promise<Audio2FaceResponse> {
        // First submit the job
        const initResponse = await this.generateAnimation(request);

        if (!initResponse.success || !initResponse.animationId) {
            return initResponse;
        }

        // Wait for completion
        const result = await this.waitForJob(initResponse.animationId);

        if (result.status === 'completed' && result.animation) {
            return {
                success: true,
                animationId: result.job_id,
                animationData: result.animation,
                provider: 'ace_audio2face',
                duration: result.animation.duration,
                frameCount: result.animation.frameCount,
                processingTimeMs: result.processing_time_ms,
                costUsd: this.calculateCost(result.animation.duration)
            };
        }

        return {
            success: false,
            error: result.error || 'Animation generation failed'
        };
    }

    // ========================================================================
    // Phoneme-based Animation (Fallback)
    // ========================================================================

    /**
     * Generate animation from phoneme timing data
     * This is a fallback method when ACE API is unavailable
     *
     * @param phonemes - Array of phoneme timings
     * @param frameRate - Output frame rate
     * @returns Animation data with blendshapes
     */
    generateFromPhonemes(phonemes: PhonemeTiming[], frameRate: number = 60): AnimationData {
        const totalDuration = phonemes[phonemes.length - 1]?.endTime || 0;
        const frameCount = Math.ceil(totalDuration * frameRate);
        const frameDuration = 1 / frameRate;

        const blendshapes: BlendshapeFrame[] = [];

        for (let frame = 0; frame < frameCount; frame++) {
            const time = frame * frameDuration;

            // Find active phoneme at this time
            const activePhoneme = phonemes.find(p => time >= p.startTime && time < p.endTime);

            // Initialize all blendshapes to 0
            const values = new Array(ARKIT_BLENDSHAPE_COUNT).fill(0);
            const named: Record<string, number> = {};

            if (activePhoneme) {
                // Get blendshapes for this viseme
                const bsNames = VISEME_TO_BLENDSHAPE[activePhoneme.viseme] || [];

                for (const bsName of bsNames) {
                    const index = ARKIT_BLENDSHAPE_NAMES.indexOf(bsName);
                    if (index >= 0) {
                        values[index] = 0.5; // Set to 50% intensity
                        named[bsName] = 0.5;
                    }
                }

                // Add some natural eye blink
                if (Math.random() < 0.01) {
                    const blinkLeft = ARKIT_BLENDSHAPE_NAMES.indexOf('eyeBlinkLeft');
                    const blinkRight = ARKIT_BLENDSHAPE_NAMES.indexOf('eyeBlinkRight');
                    if (blinkLeft >= 0) values[blinkLeft] = 0.3;
                    if (blinkRight >= 0) values[blinkRight] = 0.3;
                }
            }

            blendshapes.push({
                frame,
                time,
                values,
                named: Object.keys(named).length > 0 ? named : undefined
            });
        }

        return {
            frameRate,
            duration: totalDuration,
            frameCount,
            blendshapes,
            metadata: {
                generatedAt: Date.now()
            }
        };
    }

    // ========================================================================
    // Godot Export
    // ========================================================================

    /**
     * Export animation data as Godot-compatible format
     *
     * @param animation - Animation data
     * @returns Godot AnimationResource JSON
     */
    exportToGodot(animation: AnimationData): string {
        const tracks: any[] = [];

        // Export blendshapes as value tracks
        if (animation.blendshapes && animation.blendshapes.length > 0) {
            for (let i = 0; i < ARKIT_BLENDSHAPE_COUNT; i++) {
                const bsName = ARKIT_BLENDSHAPE_NAMES[i];

                // Build keyframe data
                const keyframes: any[] = [];
                for (const frame of animation.blendshapes) {
                    keyframes.push({
                        time: frame.time,
                        value: frame.values[i]
                    });
                }

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

        // Export bone rotations as rotation tracks
        if (animation.bones && animation.bones.length > 0) {
            const boneNames = new Set<string>();
            for (const frame of animation.bones) {
                for (const rot of frame.rotations) {
                    boneNames.add(rot.bone);
                }
            }

            for (const boneName of boneNames) {
                const keyframes: any[] = [];
                for (const frame of animation.bones) {
                    const rotation = frame.rotations.find(r => r.bone === boneName);
                    if (rotation) {
                        keyframes.push({
                            time: frame.time,
                            value: rotation.quaternion // [x, y, z, w]
                        });
                    }
                }

                tracks.push({
                    type: 'rotation_3d',
                    path: `Skeleton3D:${boneName}`,
                    interp: 1,
                    loop_wrap: true,
                    imported: true,
                    enabled: true,
                    keys: keyframes
                });
            }
        }

        // Build Godot AnimationResource
        const godotAnimation = {
            'resource_name': 'audio2face_animation',
            'length': animation.duration,
            'loop_mode': 0, // No loop
            'step': 1 / animation.frameRate,
            'tracks': tracks
        };

        return JSON.stringify(godotAnimation, null, 2);
    }

    /**
     * Export animation as GDScript resource
     *
     * @param animation - Animation data
     * @param resourceName - Name for the resource
     * @returns GDScript resource file content
     */
    exportToGodotResource(animation: AnimationData, resourceName: string = 'audio2face'): string {
        return `# Audio2Face Animation Resource
# Generated by ACE Audio2Face provider

extends AnimationResource

@export var duration: float = ${animation.duration.toFixed(3)}
@export var loop: bool = false
@export var frame_rate: int = ${animation.frameRate}

# Blendshape tracks
var blendshape_data = ${JSON.stringify(animation.blendshapes?.slice(0, 10) || [])}

func _get_blendshape_value(shape_name: String, time: float) -> float:
\t# Find the frame at the given time
\tvar frame_idx = int(time * frame_rate)
\tif frame_idx >= len(blendshape_data):
\t\treturn 0.0
\t
\tvar frame = blendshape_data[frame_idx]
\tvar shape_idx = ${JSON.stringify(ARKIT_BLENDSHAPE_NAMES)}.find(shape_name)
\tif shape_idx < 0:
\t\treturn 0.0
\t
\treturn frame.values[shape_idx]
`;
    }

    // ========================================================================
    // Health & Status
    // ========================================================================

    /**
     * Check API health
     *
     * @returns True if API is accessible
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/health`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get supported face meshes
     *
     * @returns Array of supported mesh names
     */
    async getSupportedMeshes(): Promise<string[]> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/meshes`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            if (!response.ok) {
                return ['arkit']; // Default fallback
            }

            const data = await response.json() as { meshes: string[] };
            return data.meshes || ['arkit'];
        } catch {
            return ['arkit'];
        }
    }

    // ========================================================================
    // Cost Calculation
    // ========================================================================

    /**
     * Calculate cost for animation generation
     *
     * @param durationSeconds - Audio duration in seconds
     * @returns Cost in USD
     */
    private calculateCost(durationSeconds: number): number {
        // ACE Audio2Face pricing: ~$0.001 per second
        return Math.max(0.001, durationSeconds * 0.001);
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Make authenticated fetch request
     */
    private async fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
        return fetch(url, options);
    }

    /**
     * Convert ArrayBuffer to base64
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        return btoa(binary);
    }

    /**
     * Get audio duration from buffer (estimate)
     */
    private estimateAudioDuration(buffer: ArrayBuffer, format: AudioFormat = 'mp3'): number {
        // Rough estimate based on file size
        // MP3: ~1KB per second at 128kbps
        const bytesPerSecond = format === 'mp3' ? 16000 : 176000; // 128kbps vs 1280kbps for WAV
        return buffer.byteLength / bytesPerSecond;
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Clean up old job tracking data
     */
    cleanupOldJobs(maxAge: number = 3600000): void {
        const now = Date.now();
        for (const [jobId, job] of this.activeJobs.entries()) {
            if (now - job.startTime > maxAge) {
                this.activeJobs.delete(jobId);
            }
        }
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an ACE Audio2Face client
 *
 * @param config - ACE Audio2Face configuration
 * @returns Configured AceAudio2FaceClient
 */
export function createAceAudio2FaceClient(config: AceAudio2FaceConfig): AceAudio2FaceClient {
    return new AceAudio2FaceClient(config);
}

/**
 * Create ACE Audio2Face client from environment
 *
 * @param env - Environment object with NVIDIA_API_KEY
 * @returns Configured AceAudio2FaceClient or null
 */
export function createAceAudio2FaceClientFromEnv(env: {
    NVIDIA_API_KEY?: string;
    ACE_AUDIO2FACE_ENDPOINT?: string;
}): AceAudio2FaceClient | null {
    const apiKey = env.NVIDIA_API_KEY;
    if (!apiKey) {
        return null;
    }
    return createAceAudio2FaceClient({
        apiKey,
        endpoint: env.ACE_AUDIO2FACE_ENDPOINT
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Viseme to blendshape name mapping
 *
 * @param viseme - Viseme code (0-20)
 * @returns Array of blendshape names
 */
export function visemeToBlendshapes(viseme: number): string[] {
    return VISEME_TO_BLENDSHAPE[viseme] || [];
}

/**
 * Get ARKit blendshape names
 *
 * @returns Array of all ARKit blendshape names
 */
export function getARKitBlendshapeNames(): string[] {
    return [...ARKIT_BLENDSHAPE_NAMES];
}

/**
 * Get number of ARKit blendshapes
 *
 * @returns Count of ARKit blendshapes
 */
export function getARKitBlendshapeCount(): number {
    return ARKIT_BLENDSHAPE_COUNT;
}

// ============================================================================
// Re-exports
// ============================================================================

export { ARKIT_BLENDSHAPE_NAMES, ARKIT_BLENDSHAPE_COUNT };
