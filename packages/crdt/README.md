# @studylog/crdt

**Conflict-free Replicated Data Types for StudyLoG.AI real-time collaboration**

A comprehensive CRDT implementation for building offline-first, real-time collaborative applications.

## Features

- **G-Counter**: Grow-only counter for distributed metrics
- **PN-Counter**: Counter supporting increments and decrements
- **OR-Set**: Observed-remove set for collections
- **LWW-Register**: Last-writer-wins register for single values
- **Document**: Text document CRDT for collaborative editing
- **Vector Clock**: Causal ordering for distributed operations

## Installation

```bash
pnpm install @studylog/crdt
```

## Quick Start

### Counters

```typescript
import { GCounter, PNCounter } from '@studylog/crdt';

// G-Counter - can only increment
const counter1 = new GCounter('node1');
const counter2 = new GCounter('node2');

counter1.increment(5);
counter2.increment(3);

counter1.merge(counter2);
console.log(counter1.value()); // 8

// PN-Counter - can increment and decrement
const pnCounter = new PNCounter('node1');
pnCounter.increment(10);
pnCounter.decrement(3);
console.log(pnCounter.value()); // 7
```

### Sets

```typescript
import { ORSet } from '@studylog/crdt';

const set1 = new ORSet('node1');
const set2 = new ORSet('node2');

set1.add('item1');
set2.add('item2');

set1.merge(set2);
console.log(set1.values()); // ['item1', 'item2']

set1.remove('item1');
console.log(set1.has('item1')); // false
```

### Document Collaboration

```typescript
import { Document } from '@studylog/crdt';

// Create documents for two users
const doc1 = new Document('user1', 'Hello world');
const doc2 = new Document('user2', 'Hello world');

// User1 inserts text
const op1 = doc1.insert(5, ' beautiful');
console.log(doc1.getContent()); // 'Hello beautiful world'

// User2 inserts at same position (concurrently)
const op2 = doc2.insert(5, ' amazing');
console.log(doc2.getContent()); // 'Hello amazing world'

// Merge - operations transform automatically
doc1.merge(doc2);
console.log(doc1.getContent()); // Both edits preserved
```

### Document Store

```typescript
import { DocumentStore } from '@studylog/crdt';

// Get or create a document
const doc = DocumentStore.get('doc-123', 'server');

// Set initial content
doc.setContent('Initial content');

// Another user joins
const userDoc = DocumentStore.get('doc-123', 'user-1');

// Apply remote operation
const op = userDoc.insert(7, ' text');
doc.applyRemote(op);

// Both documents are now in sync
console.log(doc.getContent()); // 'Initial content text'
```

## Architecture

### CRDT Properties

All CRDTs in this package guarantee:

- **Commutative**: `a.merge(b) === b.merge(a)`
- **Associative**: `a.merge(b).merge(c) === a.merge(b.merge(c))`
- **Idempotent**: `a.merge(a) === a`

### Operational Transformation

The Document CRDT uses operational transformation to handle concurrent edits:

```typescript
// Two users edit at the same position
const doc1 = new Document('user1', 'Hello world');
const doc2 = new Document('user2', 'Hello world');

// Both insert at position 5
doc1.insert(5, ' beautiful');
doc2.insert(5, ' amazing');

// Merge automatically transforms positions
doc1.merge(doc2);
// Result: Both insertions are preserved
```

### Vector Clocks

Lamport clocks provide causal ordering:

```typescript
import { VectorClock } from '@studylog/crdt';

const clock1 = new VectorClock('node1');
const clock2 = new VectorClock('node2');

clock1.tick(); // Local event
clock2.tick(); // Local event

// Merge clocks
clock1.merge(clock2.get());
console.log(clock1.get()); // 2
```

## Use Cases

### StudyLoG.AI

- **Real-time code collaboration**: Students work together on coding projects
- **Classroom sync**: Multi-player classroom sessions
- **Offline learning**: Download lessons, sync progress when reconnected
- **Progress tracking**: Conflict-free student progress across devices

### DMLoG.AI

- **Campaign collaboration**: DM and players co-create stories
- **Character sheets**: Real-time character updates
- **Battle maps**: Shared token manipulation
- **NPC memory**: Distributed knowledge across game sessions

## API Reference

### GCounter

| Method | Description |
|--------|-------------|
| `increment(amount?)` | Increment counter |
| `value()` | Get total value |
| `get(nodeId)` | Get value for specific node |
| `merge(other)` | Merge with another counter |
| `getState()` | Export state |
| `setState(state)` | Import state |

### PNCounter

| Method | Description |
|--------|-------------|
| `increment(amount?)` | Increment counter |
| `decrement(amount?)` | Decrement counter |
| `value()` | Get total value (positive - negative) |
| `merge(other)` | Merge with another counter |
| `getState()` | Export state |
| `setState(state)` | Import state |

### ORSet

| Method | Description |
|--------|-------------|
| `add(value)` | Add element |
| `remove(value)` | Remove element |
| `has(value)` | Check if element exists |
| `values()` | Get all elements |
| `size()` | Get element count |
| `merge(other)` | Merge with another set |
| `getState()` | Export state |
| `setState(state)` | Import state |

### LWWRegister

| Method | Description |
|--------|-------------|
| `set(value)` | Set value |
| `get()` | Get current value |
| `getTimestamp()` | Get value timestamp |
| `merge(other)` | Merge with another register |
| `getState()` | Export state |
| `setState(state)` | Import state |

### Document

| Method | Description |
|--------|-------------|
| `insert(pos, text)` | Insert text |
| `delete(pos, length)` | Delete text |
| `replace(pos, length, text)` | Replace text |
| `getContent()` | Get document content |
| `applyRemote(op)` | Apply remote operation |
| `merge(other)` | Merge with another document |
| `getSnapshot()` | Export snapshot |
| `loadSnapshot(snapshot)` | Import snapshot |

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Related Packages

- [@studylog/collab-client](../collab-client/) - WebSocket client for real-time sync
- [@studylog/classroom](../classroom/) - Classroom collaboration features
- [@studylog/dmlog-crdt](../dmlog-crdt/) - TTRPG-specific CRDT types
