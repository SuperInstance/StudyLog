# MCP (Model Context Protocol) Integration

Model Context Protocol client and router for StudyLoG.AI agents.

## Overview

MCP (Model Context Protocol) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. This implementation provides:

- **MCP Client**: Connect to MCP servers, call tools, query resources
- **MCP Router**: Intelligent tool selection based on intent, cost, and availability
- **Common MCP Server Integrations**: Pre-configured support for popular MCP servers
- **G-Assist Integration**: Agents can use MCP tools through the G-Assist API

## Architecture

```
StudyLoG Agent → G-Assist API → MCP Router → MCP Client → External MCP Server
                                                          ↓
                                                    Tool Execution
                                                          ↓
                                                    Result + Cost Metadata
                                                          ↓
Agent receives structured result with context
```

## Directory Structure

```
backend/workers/
├── mcp-client/
│   ├── types.ts           # MCP protocol types (2025-11-25 spec)
│   ├── client.ts          # MCP client implementation
│   ├── servers/
│   │   ├── index.ts       # Pre-configured server integrations
│   │   └── tools.ts       # Type-safe tool wrappers
│   └── README.md          # This file
└── mcp-router/
    ├── types.ts           # Router types
    └── index.ts           # Router implementation with tool selection
```

## Features

### MCP Client (`mcp-client/client.ts`)

- **Multi-transport support**: HTTP, WebSocket, stdio (where available)
- **Tool discovery**: Query all connected servers for available tools
- **Tool execution**: Call tools with timeout protection and error handling
- **Cost tracking**: Estimate and track costs for each tool call

### MCP Router (`mcp-router/index.ts`)

- **Intent classification**: Classify user queries to map to tools
- **Tool selection**: Score tools by relevance, cost, performance, reliability
- **Budget enforcement**: Per-user/per-session cost limits
- **Health monitoring**: Track server health and error rates

### Common Server Integrations (`mcp-client/servers/`)

| Server | Type | Cost Category | Description |
|--------|------|---------------|-------------|
| Brave Search | Search | Low | Web search with privacy focus |
| Serper | Search | Low | Google Search via API |
| PostgreSQL | Database | Low | SQL database access |
| MySQL | Database | Low | SQL database access |
| SQLite | Database | Free | Local file-based database |
| Filesystem | Files | Free | Local file access |
| GitHub | DevTools | Medium | Repository operations |
| Memory | State | Free | In-memory key-value store |
| Sequential Thinking | Prompts | Medium | Multi-step reasoning |

## Usage

### Basic Client Usage

```typescript
import { createMCPClient } from './mcp-client';

const client = createMCPClient(
  ['brave-search', 'filesystem'],  // Pre-configured servers
  [],                               // No custom servers
  {
    logging: true,
    costTracking: true,
    defaultTimeout: 30000,
  }
);

// Connect to all servers
await client.connectAll();

// Get all available tools
const tools = await client.getAllTools();
console.log('Available tools:', tools);

// Call a tool
const result = await client.callTool('brave-search', 'search', {
  query: 'latest AI news',
  count: 5,
});

console.log('Search results:', result.content);
console.log('Cost:', result._cost);
```

### Type-Safe Tool Wrappers

```typescript
import { braveSearch, readFile, createGitHubIssue } from './mcp-client/servers/tools';

// Web search
const searchResults = await braveSearch(client, {
  query: 'TypeScript best practices',
  count: 10,
});

// Read file
const fileContents = await readFile(client, {
  path: 'src/index.ts',
});

// Create GitHub issue
const issue = await createGitHubIssue(client, {
  owner: 'studylog',
  repo: 'studylog-github',
  title: 'Bug: memory leak in MCP client',
  body: 'Detailed description...',
});
```

### Router Usage

```typescript
import { MCPClient } from './mcp-client';
import { MCPRouter } from './mcp-router';

const client = new MCPClient({ servers: [...] });
await client.connectAll();

const router = new MCPRouter(client, {
  defaultTimeout: 30000,
  maxRetries: 3,
  logging: true,
  costTracking: true,
  maxSessionBudget: 1.0,  // $1.00 per session
  maxCostCategory: 'medium',
});

// Route a request to the best tool
const response = await router.route({
  query: 'search for latest AI news',
  agentId: 'teacher',
  userId: 'user123',
  userTier: 'forge',
});

console.log('Tool used:', response.toolName);
console.log('Result:', response.data);
console.log('Cost:', response.actualCost);
```

## G-Assist API Integration

Agents can call MCP tools through the G-Assist API:

```typescript
// Agent requests web search
const response = await fetch('/g-assist-api/mcp/tools/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'search for latest AI news',
    agentId: 'teacher',
    userId: 'user123',
    userTier: 'forge',
  }),
});

const result = await response.json();
```

### G-Assist MCP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp/tools/call` | POST | Route and execute a tool call |
| `/mcp/tools` | GET | List available tools |
| `/mcp/servers` | GET | Get server status |
| `/mcp/costs/:userId` | GET | Get session costs |

## Cost Implications

### Token Usage

MCP tool results become input tokens for subsequent LLM calls:

- **Search results**: ~1000 tokens for 10 results
- **File reads**: ~250 tokens per 1KB
- **Database queries**: ~50 tokens per row
- **GitHub operations**: ~500 tokens typical

### Network Latency

Each MCP call adds round-trip time:

- **HTTP/WebSocket**: 50-500ms typical
- **stdio (local)**: 10-50ms
- **Cache hits**: <5ms

### Direct API Costs

Some MCP servers charge for access:

- **Serper**: ~$0.002 per search query
- **Brave Search**: Free tier available
- **GitHub**: Free (5,000 requests/hour authenticated)
- **Database**: Free (self-hosted)

### Cost Tracking

The router tracks:
- Total cost per session
- Total tokens used
- Tool call counts
- Server call counts
- Cost by category

## Configuration

### Environment Variables

```bash
# MCP Router (for G-Assist integration)
MCP_ROUTER_URL=https://mcp-router.workers.dev

# MCP Server API Keys
BRAVE_API_KEY=your_brave_api_key
SERPER_API_KEY=your_serper_api_key
GITHUB_TOKEN=your_github_token

# Database connections
DATABASE_URL=postgresql://user:password@host:port/database
MYSQL_CONNECTION_STRING=mysql://user:password@host:port/database
SQLITE_FILE_PATH=./database.sqlite

# Filesystem access
FILESYSTEM_ROOT=/allowed/path
```

### Wrangler Configuration

```toml
# wrangler.toml

[vars]
MCP_ROUTER_URL = "https://mcp-router.workers.dev"

[env.production.vars]
MCP_ROUTER_URL = "https://mcp-router.production.workers.dev"

[[env.production.kv_namespaces]]
binding = "MCP_CACHE"
id = "your_kv_namespace_id"
```

## Tool Selection Strategy

Tools are scored based on four factors:

1. **Intent Match** (0-0.8): Semantic similarity to user intent
2. **Cost Score** (0-0.2): Inverse of direct and token costs
3. **Performance Score** (0-0.2): Inverse of latency
4. **Reliability Score** (0-0.1): Inverse of error rate

The highest-scoring tool within budget constraints is selected.

## Security Considerations

- **User Consent**: All tool calls should require user consent
- **Data Privacy**: Tool results may contain sensitive data
- **Rate Limiting**: Implement rate limits for paid APIs
- **Input Validation**: Validate all tool parameters
- **Filesystem Bounds**: File access is restricted to configured root path

## References

- [MCP Specification](https://modelcontextprotocol.io/specification/2025-11-25)
- [MCP GitHub](https://github.com/modelcontextprotocol)
- [MCP Servers](https://github.com/modelcontextprotocol/servers)

## License

MIT
