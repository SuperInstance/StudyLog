/**
 * Real-Time Communication Types
 *
 * Complete type definitions for WebSocket-based real-time features
 * including virtual classrooms, presence, and WebRTC signaling.
 */

// ============================================================================
// Connection Types
// ============================================================================

/**
 * WebSocket connection state
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

/**
 * WebSocket message direction
 */
export type MessageDirection = 'incoming' | 'outgoing';

/**
 * Connected client information
 */
export interface ConnectedClient {
  /**
   * Unique connection ID
   */
  connectionId: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Tenant ID
   */
  tenantId: string;

  /**
   * User's display name
   */
  displayName: string;

  /**
   * User's avatar URL
   */
  avatar?: string;

  /**
   * User's role
   */
  role: 'teacher' | 'student' | 'assistant' | 'observer';

  /**
   * Current room ID
   */
  roomId?: string;

  /**
   * Connection state
   */
  state: ConnectionState;

  /**
   * Connected at timestamp
   */
  connectedAt: string;

  /**
   * Last activity timestamp
   */
  lastActivityAt: string;

  /**
   * Client capabilities
   */
  capabilities: ClientCapabilities;

  /**
   * User-agent string
   */
  userAgent?: string;

  /**
   * IP address
   */
  ipAddress?: string;
}

/**
 * Client capabilities for feature negotiation
 */
export interface ClientCapabilities {
  /**
   * Supports WebRTC
   */
  webrtc: boolean;

  /**
   * Supports screen sharing
   */
  screenShare: boolean;

  /**
   * Supports audio
   */
  audio: boolean;

  /**
   * Supports video
   */
  video: boolean;

  /**
   * Supported codecs
   */
  codecs?: string[];

  /**
   * Max video resolution
   */
  maxResolution?: '360p' | '480p' | '720p' | '1080p' | '4k';
}

// ============================================================================
// Room Types
// ============================================================================

/**
 * Room type
 */
export type RoomType =
  | 'classroom'      // Live tutoring session
  | 'study_group'    // Small group collaboration
  | 'lecture'        // One-to-many broadcast
  | 'lab'           // Hands-on coding session
  | 'office_hours'  // Q&A session
  | 'breakout';     // Small group breakout room

/**
 * Room state
 */
export type RoomState = 'forming' | 'active' | 'paused' | 'ended';

/**
 * Virtual classroom / room
 */
export interface Room {
  /**
   * Unique room ID
   */
  id: string;

  /**
   * Room name
   */
  name: string;

  /**
   * Room type
   */
  type: RoomType;

  /**
   * Tenant ID
   */
  tenantId: string;

  /**
   * Room state
   */
  state: RoomState;

  /**
   * Room owner (teacher/host)
   */
  ownerId: string;

  /**
   * Room capacity (max participants)
   */
  maxParticipants: number;

  /**
   * Current participant count
   */
  currentParticipants: number;

  /**
   * Room settings
   */
  settings: RoomSettings;

  /**
   * Active sessions (media streams)
   */
  sessions: RoomSession[];

  /**
   * Created at timestamp
   */
  createdAt: string;

  /**
   * Started at timestamp (when first participant joined)
   */
  startedAt?: string;

  /**
   * Ended at timestamp
   */
  endedAt?: string;

  /**
   * Scheduled start time (for future sessions)
   */
  scheduledFor?: string;

  /**
   * Scheduled duration in minutes
   */
  durationMinutes?: number;
}

/**
 * Room settings
 */
export interface RoomSettings {
  /**
   * Allow participants to join without approval
   */
  openJoin: boolean;

  /**
   * Require password to join
   */
  password?: string;

  /**
   * Enable chat
   */
  chatEnabled: boolean;

  /**
   * Enable voice
   */
  voiceEnabled: boolean;

  /**
   * Enable video
   */
  videoEnabled: boolean;

  /**
   * Enable screen sharing
   */
  screenShareEnabled: boolean;

  /**
   * Enable recording
   */
  recordingEnabled: boolean;

  /**
   * Who can speak
   */
  whoCanSpeak: 'everyone' | 'teacher' | 'raised_hand';

  /**
   * Who can share screen
   */
  whoCanShare: 'everyone' | 'teacher';

  /**
   * Enable waiting room
   */
  waitingRoom: boolean;

  /**
   * Enable breakout rooms
   */
  breakoutRooms: boolean;

  /**
   * Max breakout rooms
   */
  maxBreakoutRooms?: number;

  /**
   * Allow hand raising
   */
  handRaiseEnabled: boolean;

  /**
   * Enable reactions
   */
  reactionsEnabled: boolean;

  /**
   * Mute on join
   */
  muteOnJoin: boolean;

  /**
   * Enable AI assistant
   */
  aiAssistant: boolean;
}

/**
 * Active media session within a room
 */
export interface RoomSession {
  /**
   * Session ID
   */
  id: string;

  /**
   * User ID
   */
  userId: string;

  /**
   * Session type
   */
  type: 'audio' | 'video' | 'screen' | 'presentation';

  /**
   * Is currently active
   */
  active: boolean;

  /**
   * Started at
   */
  startedAt: string;

  /**
   * WebRTC peer connections
   */
  peerConnections: Map<string, PeerConnectionInfo>;
}

/**
 * WebRTC peer connection info
 */
export interface PeerConnectionInfo {
  /**
   * Remote user ID
   */
  remoteUserId: string;

  /**
   * Connection state
   */
  state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';

  /**
   * ICE connection state
   */
  iceState: 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed';

  /**
   * ICE candidates received
   */
  iceCandidatesReceived: number;

  /**
   * ICE candidates sent
   */
  iceCandidatesSent: number;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * WebSocket message types
 */
export type MessageType =
  | 'welcome'
  | 'error'
  | 'room.join'
  | 'room.leave'
  | 'room.update'
  | 'room.list'
  | 'presence.update'
  | 'presence.list'
  | 'chat.message'
  | 'chat.typing'
  | 'webrtc.offer'
  | 'webrtc.answer'
  | 'webrtc.ice'
  | 'webrtc.end'
  | 'hand.raise'
  | 'reaction.send'
  | 'poll.create'
  | 'poll.vote'
  | 'whiteboard.sync'
  | 'control.grant'
  | 'control.revoke'
  | 'recording.start'
  | 'recording.stop';

/**
 * Base WebSocket message
 */
export interface WSMessage<T = unknown> {
  /**
   * Message type
   */
  type: MessageType;

  /**
   * Message ID (for correlation)
   */
  id: string;

  /**
   * Timestamp
   */
  timestamp: string;

  /**
   * Sender info (populated server-side)
   */
  from?: string;

  /**
   * Target (userId or 'all')
   */
  to?: string | 'all';

  /**
   * Message payload
   */
  data: T;
}

// ============================================================================
// Chat Types
// ============================================================================

/**
 * Chat message
 */
export interface ChatMessage {
  /**
   * Message ID
   */
  id: string;

  /**
   * Room ID
   */
  roomId: string;

  /**
   * Sender user ID
   */
  senderId: string;

  /**
   * Sender display name
   */
  senderName: string;

  /**
   * Message content
   */
  content: string;

  /**
   * Message type
   */
  messageType: 'text' | 'emoji' | 'file' | 'system';

  /**
   * Is a direct message (private)
   */
  isPrivate: boolean;

  /**
   * Target user ID (if private)
   */
  targetUserId?: string;

  /**
   * Reply to message ID
   */
  replyTo?: string;

  /**
   * Reactions
   */
  reactions: MessageReaction[];

  /**
   * Timestamp
   */
  timestamp: string;

  /**
   * Edited at
   */
  editedAt?: string;

  /**
   * Deleted flag
   */
  deleted: boolean;
}

/**
 * Message reaction
 */
export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
}

/**
 * Typing indicator
 */
export interface TypingIndicator {
  roomId: string;
  userId: string;
  userName: string;
  timestamp: string;
}

// ============================================================================
// Presence Types
// ============================================================================

/**
 * Presence status
 */
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

/**
 * User presence information
 */
export interface Presence {
  /**
   * User ID
   */
  userId: string;

  /**
   * Current status
   */
  status: PresenceStatus;

  /**
   * Current room ID
   */
  currentRoom?: string;

  /**
   * Last seen timestamp
   */
  lastSeen: string;

  /**
   * Device info
   */
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
  };

  /**
   * Activity description
   */
  activity?: string;
}

/**
 * Presence update data
 */
export interface PresenceUpdate {
  status: PresenceStatus;
  activity?: string;
  currentRoom?: string;
}

// ============================================================================
// WebRTC Signaling Types
// ============================================================================

/**
 * WebRTC signaling message types
 */
export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate' | 'end';

/**
 * WebRTC offer data
 */
export interface WebRTCOffer {
  /**
   * Target user ID
   */
  targetUserId: string;

  /**
   * Caller user ID
   */
  callerId: string;

  /**
   * Session ID
   */
  sessionId: string;

  /**
   * SDP offer
   */
  sdp: RTCSessionDescriptionInit;

  /**
   * Media types
   */
  media: {
    audio: boolean;
    video: boolean;
    screen: boolean;
  };

  /**
   * Call type
   */
  callType: 'audio' | 'video' | 'screen';
}

/**
 * WebRTC answer data
 */
export interface WebRTCAnswer {
  /**
   * Target user ID (caller)
   */
  targetUserId: string;

  /**
   * Answerer user ID
   */
  answererId: string;

  /**
   * Session ID
   */
  sessionId: string;

  /**
   * SDP answer
   */
  sdp: RTCSessionDescriptionInit;
}

/**
 * ICE candidate data
 */
export interface IceCandidate {
  /**
   * Target user ID
   */
  targetUserId: string;

  /**
   * Session ID
   */
  sessionId: string;

  /**
   * ICE candidate
   */
  candidate: RTCIceCandidateInit;
}

// ============================================================================
// Hand Raise & Reactions
// ============================================================================

/**
 * Hand raise state
 */
export interface HandRaise {
  /**
   * User ID
   */
  userId: string;

  /**
   * User name
   */
  userName: string;

  /**
   * Raised at timestamp
   */
  raisedAt: string;

  /**
   * Lowered at timestamp
   */
  loweredAt?: string;

  /**
   * Is currently raised
   */
  active: boolean;
}

/**
 * Reaction types
 */
export type ReactionType =
  | 'thumbs_up'
  | 'thumbs_down'
  | 'clap'
  | 'heart'
  | 'laugh'
  | 'surprised'
  | 'thinking'
  | 'confused';

/**
 * Reaction event
 */
export interface Reaction {
  /**
   * User ID
   */
  userId: string;

  /**
   * User name
   */
  userName: string;

  /**
   * Reaction type
   */
  type: ReactionType;

  /**
   * Timestamp
   */
  timestamp: string;
}

// ============================================================================
// Poll Types
// ============================================================================

/**
 * Poll
 */
export interface Poll {
  /**
   * Poll ID
   */
  id: string;

  /**
   * Room ID
   */
  roomId: string;

  /**
   * Poll question
   */
  question: string;

  /**
   * Poll options
   */
  options: PollOption[];

  /**
   * Poll type
   */
  type: 'single' | 'multiple';

  /**
   * Is anonymous
   */
  anonymous: boolean;

  /**
   * Created by user ID
   */
  createdBy: string;

  /**
   * Active state
   */
  active: boolean;

  /**
   * Created at
   */
  createdAt: string;

  /**
   * Ended at
   */
  endedAt?: string;
}

/**
 * Poll option
 */
export interface PollOption {
  /**
   * Option ID
   */
  id: string;

  /**
   * Option text
   */
  text: string;

  /**
   * Vote count
   */
  votes: number;

  /**
   * Voting user IDs (if not anonymous)
   */
  voterIds?: string[];
}

// ============================================================================
// Recording Types
// ============================================================================

/**
 * Recording session
 */
export interface RecordingSession {
  /**
   * Recording ID
   */
  id: string;

  /**
   * Room ID
   */
  roomId: string;

  /**
   * Started by user ID
   */
  startedBy: string;

  /**
   * Recording format
   */
  format: 'video' | 'audio' | 'slides';

  /**
   * Recording state
   */
  state: 'starting' | 'recording' | 'paused' | 'stopped' | 'failed';

  /**
   * Started at
   */
  startedAt: string;

  /**
   * Ended at
   */
  endedAt?: string;

  /**
   * Duration in seconds
   */
  duration?: number;

  /**
   * R2 storage key
   */
  storageKey?: string;

  /**
   * File size in bytes
   */
  fileSize?: number;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for real-time system
 */
export interface Env {
  // Durable Object for room state
  ROOM_DO: DurableObjectNamespace;

  // D1 Database for persistence
  DB: D1Database;

  // R2 for recording storage
  RECORDINGS: R2Bucket;

  // KV for presence cache
  PRESENCE_CACHE: KVNamespace;

  // WebSocket message queue (optional)
  WS_QUEUE?: Queue;
}
