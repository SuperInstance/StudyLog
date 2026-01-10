# StudyLoG.AI Troubleshooting Guide

Common issues and solutions for StudyLoG.AI deployment and development.

## Table of Contents

1. [Build Errors](#build-errors)
2. [Runtime Errors](#runtime-errors)
3. [Voice/STT Issues](#voicestt-issues)
4. [TTS Issues](#tts-issues)
5. [Cost Tracking Issues](#cost-tracking-issues)
6. [Performance Issues](#performance-issues)
7. [Database Issues](#database-issues)

---

## Build Errors

### TypeScript Compilation Errors

#### Error: Cannot find module '@cloudflare/workers-types'

```bash
# Solution: Install missing types
pnpm add -D @cloudflare/workers-types

# Or reinstall all dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Error: Property 'AI' does not exist on type 'Env'

**Cause:** Missing type definition for Workers AI binding.

**Solution:** Update `wrangler.toml` to include AI binding:

```toml
[ai]
binding = "AI"
```

Then rebuild:

```bash
wrangler publish --dev
```

#### Error: Type 'X' is not assignable to type 'Y'

**Cause:** Type mismatch in request/response handlers.

**Solution:** Check type definitions in `backend/workers/types.ts`:

```typescript
// Ensure Env interface includes all bindings
export interface Env {
  AI: Ai;
  STUDENT_STATE: D1Database;
  CACHE: KVNamespace;
  // ... add missing bindings
}
```

### Dependency Resolution Errors

#### Error: Cannot resolve entry point

```bash
# Verify main entry point in wrangler.toml
[build]
command = "npm run build"
main = "workers/index.ts"

# Check file exists and is correct
ls -la backend/workers/index.ts
```

#### Error: Module not found:itty-router

```bash
# Install dependency in specific worker directory
cd backend/workers/first-mile-router
pnpm add itty-router

# Or install as workspace dependency
cd ../..
pnpm add -w itty-router
```

### Wrangler Build Failures

#### Error: Too many files for upload

**Cause:** Node_modules being bundled incorrectly.

**Solution:** Update `wrangler.toml`:

```toml
[build]
command = "pnpm build"

[build.upload]
format = "modules"
main = "./dist/index.js"

# Exclude unnecessary files
rules = [
  { type = "ESModule", globs = ["**/*.js"], fallthrough = true }
]
```

#### Error: Compatibility date is too old

```toml
# Update compatibility date
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

---

## Runtime Errors

### Worker Invocation Errors

#### Error: Worker returned error: 500 Internal Server Error

**Diagnosis:**

```bash
# Tail logs to see actual error
wrangler tail <worker-name>

# Check for unhandled exceptions
grep -r "throw new Error" backend/workers/
```

**Common causes:**
1. Missing environment variable
2. Uncaught exception in handler
3. Timeout (50ms CPU limit exceeded)

**Solution:** Add error boundaries:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await handleRequest(request, env, ctx);
    } catch (error) {
      console.error('Handler error:', error);
      return new Response(
        JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }
};
```

### D1 Query Errors

#### Error: D1_ERROR: no such table

**Cause:** Migration not run or database not created.

**Solution:**

```bash
# Check database exists
wrangler d1 list

# Run migrations
wrangler d1 execute studylog-students --local --file=./backend/d1/schema.sql
wrangler d1 execute studylog-students --file=./backend/d1/schema.sql

# Verify tables created
wrangler d1 execute studylog-students --command "SELECT name FROM sqlite_master WHERE type='table'"
```

#### Error: D1_ERROR: prepared statement schema mismatch

**Cause:** Number of bind parameters doesn't match query.

**Solution:** Check bind calls:

```typescript
// WRONG
await env.STUDENT_STATE.prepare(
  'SELECT * FROM students WHERE email = ?'
).bind().first();  // Missing bind value

// CORRECT
await env.STUDENT_STATE.prepare(
  'SELECT * FROM students WHERE email = ?'
).bind(email).first();
```

### KV Namespace Errors

#### Error: Unknown KV namespace

**Cause:** KV namespace not created or binding missing.

**Solution:**

```bash
# List KV namespaces
wrangler kv:namespace list

# Create missing namespace
wrangler kv:namespace create "CACHE"

# Update wrangler.toml with correct ID
[[kv_namespaces]]
binding = "CACHE"
id = "actual-namespace-id"
```

### Authentication Errors

#### Error: 401 Unauthorized

**Diagnosis:**

```bash
# Check if token exists
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-worker.workers.dev/api/v1/auth/me
```

**Solution:** Verify session cache:

```bash
# Check KV for session
wrangler kv:key get "session:YOUR_TOKEN" --namespace-id=SESSION_CACHE_ID

# Check session TTL (default 7 days)
```

#### Error: 429 Rate Limited

**Solution:** Check rate limit configuration:

```toml
[vars]
RATE_LIMIT_REQUESTS = "100"
RATE_LIMIT_WINDOW = "60"
```

Or clear rate limit for testing:

```bash
wrangler kv:key delete "rate:YOUR_IP" --namespace-id=RATE_LIMITS_ID
```

---

## Voice/STT Issues

### Browser Permission Errors

#### Error: Permission denied for microphone access

**Cause:** Browser blocking microphone or serving over HTTP.

**Solution:**

1. Serve over HTTPS (required for microphone access)
2. Check browser permissions
3. Test on localhost (HTTPS not required)

```typescript
// Request permission explicitly
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    // Permission granted
  })
  .catch(error => {
    console.error('Microphone access denied:', error);
  });
```

#### Error: Could not start audio source

**Cause:** No microphone or device in use by another application.

**Solution:**

```javascript
// List available devices
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    console.log('Available microphones:', audioInputs);
  });
```

### STT API Failures

#### Error: STT endpoint returns 500

**Diagnosis:**

```bash
# Test STT endpoint directly
curl -X POST https://g-assist-api.workers.dev/stt \
  -H "Content-Type: application/json" \
  -d '{"audio":"base64_encoded_audio","format":"wav"}'
```

**Solution:** STT is currently a stub. Implement actual transcription:

```typescript
// Options:
// 1. Use Cloudflare Workers AI (when available)
// 2. Use Whisper API via fetch
// 3. Use browser's Web Speech API (client-side)
```

### Audio Format Issues

#### Error: Unsupported audio format

**Supported formats:**
- WAV (16-bit PCM)
- MP3
- WebM (Opus codec)

**Solution:** Convert audio before sending:

```javascript
// Record in supported format
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus'
});
```

---

## TTS Issues

### Audio Playback Errors

#### Error: Failed to decode audio data

**Cause:** Invalid audio format or corrupted data.

**Solution:**

```javascript
// Validate audio before playing
async function validateAudio(audioData: ArrayBuffer) {
  try {
    const audioContext = new AudioContext();
    await audioContext.decodeAudioData(audioData);
    return true;
  } catch (error) {
    console.error('Invalid audio:', error);
    return false;
  }
}
```

#### Error: Audio play() failed

**Cause:** Browser autoplay policies require user interaction.

**Solution:**

```javascript
// Ensure audio plays after user gesture
button.addEventListener('click', async () => {
  const audio = new Audio(audioUrl);
  await audio.play();
});
```

### TTS API Failures

#### Error: TTS endpoint returns stub response

**Cause:** TTS is not implemented yet.

**Solution:** Use browser's Speech Synthesis API:

```javascript
function speakText(text: string, voice?: string) {
  const utterance = new SpeechSynthesisUtterance(text);

  if (voice) {
    const voices = speechSynthesis.getVoices();
    const selectedVoice = voices.find(v => v.name === voice);
    if (selectedVoice) utterance.voice = selectedVoice;
  }

  speechSynthesis.speak(utterance);
}
```

### Voice Availability

#### Error: No voices available

**Solution:** Wait for voices to load:

```javascript
let voicesLoaded = false;

function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesLoaded = true;
    console.log('Available voices:', voices.map(v => v.name));
  }
}

speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();
```

---

## Cost Tracking Issues

### Cascade Metrics Not Recording

#### Error: Cascade savings showing 0

**Diagnosis:**

```bash
# Check if cascading is enabled
curl https://multi-model-router.workers.dev/costs/cascade?userId=test
```

**Solution:** Enable cascading in wrangler.toml:

```toml
[vars]
CASCADING_ENABLED = "true"
FIRST_MILE_ROUTER_URL = "https://first-mile-router.workers.dev"
```

#### Error: cascade_savings table doesn't exist

**Solution:** Create the table:

```sql
CREATE TABLE IF NOT EXISTS cascade_savings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  recommended_provider TEXT NOT NULL,
  actual_provider TEXT NOT NULL,
  saved_cost REAL NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX idx_cascade_user ON cascade_savings(user_id, timestamp);
```

### Cost Data Not Persisting

#### Error: Costs endpoint returns empty

**Diagnosis:**

```bash
# Check if D1 binding exists
grep -A5 "\[d1_databases\]" backend/workers/multi-model-router/wrangler.toml

# Verify database ID is correct
```

**Solution:** Ensure D1 binding exists:

```toml
[[d1_databases]]
binding = "DB"
database_name = "multi-model-costs"
database_id = "your-database-id"
```

### Incorrect Cost Calculations

#### Error: Cost per token seems wrong

**Solution:** Check provider cost configuration:

```typescript
// In multi-model-router/index.ts
const PROVIDERS: Record<string, Provider> = {
  anthropic: {
    costPerMillion: 3,  // Update with actual pricing
  },
  openai: {
    costPerMillion: 5,  // Update with actual pricing
  },
  // ...
};
```

---

## Performance Issues

### High Latency

#### Symptom: API responses taking >2 seconds

**Diagnosis:**

```bash
# Measure response time
time curl https://your-worker.workers.dev/health

# Check for cold starts
for i in {1..10}; do time curl https://your-worker.workers.dev/health; done
```

**Solutions:**

1. **Enable caching:**

```typescript
// Cache responses in KV
const cacheKey = getCacheKey(request);
const cached = await env.CACHE.get(cacheKey);
if (cached) return new Response(cached);
```

2. **Optimize D1 queries:**

```sql
-- Add indexes for common queries
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_progress_student ON module_progress(student_id);
```

3. **Reduce payload size:**

```typescript
// Paginate results
const limit = parseInt(url.searchParams.get('limit') || '50');
const offset = parseInt(url.searchParams.get('offset') || '0');

const result = await db.prepare(
  'SELECT * FROM items LIMIT ? OFFSET ?'
).bind(limit, offset).all();
```

### Cold Start Issues

#### Symptom: First request after idle period is slow

**Solution:**

1. **Use cron triggers to keep workers warm:**

```toml
# In wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes
```

```typescript
// Add health check endpoint
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Keep worker warm
    await fetch('https://your-worker.workers.dev/health');
  }
};
```

2. **Enable smart placement:**

```toml
[placement]
mode = "smart"
```

### Memory Issues

#### Error: Exceeded memory limit

**Solution:**

1. **Stream large responses:**

```typescript
// Instead of loading all data
const largeData = await fetch(url).then(r => r.json());

// Stream the response
return new Response(stream);
```

2. **Clean up resources:**

```typescript
// Use waitUntil for background cleanup
ctx.waitUntil(cleanupOperation());
```

---

## Database Issues

### Connection Pool Exhaustion

#### Symptom: D1 queries timing out

**Solution:**

1. **Reduce query frequency:**

```typescript
// Batch queries
const ids = ['id1', 'id2', 'id3'];
const placeholders = ids.map(() => '?').join(',');
const result = await db.prepare(
  `SELECT * FROM items WHERE id IN (${placeholders})`
).bind(...ids).all();
```

2. **Use read replicas:** (Not available in D1, consider upgrading)

### Lock Contention

#### Symptom: Database locked errors

**Solution:**

1. **Use transactions carefully:**

```typescript
// Keep transactions short
await db.batch([
  db.prepare('INSERT INTO ...'),
  db.prepare('UPDATE ...'),
]);
```

2. **Retry on lock:**

```typescript
async function queryWithRetry(db: D1Database, sql: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await db.prepare(sql).all();
    } catch (error: any) {
      if (error.message.includes('database is locked') && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 100 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

### Query Performance

#### Symptom: Slow D1 queries

**Solution:**

1. **Add indexes:**

```sql
-- Before (slow)
SELECT * FROM puzzle_attempts WHERE student_id = 'xxx';

-- After (fast with index)
CREATE INDEX idx_attempts_student ON puzzle_attempts(student_id);
```

2. **Use EXPLAIN QUERY PLAN:**

```bash
wrangler d1 execute studylog-students --command "EXPLAIN QUERY PLAN SELECT * FROM students WHERE email = 'test@example.com'"
```

3. **Optimize JOINs:**

```sql
-- Ensure join columns are indexed
CREATE INDEX idx_progress_student ON module_progress(student_id);
CREATE INDEX idx_phases_student ON learner_phases(student_id);
```

---

## Getting Help

### Debug Mode

Enable detailed logging:

```toml
[vars]
LOG_LEVEL = "debug"
```

### Log Collection

```bash
# Collect logs for support
wrangler tail > worker-logs.txt

# Filter by error level
wrangler tail --format=pretty --status-error > errors.txt
```

### Useful Resources

- Cloudflare Workers Documentation: https://developers.cloudflare.com/workers/
- D1 Documentation: https://developers.cloudflare.com/d1/
- Theia Documentation: https://github.com/eclipse-theia/theia

### Issue Reporting

When reporting issues, include:
1. Worker name and version
2. Full error message
3. Steps to reproduce
4. Log output
5. Environment details (Node version, Wrangler version)
