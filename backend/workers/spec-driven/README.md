# Spec-Driven Development Worker

**Agent 1/3** - Spec-Driven Development System for StudyLoG.AI's AI-native IDE.

## Overview

Implements OpenHands/Devin patterns for educational coding. Takes natural language specifications and generates code, tests, and documentation with autonomous self-healing.

## Architecture

```
Natural Language Spec
         |
         v
+------------------+
|   Spec Parser    |  Extract requirements, components, data structures
+------------------+
         |
         v
+------------------+
|   Task Planner   |  Break into executable tasks with dependencies
+------------------+
         |
         v
+------------------+
|  Code Generator  |  Generate code using templates + AI
+------------------+
         |
         v
+------------------+
|  Test Generator  |  Generate comprehensive test suites
+------------------+
         |
         v
+------------------+
| Self-Healing     |  <--- Test-Fix-Repeat Loop
+------------------+
```

## Files

| File | Purpose |
|------|---------|
| `spec-parser.ts` | Parse natural language specs into structured requirements |
| `task-planner.ts` | Break specs into executable tasks with dependencies |
| `code-generator.ts` | Generate code from specs (templates + AI) |
| `test-generator.ts` | Generate comprehensive tests from specs |
| `self-healing.ts` | Test-fix-repeat loop for autonomous improvement |
| `index.ts` | Main entry point with API handlers |

## API Endpoints

### POST /api/v1/spec-driven/parse
Parse a natural language specification.

```json
{
  "spec": "Create a button component with variant prop (primary, secondary) that accepts onClick handler",
  "options": {
    "qualityLevel": "production",
    "language": "typescript",
    "educational": true
  }
}
```

### POST /api/v1/spec-driven/plan
Create an execution plan from a spec.

### POST /api/v1/spec-driven/generate
Run the full pipeline: parse, plan, generate code, generate tests.

```json
{
  "spec": "Create a todo list component with add/remove functionality",
  "selfHealing": true
}
```

### POST /api/v1/spec-driven/generate/code
Generate code only (no tests).

### POST /api/v1/spec-driven/generate/tests
Generate tests only.

### POST /api/v1/spec-driven/heal
Start a self-healing session.

### GET /api/v1/spec-driven/session/:id
Get healing session status.

### DELETE /api/v1/spec-driven/session/:id
Cancel a healing session.

## Biological Agent Mapping

| Module | Biological Type | Role |
|--------|-----------------|------|
| Spec Parser | ZOOPLANKTON | Token-level pattern matching |
| Task Planner | CAPTAIN | Orchestrates task breakdown |
| Code Generator | DECKHAND | Quick template-based generation |
| Code Generator (AI mode) | WHALE | Full AI-powered generation |
| Test Generator | TESTER | Test specialist |
| Self-Healing | CAPTAIN | Orchestrates fix loop |

## Example Usage

```typescript
import { specDriven } from './spec-driven/src/index.js';

// Simple API
const result = await specDriven(`
  Create a user profile card component with:
  - Avatar image
  - Name (required)
  - Bio (optional, max 200 chars)
  - Follow button that emits onFollow event
`, {
  educational: true,
  selfHealing: true
});

console.log(result.files);  // Generated files
console.log(result.tests);  // Generated test suites
console.log(result.healingSession);  // Session ID for tracking
```

## Work Ratio Transparency

Every generated file includes:
- AI work ratio (0-1): How much was AI-generated vs template-based
- Quality score (0-1): Estimated code quality
- Source tracking: Which agent/worker generated the code

## Educational Features

When `educational: true` is enabled:
- Comments explain why patterns are used
- Links to documentation for concepts
- Progressive disclosure (simple patterns before complex ones)
- Best practice suggestions

## Self-Healing Loop

1. Generate code from spec
2. Run tests
3. Analyze failures
4. Generate fixes (categorized by type)
5. Apply fixes
6. Repeat until all tests pass or max iterations reached

## Fix Types

| Type | Description | Example |
|------|-------------|---------|
| SYNTAX | Syntax errors | Missing brackets, quotes |
| IMPORT | Missing imports | `Cannot find module` |
| TYPE | Type errors | Wrong prop types |
| LOGIC | Logic errors | Incorrect conditions |
| ASYNC | Async issues | Missing await |
| NULL_CHECK | Null/undefined | Optional chaining needed |
