# SmartCRDT Integration Guide

**StudyLoG.AI & DMLoG.AI Real-Time Collaboration**

Research and implementation guide for integrating CRDT-based real-time collaboration into SuperInstance products.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [SmartCRDT Research Findings](#smartcrdt-research-findings)
3. [CRDT Fundamentals](#crdt-fundamentals)
4. [Integration Architecture](#integration-architecture)
5. [StudyLoG.AI Use Cases](#studylogai-use-cases)
6. [DMLoG.AI Use Cases](#dmlogai-use-cases)
7. [Implementation Guide](#implementation-guide)
8. [API Reference](#api-reference)
9. [Performance Considerations](#performance-considerations)
10. [Security & Privacy](#security--privacy)

---

## Executive Summary

SmartCRDT (from Aequor Cognitive Orchestration Platform) provides production-ready CRDT implementations for real-time collaboration. This document extracts key patterns and provides integration paths for both StudyLoG.AI and DMLoG.AI.

### Key Benefits

- **Conflict-Free Replication**: Multiple users can edit simultaneously without merge conflicts
- **Offline-First**: Clients continue working during network disconnects
- **Automatic Convergence**: All replicas eventually reach consistent state
- **Presence Awareness**: Real-time cursors, typing indicators, user status
- **Scalable Architecture**: WebSocket-based with compression and batching

### Integration Scope

| Component | StudyLoG.AI | DMLoG.AI |
|-----------|-------------|----------|
| Document Sync | Collaborative code editing | Shared campaign notes |
| Presence | Tutor/student awareness | Party member awareness |
| Cursors | Code position tracking | Battle map tokens |
| Conflict Resolution | Auto-merge code changes | Turn order resolution |

---

## SmartCRDT Research Findings

### Repository Overview

**Repository**: https://github.com/SuperInstance/SmartCRDT
**Status**: Production-ready components
**Primary Package**: `@lsi/collaboration`

### Key Components Analyzed

#### 1. CRDTDocumentStore (`examples/collaboration/CRDTDocumentStore.ts`)

A TypeScript implementation of a state-based CRDT for text documents.

**Features**:
- Lamport clocks for operation ordering
- Operational transformation (OT) for concurrent edits
- Last-Writer-Wins (LWW) conflict resolution
- Causal ordering of operations
- Operation log with automatic trimming

**Core Interfaces**:

```typescript
interface DocumentOperation {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'replace';
  position: number;
  length: number;
  text?: string;
  timestamp: number;
  clock: number;
}

interface DocumentSnapshot {
  content: string;
  version: number;
  operations: DocumentOperation[];
  activeUsers: string[];
}
```

**Key Methods**:
- `insert(userId, position, text)` - Insert text at position
- `delete(userId, position, length)` - Delete text range
- `replace(userId, position, length, text)` - Replace text
- `applyRemote(operation)` - Apply operation from another replica
- `merge(remote)` - Merge state from another replica

#### 2. CollaborationServer (`examples/collaboration/CollaborationServer.ts`)

WebSocket server for real-time collaboration.

**Features**:
- Document operation broadcasting
- Presence awareness (online users)
- Cursor position sharing
- Automatic reconnection support
- Heartbeat-based connection health

**Message Types**:
- `operation` - Document edit operations
- `state` - Full document state snapshots
- `user_joined` / `user_left` - Presence events
- `cursor` - Cursor position updates
- `user_list` - Active users in document

#### 3. CollaborationClient (`examples/collaboration/CollaborationClient.ts`)

WebSocket client with automatic reconnection.

**Features**:
- Local CRDT state management
- Operation queue for offline mode
- Event-driven architecture
- Automatic reconnection with exponential backoff

#### 4. Presence System (`packages/collaboration/src/`)

Comprehensive presence awareness system.

**Files**:
- `types.ts` - Type definitions for presence
- `presence.ts` - User presence management
- `cursor.ts` - Cursor tracking and rendering
- `sync.ts` - CRDT synchronization protocol

**Features**:
- User status tracking (online, idle, offline, busy)
- Typing indicators
- Cursor position broadcasting
- Selection range sharing
- Activity timeout management

#### 5. Sync Protocol (`packages/collaboration/src/sync.ts`)

Advanced synchronization protocol for CRDT replication.

**Features**:
- Incremental sync (only changes since last version)
- Compression support (gzip, deflate, brotli, delta)
- Conflict detection and resolution
- Recovery from disconnects
- Automatic retries with exponential backoff

**Sync Message Types**:
```typescript
enum SyncMessageType {
  HANDSHAKE = 'handshake',
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
  OPERATIONS = 'operations',
  ACKNOWLEDGMENT = 'acknowledgment',
  SNAPSHOT = 'snapshot',
  HEARTBEAT = 'heartbeat',
  ERROR = 'error'
}
```

### Best Practices Identified

1. **Lamport Clocks**: Use for causal ordering of operations
2. **Operational Transformation**: Transform positions based on concurrent operations
3. **Last-Writer-Wins**: Simple conflict resolution using timestamps
4. **Heartbeat**: Keep connections alive and detect disconnects
5. **Compression**: Reduce bandwidth for large document updates
6. **Batching**: Group operations for efficiency
7. **Version Vectors**: Track causal relationships across replicas

---

## CRDT Fundamentals

### What is a CRDT?

A Conflict-Free Replicated Data Type (CRDT) is a data structure designed for collaborative editing where:
- Multiple replicas can be updated independently
- Updates can be applied in any order
- All replicas eventually converge to the same state
- No coordination is required during updates

### Key Concepts

#### Lamport Clocks

Logical clocks for ordering events in distributed systems:

```typescript
class LamportClock {
  private time: number = 0;

  tick(): number {
    return ++this.time;
  }

  merge(otherTime: number): number {
    this.time = Math.max(this.time, otherTime) + 1;
    return this.time;
  }
}
```

#### Operational Transformation

Transform operations based on concurrent operations to handle conflicts:

```typescript
// If user A inserts at position 5
// And user B inserts at position 3
// User A's operation must be transformed to position 6
```

#### Version Vectors

Track causal relationships across replicas:

```typescript
interface VersionVector {
  [replicaId: string]: number;
}
```

### CRDT Types

1. **State-Based CRDTs** (CvRDT)
   - Replicas exchange full state
   - Merge function: `state1 merge state2`
   - Example: LWW-Element-Set, G-Counter

2. **Operation-Based CRDTs** (CmRDT)
   - Replicas exchange operations
   - Operations must be delivered exactly-once and in order
   - Example: RGA (Replicated Growable Array)

**SmartCRDT uses hybrid approach**: State-based snapshots with operation-based incremental updates.

---

## Integration Architecture

### System Architecture

```
+-------------------+          +-------------------+          +-------------------+
|  StudyLoG Client  |          |  DMLoG Client     |          |  Mobile Client    |
|                   |          |                   |          |                   |
|  - CRDT Engine    |          |  - CRDT Engine    |          |  - CRDT Engine    |
|  - Presence       |          |  - Presence       |          |  - Presence       |
|  - Cursors        |          |  - Cursors        |          |  - Cursors        |
+---------+---------+          +---------+---------+          +---------+---------+
          |                              |                              |
          +------------------------------+------------------------------+
                                        |
                                        | WebSocket
                                        v
                        +-----------------------------------+
                        |     CRDT Sync Gateway              |
                        |                                   |
                        |  - Message routing                 |
                        |  - Presence broadcasting           |
                        |  - Conflict resolution             |
                        |  - Compression                     |
                        +----------------+------------------+
                                         |
                        +----------------+------------------+
                        |                |                  |
                        v                v                  v
            +---------------+  +---------------+  +---------------+
            | Document Store  |  | Presence Store |  | Snapshot Store|
            +---------------+  +---------------+  +---------------+
```

### Component Overview

| Component | Description | Location |
|-----------|-------------|----------|
| `crdt-engine.ts` | Core CRDT operations and data structures | `backend/workers/crdt-sync/` |
| `document-sync.ts` | Document state management and sync | `backend/workers/crdt-sync/` |
| `presence-awareness.ts` | User presence, cursors, typing indicators | `backend/workers/crdt-sync/` |
| `conflict-resolution.ts` | Merge strategies and conflict handling | `backend/workers/crdt-sync/` |
| `websocket-gateway.ts` | Real-time WebSocket server | `backend/workers/crdt-sync/` |
| `types.ts` | TypeScript type definitions | `backend/workers/crdt-sync/` |

---

## StudyLoG.AI Use Cases

### 1. Collaborative Coding Sessions

Multiple students can code together in real-time during tutorial sessions.

**Features**:
- Real-time code editing with syntax awareness
- Instructor can highlight code regions
- Student cursors visible to instructor
- Auto-save with version history

**Data Model**:
```typescript
interface CodeDocument {
  id: string;
  projectId: string;
  language: string;
  content: string;
  version: number;
  collaborators: UserPresence[];
}
```

### 2. AI Tutor Co-Presence

AI tutor and human student can simultaneously view and edit code.

**Features**:
- AI cursor shows what it's analyzing
- Highlight regions of interest
- Suggest edits with user acceptance
- Typing indicator when AI is generating

### 3. Code Review Sessions

Multiple reviewers can annotate code simultaneously.

**Features**:
- Line comments with presence
- Discussion threads per annotation
- Resolution tracking
- Mention notifications

---

## DMLoG.AI Use Cases

### 1. Shared Campaign Notes

Dungeon Master and players can collaboratively edit campaign notes.

**Features**:
- Rich text editing
- Image embedding
- Linking between notes
- Version history with rollback

### 2. Live Battle Maps

Multiple players can move tokens simultaneously during combat.

**Data Model**:
```typescript
interface BattleMap {
  id: string;
  sessionId: string;
  tokens: Map<string, Token>;
  terrain: GridCell[][];
  effects: AreaEffect[];
  version: number;
}

interface Token {
  id: string;
  characterId: string;
  position: { x: number; y: number };
  lastMovedBy: string;
}
```

**Conflict Resolution**:
- Token movement: Last-move-wins per token
- Overlapping positions: Stack tokens with z-order
- Turn order: CRDT-based initiative tracking

### 3. Character Sheet Sync

Player's character sheet syncs across devices and with DM.

**Features**:
- Real-time HP updates during combat
- Inventory changes visible to party
- Condition tracking with visibility
- Roll results shared with party

---

## Implementation Guide

### Installation

```bash
# Install dependencies
pnpm add ws @types/ws

# For frontend (if using React)
pnpm add react-use-websocket
```

### Quick Start

#### 1. Start the CRDT Sync Gateway

```typescript
import { CRDTGateway } from '@studylog/crdt-sync';

const gateway = new CRDTGateway({
  port: 8080,
  enableCompression: true,
  maxConnections: 100
});

await gateway.start();
```

#### 2. Connect from Client

```typescript
import { CRDTClient } from '@studylog/crdt-sync/client';

const client = new CRDTClient({
  gatewayUrl: 'ws://localhost:8080',
  userId: 'user-123',
  documentId: 'doc-456'
});

await client.connect();

// Edit document
client.insert(5, 'Hello, world!');

// Subscribe to changes
client.on('operation', (op) => {
  console.log('Remote operation:', op);
});
```

### Configuration

**Environment Variables**:

```env
# CRDT Sync Gateway
CRDT_GATEWAY_PORT=8080
CRDT_ENABLE_COMPRESSION=true
CRDT_MAX_MESSAGE_SIZE=1048576
CRDT_HEARTBEAT_INTERVAL=30000

# Presence
PRESENCE_IDLE_TIMEOUT=120000
PRESENCE_OFFLINE_TIMEOUT=300000

# Storage
CRDT_SNAPSHOT_INTERVAL=60000
CRDB_STORAGE_PATH=./data/crdt
```

---

## API Reference

### CRDTGateway

Main WebSocket gateway for real-time collaboration.

```typescript
class CRDTGateway {
  constructor(config: CRDTGatewayConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(documentId: string, message: SyncMessage): void;
  getStats(): GatewayStats;
}
```

### DocumentStore

CRDT document store for text content.

```typescript
class DocumentStore {
  constructor(initialContent: string);
  insert(userId: string, position: number, text: string): DocumentOperation;
  delete(userId: string, position: number, length: number): DocumentOperation;
  replace(userId: string, position: number, length: number, text: string): DocumentOperation;
  applyRemote(operation: DocumentOperation): DocumentOperation | null;
  merge(remote: DocumentStore): ConflictResolution;
  getContent(): string;
  getVersion(): number;
  getSnapshot(): DocumentSnapshot;
}
```

### PresenceManager

User presence and cursor tracking.

```typescript
class PresenceManager {
  constructor(options: PresenceManagerOptions);
  updateCursor(position: CursorPosition, selection?: SelectionRange): void;
  setTyping(isTyping: boolean): void;
  setDocument(documentId: string): void;
  updateRemoteUser(presence: UserPresence): void;
  getUsers(filter?: PresenceFilter): UserPresence[];
  onPresenceChange(observer: PresenceObserver): () => void;
}
```

### SyncProtocol

Advanced synchronization protocol.

```typescript
class SyncProtocol {
  constructor(replicaId: string, config?: Partial<SyncConfig>);
  connect(targetReplicaId: string): Promise<boolean>;
  syncSince(targetReplicaId: string, fromVersion: number, operations: DocumentOperation[]): Promise<SyncResponse>;
  requestSync(targetReplicaId: string, fromVersion: number): Promise<void>;
  sendSnapshot(targetReplicaId: string, snapshot: DocumentSnapshot): Promise<void>;
  handleMessage(message: SyncMessage): Promise<void>;
  getStats(): SyncStats;
}
```

---

## Performance Considerations

### Optimization Strategies

1. **Compression**
   - Enable gzip for large documents
   - Use delta encoding for incremental updates
   - Target: 70-90% compression ratio

2. **Batching**
   - Group operations into batches (default: 100 ops)
   - Reduce WebSocket message overhead
   - Balance between latency and throughput

3. **Snapshot Interval**
   - Full snapshots every 60 seconds
   - Prevents operation log from growing too large
   - Enables faster reconnection

4. **Operation Log Trimming**
   - Keep last 1000 operations
   - Older operations compacted into snapshots
   - Reduces memory footprint

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Operation Latency | <100ms | End-to-end |
| Sync Throughput | 1000 ops/sec | Per document |
| Memory per Document | <10MB | Including history |
| Compression Ratio | >70% | For text content |
| Reconnection Time | <2s | Resume editing |

### Scaling Considerations

**Single Gateway**:
- Up to 100 concurrent connections
- Up to 50 active documents
- Suitable for small classrooms

**Multi-Gateway** (Future):
- Horizontal scaling via Redis pub/sub
- Connection routing by document ID
- Shared presence across gateways

---

## Security & Privacy

### Security Considerations

1. **Authentication**
   - JWT-based user authentication
   - Document access control
   - Session validation on reconnect

2. **Authorization**
   - Per-document permissions
   - Role-based access (viewer, editor, owner)
   - Rate limiting per user

3. **Message Validation**
   - Validate operation positions
   - Sanitize inserted text
   - Limit message sizes

### Privacy Considerations

1. **Typing Indicators**
   - Don't share partial text (privacy)
   - Only share "is typing" boolean
   - Optional: character count only

2. **Cursor Positions**
   - Only share within same document
   - Allow users to hide cursor
   - Timeout idle cursors

3. **Data Residency**
   - Store snapshots in same region as users
   - Support data export
   - GDPR compliance

---

## Migration Strategy

### Phase 1: Basic Document Sync (Week 1-2)

- Implement CRDTDocumentStore
- WebSocket gateway for operation broadcast
- Basic client integration

### Phase 2: Presence & Cursors (Week 3-4)

- PresenceManager implementation
- Cursor tracking and rendering
- Typing indicators

### Phase 3: Advanced Features (Week 5-6)

- Compression and batching
- Conflict resolution UI
- Version history and rollback

### Phase 4: Production Hardening (Week 7-8)

- Security hardening
- Performance optimization
- Monitoring and alerting

---

## References

- **SmartCRDT Repository**: https://github.com/SuperInstance/SmartCRDT
- **CRDT Papers**: "A comprehensive study of Convergent and Commutative Replicated Data Types"
- **Yjs**: https://docs.yjs.dev/ - Alternative CRDT implementation
- **Automerge**: https://automerge.org/ - Another production-ready CRDT

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-10
**Author**: SmartCRDT Research Agent
