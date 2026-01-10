/**
 * StudyLoG.AI - Digital Tutor Common Types
 *
 * Digital Tutor widget provides an AI-powered avatar tutor with:
 * - Real-time lip-sync and facial expressions
 * - Voice input/output
 * - Eye contact simulation
 * - Emotion-aware responses
 */

// Widget constants
export const DigitalTutorWidget = {
  ID: 'si-digital-tutor:widget',
  LABEL: 'Digital Tutor',
  ICON_CLASS: 'fa fa-user-astronaut',
} as const;

// Agent personality types
export type TutorPersonality = 'tutor' | 'captain' | 'teacher' | 'builder';

// Voice model options
export type VoiceModel = 'us-male-1' | 'us-female-1' | 'uk-male-1' | 'uk-female-1';

// Avatar model options
export type AvatarModel = 'studylog-tutor-1' | 'studylog-captain-1' | 'nvidia-ella' | 'nvidia-james';

// Emotion types
export type TutorEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'confused'
  | 'thinking'
  | 'excited'
  | 'concerned'
  | 'encouraging';

// Animation blend shape
export interface BlendShape {
  name: string;
  value: number;
}

// Animation frame
export interface AnimationFrame {
  timestamp: number;
  blendShapes: BlendShape[];
  headRotation?: {
    x: number;
    y: number;
    z: number;
  };
  eyeGaze?: {
    x: number;
    y: number;
  };
}

// Chat message
export interface TutorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  emotion?: TutorEmotion;
  audioUrl?: string;
  animation?: AnimationFrame[];
}

// Agent configuration
export interface AgentConfig {
  agentId: string;
  personality: TutorPersonality;
  voiceModel: VoiceModel;
  avatarModel: AvatarModel;
  capabilities: string[];
  defaultEmotion?: TutorEmotion;
}

// Interaction request
export interface InteractionRequest {
  agentId: string;
  input?: string;
  audioData?: ArrayBuffer;
  emotion?: TutorEmotion;
  sessionId?: string;
  userId?: string;
  enableAnimation?: boolean;
  enableAudio?: boolean;
}

// Interaction response
export interface InteractionResponse {
  agentId: string;
  text: string;
  audioUrl?: string;
  audioDuration?: number;
  blendShapes?: Record<string, number>;
  animationTimeline?: AnimationFrame[];
  emotion?: TutorEmotion;
  timestamp: number;
  processingTimeMs: number;
}

// Session info
export interface SessionInfo {
  sessionId: string;
  agentId: string;
  userId: string;
  personality: TutorPersonality;
  startedAt: number;
  messageCount: number;
}

// Digital Tutor configuration
export interface DigitalTutorConfig {
  // Agent settings
  defaultPersonality: TutorPersonality;
  defaultVoiceModel: VoiceModel;
  defaultAvatarModel: AvatarModel;

  // Feature flags
  enableFacialAnimation: boolean;
  enableEyeContact: boolean;
  enableEmotionDetection: boolean;
  autoPlayAudio: boolean;

  // Display settings
  avatarSize: number;
  avatarPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

  // Voice settings
  voiceInputEnabled: boolean;
  voiceInputAutoSend: boolean;

  // Eye contact settings
  eyeContactStrength: number;

  // Animation settings
  animationSmoothing: number;
}

// Agent information for display
export const AGENT_INFO: Record<TutorPersonality, {
  name: string;
  description: string;
  icon: string;
  color: string;
}> = {
  tutor: {
    name: 'Tutor',
    description: 'Step-by-step guidance with encouragement',
    icon: 'fa fa-graduation-cap',
    color: '#4CAF50',
  },
  captain: {
    name: 'Captain',
    description: 'Orchestrates your learning journey',
    icon: 'fa fa-anchor',
    color: '#2196F3',
  },
  teacher: {
    name: 'Teacher',
    description: 'Clear explanations and tutorials',
    icon: 'fa fa-chalkboard-teacher',
    color: '#FF9800',
  },
  builder: {
    name: 'Builder',
    description: 'Technical guidance for code',
    icon: 'fa fa-hammer',
    color: '#9C27B0',
  },
};

// Emotion information for display
export const EMOTION_INFO: Record<TutorEmotion, {
  name: string;
  icon: string;
  blendShapes: Record<string, number>;
}> = {
  neutral: {
    name: 'Neutral',
    icon: 'fa fa-meh',
    blendShapes: {
      mouthClose: 0.5,
      jawOpen: 0,
    },
  },
  happy: {
    name: 'Happy',
    icon: 'fa fa-smile',
    blendShapes: {
      mouthSmileLeft: 0.8,
      mouthSmileRight: 0.8,
      eyeSquintLeft: 0.3,
      eyeSquintRight: 0.3,
    },
  },
  sad: {
    name: 'Sad',
    icon: 'fa fa-frown',
    blendShapes: {
      mouthFrownLeft: 0.5,
      mouthFrownRight: 0.5,
      browOuterUpLeft: 0.2,
      browOuterUpRight: 0.2,
    },
  },
  angry: {
    name: 'Angry',
    icon: 'fa fa-angry',
    blendShapes: {
      browDownLeft: 0.5,
      browDownRight: 0.5,
      mouthFrownLeft: 0.3,
      mouthFrownRight: 0.3,
      eyeSquintLeft: 0.4,
      eyeSquintRight: 0.4,
    },
  },
  surprised: {
    name: 'Surprised',
    icon: 'fa fa-surprise',
    blendShapes: {
      jawOpen: 0.6,
      mouthStretchLeft: 0.3,
      mouthStretchRight: 0.3,
      eyeWideLeft: 0.8,
      eyeWideRight: 0.8,
      browInnerUp: 0.5,
    },
  },
  confused: {
    name: 'Confused',
    icon: 'fa fa-question',
    blendShapes: {
      browInnerUp: 0.4,
      browOuterUpLeft: 0.3,
      browOuterUpRight: 0.3,
      mouthClose: 0.8,
      eyeSquintLeft: 0.2,
    },
  },
  thinking: {
    name: 'Thinking',
    icon: 'fa fa-brain',
    blendShapes: {
      browInnerUp: 0.5,
      eyeSquintLeft: 0.3,
      eyeSquintRight: 0.3,
      mouthClose: 0.9,
    },
  },
  excited: {
    name: 'Excited',
    icon: 'fa fa-bolt',
    blendShapes: {
      jawOpen: 0.3,
      mouthSmileLeft: 1.0,
      mouthSmileRight: 1.0,
      eyeWideLeft: 0.5,
      eyeWideRight: 0.5,
    },
  },
  concerned: {
    name: 'Concerned',
    icon: 'fa fa-exclamation-triangle',
    blendShapes: {
      browInnerUp: 0.3,
      browOuterUpLeft: 0.4,
      browOuterUpRight: 0.4,
      mouthFrownLeft: 0.2,
      mouthFrownRight: 0.2,
    },
  },
  encouraging: {
    name: 'Encouraging',
    icon: 'fa fa-thumbs-up',
    blendShapes: {
      mouthSmileLeft: 0.6,
      mouthSmileRight: 0.6,
      browOuterUpLeft: 0.2,
      browOuterUpRight: 0.2,
    },
  },
};

// Default configuration
export const DEFAULT_CONFIG: DigitalTutorConfig = {
  defaultPersonality: 'tutor',
  defaultVoiceModel: 'us-female-1',
  defaultAvatarModel: 'studylog-tutor-1',
  enableFacialAnimation: true,
  enableEyeContact: true,
  enableEmotionDetection: true,
  autoPlayAudio: false,
  avatarSize: 1.0,
  avatarPosition: 'bottom-right',
  voiceInputEnabled: true,
  voiceInputAutoSend: false,
  eyeContactStrength: 0.7,
  animationSmoothing: 0.8,
};

// API endpoints
export const API_ENDPOINTS = {
  BASE: '/api/v1/digital-human',
  AGENTS: '/api/v1/digital-human/agents',
  INTERACT: '/api/v1/digital-human/interact',
  SESSIONS: '/api/v1/digital-human/sessions',
  AUDIO2FACE_CONFIG: '/api/v1/digital-human/audio2face/config',
} as const;

// Audio configuration
export const AUDIO_CONFIG = {
  sampleRate: 24000,
  channelCount: 1,
  bitDepth: 16,
  mimeTypes: [
    'audio/webm',
    'audio/ogg',
    'audio/wav',
  ],
} as const;
