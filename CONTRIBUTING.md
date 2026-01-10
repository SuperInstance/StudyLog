# Contributing to StudyLoG.AI

Thank you for your interest in contributing to StudyLoG.AI! This document provides guidelines and instructions for contributing to the project.

---

## Code of Conduct

### Our Pledge

We are committed to making participation in StudyLoG.AI a harassment-free experience for everyone, regardless of level of experience, gender, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, or personal/political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Any other conduct which could reasonably be considered inappropriate

### Reporting Issues

If you experience or witness unacceptable behavior, please contact the project team at [conduct@studylog.ai](mailto:conduct@studylog.ai). All reports will be reviewed and investigated.

---

## Development Setup

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0
- **Git** for version control
- **Godot** 4.3+ (optional, for simulation development)

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/studylog.git
cd studylog

# 3. Install dependencies
pnpm install

# 4. Create a branch for your work
git checkout -b feature/your-feature-name
```

### Development Workflow

```bash
# Start development servers
pnpm dev

# Run type checking
pnpm typecheck

# Run linter
pnpm lint

# Run tests
pnpm test

# Build the project
pnpm build
```

### Working on Specific Packages

```bash
# Work on a Theia extension
pnpm dev --filter=@studylog/si-gassist

# Work on a backend worker
pnpm dev --filter=@studylog/multi-model-router

# Build specific package
pnpm build --filter=@studylog/si-bazaar
```

---

## Pull Request Process

### Before Creating a Pull Request

1. **Search for existing PRs** - Check if someone else is already working on something similar
2. **Create an issue** (if none exists) - Discuss your plans with the team
3. **Branch naming** - Use descriptive branch names:
   - `feature/` - New features
   - `fix/` - Bug fixes
   - `docs/` - Documentation changes
   - `refactor/` - Code refactoring
   - `test/` - Adding or updating tests

### Creating a Pull Request

1. Update your branch with the latest main:
   ```bash
   git checkout main
   git pull upstream main
   git checkout feature/your-feature-name
   git rebase main
   ```

2. Commit your changes with clear messages:
   ```bash
   git add .
   git commit -m "feat: add voice input to G-Assist widget"
   ```

3. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Create a pull request on GitHub with:
   - Clear title describing the change
   - Detailed description of what you changed and why
   - Links to related issues
   - Screenshots for UI changes (if applicable)

### Pull Request Template

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issue
Fixes #123

## Testing
Describe the testing performed:
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing performed

## Screenshots (if applicable)
Attach screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review performed
- [ ] Documentation updated
- [ ] No new warnings generated
```

---

## Coding Standards

### TypeScript

- Use **TypeScript 5.7+** strict mode
- Avoid `any` types - use proper typing or `unknown`
- Use interfaces for public APIs, types for internal
- Prefer `const` and `let` over `var`
- Use arrow functions for callbacks
- Add JSDoc comments for exported functions

```typescript
// Good
export interface GAssistAgent {
  id: string;
  name: string;
  icon: string;
}

/**
 * Routes a query to the appropriate agent
 * @param query - User's input query
 * @param context - Current IDE context
 * @returns Route decision with agent and provider
 */
export async function route(
  query: string,
  context: IDEContext
): Promise<RouteDecision> {
  // Implementation
}

// Avoid
export function route(query: any, context: any): any {
  // Don't do this
}
```

### React Components

- Use functional components with hooks
- Follow the Rules of Hooks
- Use TypeScript for props
- Keep components small and focused
- Use meaningful component names

```typescript
// Good
interface GAssistWidgetProps {
  agent: GAssistAgent;
  onRouteChange: (route: RouteDecision) => void;
}

export const GAssistWidget: React.FC<GAssistWidgetProps> = ({
  agent,
  onRouteChange,
}) => {
  // Implementation
};
```

### File Naming

- **Components**: PascalCase (e.g., `GAssistWidget.tsx`)
- **Utilities**: kebab-case (e.g., `route-helper.ts`)
- **Services**: kebab-case with `-service` suffix (e.g., `gassist-frontend-service.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_ENDPOINTS.ts`)
- **Types**: kebab-case with `-types` suffix (e.g., `agent-types.ts`)

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Use **semicolons**
- Maximum line length: **100 characters**
- One blank line between functions

---

## Testing Requirements

### Unit Tests

Write unit tests for:
- Utility functions
- Service methods
- Complex logic
- Edge cases

```typescript
import { describe, it, expect } from 'vitest';
import { classifyIntent } from './intent-classifier';

describe('classifyIntent', () => {
  it('should classify code-related queries as code-help', () => {
    const result = classifyIntent('How do I fix this syntax error?');
    expect(result.intent).toBe('code-help');
  });

  it('should return general intent for unknown queries', () => {
    const result = classifyIntent('xyzabc');
    expect(result.intent).toBe('general');
  });
});
```

### Integration Tests

Write integration tests for:
- API endpoints
- Worker routes
- Database operations
- Cross-component interactions

### Test Coverage

- Aim for **80%+ code coverage**
- All public APIs should have tests
- Critical paths must have tests
- Run tests before committing: `pnpm test`

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests for specific package
pnpm test --filter=@studylog/si-gassist

# Generate coverage report
pnpm test --coverage
```

---

## Documentation Requirements

### Code Documentation

- Document exported functions with JSDoc
- Add inline comments for complex logic
- Keep README files in each major directory
- Update COMPONENTS.md when adding new components

### Documentation Updates

When contributing, ensure you update:
- **README.md** - If changing user-facing behavior
- **COMPONENTS.md** - When adding new components
- **API_REFERENCE.md** - When changing API endpoints
- **ARCHITECTURE.md** - For significant architectural changes
- **ADR/** - Create new ADR for major decisions

### Writing Documentation

- Use clear, concise language
- Include code examples
- Add diagrams for complex flows (Mermaid)
- Update table of contents when adding sections
- Use relative links for internal references

---

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### Examples

```bash
feat(gassist): add voice input with MediaRecorder API
fix(router): handle missing provider fallback gracefully
docs(api): update authentication endpoint documentation
refactor(worker): extract common routing logic
test(bazaar): add fork creation tests
```

---

## Release Process

Releases are managed by the maintainers. Contributors should:

1. Ensure all tests pass
2. Update documentation
3. Add CHANGELOG entries for significant changes
4. Tag issues and PRs with the target version

---

## Getting Help

### Resources

- [Documentation Index](docs/INDEX.md) - Complete documentation
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues
- [Architecture Decisions](docs/adr/) - Design rationale

### Communication

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and ideas
- **Discord** - Real-time chat (link in README)

---

## Recognition

Contributors will be:
- Listed in the CONTRIBUTORS.md file
- Credited in release notes
- Eligible for community Grain tokens (when Bazaar launches)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Remember**: Every layer is a mill. Every agent is a millwright. Every user graduates to building mills.

Thank you for contributing to StudyLoG.AI!
