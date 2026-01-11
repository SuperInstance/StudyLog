/**
 * StudyLoG.AI - Hardware Detection
 *
 * Detects NVIDIA GPUs, Jetson devices, and Arduino boards.
 * Works on Linux, macOS, and Windows.
 */
export interface GPUInfo {
    name: string;
    vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown';
    vramMb: number;
    driverVersion?: string;
    cudaVersion?: string;
    computeCapability?: string;
    isJetson: boolean;
}
export interface SystemInfo {
    platform: 'linux' | 'darwin' | 'win32';
    arch: string;
    ramMb: number;
    cpuCores: number;
    cpuModel: string;
}
export interface ArduinoInfo {
    port: string;
    board: string;
    serialNumber?: string;
}
export interface HardwareProfile {
    system: SystemInfo;
    gpus: GPUInfo[];
    arduino: ArduinoInfo[];
    detectedAt: string;
    tier: 'starter' | 'maker' | 'edge' | 'power' | 'pro';
    capabilities: {
        canRunOllama: boolean;
        canRunAce: boolean;
        canRunVision: boolean;
        maxModelSize: string;
        recommendedModels: string[];
    };
}
export declare function detectHardware(): Promise<HardwareProfile>;
export declare function canRunLocalAI(): Promise<boolean>;
export declare function formatProfile(profile: HardwareProfile): string;
//# sourceMappingURL=detect.d.ts.map